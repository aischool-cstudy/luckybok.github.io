'use server';

/**
 * 플랜 변경 관련 Server Actions
 * - 플랜 변경 준비 (비례 배분 계산)
 * - 플랜 변경 확정
 * - 예약된 플랜 변경 취소/조회
 */

import { headers } from 'next/headers';
import { requireAuth, AuthError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTossClient, PaymentError, mapTossErrorToUserMessage } from '@/lib/payment/toss';
import { generateOrderId, decryptBillingKey } from '@/lib/payment/crypto';
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
  changePlanSchema,
  confirmPlanChangeSchema,
  type ChangePlanInput,
  type ConfirmPlanChangeInput,
} from '@/lib/validators/payment';
import {
  calculateProration,
  formatProrationSummary,
} from '@/lib/payment/proration';
import type {
  ActionResponse,
  PlanType,
  BillingCycle,
  PreparePlanChangeResponse,
  ScheduledPlanChange,
} from '@/types/payment.types';

// RPC 결과 확장 타입
interface ScheduledPlanChangeRpcResult extends RpcResultBase {
  scheduled_at: string | null;
}

// ────────────────────────────────────────────────────────────
// 플랜 변경 준비 (비례 배분 계산)
// ────────────────────────────────────────────────────────────

export async function preparePlanChange(
  input: ChangePlanInput
): Promise<ActionResponse<PreparePlanChangeResponse>> {
  try {
    // Rate Limiting (IP 기반)
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = await checkRateLimit(
      clientIP,
      'prepare_plan_change',
      RATE_LIMIT_PRESETS.SUBSCRIPTION_CREATE
    );

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: getRateLimitErrorMessage(rateLimitResult),
      };
    }

    // 입력값 검증
    const validated = changePlanSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message || '입력값이 올바르지 않습니다',
      };
    }

    const { newPlan, newBillingCycle } = validated.data;

    // 인증 확인
    const { user, supabase } = await requireAuth();

    // 현재 활성 구독 조회
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*, profiles!user_id(customer_key)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subscriptionError || !subscription) {
      return { success: false, error: '활성 구독이 없습니다' };
    }

    const currentPlan = subscription.plan as Exclude<PlanType, 'starter'>;
    const currentBillingCycle = subscription.billing_cycle as BillingCycle;
    const currentPeriodEnd = new Date(subscription.current_period_end);

    // 비례 배분 계산
    const prorationResult = calculateProration({
      currentPlan,
      currentBillingCycle,
      newPlan,
      newBillingCycle,
      currentPeriodEnd,
    });

    // 동일 플랜 체크
    if (prorationResult.changeType === 'same') {
      return { success: false, error: '현재 플랜과 동일합니다' };
    }

    // profiles 조인 결과 타입 처리 (배열이거나 단일 객체일 수 있음)
    const profilesData = subscription.profiles as unknown;
    const profileData = (Array.isArray(profilesData) ? profilesData[0] : profilesData) as { customer_key: string } | null;
    const customerKey = profileData?.customer_key;

    // 응답 준비
    const response: PreparePlanChangeResponse = {
      changeType: prorationResult.changeType,
      currentPlan,
      currentBillingCycle,
      newPlan,
      newBillingCycle,
      proratedAmount: prorationResult.proratedAmount,
      newPlanAmount: prorationResult.newPlanAmount,
      effectiveDate: prorationResult.effectiveDate,
      requiresPayment: prorationResult.requiresPayment,
      daysRemaining: prorationResult.daysRemaining,
      summary: formatProrationSummary(prorationResult),
    };

    // 결제가 필요한 경우 (업그레이드) 결제 레코드 생성
    if (prorationResult.requiresPayment && customerKey) {
      const orderId = generateOrderId('CHG');
      const planConfig = plans[newPlan];

      const adminClient = createAdminClient();
      const { error: insertError } = await adminClient.from('payments').insert({
        user_id: user.id,
        order_id: orderId,
        type: 'plan_change',
        status: 'pending',
        amount: prorationResult.proratedAmount,
        metadata: {
          subscriptionId: subscription.id,
          fromPlan: currentPlan,
          toPlan: newPlan,
          fromBillingCycle: currentBillingCycle,
          toBillingCycle: newBillingCycle,
          proratedAmount: prorationResult.proratedAmount,
          daysRemaining: prorationResult.daysRemaining,
        },
      });

      if (insertError) {
        logError('플랜 변경 결제 레코드 생성 실패', insertError, { userId: user.id, action: 'preparePlanChange' });
        return { success: false, error: '플랜 변경 준비에 실패했습니다' };
      }

      response.orderId = orderId;
      response.orderName = `CodeGen AI 플랜 변경: ${planConfig.name} (${newBillingCycle === 'yearly' ? '연간' : '월간'})`;
      response.customerKey = customerKey;
    }

    return { success: true, data: response };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('preparePlanChange 오류', error, { action: 'preparePlanChange' });
    return { success: false, error: '플랜 변경 준비에 실패했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 플랜 변경 확정
// ────────────────────────────────────────────────────────────

export async function confirmPlanChange(
  input: ConfirmPlanChangeInput
): Promise<ActionResponse<{ effectiveDate: Date }>> {
  try {
    // Rate Limiting (IP 기반)
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = await checkRateLimit(
      clientIP,
      'confirm_plan_change',
      RATE_LIMIT_PRESETS.PAYMENT_CONFIRM
    );

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: getRateLimitErrorMessage(rateLimitResult),
      };
    }

    // 입력값 검증
    const validated = confirmPlanChangeSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message || '입력값이 올바르지 않습니다',
      };
    }

    const { newPlan, newBillingCycle, orderId } = validated.data;

    // 인증 확인
    const { user } = await requireAuth();

    const adminClient = createAdminClient();

    // 현재 활성 구독 조회 (빌링키 포함)
    const { data: subscription, error: subscriptionError } = await adminClient
      .from('subscriptions')
      .select('*, billing_keys!billing_key_id(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subscriptionError || !subscription) {
      return { success: false, error: '활성 구독이 없습니다' };
    }

    const currentPlan = subscription.plan as Exclude<PlanType, 'starter'>;
    const currentBillingCycle = subscription.billing_cycle as BillingCycle;
    const currentPeriodEnd = new Date(subscription.current_period_end);

    // 비례 배분 재계산 (검증용)
    const prorationResult = calculateProration({
      currentPlan,
      currentBillingCycle,
      newPlan,
      newBillingCycle,
      currentPeriodEnd,
    });

    // 동일 플랜 체크
    if (prorationResult.changeType === 'same') {
      return { success: false, error: '현재 플랜과 동일합니다' };
    }

    // 업그레이드 (결제 필요)
    if (prorationResult.requiresPayment && orderId) {
      // 결제 레코드 조회
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

      // 빌링키 조회
      const billingKeyData = subscription.billing_keys;
      const billingKey = (Array.isArray(billingKeyData) ? billingKeyData[0] : billingKeyData) as {
        encrypted_billing_key: string;
        customer_key: string;
      } | null;

      if (!billingKey) {
        return { success: false, error: '결제 수단이 없습니다' };
      }

      // 빌링키 복호화
      const decryptedBillingKey = decryptBillingKey(billingKey.encrypted_billing_key);

      // 결제 실행
      const tossClient = getTossClient();
      const planConfig = plans[newPlan];

      let chargeResponse;
      try {
        chargeResponse = await tossClient.chargeBilling(
          decryptedBillingKey,
          billingKey.customer_key,
          prorationResult.proratedAmount,
          orderId,
          `CodeGen AI 플랜 변경: ${planConfig.name}`
        );
      } catch (error) {
        await adminClient
          .from('payments')
          .update({
            status: 'failed',
            failure_code: error instanceof PaymentError ? error.code : 'PLAN_CHANGE_FAILED',
            failure_reason: error instanceof Error ? error.message : '결제 실패',
          })
          .eq('id', payment.id);

        return {
          success: false,
          error: error instanceof PaymentError ? mapTossErrorToUserMessage(error.code) : '결제에 실패했습니다',
        };
      }

      // 원자적 트랜잭션: 결제 완료 + 플랜 즉시 변경
      const { data: rpcResult, error: rpcError } = await adminClient.rpc(
        'change_plan_immediate_atomic',
        {
          p_payment_id: payment.id,
          p_payment_key: chargeResponse.paymentKey,
          p_method: chargeResponse.method,
          p_receipt_url: chargeResponse.receipt?.url ?? null,
          p_paid_at: chargeResponse.approvedAt,
          p_subscription_id: subscription.id,
          p_new_plan: newPlan,
          p_new_billing_cycle: newBillingCycle,
          p_prorated_amount: prorationResult.proratedAmount,
        }
      );

      if (rpcError) {
        logError('플랜 변경 RPC 오류', rpcError, { userId: user.id, orderId, action: 'confirmPlanChange' });
        return { success: false, error: '플랜 변경 처리 중 오류가 발생했습니다' };
      }

      const parsed = parseRpcResult<RpcResultBase>(rpcResult);
      if (!parsed.success) {
        logError('플랜 변경 트랜잭션 실패', new Error(parsed.error), { userId: user.id, orderId, action: 'confirmPlanChange' });
        return { success: false, error: parsed.error };
      }

      return {
        success: true,
        data: { effectiveDate: new Date() },
      };
    }

    // 다운그레이드 (결제 불필요, 예약)
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      'schedule_plan_change_atomic',
      {
        p_subscription_id: subscription.id,
        p_new_plan: newPlan,
        p_new_billing_cycle: newBillingCycle,
      }
    );

    if (rpcError) {
      logError('플랜 변경 예약 RPC 오류', rpcError, { userId: user.id, action: 'confirmPlanChange' });
      return { success: false, error: '플랜 변경 예약 중 오류가 발생했습니다' };
    }

    const parsed = parseRpcResult<ScheduledPlanChangeRpcResult>(rpcResult);
    if (!parsed.success) {
      logError('플랜 변경 예약 트랜잭션 실패', new Error(parsed.error), { userId: user.id, action: 'confirmPlanChange' });
      return { success: false, error: parsed.error };
    }

    return {
      success: true,
      data: { effectiveDate: new Date(parsed.data.scheduled_at ?? new Date().toISOString()) },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('confirmPlanChange 오류', error, { action: 'confirmPlanChange' });
    return { success: false, error: '플랜 변경에 실패했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 예약된 플랜 변경 취소
// ────────────────────────────────────────────────────────────

export async function cancelScheduledPlanChange(): Promise<ActionResponse<void>> {
  try {
    const { user, supabase } = await requireAuth();

    // 활성 구독 조회
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('id, scheduled_plan')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subscriptionError || !subscription) {
      return { success: false, error: '활성 구독이 없습니다' };
    }

    if (!subscription.scheduled_plan) {
      return { success: false, error: '예약된 플랜 변경이 없습니다' };
    }

    const adminClient = createAdminClient();
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      'cancel_scheduled_plan_change',
      {
        p_subscription_id: subscription.id,
      }
    );

    if (rpcError) {
      logError('플랜 변경 취소 RPC 오류', rpcError, { userId: user.id, action: 'cancelScheduledPlanChange' });
      return { success: false, error: '플랜 변경 취소 중 오류가 발생했습니다' };
    }

    const parsed = parseRpcResult<RpcResultBase>(rpcResult);
    if (!parsed.success) {
      return { success: false, error: parsed.error };
    }

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('cancelScheduledPlanChange 오류', error, { action: 'cancelScheduledPlanChange' });
    return { success: false, error: '플랜 변경 취소에 실패했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 예약된 플랜 변경 조회
// ────────────────────────────────────────────────────────────

export async function getScheduledPlanChange(): Promise<ActionResponse<ScheduledPlanChange | null>> {
  try {
    const { user, supabase } = await requireAuth();

    // 활성 구독 조회
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('plan, billing_cycle, scheduled_plan, scheduled_billing_cycle, scheduled_change_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subscriptionError || !subscription) {
      return { success: true, data: null };
    }

    const scheduledChange: ScheduledPlanChange = {
      hasScheduledChange: !!subscription.scheduled_plan,
      currentPlan: subscription.plan as PlanType,
      currentBillingCycle: subscription.billing_cycle as BillingCycle,
      scheduledPlan: subscription.scheduled_plan as PlanType | null,
      scheduledBillingCycle: subscription.scheduled_billing_cycle as BillingCycle | null,
      scheduledChangeAt: subscription.scheduled_change_at
        ? new Date(subscription.scheduled_change_at)
        : null,
    };

    return { success: true, data: scheduledChange };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('getScheduledPlanChange 오류', error, { action: 'getScheduledPlanChange' });
    return { success: false, error: '예약 정보 조회에 실패했습니다' };
  }
}
