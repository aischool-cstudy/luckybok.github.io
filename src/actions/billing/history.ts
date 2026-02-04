'use server';

import { getAuthUser } from '@/lib/auth';
import { logError } from '@/lib/logger';
import type { Payment } from '@/types/database.types';

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────

export interface PaymentHistoryFilters {
  type?: 'subscription' | 'credit_purchase' | 'all';
  status?: 'completed' | 'refunded' | 'failed' | 'all';
  startDate?: string;
  endDate?: string;
}

export interface PaymentHistoryStats {
  totalAmount: number;
  refundedAmount: number;
  thisMonthAmount: number;
  completedCount: number;
  refundedCount: number;
}

// ────────────────────────────────────────────────────────────
// 결제 내역 조회
// ────────────────────────────────────────────────────────────

/**
 * 결제 내역 조회 (필터링 지원)
 */
export async function getPaymentHistory(
  page = 1,
  limit = 10,
  filters?: PaymentHistoryFilters
) {
  const authResult = await getAuthUser();
  if (!authResult) {
    return { payments: [], total: 0, stats: null };
  }

  const { user, supabase } = authResult;
  const offset = (page - 1) * limit;

  // 기본 쿼리 빌드
  let query = supabase
    .from('payments')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id);

  // 필터 적용
  if (filters?.type && filters.type !== 'all') {
    query = query.eq('type', filters.type);
  }

  if (filters?.status && filters.status !== 'all') {
    if (filters.status === 'refunded') {
      query = query.in('status', ['refunded', 'partial_refunded']);
    } else {
      query = query.eq('status', filters.status);
    }
  }

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters?.endDate) {
    // 종료일은 해당 일자의 끝까지 포함
    const endDateTime = new Date(filters.endDate);
    endDateTime.setHours(23, 59, 59, 999);
    query = query.lte('created_at', endDateTime.toISOString());
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logError('결제 내역 조회 오류', error, { userId: user.id, action: 'getPaymentHistory' });
    return { payments: [], total: 0, stats: null };
  }

  const payments = data as Payment[] | null;
  return {
    payments: payments || [],
    total: count || 0,
  };
}

// ────────────────────────────────────────────────────────────
// 결제 통계 조회
// ────────────────────────────────────────────────────────────

/**
 * 결제 통계 조회
 * DB 레벨에서 집계하여 성능 최적화
 */
export async function getPaymentStats(): Promise<PaymentHistoryStats | null> {
  const authResult = await getAuthUser();
  if (!authResult) {
    return null;
  }

  const { user, supabase } = authResult;

  try {
    // RPC 함수로 DB 레벨 집계
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'get_payment_stats',
      { p_user_id: user.id }
    );

    if (rpcError) {
      logError('결제 통계 RPC 오류', rpcError, { userId: user.id, action: 'getPaymentStats' });
      return null;
    }

    // RPC 결과 확인 (배열로 반환됨)
    const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;

    if (!result) {
      return {
        totalAmount: 0,
        refundedAmount: 0,
        thisMonthAmount: 0,
        completedCount: 0,
        refundedCount: 0,
      };
    }

    return {
      totalAmount: Number(result.total_amount) || 0,
      refundedAmount: Number(result.refunded_amount) || 0,
      thisMonthAmount: Number(result.this_month_amount) || 0,
      completedCount: result.completed_count || 0,
      refundedCount: result.refunded_count || 0,
    };
  } catch (error) {
    logError('결제 통계 조회 오류', error, { userId: user.id, action: 'getPaymentStats' });
    return null;
  }
}
