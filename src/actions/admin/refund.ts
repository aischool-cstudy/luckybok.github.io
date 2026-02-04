'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireAuth, AuthError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseRpcResult, type RpcResultBase } from '@/lib/supabase/helpers';
import { getTossClient, PaymentError } from '@/lib/payment/toss';
import { logError, logInfo } from '@/lib/logger';
import {
  checkRateLimit,
  getClientIP,
  getRateLimitErrorMessage,
  RATE_LIMIT_PRESETS,
} from '@/lib/rate-limit';
import type { Payment } from '@/types/database.types';

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────

interface PaymentMetadata {
  credits?: number;
  creditPackageId?: string;
  planId?: string;
  billingCycle?: string;
  [key: string]: unknown;
}

export interface RefundRequestInfo {
  id: string;
  paymentId: string;
  userId: string;
  requestedAmount: number;
  approvedAmount: number | null;
  refundType: 'full' | 'partial' | 'prorated';
  status: string;
  reason: string;
  adminNote: string | null;
  rejectionReason: string | null;
  processedAt: string | null;
  retryCount: number;
  createdAt: string;
  user?: {
    email: string;
    name: string | null;
  };
  payment?: {
    amount: number;
    type: string;
    orderId: string;
  };
}

export interface AdminRefundStats {
  totalRequests: number;
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  rejectedCount: number;
  totalRefundedAmount: number;
  avgProcessingMinutes: number;
}

// ────────────────────────────────────────────────────────────
// 관리자 권한 확인
// ────────────────────────────────────────────────────────────

async function checkAdminAccess(): Promise<{ isAdmin: boolean; userId?: string; error?: string }> {
  let user;
  let supabase;
  try {
    const authResult = await requireAuth();
    user = authResult.user;
    supabase = authResult.supabase;
  } catch (error) {
    if (error instanceof AuthError) {
      return { isAdmin: false, error: error.message };
    }
    throw error;
  }

  // 프로필에서 관리자 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // role이 'admin' 또는 'super_admin'인 경우 관리자 권한
  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    return { isAdmin: false, error: '관리자 권한이 필요합니다' };
  }

  return { isAdmin: true, userId: user.id };
}

// ────────────────────────────────────────────────────────────
// 환불 요청 목록 조회
// ────────────────────────────────────────────────────────────

export interface RefundRequestFilters {
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'rejected' | 'canceled' | 'all';
  userId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * 환불 요청 목록 조회 (관리자용)
 */
export async function getRefundRequests(
  page = 1,
  limit = 20,
  filters?: RefundRequestFilters
): Promise<{
  success: boolean;
  data?: {
    requests: RefundRequestInfo[];
    total: number;
  };
  error?: string;
}> {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    return { success: false, error: adminCheck.error };
  }

  try {
    const adminClient = createAdminClient();
    const offset = (page - 1) * limit;

    let query = adminClient
      .from('refund_requests')
      .select(`
        id,
        payment_id,
        user_id,
        requested_amount,
        approved_amount,
        refund_type,
        status,
        reason,
        admin_note,
        rejection_reason,
        processed_at,
        retry_count,
        created_at,
        profiles!inner(email, name),
        payments!inner(amount, type, order_id)
      `, { count: 'exact' });

    // 필터 적용
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters?.endDate) {
      const endDateTime = new Date(filters.endDate);
      endDateTime.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endDateTime.toISOString());
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logError('환불 요청 목록 조회 오류', error, { action: 'getRefundRequests' });
      return { success: false, error: '환불 요청 목록을 조회할 수 없습니다' };
    }

    // 타입 변환 및 매핑
    interface RefundRequestRow {
      id: string;
      payment_id: string;
      user_id: string;
      requested_amount: number;
      approved_amount: number | null;
      refund_type: 'full' | 'partial' | 'prorated';
      status: string;
      reason: string;
      admin_note: string | null;
      rejection_reason: string | null;
      processed_at: string | null;
      retry_count: number;
      created_at: string;
      profiles: { email: string; name: string | null };
      payments: { amount: number; type: string; order_id: string };
    }

    const requests: RefundRequestInfo[] = (data as RefundRequestRow[] | null)?.map(row => ({
      id: row.id,
      paymentId: row.payment_id,
      userId: row.user_id,
      requestedAmount: row.requested_amount,
      approvedAmount: row.approved_amount,
      refundType: row.refund_type,
      status: row.status,
      reason: row.reason,
      adminNote: row.admin_note,
      rejectionReason: row.rejection_reason,
      processedAt: row.processed_at,
      retryCount: row.retry_count,
      createdAt: row.created_at,
      user: {
        email: row.profiles.email,
        name: row.profiles.name,
      },
      payment: {
        amount: row.payments.amount,
        type: row.payments.type,
        orderId: row.payments.order_id,
      },
    })) ?? [];

    return {
      success: true,
      data: {
        requests,
        total: count || 0,
      },
    };
  } catch (error) {
    logError('환불 요청 목록 조회 오류', error, { action: 'getRefundRequests' });
    return { success: false, error: '환불 요청 목록을 조회할 수 없습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 환불 요청 상세 조회
// ────────────────────────────────────────────────────────────

/**
 * 환불 요청 상세 조회 (관리자용)
 */
export async function getRefundRequestDetail(requestId: string): Promise<{
  success: boolean;
  data?: RefundRequestInfo & {
    originalCredits?: number;
    usedCredits?: number;
    refundableCredits?: number;
    prorationDetails?: Record<string, unknown>;
    tossResponse?: Record<string, unknown>;
    lastError?: string;
  };
  error?: string;
}> {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    return { success: false, error: adminCheck.error };
  }

  try {
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('refund_requests')
      .select(`
        *,
        profiles!inner(email, name),
        payments!inner(amount, type, order_id, payment_key, status)
      `)
      .eq('id', requestId)
      .single();

    if (error || !data) {
      return { success: false, error: '환불 요청을 찾을 수 없습니다' };
    }

    // 타입 안전하게 처리
    interface DetailRow {
      id: string;
      payment_id: string;
      user_id: string;
      requested_amount: number;
      approved_amount: number | null;
      refund_type: 'full' | 'partial' | 'prorated';
      status: string;
      reason: string;
      admin_note: string | null;
      rejection_reason: string | null;
      processed_at: string | null;
      retry_count: number;
      created_at: string;
      original_credits: number | null;
      used_credits: number | null;
      refundable_credits: number | null;
      proration_details: Record<string, unknown> | null;
      toss_response: Record<string, unknown> | null;
      last_error: string | null;
      profiles: { email: string; name: string | null };
      payments: { amount: number; type: string; order_id: string; payment_key: string; status: string };
    }

    const row = data as DetailRow;

    return {
      success: true,
      data: {
        id: row.id,
        paymentId: row.payment_id,
        userId: row.user_id,
        requestedAmount: row.requested_amount,
        approvedAmount: row.approved_amount,
        refundType: row.refund_type,
        status: row.status,
        reason: row.reason,
        adminNote: row.admin_note,
        rejectionReason: row.rejection_reason,
        processedAt: row.processed_at,
        retryCount: row.retry_count,
        createdAt: row.created_at,
        user: {
          email: row.profiles.email,
          name: row.profiles.name,
        },
        payment: {
          amount: row.payments.amount,
          type: row.payments.type,
          orderId: row.payments.order_id,
        },
        originalCredits: row.original_credits ?? undefined,
        usedCredits: row.used_credits ?? undefined,
        refundableCredits: row.refundable_credits ?? undefined,
        prorationDetails: row.proration_details ?? undefined,
        tossResponse: row.toss_response ?? undefined,
        lastError: row.last_error ?? undefined,
      },
    };
  } catch (error) {
    logError('환불 요청 상세 조회 오류', error, { requestId, action: 'getRefundRequestDetail' });
    return { success: false, error: '환불 요청을 조회할 수 없습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 환불 요청 승인
// ────────────────────────────────────────────────────────────

/**
 * 환불 요청 승인 및 처리 (관리자용)
 */
export async function approveRefundRequest(input: {
  requestId: string;
  approvedAmount?: number; // 미지정 시 요청 금액 전체 승인
  adminNote?: string;
}): Promise<{
  success: boolean;
  data?: { refundedAmount: number; refundedAt: string };
  error?: string;
}> {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    return { success: false, error: adminCheck.error };
  }

  try {
    // Rate Limiting
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = await checkRateLimit(
      clientIP,
      'admin_refund_approve',
      RATE_LIMIT_PRESETS.PAYMENT_CONFIRM
    );

    if (!rateLimitResult.allowed) {
      return { success: false, error: getRateLimitErrorMessage(rateLimitResult) };
    }

    const adminClient = createAdminClient();

    // 환불 요청 조회
    const { data: requestData, error: fetchError } = await adminClient
      .from('refund_requests')
      .select(`
        *,
        payments!inner(*)
      `)
      .eq('id', input.requestId)
      .single();

    if (fetchError || !requestData) {
      return { success: false, error: '환불 요청을 찾을 수 없습니다' };
    }

    // 타입 정의
    interface RequestWithPayment {
      id: string;
      payment_id: string;
      user_id: string;
      requested_amount: number;
      status: string;
      reason: string;
      refund_type: 'full' | 'partial' | 'prorated';
      refundable_credits: number | null;
      payments: Payment;
    }

    const request = requestData as RequestWithPayment;

    // 상태 확인
    if (request.status !== 'pending' && request.status !== 'failed') {
      return { success: false, error: '승인 가능한 상태가 아닙니다' };
    }

    const payment = request.payments;
    const approvedAmount = input.approvedAmount ?? request.requested_amount;

    // 금액 검증
    if (approvedAmount > payment.amount - (payment.refund_amount || 0)) {
      return { success: false, error: '환불 금액이 환불 가능 금액을 초과합니다' };
    }

    // 상태를 processing으로 업데이트
    await adminClient.rpc('update_refund_request_status', {
      p_request_id: request.id,
      p_status: 'processing',
      p_approved_amount: approvedAmount,
      p_processed_by: adminCheck.userId,
      p_admin_note: input.adminNote,
    });

    // 토스페이먼츠 환불 API 호출
    const tossClient = getTossClient();
    let tossResponse;

    try {
      tossResponse = await tossClient.cancelPayment(
        payment.payment_key!,
        request.reason,
        approvedAmount
      );
    } catch (error) {
      // 토스 API 실패 - 상태를 failed로 업데이트
      const errorMessage = error instanceof PaymentError ? error.message : '환불 API 호출 실패';

      await adminClient.rpc('update_refund_request_status', {
        p_request_id: request.id,
        p_status: 'failed',
        p_error: errorMessage,
      });

      logError('관리자 환불 토스 API 오류', error, {
        requestId: request.id,
        paymentId: payment.id,
        action: 'approveRefundRequest',
      });

      return { success: false, error: `환불 실패: ${errorMessage}` };
    }

    // DB 환불 처리 (원자적 RPC)
    const metadata = payment.metadata as PaymentMetadata | null;
    const isPartialRefund = approvedAmount < payment.amount;
    let rpcSucceeded = false;

    if (payment.type === 'credit_purchase' && metadata?.credits) {
      const creditsToDeduct = request.refundable_credits ?? Math.floor(
        (metadata.credits * approvedAmount) / payment.amount
      );

      const { data: rpcResult, error: rpcError } = await adminClient.rpc(
        'process_credit_refund_atomic',
        {
          p_payment_id: payment.id,
          p_user_id: request.user_id,
          p_refund_amount: approvedAmount,
          p_is_partial: isPartialRefund,
          p_credits_to_deduct: creditsToDeduct,
          p_reason: request.reason,
        }
      );

      if (!rpcError) {
        const parsed = parseRpcResult<RpcResultBase>(rpcResult);
        rpcSucceeded = parsed.success;
      }
    } else if (payment.type === 'subscription' && payment.subscription_id) {
      const { data: rpcResult, error: rpcError } = await adminClient.rpc(
        'process_subscription_refund_atomic',
        {
          p_payment_id: payment.id,
          p_subscription_id: payment.subscription_id,
          p_user_id: request.user_id,
          p_refund_amount: approvedAmount,
          p_is_partial: isPartialRefund,
          p_reason: request.reason,
        }
      );

      if (!rpcError) {
        const parsed = parseRpcResult<RpcResultBase>(rpcResult);
        rpcSucceeded = parsed.success;
      }
    } else {
      const { data: rpcResult, error: rpcError } = await adminClient.rpc(
        'process_simple_refund_atomic',
        {
          p_payment_id: payment.id,
          p_refund_amount: approvedAmount,
          p_is_partial: isPartialRefund,
          p_reason: request.reason,
        }
      );

      if (!rpcError) {
        const parsed = parseRpcResult<RpcResultBase>(rpcResult);
        rpcSucceeded = parsed.success;
      }
    }

    // 환불 요청 상태 업데이트
    await adminClient.rpc('update_refund_request_status', {
      p_request_id: request.id,
      p_status: rpcSucceeded ? 'completed' : 'failed',
      p_approved_amount: approvedAmount,
      p_processed_by: adminCheck.userId,
      p_admin_note: input.adminNote,
      p_toss_response: JSON.parse(JSON.stringify(tossResponse)),
      p_error: rpcSucceeded ? undefined : 'DB 업데이트 실패 (토스 환불은 완료됨)',
    });

    logInfo('관리자 환불 처리 완료', {
      requestId: request.id,
      paymentId: payment.id,
      approvedAmount,
      adminId: adminCheck.userId,
      action: 'approveRefundRequest',
    });

    revalidatePath('/admin/refunds');
    revalidatePath('/settings');

    return {
      success: true,
      data: {
        refundedAmount: approvedAmount,
        refundedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    logError('관리자 환불 승인 오류', error, { action: 'approveRefundRequest' });
    return { success: false, error: '환불 처리 중 오류가 발생했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 환불 요청 거절
// ────────────────────────────────────────────────────────────

/**
 * 환불 요청 거절 (관리자용)
 */
export async function rejectRefundRequest(input: {
  requestId: string;
  rejectionReason: string;
  adminNote?: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    return { success: false, error: adminCheck.error };
  }

  if (!input.rejectionReason.trim()) {
    return { success: false, error: '거절 사유를 입력해주세요' };
  }

  try {
    const adminClient = createAdminClient();

    // 환불 요청 조회
    const { data: request, error: fetchError } = await adminClient
      .from('refund_requests')
      .select('id, status')
      .eq('id', input.requestId)
      .single();

    if (fetchError || !request) {
      return { success: false, error: '환불 요청을 찾을 수 없습니다' };
    }

    if (request.status !== 'pending') {
      return { success: false, error: '거절 가능한 상태가 아닙니다' };
    }

    // 상태 업데이트
    const { error: updateError } = await adminClient.rpc('update_refund_request_status', {
      p_request_id: input.requestId,
      p_status: 'rejected',
      p_processed_by: adminCheck.userId,
      p_admin_note: input.adminNote,
      p_rejection_reason: input.rejectionReason,
    });

    if (updateError) {
      logError('환불 거절 업데이트 오류', updateError, {
        requestId: input.requestId,
        action: 'rejectRefundRequest',
      });
      return { success: false, error: '환불 거절에 실패했습니다' };
    }

    logInfo('관리자 환불 거절', {
      requestId: input.requestId,
      rejectionReason: input.rejectionReason,
      adminId: adminCheck.userId,
      action: 'rejectRefundRequest',
    });

    revalidatePath('/admin/refunds');

    return { success: true };
  } catch (error) {
    logError('환불 거절 오류', error, { action: 'rejectRefundRequest' });
    return { success: false, error: '환불 거절 중 오류가 발생했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 환불 통계 조회
// ────────────────────────────────────────────────────────────

/**
 * 환불 통계 조회 (관리자용)
 */
export async function getRefundStats(): Promise<{
  success: boolean;
  data?: AdminRefundStats;
  error?: string;
}> {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    return { success: false, error: adminCheck.error };
  }

  try {
    const adminClient = createAdminClient();

    // 전체 통계
    const { data: totalData } = await adminClient
      .from('refund_requests')
      .select('status', { count: 'exact' });

    // 상태별 카운트
    const { data: statusCounts } = await adminClient
      .from('refund_requests')
      .select('status')
      .then(async result => {
        if (result.error) return { data: null };

        const counts = {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          rejected: 0,
        };

        result.data?.forEach((row: { status: string }) => {
          if (row.status in counts) {
            counts[row.status as keyof typeof counts]++;
          }
        });

        return { data: counts };
      });

    // 완료된 환불 총액
    const { data: completedData } = await adminClient
      .from('refund_requests')
      .select('approved_amount')
      .eq('status', 'completed');

    const totalRefundedAmount = completedData?.reduce(
      (sum, row) => sum + (row.approved_amount || 0),
      0
    ) ?? 0;

    // 평균 처리 시간 (완료된 것만)
    const { data: processingTimeData } = await adminClient
      .from('refund_requests')
      .select('created_at, processed_at')
      .eq('status', 'completed')
      .not('processed_at', 'is', null);

    let avgProcessingMinutes = 0;
    if (processingTimeData && processingTimeData.length > 0) {
      const totalMinutes = processingTimeData.reduce((sum, row) => {
        const created = new Date(row.created_at).getTime();
        const processed = new Date(row.processed_at!).getTime();
        return sum + (processed - created) / (1000 * 60);
      }, 0);
      avgProcessingMinutes = Math.round(totalMinutes / processingTimeData.length);
    }

    return {
      success: true,
      data: {
        totalRequests: totalData?.length ?? 0,
        pendingCount: statusCounts?.pending ?? 0,
        processingCount: statusCounts?.processing ?? 0,
        completedCount: statusCounts?.completed ?? 0,
        failedCount: statusCounts?.failed ?? 0,
        rejectedCount: statusCounts?.rejected ?? 0,
        totalRefundedAmount,
        avgProcessingMinutes,
      },
    };
  } catch (error) {
    logError('환불 통계 조회 오류', error, { action: 'getRefundStats' });
    return { success: false, error: '환불 통계를 조회할 수 없습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 프로레이션 계산 미리보기
// ────────────────────────────────────────────────────────────

/**
 * 환불 금액 계산 미리보기 (관리자용)
 */
export async function calculateRefundPreview(paymentId: string): Promise<{
  success: boolean;
  data?: {
    originalAmount: number;
    refundableAmount: number;
    originalCredits?: number;
    usedCredits?: number;
    refundableCredits?: number;
    daysSincePurchase: number;
    isWithinRefundPeriod: boolean;
    breakdown: { label: string; value: string | number }[];
  };
  error?: string;
}> {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    return { success: false, error: adminCheck.error };
  }

  try {
    const adminClient = createAdminClient();

    // 결제 정보 조회
    const { data: payment, error: fetchError } = await adminClient
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      return { success: false, error: '결제 정보를 찾을 수 없습니다' };
    }

    // RPC로 프로레이션 계산
    const { data: calcResult, error: calcError } = await adminClient.rpc(
      'calculate_prorated_refund',
      {
        p_payment_id: paymentId,
        p_user_id: payment.user_id,
      }
    );

    if (calcError) {
      logError('프로레이션 계산 오류', calcError, { paymentId, action: 'calculateRefundPreview' });
      return { success: false, error: '환불 금액 계산에 실패했습니다' };
    }

    const result = Array.isArray(calcResult) ? calcResult[0] : calcResult;

    if (!result?.success) {
      return { success: false, error: result?.error_message || '환불 금액 계산에 실패했습니다' };
    }

    return {
      success: true,
      data: {
        originalAmount: result.original_amount,
        refundableAmount: result.refundable_amount,
        originalCredits: result.original_credits || undefined,
        usedCredits: result.used_credits || undefined,
        refundableCredits: result.refundable_credits || undefined,
        daysSincePurchase: result.days_since_purchase,
        isWithinRefundPeriod: result.is_within_refund_period,
        breakdown: [
          { label: '원래 결제 금액', value: `₩${result.original_amount.toLocaleString()}` },
          { label: '환불 가능 금액', value: `₩${result.refundable_amount.toLocaleString()}` },
          { label: '결제 후 경과일', value: `${result.days_since_purchase}일` },
          { label: '환불 가능 기간 내', value: result.is_within_refund_period ? '예' : '아니오' },
          ...(result.original_credits ? [
            { label: '충전된 크레딧', value: `${result.original_credits}개` },
            { label: '사용한 크레딧', value: `${result.used_credits}개` },
            { label: '환불 가능 크레딧', value: `${result.refundable_credits}개` },
          ] : []),
        ],
      },
    };
  } catch (error) {
    logError('환불 미리보기 오류', error, { paymentId, action: 'calculateRefundPreview' });
    return { success: false, error: '환불 금액 계산에 실패했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 보상 트랜잭션 모니터링
// ────────────────────────────────────────────────────────────

export interface CompensationTransaction {
  id: string;
  paymentId: string;
  userId: string;
  orderId: string;
  refundAmount: number;
  paymentType: string;
  errorMessage: string;
  status: string;
  createdAt: string;
  user?: {
    email: string;
    name: string | null;
  };
}

export interface CompensationStats {
  pendingCount: number;
  resolvedCount: number;
  totalAmount: number;
}

/**
 * 보상 트랜잭션 목록 조회 (관리자용)
 * 토스 환불 성공 + DB 동기화 실패 케이스
 */
export async function getCompensationTransactions(
  page = 1,
  limit = 20,
  status?: 'pending' | 'resolved' | 'all'
): Promise<{
  success: boolean;
  data?: {
    transactions: CompensationTransaction[];
    total: number;
  };
  error?: string;
}> {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    return { success: false, error: adminCheck.error };
  }

  try {
    const adminClient = createAdminClient();
    const offset = (page - 1) * limit;

    // webhook_logs에서 REFUND_DB_SYNC_FAILED 이벤트 조회
    let query = adminClient
      .from('webhook_logs')
      .select('*', { count: 'exact' })
      .eq('event_type', 'REFUND_DB_SYNC_FAILED');

    if (status && status !== 'all') {
      if (status === 'pending') {
        query = query.in('status', ['pending', 'failed']);
      } else {
        query = query.eq('status', 'processed');
      }
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logError('보상 트랜잭션 조회 오류', error, { action: 'getCompensationTransactions' });
      return { success: false, error: '보상 트랜잭션 목록을 조회할 수 없습니다' };
    }

    // 타입 정의
    interface WebhookLogRow {
      id: string;
      payload: {
        paymentId?: string;
        userId?: string;
        orderId?: string;
        refundAmount?: number;
        paymentType?: string;
        errorMessage?: string;
        [key: string]: unknown;
      };
      status: string;
      created_at: string;
    }

    // 사용자 정보 일괄 조회
    const userIds = [...new Set((data as WebhookLogRow[] | null)?.map(row => row.payload?.userId).filter(Boolean) || [])];

    let usersMap: Record<string, { email: string; name: string | null }> = {};
    if (userIds.length > 0) {
      const { data: users } = await adminClient
        .from('profiles')
        .select('id, email, name')
        .in('id', userIds);

      if (users) {
        usersMap = users.reduce((acc, user) => {
          acc[user.id] = { email: user.email, name: user.name };
          return acc;
        }, {} as Record<string, { email: string; name: string | null }>);
      }
    }

    const transactions: CompensationTransaction[] = (data as WebhookLogRow[] | null)?.map(row => ({
      id: row.id,
      paymentId: row.payload?.paymentId || '',
      userId: row.payload?.userId || '',
      orderId: row.payload?.orderId || '',
      refundAmount: row.payload?.refundAmount || 0,
      paymentType: row.payload?.paymentType || '',
      errorMessage: row.payload?.errorMessage || '',
      status: row.status,
      createdAt: row.created_at,
      user: row.payload?.userId ? usersMap[row.payload.userId] : undefined,
    })) ?? [];

    return {
      success: true,
      data: {
        transactions,
        total: count || 0,
      },
    };
  } catch (error) {
    logError('보상 트랜잭션 조회 오류', error, { action: 'getCompensationTransactions' });
    return { success: false, error: '보상 트랜잭션 목록을 조회할 수 없습니다' };
  }
}

/**
 * 보상 트랜잭션 상세 조회 (관리자용)
 * 토스 결제 상태와 DB 상태 비교
 */
export async function getCompensationTransactionDetail(transactionId: string): Promise<{
  success: boolean;
  data?: {
    transaction: CompensationTransaction;
    tossStatus?: {
      status: string;
      cancels?: Array<{
        cancelAmount: number;
        canceledAt: string;
        cancelReason: string;
      }>;
    };
    dbStatus?: {
      paymentStatus: string;
      refundedAmount: number;
    };
    mismatch: boolean;
    recommendedAction: string;
  };
  error?: string;
}> {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    return { success: false, error: adminCheck.error };
  }

  try {
    const adminClient = createAdminClient();

    // 웹훅 로그 조회
    const { data: webhook, error: fetchError } = await adminClient
      .from('webhook_logs')
      .select('*')
      .eq('id', transactionId)
      .eq('event_type', 'REFUND_DB_SYNC_FAILED')
      .single();

    if (fetchError || !webhook) {
      return { success: false, error: '보상 트랜잭션을 찾을 수 없습니다' };
    }

    interface WebhookPayload {
      paymentId?: string;
      userId?: string;
      orderId?: string;
      refundAmount?: number;
      paymentType?: string;
      errorMessage?: string;
      [key: string]: unknown;
    }

    const payload = webhook.payload as WebhookPayload;
    const paymentId = payload?.paymentId;

    if (!paymentId) {
      return { success: false, error: '결제 ID가 없습니다' };
    }

    // DB 결제 상태 조회
    const { data: payment } = await adminClient
      .from('payments')
      .select('id, status, refund_amount, payment_key, order_id')
      .eq('id', paymentId)
      .single();

    // 토스 결제 상태 조회 (payment_key가 있는 경우)
    let tossStatus = null;
    if (payment?.payment_key) {
      try {
        const tossClient = getTossClient();
        const tossPayment = await tossClient.getPayment(payment.payment_key);
        tossStatus = {
          status: tossPayment.status,
          cancels: tossPayment.cancels?.map((c: { cancelAmount: number; canceledAt: string; cancelReason: string }) => ({
            cancelAmount: c.cancelAmount,
            canceledAt: c.canceledAt,
            cancelReason: c.cancelReason,
          })),
        };
      } catch (tossError) {
        logError('토스 결제 조회 오류', tossError, { paymentId, action: 'getCompensationTransactionDetail' });
      }
    }

    // 상태 불일치 확인
    const dbStatus = payment ? {
      paymentStatus: payment.status,
      refundedAmount: payment.refund_amount || 0,
    } : undefined;

    const tossRefundedAmount = tossStatus?.cancels?.reduce((sum: number, c: { cancelAmount: number }) => sum + c.cancelAmount, 0) || 0;
    const mismatch = tossRefundedAmount !== (dbStatus?.refundedAmount || 0);

    // 권장 조치 결정
    let recommendedAction = '추가 조사 필요';
    if (mismatch && tossRefundedAmount > 0 && (dbStatus?.refundedAmount || 0) === 0) {
      recommendedAction = 'DB 환불 금액 동기화 필요';
    } else if (!mismatch) {
      recommendedAction = '이미 동기화됨 - 해결 완료 처리 가능';
    }

    // 사용자 정보 조회
    let user = undefined;
    if (payload?.userId) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('email, name')
        .eq('id', payload.userId)
        .single();
      if (profile) {
        user = { email: profile.email, name: profile.name };
      }
    }

    return {
      success: true,
      data: {
        transaction: {
          id: webhook.id,
          paymentId: payload?.paymentId || '',
          userId: payload?.userId || '',
          orderId: payload?.orderId || '',
          refundAmount: payload?.refundAmount || 0,
          paymentType: payload?.paymentType || '',
          errorMessage: payload?.errorMessage || '',
          status: webhook.status,
          createdAt: webhook.created_at,
          user,
        },
        tossStatus: tossStatus || undefined,
        dbStatus,
        mismatch,
        recommendedAction,
      },
    };
  } catch (error) {
    logError('보상 트랜잭션 상세 조회 오류', error, { transactionId, action: 'getCompensationTransactionDetail' });
    return { success: false, error: '보상 트랜잭션을 조회할 수 없습니다' };
  }
}

/**
 * 보상 트랜잭션 수동 처리 (관리자용)
 * DB 상태를 토스 상태에 맞게 동기화
 */
export async function processCompensationTransaction(input: {
  transactionId: string;
  adminNote?: string;
}): Promise<{
  success: boolean;
  data?: { syncedAmount: number };
  error?: string;
}> {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    return { success: false, error: adminCheck.error };
  }

  try {
    // Rate Limiting
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = await checkRateLimit(
      clientIP,
      'admin_compensation_process',
      RATE_LIMIT_PRESETS.PAYMENT_CONFIRM
    );

    if (!rateLimitResult.allowed) {
      return { success: false, error: getRateLimitErrorMessage(rateLimitResult) };
    }

    const adminClient = createAdminClient();

    // 웹훅 로그 조회
    const { data: webhook, error: fetchError } = await adminClient
      .from('webhook_logs')
      .select('*')
      .eq('id', input.transactionId)
      .eq('event_type', 'REFUND_DB_SYNC_FAILED')
      .single();

    if (fetchError || !webhook) {
      return { success: false, error: '보상 트랜잭션을 찾을 수 없습니다' };
    }

    if (webhook.status === 'processed') {
      return { success: false, error: '이미 처리된 보상 트랜잭션입니다' };
    }

    interface WebhookPayload {
      paymentId?: string;
      userId?: string;
      refundAmount?: number;
      paymentType?: string;
      [key: string]: unknown;
    }

    const payload = webhook.payload as WebhookPayload;
    const paymentId = payload?.paymentId;
    const userId = payload?.userId;
    const refundAmount = payload?.refundAmount || 0;
    const paymentType = payload?.paymentType;

    if (!paymentId || !userId) {
      return { success: false, error: '결제 정보가 불완전합니다' };
    }

    // DB 상태 동기화 (단순 환불 RPC 재실행)
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      'process_simple_refund_atomic',
      {
        p_payment_id: paymentId,
        p_refund_amount: refundAmount,
        p_is_partial: false,
        p_reason: `관리자 보상 처리: ${input.adminNote || '수동 동기화'}`,
      }
    );

    if (rpcError) {
      logError('보상 트랜잭션 RPC 오류', rpcError, {
        transactionId: input.transactionId,
        paymentId,
        action: 'processCompensationTransaction',
      });
      return { success: false, error: 'DB 동기화에 실패했습니다' };
    }

    const parsed = parseRpcResult<RpcResultBase>(rpcResult);
    if (!parsed.success) {
      return { success: false, error: parsed.error };
    }

    // 웹훅 로그 상태 업데이트
    await adminClient
      .from('webhook_logs')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        error: null,
      })
      .eq('id', input.transactionId);

    logInfo('보상 트랜잭션 처리 완료', {
      transactionId: input.transactionId,
      paymentId,
      userId,
      refundAmount,
      paymentType,
      adminId: adminCheck.userId,
      action: 'processCompensationTransaction',
    });

    revalidatePath('/admin/refunds');

    return {
      success: true,
      data: { syncedAmount: refundAmount },
    };
  } catch (error) {
    logError('보상 트랜잭션 처리 오류', error, { action: 'processCompensationTransaction' });
    return { success: false, error: '보상 트랜잭션 처리 중 오류가 발생했습니다' };
  }
}

/**
 * 보상 트랜잭션 수동 해결 완료 처리 (관리자용)
 * 외부에서 이미 해결된 경우 완료 표시
 */
export async function markCompensationResolved(input: {
  transactionId: string;
  resolution: string;
  adminNote?: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    return { success: false, error: adminCheck.error };
  }

  if (!input.resolution.trim()) {
    return { success: false, error: '해결 내용을 입력해주세요' };
  }

  try {
    const adminClient = createAdminClient();

    // 웹훅 로그 조회
    const { data: webhook, error: fetchError } = await adminClient
      .from('webhook_logs')
      .select('id, status')
      .eq('id', input.transactionId)
      .eq('event_type', 'REFUND_DB_SYNC_FAILED')
      .single();

    if (fetchError || !webhook) {
      return { success: false, error: '보상 트랜잭션을 찾을 수 없습니다' };
    }

    if (webhook.status === 'processed') {
      return { success: false, error: '이미 처리된 보상 트랜잭션입니다' };
    }

    // 상태 업데이트
    const { error: updateError } = await adminClient
      .from('webhook_logs')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        error: `[수동 해결] ${input.resolution}${input.adminNote ? ` (관리자 메모: ${input.adminNote})` : ''}`,
      })
      .eq('id', input.transactionId);

    if (updateError) {
      logError('보상 트랜잭션 해결 완료 처리 오류', updateError, {
        transactionId: input.transactionId,
        action: 'markCompensationResolved',
      });
      return { success: false, error: '해결 완료 처리에 실패했습니다' };
    }

    logInfo('보상 트랜잭션 수동 해결 완료', {
      transactionId: input.transactionId,
      resolution: input.resolution,
      adminId: adminCheck.userId,
      action: 'markCompensationResolved',
    });

    revalidatePath('/admin/refunds');

    return { success: true };
  } catch (error) {
    logError('보상 트랜잭션 해결 완료 처리 오류', error, { action: 'markCompensationResolved' });
    return { success: false, error: '해결 완료 처리 중 오류가 발생했습니다' };
  }
}

/**
 * 보상 트랜잭션 통계 조회 (관리자용)
 */
export async function getCompensationStats(): Promise<{
  success: boolean;
  data?: CompensationStats;
  error?: string;
}> {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    return { success: false, error: adminCheck.error };
  }

  try {
    const adminClient = createAdminClient();

    // 대기 중 개수
    const { count: pendingCount } = await adminClient
      .from('webhook_logs')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'REFUND_DB_SYNC_FAILED')
      .in('status', ['pending', 'failed']);

    // 해결됨 개수
    const { count: resolvedCount } = await adminClient
      .from('webhook_logs')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'REFUND_DB_SYNC_FAILED')
      .eq('status', 'processed');

    // 대기 중인 총 금액
    const { data: pendingData } = await adminClient
      .from('webhook_logs')
      .select('payload')
      .eq('event_type', 'REFUND_DB_SYNC_FAILED')
      .in('status', ['pending', 'failed']);

    const totalAmount = pendingData?.reduce((sum, row) => {
      const payload = row.payload as { refundAmount?: number } | null;
      return sum + (payload?.refundAmount || 0);
    }, 0) ?? 0;

    return {
      success: true,
      data: {
        pendingCount: pendingCount || 0,
        resolvedCount: resolvedCount || 0,
        totalAmount,
      },
    };
  } catch (error) {
    logError('보상 트랜잭션 통계 조회 오류', error, { action: 'getCompensationStats' });
    return { success: false, error: '통계를 조회할 수 없습니다' };
  }
}
