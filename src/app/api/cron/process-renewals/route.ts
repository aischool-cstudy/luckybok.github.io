/**
 * 구독 갱신 처리 Cron Job
 * 매일 오전 9시(KST) / 자정(UTC)에 실행: "0 0 * * *"
 * Vercel Cron으로 호출됨
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { renewSubscription } from '@/actions/subscription';
import { serverEnv } from '@/lib/env';
import { logInfo, logWarn, logError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // 1. Cron 인증 확인
    const authHeader = request.headers.get('authorization');
    const cronSecret = serverEnv.CRON_SECRET;

    if (authHeader !== `Bearer ${cronSecret}`) {
      logWarn('Cron 인증 실패', { action: 'cron/process-renewals' });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminClient = createAdminClient();
    const now = new Date();

    // 2. 오늘 갱신 대상 구독 조회
    // current_period_end가 오늘이고 상태가 active인 구독
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const { data: subscriptions, error: fetchError } = await adminClient
      .from('subscriptions')
      .select('id, user_id, plan, billing_cycle, current_period_end, cancel_at_period_end')
      .eq('status', 'active')
      .lte('current_period_end', todayEnd.toISOString())
      .gte('current_period_end', todayStart.toISOString());

    if (fetchError) {
      logError('구독 조회 오류', fetchError, {
        action: 'cron/process-renewals',
      });
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      logInfo('오늘 갱신 대상 구독 없음', {
        action: 'cron/process-renewals',
      });
      return NextResponse.json({
        success: true,
        message: '갱신 대상 구독이 없습니다.',
        processed: 0,
        timestamp: now.toISOString(),
      });
    }

    // 3. 각 구독 갱신 처리
    const results = {
      success: [] as string[],
      canceled: [] as string[],
      failed: [] as string[],
    };

    for (const subscription of subscriptions) {
      // 취소 예정인 구독은 갱신하지 않고 취소 처리
      if (subscription.cancel_at_period_end) {
        await adminClient
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('id', subscription.id);

        await adminClient
          .from('profiles')
          .update({
            plan: 'starter',
            plan_expires_at: null,
            daily_generations_remaining: 10,
          })
          .eq('id', subscription.user_id);

        results.canceled.push(subscription.id);
        logInfo('구독 취소 완료 (cancel_at_period_end)', {
          action: 'cron/process-renewals',
          subscriptionId: subscription.id,
        });
        continue;
      }

      // 갱신 처리
      const renewResult = await renewSubscription(subscription.id);

      if (renewResult.success) {
        results.success.push(subscription.id);
        logInfo('구독 갱신 성공', {
          action: 'cron/process-renewals',
          subscriptionId: subscription.id,
        });
      } else {
        results.failed.push(subscription.id);
        logError('구독 갱신 실패', renewResult.error, {
          action: 'cron/process-renewals',
          subscriptionId: subscription.id,
        });
      }
    }

    // 4. 결과 반환
    const summary = {
      total: subscriptions.length,
      success: results.success.length,
      canceled: results.canceled.length,
      failed: results.failed.length,
    };

    logInfo('구독 갱신 처리 완료', {
      action: 'cron/process-renewals',
      ...summary,
    });

    return NextResponse.json({
      success: true,
      message: `${summary.total}개 구독 처리 완료`,
      summary,
      details: {
        success: results.success,
        canceled: results.canceled,
        failed: results.failed,
      },
      timestamp: now.toISOString(),
    });
  } catch (error) {
    logError('Cron 실행 오류', error, {
      action: 'cron/process-renewals',
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
