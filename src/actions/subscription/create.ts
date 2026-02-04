'use server';

/**
 * 구독 생성 관련 Server Actions
 * - 구독 시작 준비
 * - 구독 확정 (빌링키 발급 + 첫 결제)
 */

import { headers } from 'next/headers';
import { requireAuth, AuthError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTossClient, PaymentError, mapTossErrorToUserMessage } from '@/lib/payment/toss';
import { generateOrderId, encryptBillingKey } from '@/lib/payment/crypto';
import { plans } from '@/config/pricing';
import { logError } from '@/lib/logger';
import { parseRpcResult, type RpcResultBase } from '@/lib/supabase/helpers';
import {
  checkRateLimit,
  getClientIP,
  getRateLimitErrorMessage,
  RATE_LIMIT_PRESETS,
} from '@/lib/rate-limit';
import {
  prepareSubscriptionSchema,
  confirmSubscriptionSchema,
  validateSubscriptionAmount,
  type PrepareSubscriptionInput,
  type ConfirmSubscriptionInput,
} from '@/lib/validators/payment';
import type {
  ActionResponse,
  PrepareSubscriptionResponse,
} from '@/types/payment.types';

// RPC 결과 확장 타입
interface SubscriptionRpcResult extends RpcResultBase {
  subscription_id?: string;
}

// ────────────────────────────────────────────────────────────
// 구독 시작 준비
// ────────────────────────────────────────────────────────────

export async function prepareSubscription(
  input: PrepareSubscriptionInput
): Promise<ActionResponse<PrepareSubscriptionResponse>> {
  try {
    // Rate Limiting (IP 기반)
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = await checkRateLimit(
      clientIP,
      'prepare_subscription',
      RATE_LIMIT_PRESETS.SUBSCRIPTION_CREATE
    );

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: getRateLimitErrorMessage(rateLimitResult),
      };
    }

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
    const { user, supabase } = await requireAuth();

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
      logError('구독 결제 레코드 생성 실패', insertError, { userId: user.id, action: 'prepareSubscription' });
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
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('prepareSubscription 오류', error, { action: 'prepareSubscription' });
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
    // Rate Limiting (IP 기반)
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = await checkRateLimit(
      clientIP,
      'confirm_subscription',
      RATE_LIMIT_PRESETS.PAYMENT_CONFIRM
    );

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: getRateLimitErrorMessage(rateLimitResult),
      };
    }

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
    const { user } = await requireAuth();

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
        error: error instanceof PaymentError ? mapTossErrorToUserMessage(error.code) : '빌링키 발급에 실패했습니다',
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
      logError('빌링키 저장 실패', billingKeyError, { userId: user.id, action: 'confirmSubscription' });
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
        error: error instanceof PaymentError ? mapTossErrorToUserMessage(error.code) : '결제에 실패했습니다',
      };
    }

    // 토스 응답 금액 검증 (보안: 결제 금액 무결성 확인)
    if (chargeResponse.totalAmount !== payment.amount) {
      logError('토스 응답 금액 불일치', new Error('Amount mismatch'), {
        action: 'confirmSubscription',
        orderId,
        expectedAmount: payment.amount,
        receivedAmount: chargeResponse.totalAmount,
      });

      // 결제 상태를 failed로 업데이트
      await adminClient
        .from('payments')
        .update({
          status: 'failed',
          failure_code: 'AMOUNT_MISMATCH',
          failure_reason: '결제 금액이 일치하지 않습니다',
        })
        .eq('id', payment.id);

      // 빌링키 삭제
      await adminClient
        .from('billing_keys')
        .delete()
        .eq('id', billingKeyRecord.id);

      return { success: false, error: '결제 금액 검증에 실패했습니다' };
    }

    // 4-6. 원자적 트랜잭션: 결제 완료 + 구독 생성 + 프로필 업데이트
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      'confirm_subscription_atomic',
      {
        p_payment_id: payment.id,
        p_payment_key: chargeResponse.paymentKey,
        p_method: chargeResponse.method,
        p_receipt_url: chargeResponse.receipt?.url ?? null,
        p_paid_at: chargeResponse.approvedAt,
        p_user_id: user.id,
        p_plan: plan,
        p_billing_cycle: billingCycle,
        p_billing_key_id: billingKeyRecord.id,
        p_period_start: now.toISOString(),
        p_period_end: periodEnd.toISOString(),
      }
    );

    if (rpcError) {
      logError('구독 확정 RPC 오류', rpcError, { userId: user.id, orderId, action: 'confirmSubscription' });
      // 결제는 성공했지만 DB 처리 실패 - 환불 처리 필요할 수 있음
      // 빌링키 삭제
      await adminClient
        .from('billing_keys')
        .delete()
        .eq('id', billingKeyRecord.id);
      return { success: false, error: '구독 처리 중 오류가 발생했습니다' };
    }

    // RPC 결과 확인
    const parsed = parseRpcResult<SubscriptionRpcResult>(rpcResult);
    if (!parsed.success) {
      logError('구독 트랜잭션 실패', new Error(parsed.error), { userId: user.id, orderId, action: 'confirmSubscription' });
      // 빌링키 삭제
      await adminClient
        .from('billing_keys')
        .delete()
        .eq('id', billingKeyRecord.id);
      return { success: false, error: parsed.error };
    }

    return {
      success: true,
      data: {
        subscriptionId: parsed.data.subscription_id ?? '',
      },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('confirmSubscription 오류', error, { action: 'confirmSubscription' });
    return { success: false, error: '구독 처리에 실패했습니다' };
  }
}
