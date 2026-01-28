'use server';

import { createServerClient } from '@/lib/supabase/server';
import type { CreditTransactionInsert } from '@/types/database.types';

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────

export interface CreditBalance {
  balance: number;
  expiringCredits: number;
  expiringDate: Date | null;
}

export interface GenerationAvailability {
  canGenerate: boolean;
  reason?: string;
  dailyRemaining: number;
  creditBalance: number;
  useCredits: boolean;
}

// ────────────────────────────────────────────────────────────
// 크레딧 잔액 조회
// ────────────────────────────────────────────────────────────

/**
 * 사용자의 크레딧 잔액 조회
 */
export async function getCreditBalance(userId?: string): Promise<CreditBalance | null> {
  const supabase = await createServerClient();

  // userId가 없으면 현재 로그인한 사용자 조회
  let targetUserId = userId;
  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    targetUserId = user.id;
  }

  // 프로필에서 크레딧 잔액 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_balance')
    .eq('id', targetUserId)
    .single();

  if (!profile) return null;

  // 만료 예정 크레딧 조회 (30일 이내)
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  const { data: expiringTransactions } = await supabase
    .from('credit_transactions')
    .select('amount, expires_at')
    .eq('user_id', targetUserId)
    .in('type', ['purchase', 'subscription_grant'])
    .gt('amount', 0)
    .not('expires_at', 'is', null)
    .lte('expires_at', thirtyDaysLater.toISOString())
    .gte('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true });

  // 만료 예정 크레딧 계산
  let expiringCredits = 0;
  let expiringDate: Date | null = null;

  if (expiringTransactions && expiringTransactions.length > 0) {
    expiringCredits = expiringTransactions.reduce((sum, t) => sum + t.amount, 0);
    const firstExpiry = expiringTransactions[0]?.expires_at;
    expiringDate = firstExpiry ? new Date(firstExpiry) : null;
  }

  return {
    balance: profile.credits_balance,
    expiringCredits,
    expiringDate,
  };
}

// ────────────────────────────────────────────────────────────
// 생성 가능 여부 확인
// ────────────────────────────────────────────────────────────

/**
 * 콘텐츠 생성 가능 여부 확인
 * - 일일 횟수가 있으면 일일 횟수 사용
 * - 일일 횟수가 0이면 크레딧 사용 가능 여부 확인
 */
export async function checkGenerationAvailability(): Promise<GenerationAvailability> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      canGenerate: false,
      reason: '로그인이 필요합니다.',
      dailyRemaining: 0,
      creditBalance: 0,
      useCredits: false,
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, daily_generations_remaining, daily_reset_at, credits_balance')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return {
      canGenerate: false,
      reason: '사용자 정보를 찾을 수 없습니다.',
      dailyRemaining: 0,
      creditBalance: 0,
      useCredits: false,
    };
  }

  const dailyRemaining = profile.daily_generations_remaining;
  const creditBalance = profile.credits_balance;

  // 일일 횟수가 남아있으면 일일 횟수 사용
  if (dailyRemaining > 0) {
    return {
      canGenerate: true,
      dailyRemaining,
      creditBalance,
      useCredits: false,
    };
  }

  // 일일 횟수가 없으면 크레딧 확인
  if (creditBalance > 0) {
    return {
      canGenerate: true,
      dailyRemaining: 0,
      creditBalance,
      useCredits: true,
    };
  }

  // 둘 다 없으면 생성 불가
  return {
    canGenerate: false,
    reason: '오늘의 생성 횟수를 모두 사용했습니다. 크레딧을 충전하거나 플랜을 업그레이드해주세요.',
    dailyRemaining: 0,
    creditBalance: 0,
    useCredits: false,
  };
}

// ────────────────────────────────────────────────────────────
// 크레딧 사용
// ────────────────────────────────────────────────────────────

/**
 * 크레딧 사용 (차감)
 * @param userId 사용자 ID
 * @param amount 사용할 크레딧 양 (양수)
 * @param description 사용 내역 설명
 */
export async function useCredit(
  userId: string,
  amount: number,
  description: string
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  if (amount <= 0) {
    return { success: false, error: '유효하지 않은 크레딧 양입니다.' };
  }

  const supabase = await createServerClient();

  // 현재 잔액 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_balance')
    .eq('id', userId)
    .single();

  if (!profile) {
    return { success: false, error: '사용자를 찾을 수 없습니다.' };
  }

  if (profile.credits_balance < amount) {
    return { success: false, error: '크레딧이 부족합니다.' };
  }

  const newBalance = profile.credits_balance - amount;

  // 트랜잭션 기록
  const transaction: CreditTransactionInsert = {
    user_id: userId,
    type: 'usage',
    amount: -amount, // 사용은 음수로 기록
    balance: newBalance,
    description,
  };

  const { error: transactionError } = await supabase
    .from('credit_transactions')
    .insert(transaction);

  if (transactionError) {
    console.error('크레딧 트랜잭션 기록 오류:', transactionError);
    return { success: false, error: '크레딧 사용 기록에 실패했습니다.' };
  }

  // 잔액 업데이트
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ credits_balance: newBalance })
    .eq('id', userId);

  if (updateError) {
    console.error('크레딧 잔액 업데이트 오류:', updateError);
    return { success: false, error: '크레딧 잔액 업데이트에 실패했습니다.' };
  }

  return { success: true, newBalance };
}

// ────────────────────────────────────────────────────────────
// 크레딧 추가
// ────────────────────────────────────────────────────────────

/**
 * 크레딧 추가 (충전/지급)
 * @param userId 사용자 ID
 * @param amount 추가할 크레딧 양 (양수)
 * @param type 트랜잭션 타입
 * @param description 설명
 * @param paymentId 결제 ID (구매의 경우)
 * @param expiresAt 만료일 (옵션)
 */
export async function addCredit(
  userId: string,
  amount: number,
  type: 'purchase' | 'subscription_grant' | 'refund' | 'admin_adjustment',
  description: string,
  paymentId?: string,
  expiresAt?: Date
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  if (amount <= 0) {
    return { success: false, error: '유효하지 않은 크레딧 양입니다.' };
  }

  const supabase = await createServerClient();

  // 현재 잔액 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_balance')
    .eq('id', userId)
    .single();

  if (!profile) {
    return { success: false, error: '사용자를 찾을 수 없습니다.' };
  }

  const newBalance = profile.credits_balance + amount;

  // 트랜잭션 기록
  const transaction: CreditTransactionInsert = {
    user_id: userId,
    type,
    amount,
    balance: newBalance,
    description,
    payment_id: paymentId || null,
    expires_at: expiresAt?.toISOString() || null,
  };

  const { error: transactionError } = await supabase
    .from('credit_transactions')
    .insert(transaction);

  if (transactionError) {
    console.error('크레딧 트랜잭션 기록 오류:', transactionError);
    return { success: false, error: '크레딧 추가 기록에 실패했습니다.' };
  }

  // 잔액 업데이트
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ credits_balance: newBalance })
    .eq('id', userId);

  if (updateError) {
    console.error('크레딧 잔액 업데이트 오류:', updateError);
    return { success: false, error: '크레딧 잔액 업데이트에 실패했습니다.' };
  }

  return { success: true, newBalance };
}

// ────────────────────────────────────────────────────────────
// 크레딧 트랜잭션 히스토리
// ────────────────────────────────────────────────────────────

/**
 * 크레딧 트랜잭션 히스토리 조회
 */
export async function getCreditHistory(page = 1, limit = 10) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { transactions: [], total: 0 };
  }

  const offset = (page - 1) * limit;

  const { data: transactions, error, count } = await supabase
    .from('credit_transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('크레딧 히스토리 조회 오류:', error);
    return { transactions: [], total: 0 };
  }

  return {
    transactions: transactions || [],
    total: count || 0,
  };
}
