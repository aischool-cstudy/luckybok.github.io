/**
 * 토스페이먼츠 웹훅 처리
 * POST /api/webhooks/toss
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyWebhookSignature } from '@/lib/payment/crypto';
import { webhookPayloadSchema } from '@/lib/validators/payment';
import type { WebhookEventType } from '@/types/payment.types';

// 웹훅은 외부에서 호출되므로 동적 렌더링 필요
// Note: Next.js 16 cacheComponents와 호환을 위해 dynamic 제거
// API 라우트는 기본적으로 동적임

// ────────────────────────────────────────────────────────────
// 웹훅 핸들러
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const adminClient = createAdminClient();
  let rawBody: string;
  let webhookLogId: string | null = null;

  try {
    // 1. 원본 바디 읽기
    rawBody = await request.text();

    // 2. 서명 검증
    const signature = request.headers.get('Toss-Signature');

    if (!signature) {
      console.error('웹훅 서명 헤더 없음');
      return NextResponse.json(
        { error: '서명이 없습니다' },
        { status: 401 }
      );
    }

    const isValidSignature = verifyWebhookSignature(rawBody, signature);

    if (!isValidSignature) {
      console.error('웹훅 서명 검증 실패');
      return NextResponse.json(
        { error: '서명 검증 실패' },
        { status: 401 }
      );
    }

    // 3. 페이로드 파싱
    const payload = JSON.parse(rawBody);

    // 4. 페이로드 검증
    const validated = webhookPayloadSchema.safeParse(payload);

    if (!validated.success) {
      console.error('웹훅 페이로드 검증 실패:', validated.error);
      return NextResponse.json(
        { error: '잘못된 페이로드 형식' },
        { status: 400 }
      );
    }

    const { eventType, data } = validated.data;

    // 5. 웹훅 로그 저장
    const { data: log } = await adminClient
      .from('webhook_logs')
      .insert({
        event_type: eventType,
        payload,
      })
      .select('id')
      .single();

    webhookLogId = log?.id ?? null;

    // 6. 이벤트 타입별 처리
    await handleWebhookEvent(eventType as WebhookEventType, data, adminClient);

    // 7. 처리 완료 표시
    if (webhookLogId) {
      await adminClient
        .from('webhook_logs')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', webhookLogId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('웹훅 처리 오류:', error);

    // 에러 로깅
    if (webhookLogId) {
      await adminClient
        .from('webhook_logs')
        .update({
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        })
        .eq('id', webhookLogId);
    }

    // 토스페이먼츠는 2xx 응답이 아니면 재시도하므로
    // 복구 불가능한 에러가 아니면 200을 반환
    return NextResponse.json(
      { error: '처리 중 오류 발생' },
      { status: 200 }
    );
  }
}

// GET 요청 처리 (웹훅 테스트용)
export async function GET() {
  return NextResponse.json({
    status: 'Toss Payments Webhook Endpoint',
    active: true,
    timestamp: new Date().toISOString(),
  });
}

// ────────────────────────────────────────────────────────────
// 이벤트 핸들러
// ────────────────────────────────────────────────────────────

async function handleWebhookEvent(
  eventType: WebhookEventType,
  data: Record<string, unknown>,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<void> {
  switch (eventType) {
    case 'PAYMENT_STATUS_CHANGED':
      await handlePaymentStatusChanged(data, adminClient);
      break;

    case 'BILLING_STATUS_CHANGED':
      await handleBillingStatusChanged(data, adminClient);
      break;

    case 'VIRTUAL_ACCOUNT_DEPOSITED':
      await handleVirtualAccountDeposited(data, adminClient);
      break;

    case 'DEPOSIT_CALLBACK':
      await handleDepositCallback(data);
      break;

    default:
      console.log(`처리되지 않은 이벤트 타입: ${eventType}`);
  }
}

// ────────────────────────────────────────────────────────────
// PAYMENT_STATUS_CHANGED 핸들러
// ────────────────────────────────────────────────────────────

async function handlePaymentStatusChanged(
  data: Record<string, unknown>,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<void> {
  const paymentKey = data.paymentKey as string | undefined;
  const status = data.status as string | undefined;

  if (!paymentKey || !status) {
    console.error('paymentKey 또는 status 누락');
    return;
  }

  // 결제 레코드 조회
  const { data: payment, error } = await adminClient
    .from('payments')
    .select('*')
    .eq('payment_key', paymentKey)
    .single();

  if (error || !payment) {
    console.error('결제 레코드 찾을 수 없음:', paymentKey);
    return;
  }

  // 상태 매핑
  const statusMap: Record<string, 'pending' | 'completed' | 'failed' | 'canceled' | 'refunded' | 'partial_refunded'> = {
    DONE: 'completed',
    CANCELED: 'canceled',
    PARTIAL_CANCELED: 'partial_refunded',
    WAITING_FOR_DEPOSIT: 'pending',
    ABORTED: 'failed',
    EXPIRED: 'failed',
  };

  const newStatus = statusMap[status] || payment.status;

  // 결제 상태 업데이트
  await adminClient
    .from('payments')
    .update({ status: newStatus })
    .eq('id', payment.id);

  // 취소/환불 시 크레딧 처리
  if (['canceled', 'refunded', 'partial_refunded'].includes(newStatus)) {
    const paymentRecord: PaymentRecord = {
      id: payment.id,
      user_id: payment.user_id,
      type: payment.type,
      metadata: (payment.metadata as Record<string, unknown>) ?? {},
    };
    await handlePaymentCancellation(paymentRecord, adminClient);
  }

  console.log(`결제 상태 업데이트: ${payment.order_id} -> ${newStatus}`);
}

// ────────────────────────────────────────────────────────────
// BILLING_STATUS_CHANGED 핸들러
// ────────────────────────────────────────────────────────────

async function handleBillingStatusChanged(
  data: Record<string, unknown>,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<void> {
  const customerKey = data.customerKey as string | undefined;
  const status = data.status as string | undefined;

  if (!customerKey || !status) {
    console.error('customerKey 또는 status 누락');
    return;
  }

  console.log(`빌링키 상태 변경: customerKey=${customerKey}, status=${status}`);

  // 빌링키 상태가 비활성화된 경우 처리
  if (status === 'EXPIRED' || status === 'STOPPED') {
    // 해당 고객의 활성 구독 조회
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('customer_key', customerKey)
      .single();

    if (profile) {
      // 구독 상태를 past_due로 변경
      await adminClient
        .from('subscriptions')
        .update({ status: 'past_due' })
        .eq('user_id', profile.id)
        .eq('status', 'active');

      console.log(`사용자 ${profile.id}의 구독 상태가 past_due로 변경됨`);
    }
  }
}

// ────────────────────────────────────────────────────────────
// VIRTUAL_ACCOUNT_DEPOSITED 핸들러 (가상계좌 입금)
// ────────────────────────────────────────────────────────────

async function handleVirtualAccountDeposited(
  data: Record<string, unknown>,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<void> {
  const orderId = data.orderId as string | undefined;
  const secret = data.secret as string | undefined;

  if (!orderId) {
    console.error('orderId 누락');
    return;
  }

  console.log(`가상계좌 입금 완료: ${orderId}, secret: ${secret}`);

  // 결제 레코드 조회
  const { data: payment, error } = await adminClient
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (error || !payment) {
    console.error('결제 레코드 찾을 수 없음:', orderId);
    return;
  }

  // 결제 상태 업데이트
  await adminClient
    .from('payments')
    .update({
      status: 'completed',
      paid_at: new Date().toISOString(),
    })
    .eq('id', payment.id);

  // 크레딧 지급
  if (payment.type === 'credit_purchase') {
    const paymentRecord: PaymentRecord = {
      id: payment.id,
      user_id: payment.user_id,
      type: payment.type,
      metadata: (payment.metadata as Record<string, unknown>) ?? {},
    };
    await grantCredits(paymentRecord, adminClient);
  }
}

// ────────────────────────────────────────────────────────────
// DEPOSIT_CALLBACK 핸들러
// ────────────────────────────────────────────────────────────

async function handleDepositCallback(
  data: Record<string, unknown>
): Promise<void> {
  // 입금 콜백 처리 (간편결제 등)
  console.log('입금 콜백:', data);
}

// ────────────────────────────────────────────────────────────
// 헬퍼 함수들
// ────────────────────────────────────────────────────────────

interface PaymentRecord {
  id: string;
  user_id: string;
  type: string;
  metadata: Record<string, unknown>;
}

async function handlePaymentCancellation(
  payment: PaymentRecord,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<void> {
  if (payment.type === 'credit_purchase') {
    const credits = payment.metadata?.credits as number;
    if (!credits) return;

    // 현재 잔액 조회
    const { data: profile } = await adminClient
      .from('profiles')
      .select('credits_balance')
      .eq('id', payment.user_id)
      .single();

    const currentBalance = profile?.credits_balance ?? 0;
    const newBalance = Math.max(0, currentBalance - credits);

    // 크레딧 차감 트랜잭션 생성
    await adminClient.from('credit_transactions').insert({
      user_id: payment.user_id,
      type: 'refund',
      amount: -credits,
      balance: newBalance,
      description: '결제 취소로 인한 크레딧 차감',
      payment_id: payment.id,
    });
  } else if (payment.type === 'subscription') {
    const subscriptionId = payment.metadata?.subscriptionId as string;
    if (!subscriptionId) return;

    // 구독 취소 처리
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
      .eq('id', payment.user_id);
  }
}

async function grantCredits(
  payment: PaymentRecord,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<void> {
  const metadata = payment.metadata;
  const credits = metadata?.credits as number;
  const validityDays = metadata?.validityDays as number;

  if (!credits) return;

  // 현재 잔액 조회
  const { data: profile } = await adminClient
    .from('profiles')
    .select('credits_balance')
    .eq('id', payment.user_id)
    .single();

  const currentBalance = profile?.credits_balance ?? 0;
  const newBalance = currentBalance + credits;

  // 만료일 계산
  const expiresAt = validityDays
    ? new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // 크레딧 지급 트랜잭션 생성
  await adminClient.from('credit_transactions').insert({
    user_id: payment.user_id,
    type: 'purchase',
    amount: credits,
    balance: newBalance,
    description: `크레딧 ${credits}개 구매`,
    payment_id: payment.id,
    expires_at: expiresAt,
  });
}
