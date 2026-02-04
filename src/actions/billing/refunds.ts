'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireAuth, AuthError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseRpcResult, type RpcResultBase } from '@/lib/supabase/helpers';
import { getTossClient, PaymentError } from '@/lib/payment/toss';
import { logError, logWarn } from '@/lib/logger';
import { alertRefundSyncFailed } from '@/lib/notification/admin-alert';
import {
  checkRateLimit,
  getClientIP,
  getRateLimitErrorMessage,
  RATE_LIMIT_PRESETS,
} from '@/lib/rate-limit';
import { refundRequestSchema } from '@/lib/validators/payment';
import type { Payment } from '@/types/database.types';

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────

// 결제 메타데이터 타입 (Json 타입을 구체화)
interface PaymentMetadata {
  credits?: number;
  creditPackageId?: string;
  planId?: string;
  billingCycle?: string;
  [key: string]: unknown;
}

export interface RefundRequest {
  paymentId: string;
  reason?: string;
  refundAmount?: number; // 부분 환불 시 사용
}

export interface CreateRefundRequestInput {
  paymentId: string;
  reason: string;
  requestedAmount?: number;
}

// ────────────────────────────────────────────────────────────
// 환불 처리
// ────────────────────────────────────────────────────────────

/**
 * 결제 환불 요청
 * - Rate Limiting 적용 (분당 3회)
 * - Zod 입력값 검증
 * - 전체 환불 또는 부분 환불 지원
 * - 원자적 트랜잭션으로 크레딧/구독 환불 처리
 */
export async function requestRefund(request: RefundRequest): Promise<{
  success: boolean;
  data?: { refundAmount: number; refundedAt: string };
  error?: string;
}> {
  try {
    // 1. Rate Limiting (IP 기반)
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = await checkRateLimit(
      clientIP,
      'refund_request',
      RATE_LIMIT_PRESETS.REFUND_REQUEST
    );

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: getRateLimitErrorMessage(rateLimitResult),
      };
    }

    // 2. 입력값 검증
    const validated = refundRequestSchema.safeParse(request);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message || '입력값이 올바르지 않습니다',
      };
    }

    // 3. 인증 확인
    const { user, supabase } = await requireAuth();

    // 4. 결제 정보 조회
    const { data: paymentData, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', validated.data.paymentId)
      .eq('user_id', user.id)
      .single();

    const payment = paymentData as Payment | null;
    if (fetchError || !payment) {
      return { success: false, error: '결제 정보를 찾을 수 없습니다' };
    }

    // 이미 환불된 결제인지 확인
    if (payment.status === 'refunded') {
      return { success: false, error: '이미 환불된 결제입니다' };
    }

    // 환불 가능한 상태인지 확인
    if (payment.status !== 'completed') {
      return { success: false, error: '환불 가능한 상태가 아닙니다' };
    }

    // 5. 환불 금액 결정
    const refundAmount = validated.data.refundAmount ?? payment.amount;
    if (refundAmount > payment.amount) {
      return { success: false, error: '환불 금액이 결제 금액을 초과합니다' };
    }

    // 6. 토스페이먼츠 환불 API 호출
    const tossClient = getTossClient();
    const adminClient = createAdminClient();
    const isPartialRefund = refundAmount < payment.amount;
    const reason = validated.data.reason || '고객 요청';

    // payment_key 확인
    if (!payment.payment_key) {
      return { success: false, error: '결제 키가 없어 환불할 수 없습니다' };
    }

    // 토스 환불 성공 여부 추적
    let tossRefundSucceeded = false;

    await tossClient.cancelPayment(
      payment.payment_key,
      reason,
      refundAmount
    );

    // 토스 환불 성공
    tossRefundSucceeded = true;

    // 7. 원자적 트랜잭션으로 DB 업데이트
    // RPC 실패 시 토스 환불은 이미 완료된 상태이므로 보상 처리 필요
    let rpcSucceeded = false;
    let rpcErrorMessage = '';

    // 메타데이터 타입 캐스팅
    const metadata = payment.metadata as PaymentMetadata | null;

    if (payment.type === 'credit_purchase' && metadata?.credits) {
      // 크레딧 환불: 원자적 RPC 사용
      const creditsToDeduct = isPartialRefund
        ? Math.floor((metadata.credits * refundAmount) / payment.amount)
        : metadata.credits;

      const { data: rpcResult, error: rpcError } = await adminClient.rpc(
        'process_credit_refund_atomic',
        {
          p_payment_id: payment.id,
          p_user_id: user.id,
          p_refund_amount: refundAmount,
          p_is_partial: isPartialRefund,
          p_credits_to_deduct: creditsToDeduct,
          p_reason: reason,
        }
      );

      if (rpcError) {
        rpcErrorMessage = rpcError.message;
        logError('크레딧 환불 RPC 오류', rpcError, {
          userId: user.id,
          paymentId: payment.id,
          action: 'requestRefund',
          tossRefundSucceeded,
        });
      } else {
        const parsed = parseRpcResult<RpcResultBase>(rpcResult);
        if (parsed.success) {
          rpcSucceeded = true;
        } else {
          rpcErrorMessage = parsed.error;
          logError('크레딧 환불 트랜잭션 실패', new Error(parsed.error), {
            userId: user.id,
            paymentId: payment.id,
            action: 'requestRefund',
            tossRefundSucceeded,
          });
        }
      }
    } else if (payment.type === 'subscription' && payment.subscription_id) {
      // 구독 환불: 원자적 RPC 사용
      const { data: rpcResult, error: rpcError } = await adminClient.rpc(
        'process_subscription_refund_atomic',
        {
          p_payment_id: payment.id,
          p_subscription_id: payment.subscription_id,
          p_user_id: user.id,
          p_refund_amount: refundAmount,
          p_is_partial: isPartialRefund,
          p_reason: reason,
        }
      );

      if (rpcError) {
        rpcErrorMessage = rpcError.message;
        logError('구독 환불 RPC 오류', rpcError, {
          userId: user.id,
          paymentId: payment.id,
          action: 'requestRefund',
          tossRefundSucceeded,
        });
      } else {
        const parsed = parseRpcResult<RpcResultBase>(rpcResult);
        if (parsed.success) {
          rpcSucceeded = true;
        } else {
          rpcErrorMessage = parsed.error;
          logError('구독 환불 트랜잭션 실패', new Error(parsed.error), {
            userId: user.id,
            paymentId: payment.id,
            action: 'requestRefund',
            tossRefundSucceeded,
          });
        }
      }
    } else {
      // 일반 환불: 원자적 RPC 사용
      const { data: rpcResult, error: rpcError } = await adminClient.rpc(
        'process_simple_refund_atomic',
        {
          p_payment_id: payment.id,
          p_refund_amount: refundAmount,
          p_is_partial: isPartialRefund,
          p_reason: reason,
        }
      );

      if (rpcError) {
        rpcErrorMessage = rpcError.message;
        logError('일반 환불 RPC 오류', rpcError, {
          userId: user.id,
          paymentId: payment.id,
          action: 'requestRefund',
          tossRefundSucceeded,
        });
      } else {
        const parsed = parseRpcResult<RpcResultBase>(rpcResult);
        if (parsed.success) {
          rpcSucceeded = true;
        } else {
          rpcErrorMessage = parsed.error;
          logError('일반 환불 트랜잭션 실패', new Error(parsed.error), {
            userId: user.id,
            paymentId: payment.id,
            action: 'requestRefund',
            tossRefundSucceeded,
          });
        }
      }
    }

    // 8. 보상 트랜잭션: 토스 환불 성공 + DB 업데이트 실패 시
    if (tossRefundSucceeded && !rpcSucceeded) {
      // 수동 개입 필요 로그 기록
      await adminClient.from('webhook_logs').insert({
        event_type: 'REFUND_DB_SYNC_FAILED',
        payload: {
          paymentId: payment.id,
          userId: user.id,
          refundAmount,
          isPartialRefund,
          reason,
          paymentKey: '[REDACTED]', // 민감 정보 제외
          orderId: payment.order_id,
          paymentType: payment.type,
          errorMessage: rpcErrorMessage,
          requiresManualIntervention: true,
          tossRefundSucceeded: true,
        },
        status: 'pending',
        error: `토스 환불 완료, DB 동기화 실패: ${rpcErrorMessage}`,
      });

      logError('보상 트랜잭션 필요: 토스 환불 완료, DB 미반영', new Error(rpcErrorMessage), {
        userId: user.id,
        paymentId: payment.id,
        orderId: payment.order_id,
        refundAmount,
        action: 'requestRefund',
        requiresManualIntervention: true,
      });

      // 관리자 알림 전송 (Slack/이메일)
      await alertRefundSyncFailed({
        paymentId: payment.id,
        userId: user.id,
        orderId: payment.order_id,
        refundAmount,
        error: rpcErrorMessage || 'DB 트랜잭션 실패',
      }).catch(() => {
        // 알림 실패는 환불 처리에 영향 주지 않음
        logWarn('관리자 알림 전송 실패', {
          action: 'admin_alert_failed',
          originalError: rpcErrorMessage,
        });
      });

      // 토스 환불은 성공했으므로 사용자에게는 성공 응답
      // 단, 시스템 반영 지연 가능성 안내
      revalidatePath('/settings');
      revalidatePath('/history');

      // 토스 환불 성공, RPC 실패 케이스: 성공 응답 반환
      // 참고: 시스템 반영 지연 가능성 있음 (관리자에게 알림 전송됨)
      return {
        success: true,
        data: {
          refundAmount,
          refundedAt: new Date().toISOString(),
        },
      };
    }

    // RPC도 실패하고 토스도 실패한 경우 (토스 실패 시 예외가 발생하므로 여기 도달 안 함)
    if (!rpcSucceeded) {
      return { success: false, error: rpcErrorMessage || '환불 처리에 실패했습니다' };
    }

    revalidatePath('/settings');
    revalidatePath('/history');

    return {
      success: true,
      data: {
        refundAmount,
        refundedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('환불 처리 오류', error, { action: 'requestRefund' });

    if (error instanceof PaymentError) {
      return { success: false, error: `환불 실패: ${error.message}` };
    }

    return { success: false, error: '환불 처리 중 오류가 발생했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 환불 가능 여부 확인
// ────────────────────────────────────────────────────────────

/**
 * 환불 가능 여부 확인
 */
export async function checkRefundEligibility(paymentId: string): Promise<{
  eligible: boolean;
  reason?: string;
  maxRefundAmount?: number;
}> {
  try {
    const { user, supabase } = await requireAuth();

    const { data: paymentData } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('user_id', user.id)
      .single();

    const payment = paymentData as Payment | null;
    if (!payment) {
      return { eligible: false, reason: '결제 정보를 찾을 수 없습니다' };
    }

    if (payment.status === 'refunded') {
      return { eligible: false, reason: '이미 환불된 결제입니다' };
    }

    if (payment.status !== 'completed') {
      return { eligible: false, reason: '환불 가능한 상태가 아닙니다' };
    }

    // 결제일로부터 7일 이내만 환불 가능
    const paymentDate = new Date(payment.created_at);
    const daysSincePayment = Math.floor(
      (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSincePayment > 7) {
      return { eligible: false, reason: '환불 가능 기간(7일)이 지났습니다' };
    }

    // 부분 환불된 경우 남은 금액만 환불 가능
    const maxRefundAmount = payment.amount - (payment.refund_amount || 0);

    return {
      eligible: true,
      maxRefundAmount,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { eligible: false, reason: error.message };
    }
    throw error;
  }
}

// ────────────────────────────────────────────────────────────
// 환불 요청 생성 (관리자 승인 필요)
// ────────────────────────────────────────────────────────────

/**
 * 환불 요청 생성 (관리자 승인 필요한 경우)
 * - 일반 환불은 requestRefund 사용
 * - 7일 초과 또는 대용량 환불은 이 함수 사용하여 관리자 검토 요청
 */
export async function createRefundRequest(input: CreateRefundRequestInput): Promise<{
  success: boolean;
  data?: { requestId: string; status: string };
  error?: string;
}> {
  try {
    // Rate Limiting
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = await checkRateLimit(
      clientIP,
      'refund_request',
      RATE_LIMIT_PRESETS.REFUND_REQUEST
    );

    if (!rateLimitResult.allowed) {
      return { success: false, error: getRateLimitErrorMessage(rateLimitResult) };
    }

    // 인증 확인
    const { user, supabase } = await requireAuth();

    // 결제 정보 조회
    const { data: paymentData, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', input.paymentId)
      .eq('user_id', user.id)
      .single();

    const payment = paymentData as Payment | null;
    if (fetchError || !payment) {
      return { success: false, error: '결제 정보를 찾을 수 없습니다' };
    }

    // 상태 확인
    if (payment.status === 'refunded') {
      return { success: false, error: '이미 환불된 결제입니다' };
    }

    if (payment.status !== 'completed' && payment.status !== 'partial_refunded') {
      return { success: false, error: '환불 가능한 상태가 아닙니다' };
    }

    // 환불 금액 결정
    const maxRefundable = payment.amount - (payment.refund_amount || 0);
    const requestedAmount = input.requestedAmount ?? maxRefundable;

    if (requestedAmount > maxRefundable) {
      return { success: false, error: '환불 금액이 환불 가능 금액을 초과합니다' };
    }

    // 환불 유형 결정
    const metadata = payment.metadata as PaymentMetadata | null;
    let refundType: 'full' | 'partial' | 'prorated' = 'full';
    let originalCredits = 0;
    let usedCredits = 0;
    let refundableCredits = 0;

    if (payment.type === 'credit_purchase' && metadata?.credits) {
      originalCredits = metadata.credits;

      // 사용한 크레딧 계산 (프로레이션)
      const adminClient = createAdminClient();
      const { data: calcResult } = await adminClient.rpc('calculate_prorated_refund', {
        p_payment_id: payment.id,
        p_user_id: user.id,
      });

      if (calcResult) {
        const result = Array.isArray(calcResult) ? calcResult[0] : calcResult;
        if (result?.success) {
          usedCredits = result.used_credits ?? 0;
          refundableCredits = result.refundable_credits ?? originalCredits;
          refundType = usedCredits > 0 ? 'prorated' : 'full';
        }
      }
    } else if (requestedAmount < maxRefundable) {
      refundType = 'partial';
    }

    // 환불 요청 생성 (RPC)
    const adminClient = createAdminClient();
    const { data: rpcResult, error: rpcError } = await adminClient.rpc('create_refund_request', {
      p_payment_id: payment.id,
      p_user_id: user.id,
      p_requested_amount: requestedAmount,
      p_refund_type: refundType,
      p_reason: input.reason,
      p_original_credits: originalCredits || undefined,
      p_used_credits: usedCredits || undefined,
      p_refundable_credits: refundableCredits || undefined,
      p_proration_details: originalCredits > 0 ? {
        originalCredits,
        usedCredits,
        refundableCredits,
        originalAmount: payment.amount,
        refundableAmount: requestedAmount,
      } : undefined,
    });

    if (rpcError) {
      logError('환불 요청 생성 RPC 오류', rpcError, {
        userId: user.id,
        paymentId: payment.id,
        action: 'createRefundRequest',
      });
      return { success: false, error: '환불 요청 생성에 실패했습니다' };
    }

    interface RefundRequestRpcResult extends RpcResultBase {
      request_id: string | null;
    }
    const parsed = parseRpcResult<RefundRequestRpcResult>(rpcResult);
    if (!parsed.success) {
      return { success: false, error: parsed.error };
    }

    revalidatePath('/settings');

    return {
      success: true,
      data: {
        requestId: parsed.data.request_id ?? '',
        status: 'pending' as const,
      },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('환불 요청 생성 오류', error, { action: 'createRefundRequest' });
    return { success: false, error: '환불 요청 생성 중 오류가 발생했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 환불 요청 조회
// ────────────────────────────────────────────────────────────

/**
 * 사용자의 환불 요청 목록 조회
 */
export async function getUserRefundRequests(page = 1, limit = 10): Promise<{
  success: boolean;
  data?: {
    requests: Array<{
      id: string;
      paymentId: string;
      requestedAmount: number;
      approvedAmount: number | null;
      status: string;
      reason: string;
      rejectionReason: string | null;
      createdAt: string;
      processedAt: string | null;
    }>;
    total: number;
  };
  error?: string;
}> {
  try {
    const { user, supabase } = await requireAuth();

    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('refund_requests')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logError('환불 요청 목록 조회 오류', error, { userId: user.id, action: 'getUserRefundRequests' });
      return { success: false, error: '환불 요청 목록을 조회할 수 없습니다' };
    }

    // 타입 변환
    interface RefundRequestRow {
      id: string;
      payment_id: string;
      requested_amount: number;
      approved_amount: number | null;
      status: string;
      reason: string;
      rejection_reason: string | null;
      created_at: string;
      processed_at: string | null;
    }

    const requests = (data as RefundRequestRow[] | null)?.map(row => ({
      id: row.id,
      paymentId: row.payment_id,
      requestedAmount: row.requested_amount,
      approvedAmount: row.approved_amount,
      status: row.status,
      reason: row.reason,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      processedAt: row.processed_at,
    })) ?? [];

    return {
      success: true,
      data: {
        requests,
        total: count || 0,
      },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

// ────────────────────────────────────────────────────────────
// 환불 요청 취소
// ────────────────────────────────────────────────────────────

/**
 * 환불 요청 취소 (pending 상태인 경우만)
 */
export async function cancelRefundRequest(requestId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { user, supabase } = await requireAuth();

    // 요청 조회 및 소유권 확인
    const { data: request, error: fetchError } = await supabase
      .from('refund_requests')
      .select('id, user_id, status')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return { success: false, error: '환불 요청을 찾을 수 없습니다' };
    }

    if (request.user_id !== user.id) {
      return { success: false, error: '권한이 없습니다' };
    }

    if (request.status !== 'pending') {
      return { success: false, error: '취소할 수 없는 상태입니다' };
    }

    // 상태 업데이트
    const { error: updateError } = await supabase
      .from('refund_requests')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      logError('환불 요청 취소 오류', updateError, { requestId, action: 'cancelRefundRequest' });
      return { success: false, error: '환불 요청 취소에 실패했습니다' };
    }

    revalidatePath('/settings');

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}
