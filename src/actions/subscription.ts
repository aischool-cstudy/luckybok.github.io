'use server';

/**
 * 구독 관련 Server Actions
 * - 구독 시작/취소
 * - 현재 구독 상태 조회
 */

import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTossClient, PaymentError } from '@/lib/payment/toss';
import { generateOrderId, encryptBillingKey } from '@/lib/payment/crypto';
import { plans } from '@/config/pricing';
import {
  prepareSubscriptionSchema,
  confirmSubscriptionSchema,
  cancelSubscriptionSchema,
  validateSubscriptionAmount,
  type PrepareSubscriptionInput,
  type ConfirmSubscriptionInput,
  type CancelSubscriptionInput,
} from '@/lib/validators/payment';
import type {
  ActionResponse,
  PrepareSubscriptionResponse,
  SubscriptionSummary,
  PlanType,
  BillingCycle,
} from '@/types/payment.types';

// ────────────────────────────────────────────────────────────
// 구독 시작 준비
// ────────────────────────────────────────────────────────────

export async function prepareSubscription(
  input: PrepareSubscriptionInput
): Promise<ActionResponse<PrepareSubscriptionResponse>> {
  try {
    // 입력값 검증
    const validated = prepareSubscriptionSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message || '입력값이 올바르지 않습니다',
      };
    }

    const { plan, billingCycle } = validated.data;

    // 인증 확인
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: '로그인이 필요합니다' };
    }

    // 사용자 프로필 조회
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('customer_key, plan')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, error: '사용자 정보를 찾을 수 없습니다' };
    }

    // 이미 같은 플랜 구독 중인지 확인
    if (profile.plan === plan) {
      return { success: false, error: '이미 해당 플랜을 구독 중입니다' };
    }

    // 활성 구독 있는지 확인
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (existingSubscription) {
      return { success: false, error: '이미 활성 구독이 있습니다. 먼저 기존 구독을 취소해주세요.' };
    }

    // 플랜 정보 조회
    const planConfig = plans[plan];
    if (!planConfig) {
      return { success: false, error: '존재하지 않는 플랜입니다' };
    }

    const amount = planConfig.price[billingCycle];
    const orderId = generateOrderId('SUB');

    // 결제 레코드 생성 (pending 상태)
    const adminClient = createAdminClient();
    const { error: insertError } = await adminClient.from('payments').insert({
      user_id: user.id,
      order_id: orderId,
      type: 'subscription',
      status: 'pending',
      amount,
      metadata: {
        planId: plan,
        billingCycle,
      },
    });

    if (insertError) {
      console.error('결제 레코드 생성 실패:', insertError);
      return { success: false, error: '구독 준비에 실패했습니다' };
    }

    return {
      success: true,
      data: {
        orderId,
        amount,
        orderName: `CodeGen AI ${planConfig.name} (${billingCycle === 'yearly' ? '연간' : '월간'})`,
        customerKey: profile.customer_key,
        plan,
        billingCycle,
      },
    };
  } catch (error) {
    console.error('prepareSubscription 오류:', error);
    return { success: false, error: '구독 준비에 실패했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 구독 확정 (빌링키 발급 + 첫 결제)
// ────────────────────────────────────────────────────────────

export async function confirmSubscription(
  input: ConfirmSubscriptionInput
): Promise<ActionResponse<{ subscriptionId: string }>> {
  try {
    // 입력값 검증
    const validated = confirmSubscriptionSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message || '입력값이 올바르지 않습니다',
      };
    }

    const { authKey, customerKey, orderId, plan, billingCycle } = validated.data;

    // 인증 확인
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: '로그인이 필요합니다' };
    }

    // 기존 결제 레코드 조회
    const adminClient = createAdminClient();
    const { data: payment, error: paymentError } = await adminClient
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', user.id)
      .single();

    if (paymentError || !payment) {
      return { success: false, error: '결제 정보를 찾을 수 없습니다' };
    }

    if (payment.status !== 'pending') {
      return { success: false, error: '이미 처리된 결제입니다' };
    }

    // 금액 검증
    const amountValidation = validateSubscriptionAmount(plan, billingCycle, payment.amount);
    if (!amountValidation.valid) {
      return { success: false, error: amountValidation.error };
    }

    const tossClient = getTossClient();

    // 1. 빌링키 발급
    let billingKeyResponse;
    try {
      billingKeyResponse = await tossClient.issueBillingKey(authKey, customerKey);
    } catch (error) {
      await adminClient
        .from('payments')
        .update({
          status: 'failed',
          failure_code: error instanceof PaymentError ? error.code : 'BILLING_KEY_ISSUE_FAILED',
          failure_reason: error instanceof Error ? error.message : '빌링키 발급 실패',
        })
        .eq('id', payment.id);

      return {
        success: false,
        error: error instanceof PaymentError ? error.message : '빌링키 발급에 실패했습니다',
      };
    }

    // 2. 빌링키 저장 (암호화)
    const encryptedBillingKey = encryptBillingKey(billingKeyResponse.billingKey);

    // 기존 빌링키 기본 설정 해제
    await adminClient
      .from('billing_keys')
      .update({ is_default: false })
      .eq('user_id', user.id);

    const { data: billingKeyRecord, error: billingKeyError } = await adminClient
      .from('billing_keys')
      .insert({
        user_id: user.id,
        customer_key: customerKey,
        encrypted_billing_key: encryptedBillingKey,
        card_company: billingKeyResponse.card.company,
        card_number: billingKeyResponse.card.number,
        card_type: billingKeyResponse.card.cardType,
        is_default: true,
      })
      .select('id')
      .single();

    if (billingKeyError || !billingKeyRecord) {
      console.error('빌링키 저장 실패:', billingKeyError);
      return { success: false, error: '결제 수단 등록에 실패했습니다' };
    }

    // 3. 첫 번째 결제 실행
    const planConfig = plans[plan];
    let chargeResponse;

    try {
      chargeResponse = await tossClient.chargeBilling(
        billingKeyResponse.billingKey,
        customerKey,
        payment.amount,
        orderId,
        `CodeGen AI ${planConfig.name} (${billingCycle === 'yearly' ? '연간' : '월간'})`
      );
    } catch (error) {
      await adminClient
        .from('payments')
        .update({
          status: 'failed',
          failure_code: error instanceof PaymentError ? error.code : 'CHARGE_FAILED',
          failure_reason: error instanceof Error ? error.message : '결제 실패',
        })
        .eq('id', payment.id);

      // 빌링키도 삭제
      await adminClient
        .from('billing_keys')
        .delete()
        .eq('id', billingKeyRecord.id);

      return {
        success: false,
        error: error instanceof PaymentError ? error.message : '결제에 실패했습니다',
      };
    }

    // 4. 결제 완료 처리
    await adminClient
      .from('payments')
      .update({
        status: 'completed',
        payment_key: chargeResponse.paymentKey,
        method: chargeResponse.method,
        receipt_url: chargeResponse.receipt?.url,
        paid_at: chargeResponse.approvedAt,
      })
      .eq('id', payment.id);

    // 5. 구독 레코드 생성
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const { data: subscription, error: subscriptionError } = await adminClient
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan,
        billing_cycle: billingCycle,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        billing_key_id: billingKeyRecord.id,
      })
      .select('id')
      .single();

    if (subscriptionError || !subscription) {
      console.error('구독 레코드 생성 실패:', subscriptionError);
      return { success: false, error: '구독 등록에 실패했습니다' };
    }

    // 6. 결제 메타데이터에 구독 ID 추가
    await adminClient
      .from('payments')
      .update({
        metadata: {
          ...payment.metadata as object,
          subscriptionId: subscription.id,
        },
      })
      .eq('id', payment.id);

    return {
      success: true,
      data: {
        subscriptionId: subscription.id,
      },
    };
  } catch (error) {
    console.error('confirmSubscription 오류:', error);
    return { success: false, error: '구독 처리에 실패했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 구독 취소
// ────────────────────────────────────────────────────────────

export async function cancelSubscription(
  input: CancelSubscriptionInput
): Promise<ActionResponse<{ canceledAt: Date; effectiveEndDate: Date }>> {
  try {
    // 입력값 검증
    const validated = cancelSubscriptionSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message || '입력값이 올바르지 않습니다',
      };
    }

    const { cancelImmediately } = validated.data;

    // 인증 확인
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: '로그인이 필요합니다' };
    }

    // 활성 구독 조회
    const adminClient = createAdminClient();
    const { data: subscription, error: subscriptionError } = await adminClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subscriptionError || !subscription) {
      return { success: false, error: '활성 구독을 찾을 수 없습니다' };
    }

    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);

    if (cancelImmediately) {
      // 즉시 취소: 구독 상태를 canceled로 변경하고 플랜을 starter로 변경
      await adminClient
        .from('subscriptions')
        .update({
          status: 'canceled',
          canceled_at: now.toISOString(),
        })
        .eq('id', subscription.id);

      // 프로필 업데이트 (starter로 변경)
      await adminClient
        .from('profiles')
        .update({
          plan: 'starter',
          plan_expires_at: null,
        })
        .eq('id', user.id);

      return {
        success: true,
        data: {
          canceledAt: now,
          effectiveEndDate: now,
        },
      };
    } else {
      // 기간 종료 시 취소: cancel_at_period_end를 true로 설정
      await adminClient
        .from('subscriptions')
        .update({
          cancel_at_period_end: true,
          canceled_at: now.toISOString(),
        })
        .eq('id', subscription.id);

      return {
        success: true,
        data: {
          canceledAt: now,
          effectiveEndDate: periodEnd,
        },
      };
    }
  } catch (error) {
    console.error('cancelSubscription 오류:', error);
    return { success: false, error: '구독 취소에 실패했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 현재 구독 조회
// ────────────────────────────────────────────────────────────

export async function getCurrentSubscription(): Promise<
  ActionResponse<SubscriptionSummary | null>
> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: '로그인이 필요합니다' };
    }

    // 구독 정보 조회
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*, billing_keys!billing_key_id(card_company, card_number)')
      .eq('user_id', user.id)
      .in('status', ['active', 'canceled'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!subscription) {
      return { success: true, data: null };
    }

    // 기간 종료 후 취소된 경우 null 반환
    if (subscription.status === 'canceled' && !subscription.cancel_at_period_end) {
      return { success: true, data: null };
    }

    const billingKey = subscription.billing_keys as { card_company: string; card_number: string } | null;

    const summary: SubscriptionSummary = {
      plan: subscription.plan as PlanType,
      status: subscription.status as 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused',
      currentPeriodEnd: new Date(subscription.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      cardInfo: billingKey
        ? {
            company: billingKey.card_company,
            lastFourDigits: billingKey.card_number.slice(-4),
          }
        : null,
    };

    return { success: true, data: summary };
  } catch (error) {
    console.error('getCurrentSubscription 오류:', error);
    return { success: false, error: '구독 정보 조회에 실패했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 구독 갱신 (cron job에서 호출)
// ────────────────────────────────────────────────────────────

export async function renewSubscription(
  subscriptionId: string
): Promise<ActionResponse<{ paymentId: string }>> {
  try {
    const adminClient = createAdminClient();

    // 구독 정보 조회
    const { data: subscription, error: subscriptionError } = await adminClient
      .from('subscriptions')
      .select('*, billing_keys!billing_key_id(*)')
      .eq('id', subscriptionId)
      .single();

    if (subscriptionError || !subscription) {
      return { success: false, error: '구독을 찾을 수 없습니다' };
    }

    if (subscription.status !== 'active') {
      return { success: false, error: '활성 상태의 구독만 갱신할 수 있습니다' };
    }

    // 취소 예정인 경우 갱신하지 않음
    if (subscription.cancel_at_period_end) {
      // 구독 상태를 canceled로 변경
      await adminClient
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('id', subscriptionId);

      // 프로필 업데이트
      await adminClient
        .from('profiles')
        .update({
          plan: 'starter',
          plan_expires_at: null,
        })
        .eq('id', subscription.user_id);

      return { success: false, error: '취소 예정인 구독입니다' };
    }

    const billingKey = subscription.billing_keys as {
      encrypted_billing_key: string;
      customer_key: string;
    } | null;

    if (!billingKey) {
      return { success: false, error: '결제 수단이 없습니다' };
    }

    // 빌링키 복호화
    const { decryptBillingKey } = await import('@/lib/payment/crypto');
    const decryptedBillingKey = decryptBillingKey(billingKey.encrypted_billing_key);

    // 플랜 정보
    const plan = subscription.plan as 'pro' | 'team' | 'enterprise';
    const billingCycle = subscription.billing_cycle as BillingCycle;
    const planConfig = plans[plan];
    const amount = planConfig.price[billingCycle];

    // 주문 ID 생성
    const orderId = generateOrderId('SUB');

    // 결제 레코드 생성
    const { data: payment, error: paymentError } = await adminClient
      .from('payments')
      .insert({
        user_id: subscription.user_id,
        order_id: orderId,
        type: 'subscription',
        status: 'pending',
        amount,
        metadata: {
          planId: plan,
          billingCycle,
          subscriptionId,
          isRenewal: true,
        },
      })
      .select('id')
      .single();

    if (paymentError || !payment) {
      return { success: false, error: '결제 레코드 생성 실패' };
    }

    // 결제 실행
    const tossClient = getTossClient();
    try {
      const chargeResponse = await tossClient.chargeBilling(
        decryptedBillingKey,
        billingKey.customer_key,
        amount,
        orderId,
        `CodeGen AI ${planConfig.name} 갱신 (${billingCycle === 'yearly' ? '연간' : '월간'})`
      );

      // 결제 완료 처리
      await adminClient
        .from('payments')
        .update({
          status: 'completed',
          payment_key: chargeResponse.paymentKey,
          method: chargeResponse.method,
          receipt_url: chargeResponse.receipt?.url,
          paid_at: chargeResponse.approvedAt,
        })
        .eq('id', payment.id);

      // 구독 기간 연장
      const newPeriodStart = new Date(subscription.current_period_end);
      const newPeriodEnd = new Date(newPeriodStart);
      if (billingCycle === 'monthly') {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      } else {
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
      }

      await adminClient
        .from('subscriptions')
        .update({
          current_period_start: newPeriodStart.toISOString(),
          current_period_end: newPeriodEnd.toISOString(),
        })
        .eq('id', subscriptionId);

      return { success: true, data: { paymentId: payment.id } };
    } catch (error) {
      // 결제 실패 처리
      await adminClient
        .from('payments')
        .update({
          status: 'failed',
          failure_code: error instanceof PaymentError ? error.code : 'RENEWAL_FAILED',
          failure_reason: error instanceof Error ? error.message : '갱신 결제 실패',
        })
        .eq('id', payment.id);

      // 구독 상태를 past_due로 변경
      await adminClient
        .from('subscriptions')
        .update({ status: 'past_due' })
        .eq('id', subscriptionId);

      return {
        success: false,
        error: error instanceof PaymentError ? error.message : '갱신 결제에 실패했습니다',
      };
    }
  } catch (error) {
    console.error('renewSubscription 오류:', error);
    return { success: false, error: '구독 갱신에 실패했습니다' };
  }
}
