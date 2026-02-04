// 구독 자동 갱신 Cron Job
// 스케줄: 6시간마다 (cron: 0 star/6 * * *)
//
// Vercel Cron Jobs에서 호출됨
// - 만료 임박 구독 조회 후 renewSubscription 호출
// - 예약된 플랜 변경 적용

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { renewSubscription } from '@/actions/subscription';
import { serverEnv } from '@/lib/env';
import { logInfo, logWarn, logError } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Cron 인증 검증
  const authHeader = request.headers.get('authorization');
  const cronSecret = serverEnv.CRON_SECRET;

  if (authHeader !== `Bearer ${cronSecret}`) {
    logWarn('Cron 인증 실패', { action: 'cron/renew-subscriptions' });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const adminClient = createAdminClient();

  const results = {
    processed: 0,
    renewed: 0,
    canceled: 0,
    failed: 0,
    retried: 0,
    planChangesApplied: 0,
    errors: [] as string[],
  };

  try {
    // 0. 예약된 플랜 변경 적용
    try {
      const { data: planChangeResult, error: planChangeError } = await adminClient.rpc(
        'apply_scheduled_plan_changes'
      );

      if (planChangeError) {
        logError('예약된 플랜 변경 적용 오류', planChangeError, {
          action: 'cron/renew-subscriptions',
          step: 'apply_plan_changes',
        });
        results.errors.push(`플랜 변경 적용: ${planChangeError.message}`);
      } else {
        const result = Array.isArray(planChangeResult) ? planChangeResult[0] : planChangeResult;
        if (result?.success) {
          results.planChangesApplied = result.processed_count || 0;
          logInfo('예약된 플랜 변경 적용 완료', {
            action: 'cron/renew-subscriptions',
            count: results.planChangesApplied,
          });
        } else if (result?.error_message) {
          results.errors.push(`플랜 변경 적용: ${result.error_message}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError('예약된 플랜 변경 적용 예외', error, {
        action: 'cron/renew-subscriptions',
        step: 'apply_plan_changes',
      });
      results.errors.push(`플랜 변경 적용 예외: ${errorMessage}`);
    }

    // 1. 재시도가 필요한 구독 먼저 처리
    const { data: subscriptionsToRetry, error: retryQueryError } = await adminClient
      .from('subscriptions')
      .select('id, user_id, metadata')
      .eq('status', 'active')
      .not('metadata->next_retry_at', 'is', null)
      .lte('metadata->>next_retry_at', new Date().toISOString());

    if (!retryQueryError && subscriptionsToRetry && subscriptionsToRetry.length > 0) {
      logInfo('재시도 대상 구독 조회', {
        action: 'cron/renew-subscriptions',
        count: subscriptionsToRetry.length,
      });

      for (const subscription of subscriptionsToRetry) {
        results.processed++;

        try {
          const renewResult = await renewSubscription(subscription.id);

          if (renewResult.success) {
            // 재시도 성공: 메타데이터 초기화
            await adminClient
              .from('subscriptions')
              .update({
                metadata: {
                  ...(subscription.metadata as Record<string, unknown>),
                  renewal_retry_count: 0,
                  next_retry_at: null,
                  last_success_at: new Date().toISOString(),
                },
              })
              .eq('id', subscription.id);

            results.renewed++;
            results.retried++;
            logInfo('구독 재시도 성공', {
              action: 'cron/renew-subscriptions',
              subscriptionId: subscription.id,
            });
          } else {
            results.failed++;
            results.errors.push(`재시도 ${subscription.id}: ${renewResult.error}`);
            logError('구독 재시도 실패', renewResult.error, {
              action: 'cron/renew-subscriptions',
              subscriptionId: subscription.id,
            });
          }
        } catch (error) {
          results.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push(`재시도 ${subscription.id}: ${errorMessage}`);
          logError('구독 재시도 예외', error, {
            action: 'cron/renew-subscriptions',
            subscriptionId: subscription.id,
          });
        }
      }
    }

    // 2. 갱신 대상 구독 조회 (24시간 이내 만료)
    const { data: subscriptionsDue, error: queryError } = await adminClient.rpc(
      'get_subscriptions_due_for_renewal',
      { p_hours_ahead: 24 }
    );

    if (queryError) {
      logError('구독 조회 오류', queryError, {
        action: 'cron/renew-subscriptions',
        step: 'query_due_subscriptions',
      });
      return NextResponse.json(
        {
          success: false,
          error: queryError.message,
          duration: Date.now() - startTime,
        },
        { status: 500 }
      );
    }

    const subscriptions = subscriptionsDue || [];
    logInfo('갱신 대상 구독 조회', {
      action: 'cron/renew-subscriptions',
      count: subscriptions.length,
    });

    // 각 구독에 대해 갱신 처리
    for (const subscription of subscriptions) {
      results.processed++;

      try {
        // 취소 예정인 구독 처리
        if (subscription.cancel_at_period_end) {
          // 구독 상태를 canceled로 변경
          await adminClient
            .from('subscriptions')
            .update({
              status: 'canceled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', subscription.subscription_id);

          // 프로필 다운그레이드
          await adminClient
            .from('profiles')
            .update({
              plan: 'starter',
              plan_expires_at: null,
              daily_generations_remaining: 10,
            })
            .eq('id', subscription.user_id);

          results.canceled++;
          logInfo('구독 취소 완료', {
            action: 'cron/renew-subscriptions',
            subscriptionId: subscription.subscription_id,
          });
          continue;
        }

        // 구독 갱신
        const renewResult = await renewSubscription(subscription.subscription_id);

        if (renewResult.success) {
          results.renewed++;
          logInfo('구독 갱신 성공', {
            action: 'cron/renew-subscriptions',
            subscriptionId: subscription.subscription_id,
          });
        } else {
          results.failed++;
          results.errors.push(`${subscription.subscription_id}: ${renewResult.error}`);
          logError('구독 갱신 실패', renewResult.error, {
            action: 'cron/renew-subscriptions',
            subscriptionId: subscription.subscription_id,
          });
        }
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`${subscription.subscription_id}: ${errorMessage}`);
        logError('구독 처리 예외', error, {
          action: 'cron/renew-subscriptions',
          subscriptionId: subscription.subscription_id,
        });
      }
    }

    logInfo('구독 갱신 Cron 완료', {
      action: 'cron/renew-subscriptions',
      processed: results.processed,
      renewed: results.renewed,
      retried: results.retried,
      canceled: results.canceled,
      planChangesApplied: results.planChangesApplied,
      failed: results.failed,
    });

    return NextResponse.json({
      success: true,
      results: {
        processed: results.processed,
        renewed: results.renewed,
        retried: results.retried,
        canceled: results.canceled,
        planChangesApplied: results.planChangesApplied,
        failed: results.failed,
      },
      errors: results.errors.length > 0 ? results.errors : undefined,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logError('구독 갱신 Cron 예외', error, {
      action: 'cron/renew-subscriptions',
      results,
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
