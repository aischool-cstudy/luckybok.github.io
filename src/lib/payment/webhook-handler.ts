/**
 * 웹훅 재처리 핸들러
 * admin/webhook.ts에서 사용
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logError } from '@/lib/logger';
import type { WebhookEventType } from '@/types/payment.types';

interface ReprocessResult {
  success: boolean;
  error?: string;
}

/**
 * 웹훅 재처리 메인 함수
 */
export async function handleWebhookReprocess(
  eventType: string,
  payload: Record<string, unknown>
): Promise<ReprocessResult> {
  const adminClient = createAdminClient();
  const data = payload.data as Record<string, unknown> | undefined;

  if (!data) {
    return { success: false, error: '페이로드에 data가 없습니다' };
  }

  try {
    switch (eventType as WebhookEventType) {
      case 'PAYMENT_STATUS_CHANGED':
        return await reprocessPaymentStatusChanged(data, adminClient);

      case 'BILLING_STATUS_CHANGED':
        return await reprocessBillingStatusChanged(data, adminClient);

      case 'VIRTUAL_ACCOUNT_DEPOSITED':
        return await reprocessVirtualAccountDeposited(data, adminClient);

      default:
        return { success: true }; // 처리 불필요한 이벤트는 성공 처리
    }
  } catch (error) {
    logError('웹훅 재처리 오류', error, {
      action: 'handleWebhookReprocess',
      eventType,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}

/**
 * PAYMENT_STATUS_CHANGED 재처리
 */
async function reprocessPaymentStatusChanged(
  data: Record<string, unknown>,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<ReprocessResult> {
  const paymentKey = data.paymentKey as string | undefined;
  const status = data.status as string | undefined;

  if (!paymentKey || !status) {
    return { success: false, error: 'paymentKey 또는 status 누락' };
  }

  // 결제 레코드 조회
  const { data: payment, error } = await adminClient
    .from('payments')
    .select('*')
    .eq('payment_key', paymentKey)
    .single();

  if (error || !payment) {
    return { success: false, error: `결제 레코드를 찾을 수 없음: ${paymentKey}` };
  }

  // 상태 매핑
  type PaymentStatusValue = 'pending' | 'failed' | 'canceled' | 'completed' | 'refunded' | 'partial_refunded';
  const statusMap: Record<string, PaymentStatusValue> = {
    DONE: 'completed',
    CANCELED: 'canceled',
    PARTIAL_CANCELED: 'partial_refunded',
    WAITING_FOR_DEPOSIT: 'pending',
    ABORTED: 'failed',
    EXPIRED: 'failed',
  };

  const newStatus: PaymentStatusValue = statusMap[status] || (payment.status as PaymentStatusValue);

  // 결제 상태 업데이트
  const { error: updateError } = await adminClient
    .from('payments')
    .update({ status: newStatus })
    .eq('id', payment.id);

  if (updateError) {
    return { success: false, error: `결제 상태 업데이트 실패: ${updateError.message}` };
  }

  // 취소/환불 시 추가 처리
  if (['canceled', 'refunded', 'partial_refunded'].includes(newStatus)) {
    await handlePaymentCancellation(payment, adminClient);
  }

  return { success: true };
}

/**
 * BILLING_STATUS_CHANGED 재처리
 */
async function reprocessBillingStatusChanged(
  data: Record<string, unknown>,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<ReprocessResult> {
  const customerKey = data.customerKey as string | undefined;
  const status = data.status as string | undefined;

  if (!customerKey || !status) {
    return { success: false, error: 'customerKey 또는 status 누락' };
  }

  // 빌링키 상태가 비활성화된 경우
  if (status === 'EXPIRED' || status === 'STOPPED') {
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('customer_key', customerKey)
      .single();

    if (profile) {
      const { error: updateError } = await adminClient
        .from('subscriptions')
        .update({ status: 'past_due' })
        .eq('user_id', profile.id)
        .eq('status', 'active');

      if (updateError) {
        return { success: false, error: `구독 상태 업데이트 실패: ${updateError.message}` };
      }
    }
  }

  return { success: true };
}

/**
 * VIRTUAL_ACCOUNT_DEPOSITED 재처리
 */
async function reprocessVirtualAccountDeposited(
  data: Record<string, unknown>,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<ReprocessResult> {
  const orderId = data.orderId as string | undefined;

  if (!orderId) {
    return { success: false, error: 'orderId 누락' };
  }

  // 결제 레코드 조회
  const { data: payment, error } = await adminClient
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (error || !payment) {
    return { success: false, error: `결제 레코드를 찾을 수 없음: ${orderId}` };
  }

  // 이미 완료된 결제인지 확인
  if (payment.status === 'completed') {
    return { success: true }; // 이미 처리됨
  }

  // 결제 상태 업데이트
  const { error: updateError } = await adminClient
    .from('payments')
    .update({
      status: 'completed',
      paid_at: new Date().toISOString(),
    })
    .eq('id', payment.id);

  if (updateError) {
    return { success: false, error: `결제 상태 업데이트 실패: ${updateError.message}` };
  }

  // 크레딧 지급
  if (payment.type === 'credit_purchase') {
    const metadata = payment.metadata as Record<string, unknown> | null;
    const credits = metadata?.credits as number;
    const validityDays = metadata?.validityDays as number;

    if (credits) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('credits_balance')
        .eq('id', payment.user_id)
        .single();

      const currentBalance = profile?.credits_balance ?? 0;
      const newBalance = currentBalance + credits;

      const expiresAt = validityDays
        ? new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      await adminClient.from('credit_transactions').insert({
        user_id: payment.user_id,
        type: 'purchase',
        amount: credits,
        balance: newBalance,
        description: `크레딧 ${credits}개 구매 (가상계좌)`,
        payment_id: payment.id,
        expires_at: expiresAt,
      });
    }
  }

  return { success: true };
}

/**
 * 결제 취소 처리 헬퍼
 */
async function handlePaymentCancellation(
  payment: { id: string; user_id: string; type: string; metadata: unknown },
  adminClient: ReturnType<typeof createAdminClient>
): Promise<void> {
  const metadata = payment.metadata as Record<string, unknown> | null;

  if (payment.type === 'credit_purchase') {
    const credits = metadata?.credits as number;
    if (!credits) return;

    const { data: profile } = await adminClient
      .from('profiles')
      .select('credits_balance')
      .eq('id', payment.user_id)
      .single();

    const currentBalance = profile?.credits_balance ?? 0;
    const newBalance = Math.max(0, currentBalance - credits);

    await adminClient.from('credit_transactions').insert({
      user_id: payment.user_id,
      type: 'refund',
      amount: -credits,
      balance: newBalance,
      description: '결제 취소로 인한 크레딧 차감',
      payment_id: payment.id,
    });
  } else if (payment.type === 'subscription') {
    const subscriptionId = metadata?.subscriptionId as string;
    if (!subscriptionId) return;

    await adminClient
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('id', subscriptionId);

    await adminClient
      .from('profiles')
      .update({
        plan: 'starter',
        plan_expires_at: null,
      })
      .eq('id', payment.user_id);
  }
}
