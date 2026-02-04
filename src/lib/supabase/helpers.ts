import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  Profile,
  Subscription,
  Payment,
  GeneratedContent,
  CreditTransaction,
  PaymentStats,
  GenerationStats,
} from '@/types/database.types';
import { logError } from '@/lib/logger';

type TypedSupabaseClient = SupabaseClient<Database>;

// =====================================================
// 프로필 관련 헬퍼
// =====================================================

export async function getProfile(
  client: TypedSupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    logError('getProfile error', error, { action: 'getProfile' });
    return null;
  }

  return data;
}

export async function updateProfile(
  client: TypedSupabaseClient,
  userId: string,
  updates: Partial<Profile>
): Promise<Profile | null> {
  const { data, error } = await client
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    logError('updateProfile error', error, { action: 'updateProfile' });
    return null;
  }

  return data;
}

// =====================================================
// 크레딧 관련 헬퍼
// =====================================================

/**
 * 콘텐츠 생성 시 크레딧 차감
 * @returns true: 성공, false: 크레딧 부족
 */
export async function useGenerationCredit(
  client: TypedSupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await client.rpc('use_generation_credit', {
    p_user_id: userId,
  });

  if (error) {
    logError('useGenerationCredit error', error, { action: 'useGenerationCredit' });
    return false;
  }

  return data ?? false;
}

/**
 * 크레딧 거래 내역 조회
 */
export async function getCreditTransactions(
  client: TypedSupabaseClient,
  userId: string,
  limit = 20
): Promise<CreditTransaction[]> {
  const { data, error } = await client
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logError('getCreditTransactions error', error, { action: 'getCreditTransactions' });
    return [];
  }

  return data ?? [];
}

// =====================================================
// 구독 관련 헬퍼
// =====================================================

/**
 * 활성 구독 조회
 */
export async function getActiveSubscription(
  client: TypedSupabaseClient,
  userId: string
): Promise<Subscription | null> {
  const { data, error } = await client
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116: 결과 없음
    logError('getActiveSubscription error', error, { action: 'getActiveSubscription' });
  }

  return data;
}

/**
 * 구독 이력 조회
 */
export async function getSubscriptionHistory(
  client: TypedSupabaseClient,
  userId: string,
  limit = 10
): Promise<Subscription[]> {
  const { data, error } = await client
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logError('getSubscriptionHistory error', error, { action: 'getSubscriptionHistory' });
    return [];
  }

  return data ?? [];
}

// =====================================================
// 결제 관련 헬퍼
// =====================================================

/**
 * 주문 ID 생성
 */
export async function generateOrderId(
  client: TypedSupabaseClient,
  prefix = 'ORD'
): Promise<string> {
  const { data, error } = await client.rpc('generate_order_id', { prefix });

  if (error) {
    logError('generateOrderId error', error, { action: 'generateOrderId' });
    // 폴백: 클라이언트에서 생성
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }

  return data;
}

/**
 * 결제 이력 조회
 */
export async function getPaymentHistory(
  client: TypedSupabaseClient,
  userId: string,
  limit = 20
): Promise<Payment[]> {
  const { data, error } = await client
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logError('getPaymentHistory error', error, { action: 'getPaymentHistory' });
    return [];
  }

  return data ?? [];
}

/**
 * 결제 상세 조회
 */
export async function getPaymentByOrderId(
  client: TypedSupabaseClient,
  orderId: string
): Promise<Payment | null> {
  const { data, error } = await client
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (error) {
    logError('getPaymentByOrderId error', error, { action: 'getPaymentByOrderId' });
    return null;
  }

  return data;
}

// =====================================================
// 콘텐츠 관련 헬퍼
// =====================================================

/**
 * 생성된 콘텐츠 목록 조회
 */
export async function getGeneratedContents(
  client: TypedSupabaseClient,
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    language?: string;
  }
): Promise<GeneratedContent[]> {
  let query = client
    .from('generated_contents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options?.language) {
    query = query.eq('language', options.language);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    logError('getGeneratedContents error', error, { action: 'getGeneratedContents' });
    return [];
  }

  return data ?? [];
}

/**
 * 콘텐츠 상세 조회
 */
export async function getGeneratedContent(
  client: TypedSupabaseClient,
  contentId: string
): Promise<GeneratedContent | null> {
  const { data, error } = await client
    .from('generated_contents')
    .select('*')
    .eq('id', contentId)
    .single();

  if (error) {
    logError('getGeneratedContent error', error, { action: 'getGeneratedContent' });
    return null;
  }

  return data;
}

// =====================================================
// 통계 관련 헬퍼
// =====================================================

/**
 * 결제 통계 조회
 */
export async function getPaymentStats(
  client: TypedSupabaseClient,
  userId: string
): Promise<PaymentStats | null> {
  const { data, error } = await client
    .from('payment_stats')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    logError('getPaymentStats error', error, { action: 'getPaymentStats' });
  }

  return data;
}

/**
 * 콘텐츠 생성 통계 조회
 */
export async function getGenerationStats(
  client: TypedSupabaseClient,
  userId: string
): Promise<GenerationStats | null> {
  const { data, error } = await client
    .from('generation_stats')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    logError('getGenerationStats error', error, { action: 'getGenerationStats' });
  }

  return data;
}

// =====================================================
// 관리자 전용 헬퍼 (Service Role 필요)
// =====================================================

/**
 * 일일 생성 횟수 리셋 (cron job용)
 */
export async function resetDailyGenerations(
  adminClient: TypedSupabaseClient
): Promise<void> {
  const { error } = await adminClient.rpc('reset_daily_generations');

  if (error) {
    logError('resetDailyGenerations error', error, { action: 'resetDailyGenerations' });
    throw error;
  }
}

/**
 * 만료 구독 처리 (cron job용)
 */
export async function checkExpiredSubscriptions(
  adminClient: TypedSupabaseClient
): Promise<void> {
  const { error } = await adminClient.rpc('check_expired_subscriptions');

  if (error) {
    logError('checkExpiredSubscriptions error', error, { action: 'checkExpiredSubscriptions' });
    throw error;
  }
}

/**
 * 만료 크레딧 정리 (cron job용)
 */
export async function expireCredits(
  adminClient: TypedSupabaseClient
): Promise<void> {
  const { error } = await adminClient.rpc('expire_credits');

  if (error) {
    logError('expireCredits error', error, { action: 'expireCredits' });
    throw error;
  }
}

// =====================================================
// 유틸리티 함수
// =====================================================

/**
 * Supabase 조인 결과 정규화
 *
 * Supabase 조인 쿼리 결과가 단일 객체 또는 배열로 올 수 있음.
 * 이 함수는 일관된 단일 객체 반환을 보장합니다.
 *
 * @example
 * ```typescript
 * const { data } = await supabase
 *   .from('subscriptions')
 *   .select('*, billing_keys!billing_key_id(card_company, card_number)')
 *   .single();
 *
 * const billingKey = normalizeJoinResult<BillingKeyInfo>(data?.billing_keys);
 * ```
 */
export function normalizeJoinResult<T>(data: unknown): T | null {
  if (!data) return null;
  return (Array.isArray(data) ? data[0] : data) as T;
}

/**
 * RPC 함수 결과 표준 응답 타입
 */
export interface RpcResultBase {
  success: boolean;
  error_message?: string | null;
}

/**
 * RPC 함수 결과 파싱
 *
 * Supabase RPC 함수는 RETURNS TABLE 사용 시 배열로 반환됨.
 * 이 함수는 일관된 결과 처리를 보장합니다.
 *
 * @example
 * ```typescript
 * const { data: rpcResult } = await adminClient.rpc('confirm_payment_atomic', { ... });
 * const parsed = parseRpcResult(rpcResult);
 *
 * if (!parsed.success) {
 *   return { success: false, error: parsed.error };
 * }
 *
 * // parsed.data 사용
 * ```
 */
export function parseRpcResult<T extends RpcResultBase>(
  rpcResult: T[] | T | null
): { success: true; data: T } | { success: false; error: string } {
  const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;

  if (!result) {
    return { success: false, error: 'RPC 결과가 없습니다' };
  }

  if (!result.success) {
    return { success: false, error: result.error_message || '처리에 실패했습니다' };
  }

  return { success: true, data: result };
}

/**
 * RPC 에러 응답 생성 헬퍼
 *
 * @example
 * ```typescript
 * if (rpcError) {
 *   return createRpcErrorResponse('결제 처리');
 * }
 * ```
 */
export function createRpcErrorResponse(operation: string): { success: false; error: string } {
  return { success: false, error: `${operation} 중 오류가 발생했습니다` };
}
