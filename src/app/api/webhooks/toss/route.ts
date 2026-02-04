/**
 * 토스페이먼츠 웹훅 처리
 * POST /api/webhooks/toss
 *
 * 멱등성(Idempotency) 처리:
 * - 페이로드 해시를 idempotency_key로 사용
 * - 동일 웹훅 중복 수신 시 중복 처리 방지
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyWebhookSignature } from '@/lib/payment/crypto';
import { webhookPayloadSchema } from '@/lib/validators/payment';
import { logInfo, logWarn, logError } from '@/lib/logger';
import type { WebhookEventType } from '@/types/payment.types';

/**
 * 페이로드에서 멱등성 키 생성
 * - 토스 제공 헤더 또는 페이로드 해시 사용
 */
function generateIdempotencyKey(rawBody: string, headers: Headers): string {
  // 토스에서 제공하는 고유 ID가 있으면 사용
  const tossId = headers.get('X-Toss-Idempotency-Key') ||
                 headers.get('X-Request-Id');

  if (tossId) {
    return tossId;
  }

  // 없으면 페이로드 SHA-256 해시 사용
  return createHash('sha256').update(rawBody).digest('hex');
}

// API 라우트 설정: 웹훅은 즉시 처리 필요 (캐싱 비활성화)
export const revalidate = 0;
export const maxDuration = 30; // 웹훅 처리 최대 30초

// 페이로드 크기 제한 (10KB)
const MAX_PAYLOAD_SIZE = 10 * 1024;

// ────────────────────────────────────────────────────────────
// 웹훅 핸들러
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const adminClient = createAdminClient();
  let rawBody: string;
  let webhookLogId: string | null = null;
  let idempotencyKey: string | null = null;

  try {
    // 1. 원본 바디 읽기
    rawBody = await request.text();

    // 1.1 페이로드 크기 검증
    if (rawBody.length > MAX_PAYLOAD_SIZE) {
      logWarn('웹훅 페이로드 크기 초과', {
        action: 'webhook_toss',
        payloadSize: rawBody.length,
        maxSize: MAX_PAYLOAD_SIZE,
      });
      return NextResponse.json(
        { error: '페이로드 크기가 너무 큽니다' },
        { status: 413 }
      );
    }

    // 2. 서명 검증
    const signature = request.headers.get('Toss-Signature');

    if (!signature) {
      logWarn('웹훅 서명 헤더 없음', { action: 'webhook_toss' });
      return NextResponse.json(
        { error: '서명이 없습니다' },
        { status: 401 }
      );
    }

    const isValidSignature = verifyWebhookSignature(rawBody, signature);

    if (!isValidSignature) {
      logWarn('웹훅 서명 검증 실패', { action: 'webhook_toss' });
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
      logError('웹훅 페이로드 검증 실패', validated.error, { action: 'webhook_toss' });
      return NextResponse.json(
        { error: '잘못된 페이로드 형식' },
        { status: 400 }
      );
    }

    const { eventType, data } = validated.data;

    // 5. 멱등성 키 생성 및 원자적 upsert (Race Condition 방지)
    idempotencyKey = generateIdempotencyKey(rawBody, request.headers);

    // RPC 함수로 원자적 upsert 수행
    const { data: upsertResult, error: upsertError } = await adminClient.rpc(
      'upsert_webhook_log_atomic',
      {
        p_idempotency_key: idempotencyKey,
        p_event_type: eventType,
        p_payload: payload,
      }
    );

    if (upsertError) {
      logError('웹훅 로그 upsert 실패', upsertError, {
        action: 'webhook_toss',
        idempotencyKey,
      });
      return NextResponse.json(
        { error: '웹훅 처리 중 오류가 발생했습니다' },
        { status: 500 }
      );
    }

    // RPC 결과 타입 정의
    type WebhookUpsertResult = {
      action: 'already_processed' | 'reprocessing' | 'new';
      log_id: string | null;
      existing_status?: string;
    };

    // RPC 결과 파싱 (배열로 반환됨)
    const result = (Array.isArray(upsertResult) ? upsertResult[0] : upsertResult) as WebhookUpsertResult | undefined;

    // 이미 처리된 웹훅인 경우 - 중복 처리 방지
    if (result?.action === 'already_processed') {
      logInfo('중복 웹훅 감지 - 이미 처리됨', {
        action: 'webhook_toss',
        idempotencyKey,
        existingLogId: result.log_id,
      });
      return NextResponse.json({
        success: true,
        message: 'Already processed',
        idempotencyKey,
      });
    }

    // 웹훅 로그 ID 저장
    webhookLogId = result?.log_id ?? null;

    if (result?.action === 'reprocessing') {
      logInfo('기존 웹훅 로그 재처리', {
        action: 'webhook_toss',
        idempotencyKey,
        existingStatus: result.existing_status,
      });
    } else {
      logInfo('새 웹훅 로그 생성', {
        action: 'webhook_toss',
        idempotencyKey,
        logId: webhookLogId,
      });
    }

    // 7. 이벤트 타입별 처리
    await handleWebhookEvent(eventType as WebhookEventType, data, adminClient);

    // 8. 처리 완료 표시
    if (webhookLogId) {
      await adminClient
        .from('webhook_logs')
        .update({
          processed_at: new Date().toISOString(),
          status: 'processed',
        })
        .eq('id', webhookLogId);
    }

    return NextResponse.json({ success: true, idempotencyKey });
  } catch (error) {
    logError('웹훅 처리 오류', error, { action: 'webhook_toss' });

    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    const isCriticalError = checkCriticalError(error);

    // 에러 로깅
    if (webhookLogId) {
      await adminClient
        .from('webhook_logs')
        .update({
          error: errorMessage,
          status: 'failed',
        })
        .eq('id', webhookLogId);
    }

    // 중요 에러 판단:
    // - 결제/구독 처리 실패는 토스 재시도 필요 (500 반환)
    // - 파싱 에러 등 복구 불가능한 에러는 200 반환
    if (isCriticalError) {
      logError('중요 에러로 인해 재시도 트리거', null, { action: 'webhook_toss', errorMessage });
      return NextResponse.json(
        { error: '처리 중 오류 발생', retryable: true },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: '처리 중 오류 발생', retryable: false },
      { status: 200 }
    );
  }
}

/**
 * 중요 에러 여부 판단
 * 재시도가 필요한 에러인지 확인
 */
function checkCriticalError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // 재시도 가능한 에러 패턴
  const retryablePatterns = [
    'network',
    'timeout',
    'connection',
    'econnreset',
    'database',
    'transaction',
    'deadlock',
    'conflict',
    'temporarily unavailable',
  ];

  return retryablePatterns.some((pattern) => message.includes(pattern));
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
      await handleDepositCallback(data, adminClient);
      break;

    default:
      logInfo(`처리되지 않은 이벤트 타입: ${eventType}`, { action: 'webhook_toss' });
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
  const webhookAmount = data.totalAmount as number | undefined;

  if (!paymentKey || !status) {
    logWarn('paymentKey 또는 status 누락', { action: 'webhook_payment_status' });
    return;
  }

  // 결제 레코드 조회
  const { data: payment, error } = await adminClient
    .from('payments')
    .select('*')
    .eq('payment_key', paymentKey)
    .single();

  if (error || !payment) {
    logWarn('결제 레코드 찾을 수 없음', {
      action: 'webhook_payment_status',
      paymentKey: '[REDACTED]', // 민감 정보 마스킹
    });
    return;
  }

  // 금액 무결성 검증 (웹훅에 금액이 포함된 경우)
  if (webhookAmount !== undefined && payment.amount !== webhookAmount) {
    logError('결제 금액 불일치 감지', new Error('Amount mismatch'), {
      action: 'webhook_payment_status',
      orderId: payment.order_id,
      expectedAmount: payment.amount,
      receivedAmount: webhookAmount,
    });
    // 금액 불일치는 심각한 보안 문제이므로 처리 중단
    throw new Error('결제 금액이 일치하지 않습니다.');
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

  logInfo('결제 상태 업데이트', {
    action: 'webhook_payment_status',
    orderId: payment.order_id,
    newStatus,
  });
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
    logWarn('customerKey 또는 status 누락', { action: 'webhook_billing_status' });
    return;
  }

  logInfo('빌링키 상태 변경', {
    action: 'webhook_billing_status',
    customerKey: '[REDACTED]', // 민감 정보 마스킹
    status,
  });

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

      logInfo('구독 상태 past_due 변경', {
        action: 'webhook_billing_status',
        userId: profile.id,
      });
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
  const webhookAmount = data.totalAmount as number | undefined;
  // Note: secret은 가상계좌 입금 확인 시 검증에 사용될 수 있으나 현재는 미사용
  // const secret = data.secret as string | undefined;

  if (!orderId) {
    logWarn('orderId 누락', { action: 'webhook_virtual_account' });
    return;
  }

  logInfo('가상계좌 입금 완료', { action: 'webhook_virtual_account', orderId });

  // 결제 레코드 조회
  const { data: payment, error } = await adminClient
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (error || !payment) {
    logWarn('가상계좌 결제 레코드 찾을 수 없음', {
      action: 'webhook_virtual_account',
      orderId,
    });
    return;
  }

  // 금액 무결성 검증
  if (webhookAmount !== undefined && payment.amount !== webhookAmount) {
    logError('가상계좌 입금 금액 불일치 감지', new Error('Amount mismatch'), {
      action: 'webhook_virtual_account',
      orderId,
      expectedAmount: payment.amount,
      receivedAmount: webhookAmount,
    });
    throw new Error('입금 금액이 일치하지 않습니다.');
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
// DEPOSIT_CALLBACK 핸들러 (간편결제/계좌이체 완료)
// ────────────────────────────────────────────────────────────

async function handleDepositCallback(
  data: Record<string, unknown>,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<void> {
  const orderId = data.orderId as string | undefined;
  const paymentKey = data.paymentKey as string | undefined;
  const status = data.status as string | undefined;
  const webhookAmount = data.totalAmount as number | undefined;

  logInfo('입금 콜백 수신', {
    action: 'webhook_deposit_callback',
    orderId,
    status,
  });

  if (!orderId) {
    logWarn('orderId 누락', { action: 'webhook_deposit_callback' });
    return;
  }

  // 결제 완료 상태가 아니면 무시
  if (status !== 'DONE') {
    logInfo('결제 미완료 상태, 처리 건너뜀', {
      action: 'webhook_deposit_callback',
      orderId,
      status,
    });
    return;
  }

  // 결제 레코드 조회
  const { data: payment, error } = await adminClient
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (error || !payment) {
    logWarn('결제 레코드 찾을 수 없음', {
      action: 'webhook_deposit_callback',
      orderId,
    });
    return;
  }

  // 금액 무결성 검증
  if (webhookAmount !== undefined && payment.amount !== webhookAmount) {
    logError('입금 콜백 금액 불일치 감지', new Error('Amount mismatch'), {
      action: 'webhook_deposit_callback',
      orderId,
      expectedAmount: payment.amount,
      receivedAmount: webhookAmount,
    });
    throw new Error('결제 금액이 일치하지 않습니다.');
  }

  // 이미 처리된 결제인지 확인
  if (payment.status === 'completed') {
    logInfo('이미 처리된 결제', {
      action: 'webhook_deposit_callback',
      orderId,
    });
    return;
  }

  // 결제 상태 업데이트
  const updateData: Record<string, unknown> = {
    status: 'completed',
    paid_at: new Date().toISOString(),
  };

  if (paymentKey) {
    updateData.payment_key = paymentKey;
  }

  await adminClient
    .from('payments')
    .update(updateData)
    .eq('id', payment.id);

  // 결제 타입에 따른 후처리
  const paymentRecord: PaymentRecord = {
    id: payment.id,
    user_id: payment.user_id,
    type: payment.type,
    metadata: (payment.metadata as Record<string, unknown>) ?? {},
  };

  if (payment.type === 'credit_purchase') {
    // 크레딧 지급
    await grantCredits(paymentRecord, adminClient);
    logInfo('크레딧 지급 완료', {
      action: 'webhook_deposit_callback',
      orderId,
      userId: payment.user_id,
    });
  } else if (payment.type === 'subscription') {
    // 구독 처리는 confirmSubscription에서 처리됨
    // 여기서는 결제 상태만 업데이트
    logInfo('구독 결제 완료', {
      action: 'webhook_deposit_callback',
      orderId,
      userId: payment.user_id,
    });
  }
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

    // RPC 함수로 원자적 크레딧 차감
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      'deduct_credit_for_refund_atomic',
      {
        p_user_id: payment.user_id,
        p_amount: credits,
        p_payment_id: payment.id,
        p_description: '결제 취소로 인한 크레딧 차감',
      }
    );

    if (rpcError) {
      logError('크레딧 차감 RPC 실패', rpcError, {
        action: 'handlePaymentCancellation',
        paymentId: payment.id,
        userId: payment.user_id,
        credits,
      });
      return;
    }

    // RPC 결과 타입 정의
    type CreditDeductResult = {
      success: boolean;
      error_message?: string;
      deducted_amount?: number;
      new_balance?: number;
    };
    const result = (Array.isArray(rpcResult) ? rpcResult[0] : rpcResult) as CreditDeductResult | undefined;
    if (!result?.success) {
      // 이미 처리된 환불이면 정상 케이스
      if (result?.error_message === '이미 처리된 환불입니다.') {
        logInfo('중복 환불 요청 무시', {
          action: 'handlePaymentCancellation',
          paymentId: payment.id,
        });
        return;
      }
      logError('크레딧 차감 실패', new Error(result?.error_message || 'Unknown'), {
        action: 'handlePaymentCancellation',
        paymentId: payment.id,
        userId: payment.user_id,
      });
      return;
    }

    logInfo('크레딧 차감 완료', {
      action: 'handlePaymentCancellation',
      paymentId: payment.id,
      userId: payment.user_id,
      deductedAmount: result.deducted_amount,
      newBalance: result.new_balance,
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

  // 프로필 잔액 업데이트
  await adminClient
    .from('profiles')
    .update({ credits_balance: newBalance })
    .eq('id', payment.user_id);
}
