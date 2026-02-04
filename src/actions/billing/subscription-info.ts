'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, AuthError } from '@/lib/auth';
import { getActiveSubscription } from '@/lib/supabase/helpers';
import { logError } from '@/lib/logger';
import type { Subscription } from '@/types/database.types';

// ────────────────────────────────────────────────────────────
// 내부 타입 정의
// ────────────────────────────────────────────────────────────

type PartialSubscription = Pick<Subscription, 'id' | 'user_id'>;
type SubscriptionWithCancel = Pick<Subscription, 'id' | 'user_id' | 'cancel_at_period_end'>;

// ────────────────────────────────────────────────────────────
// 외부 타입 정의
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
  try {
    const { user, supabase } = await requireAuth();

    const subscription = await getActiveSubscription(supabase, user.id);

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
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('구독 조회 오류', error, { action: 'getSubscription' });
    return { success: false, error: '구독 정보를 조회할 수 없습니다' };
  }
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
  try {
    const { user, supabase } = await requireAuth();

    // 구독 소유권 확인
    const { data } = await supabase
      .from('subscriptions')
      .select('id, user_id')
      .eq('id', subscriptionId)
      .single();

    const subscription = data as PartialSubscription | null;
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
      logError('구독 취소 오류', error, { userId: user.id, subscriptionId, action: 'cancelSubscription' });
      return { success: false, error: '구독 취소에 실패했습니다' };
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
  try {
    const { user, supabase } = await requireAuth();

    // 구독 소유권 확인
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('id, user_id, cancel_at_period_end')
      .eq('id', subscriptionId)
      .single();

    const subscription = subData as SubscriptionWithCancel | null;
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
      logError('구독 취소 철회 오류', error, { userId: user.id, subscriptionId, action: 'reactivateSubscription' });
      return { success: false, error: '구독 취소 철회에 실패했습니다' };
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
