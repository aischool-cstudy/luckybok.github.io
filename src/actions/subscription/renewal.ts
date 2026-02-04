'use server';

/**
 * 구독 갱신 관련 Server Actions
 * - cron job에서 호출되는 갱신 로직
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { getTossClient, PaymentError, mapTossErrorToUserMessage } from '@/lib/payment/toss';
import { generateOrderId, decryptBillingKey } from '@/lib/payment/crypto';
import { plans } from '@/config/pricing';
import { logError } from '@/lib/logger';
import { parseRpcResult, type RpcResultBase } from '@/lib/supabase/helpers';
import type { ActionResponse, BillingCycle } from '@/types/payment.types';

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

    // billing_keys는 foreign key join으로 단일 객체이지만 타입이 배열로 추론될 수 있음
    const billingKeyData = subscription.billing_keys;
    const billingKey = (Array.isArray(billingKeyData) ? billingKeyData[0] : billingKeyData) as {
      encrypted_billing_key: string;
      customer_key: string;
    } | null;

    if (!billingKey) {
      return { success: false, error: '결제 수단이 없습니다' };
    }

    // 빌링키 복호화 (정적 import 사용)
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

      // 원자적 트랜잭션: 결제 완료 + 구독 기간 연장
      const newPeriodStart = new Date(subscription.current_period_end);
      const newPeriodEnd = new Date(newPeriodStart);
      if (billingCycle === 'monthly') {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      } else {
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
      }

      const { data: rpcResult, error: rpcError } = await adminClient.rpc(
        'renew_subscription_atomic',
        {
          p_payment_id: payment.id,
          p_payment_key: chargeResponse.paymentKey,
          p_method: chargeResponse.method,
          p_receipt_url: chargeResponse.receipt?.url ?? null,
          p_paid_at: chargeResponse.approvedAt,
          p_subscription_id: subscriptionId,
          p_new_period_start: newPeriodStart.toISOString(),
          p_new_period_end: newPeriodEnd.toISOString(),
        }
      );

      if (rpcError) {
        logError('갱신 RPC 오류', rpcError, { subscriptionId, action: 'renewSubscription' });
        return { success: false, error: '구독 갱신 처리 중 오류가 발생했습니다' };
      }

      const parsed = parseRpcResult<RpcResultBase>(rpcResult);
      if (!parsed.success) {
        logError('갱신 트랜잭션 실패', new Error(parsed.error), { subscriptionId, action: 'renewSubscription' });
        return { success: false, error: parsed.error };
      }

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

      // 재시도 로직: 최대 3회까지 24시간 간격으로 재시도
      const MAX_RETRY_COUNT = 3;
      const RETRY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24시간

      const currentMetadata = (subscription.metadata as Record<string, unknown>) || {};
      const currentRetryCount = (currentMetadata.renewal_retry_count as number) || 0;
      const newRetryCount = currentRetryCount + 1;

      if (newRetryCount < MAX_RETRY_COUNT) {
        // 재시도 예약: 메타데이터에 재시도 횟수와 다음 재시도 시간 기록
        const nextRetryAt = new Date(Date.now() + RETRY_INTERVAL_MS);

        await adminClient
          .from('subscriptions')
          .update({
            metadata: {
              ...currentMetadata,
              renewal_retry_count: newRetryCount,
              next_retry_at: nextRetryAt.toISOString(),
              last_failure_reason: error instanceof Error ? error.message : '갱신 결제 실패',
              last_failure_code: error instanceof PaymentError ? error.code : 'RENEWAL_FAILED',
            },
          })
          .eq('id', subscriptionId);

        logError('구독 갱신 결제 실패 - 재시도 예약', error, {
          subscriptionId,
          retryCount: newRetryCount,
          nextRetryAt: nextRetryAt.toISOString(),
          action: 'renewSubscription',
        });

        return {
          success: false,
          error: `갱신 결제 실패 (${newRetryCount}/${MAX_RETRY_COUNT}회 시도). 24시간 후 자동 재시도됩니다.`,
        };
      } else {
        // 최대 재시도 횟수 초과: past_due로 변경
        await adminClient
          .from('subscriptions')
          .update({
            status: 'past_due',
            metadata: {
              ...currentMetadata,
              renewal_retry_count: newRetryCount,
              final_failure_at: new Date().toISOString(),
              final_failure_reason: error instanceof Error ? error.message : '갱신 결제 실패',
            },
          })
          .eq('id', subscriptionId);

        logError('구독 갱신 최종 실패 - past_due 전환', error, {
          subscriptionId,
          totalRetries: newRetryCount,
          action: 'renewSubscription',
        });

        return {
          success: false,
          error: error instanceof PaymentError ? mapTossErrorToUserMessage(error.code) : '갱신 결제에 실패했습니다. 결제 수단을 확인해주세요.',
        };
      }
    }
  } catch (error) {
    logError('renewSubscription 오류', error, { action: 'renewSubscription' });
    return { success: false, error: '구독 갱신에 실패했습니다' };
  }
}
