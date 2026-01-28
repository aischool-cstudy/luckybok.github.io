'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────

export interface SubscriptionInfo {
  id: string;
  plan: 'pro' | 'team' | 'enterprise';
  billingCycle: 'monthly' | 'yearly';
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
}

export interface PaymentMethodInfo {
  id: string;
  cardCompany: string;
  cardNumber: string; // 마스킹된 번호 (끝 4자리만)
  cardType: string | null;
  isDefault: boolean;
}

// ────────────────────────────────────────────────────────────
// 구독 정보 조회
// ────────────────────────────────────────────────────────────

/**
 * 현재 사용자의 구독 정보 조회
 */
export async function getSubscription(): Promise<{
  success: boolean;
  data?: SubscriptionInfo | null;
  error?: string;
}> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '로그인이 필요합니다' };
  }

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116은 "no rows returned" 에러 - 구독이 없는 경우
    console.error('구독 조회 오류:', error);
    return { success: false, error: '구독 정보를 조회할 수 없습니다' };
  }

  if (!subscription) {
    return { success: true, data: null };
  }

  return {
    success: true,
    data: {
      id: subscription.id,
      plan: subscription.plan,
      billingCycle: subscription.billing_cycle,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at,
    },
  };
}

// ────────────────────────────────────────────────────────────
// 결제 수단 조회
// ────────────────────────────────────────────────────────────

/**
 * 현재 사용자의 결제 수단 목록 조회
 */
export async function getPaymentMethods(): Promise<{
  success: boolean;
  data?: PaymentMethodInfo[];
  error?: string;
}> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '로그인이 필요합니다' };
  }

  const { data: billingKeys, error } = await supabase
    .from('billing_keys')
    .select('id, card_company, card_number, card_type, is_default')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('결제 수단 조회 오류:', error);
    return { success: false, error: '결제 수단을 조회할 수 없습니다' };
  }

  return {
    success: true,
    data: billingKeys?.map(key => ({
      id: key.id,
      cardCompany: key.card_company,
      cardNumber: key.card_number,
      cardType: key.card_type,
      isDefault: key.is_default,
    })) ?? [],
  };
}

// ────────────────────────────────────────────────────────────
// 구독 취소
// ────────────────────────────────────────────────────────────

/**
 * 구독 취소 (기간 종료 시 취소)
 */
export async function cancelSubscription(subscriptionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '로그인이 필요합니다' };
  }

  // 구독 소유권 확인
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, user_id')
    .eq('id', subscriptionId)
    .single();

  if (!subscription || subscription.user_id !== user.id) {
    return { success: false, error: '구독을 찾을 수 없습니다' };
  }

  // 기간 종료 시 취소로 설정
  const { error } = await supabase
    .from('subscriptions')
    .update({
      cancel_at_period_end: true,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);

  if (error) {
    console.error('구독 취소 오류:', error);
    return { success: false, error: '구독 취소에 실패했습니다' };
  }

  revalidatePath('/settings');
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// 구독 취소 철회
// ────────────────────────────────────────────────────────────

/**
 * 구독 취소 철회 (취소 예약 해제)
 */
export async function reactivateSubscription(subscriptionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '로그인이 필요합니다' };
  }

  // 구독 소유권 확인
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, user_id, cancel_at_period_end')
    .eq('id', subscriptionId)
    .single();

  if (!subscription || subscription.user_id !== user.id) {
    return { success: false, error: '구독을 찾을 수 없습니다' };
  }

  if (!subscription.cancel_at_period_end) {
    return { success: false, error: '취소 예약된 구독이 아닙니다' };
  }

  // 취소 철회
  const { error } = await supabase
    .from('subscriptions')
    .update({
      cancel_at_period_end: false,
      canceled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);

  if (error) {
    console.error('구독 취소 철회 오류:', error);
    return { success: false, error: '구독 취소 철회에 실패했습니다' };
  }

  revalidatePath('/settings');
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// 기본 결제 수단 변경
// ────────────────────────────────────────────────────────────

/**
 * 기본 결제 수단 변경
 */
export async function setDefaultPaymentMethod(billingKeyId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '로그인이 필요합니다' };
  }

  // 소유권 확인
  const { data: billingKey } = await supabase
    .from('billing_keys')
    .select('id, user_id')
    .eq('id', billingKeyId)
    .single();

  if (!billingKey || billingKey.user_id !== user.id) {
    return { success: false, error: '결제 수단을 찾을 수 없습니다' };
  }

  // 모든 결제 수단의 기본 설정 해제
  await supabase
    .from('billing_keys')
    .update({ is_default: false })
    .eq('user_id', user.id);

  // 선택된 결제 수단을 기본으로 설정
  const { error } = await supabase
    .from('billing_keys')
    .update({ is_default: true })
    .eq('id', billingKeyId);

  if (error) {
    console.error('기본 결제 수단 변경 오류:', error);
    return { success: false, error: '기본 결제 수단 변경에 실패했습니다' };
  }

  revalidatePath('/settings');
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// 결제 수단 삭제
// ────────────────────────────────────────────────────────────

/**
 * 결제 수단 삭제
 */
export async function deletePaymentMethod(billingKeyId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '로그인이 필요합니다' };
  }

  // 소유권 확인
  const { data: billingKey } = await supabase
    .from('billing_keys')
    .select('id, user_id, is_default')
    .eq('id', billingKeyId)
    .single();

  if (!billingKey || billingKey.user_id !== user.id) {
    return { success: false, error: '결제 수단을 찾을 수 없습니다' };
  }

  // 기본 결제 수단인 경우 삭제 방지
  if (billingKey.is_default) {
    // 활성 구독이 있는지 확인
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subscription) {
      return {
        success: false,
        error: '활성 구독이 있는 상태에서 기본 결제 수단을 삭제할 수 없습니다',
      };
    }
  }

  const { error } = await supabase
    .from('billing_keys')
    .delete()
    .eq('id', billingKeyId);

  if (error) {
    console.error('결제 수단 삭제 오류:', error);
    return { success: false, error: '결제 수단 삭제에 실패했습니다' };
  }

  revalidatePath('/settings');
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// 결제 내역 조회
// ────────────────────────────────────────────────────────────

/**
 * 결제 내역 조회
 */
export async function getPaymentHistory(page = 1, limit = 10) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { payments: [], total: 0 };
  }

  const offset = (page - 1) * limit;

  const { data: payments, error, count } = await supabase
    .from('payments')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('결제 내역 조회 오류:', error);
    return { payments: [], total: 0 };
  }

  return {
    payments: payments || [],
    total: count || 0,
  };
}
