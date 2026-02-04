'use server';

/**
 * 현재 구독 조회 관련 Server Actions
 */

import { requireAuth, AuthError } from '@/lib/auth';
import { logError } from '@/lib/logger';
import type {
  ActionResponse,
  SubscriptionSummary,
  PlanType,
} from '@/types/payment.types';

// ────────────────────────────────────────────────────────────
// 현재 구독 조회
// ────────────────────────────────────────────────────────────
// 참고: cancelSubscription은 @/actions/billing에서 제공합니다.
// ────────────────────────────────────────────────────────────

export async function getCurrentSubscription(): Promise<
  ActionResponse<SubscriptionSummary | null>
> {
  try {
    const { user, supabase } = await requireAuth();

    // 구독 정보 조회
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*, billing_keys!billing_key_id(card_company, card_number)')
      .eq('user_id', user.id)
      .in('status', ['active', 'canceled'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!subscription) {
      return { success: true, data: null };
    }

    // 기간 종료 후 취소된 경우 null 반환
    if (subscription.status === 'canceled' && !subscription.cancel_at_period_end) {
      return { success: true, data: null };
    }

    // Supabase 조인 결과는 배열이거나 단일 객체일 수 있음
    const billingKeyData = subscription.billing_keys as unknown;
    const billingKey = (Array.isArray(billingKeyData) ? billingKeyData[0] : billingKeyData) as { card_company: string; card_number: string } | null;

    const summary: SubscriptionSummary = {
      plan: subscription.plan as PlanType,
      status: subscription.status as 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused',
      currentPeriodEnd: new Date(subscription.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      cardInfo: billingKey
        ? {
            company: billingKey.card_company,
            lastFourDigits: billingKey.card_number.slice(-4),
          }
        : null,
    };

    return { success: true, data: summary };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('getCurrentSubscription 오류', error, { action: 'getCurrentSubscription' });
    return { success: false, error: '구독 정보 조회에 실패했습니다' };
  }
}
