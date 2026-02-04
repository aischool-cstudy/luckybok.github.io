/**
 * 실패한 환불 요청 재시도 Cron Job
 *
 * 실행 주기: 매 10분 (Vercel Cron 또는 외부 스케줄러)
 * 기능:
 * - 재시도 가능한 실패 환불 요청 조회
 * - 지수 백오프에 따른 재시도 실행
 * - 최대 재시도 횟수 초과 시 알림
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTossClient, PaymentError, NetworkError, TossPaymentResponse } from '@/lib/payment/toss';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { CRON_TIMEOUT_MS } from '@/config/constants';
import { serverEnv } from '@/lib/env';

interface PendingRetry {
  request_id: string;
  payment_id: string;
  user_id: string;
  requested_amount: number;
  refund_type: string;
  reason: string;
  retry_count: number;
  payment_key: string;
  order_id: string;
}

interface PaymentMetadata {
  credits?: number;
  [key: string]: unknown;
}

export async function GET(request: Request) {
  const startTime = Date.now();

  // 인증 확인
  const authHeader = request.headers.get('authorization');
  const cronSecret = serverEnv.CRON_SECRET;

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    maxRetriesReached: 0,
    errors: [] as string[],
  };

  try {
    const adminClient = createAdminClient();
    const tossClient = getTossClient();

    // 재시도 대상 환불 요청 조회 (FOR UPDATE SKIP LOCKED)
    const { data: pendingRetries, error: fetchError } = await adminClient.rpc(
      'get_pending_refund_retries'
    );

    if (fetchError) {
      logError('재시도 대상 조회 오류', fetchError, { action: 'retry-refunds' });
      return NextResponse.json(
        { error: '재시도 대상 조회 실패', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!pendingRetries || pendingRetries.length === 0) {
      return NextResponse.json({
        message: '재시도할 환불 요청이 없습니다',
        ...results,
        executionTimeMs: Date.now() - startTime,
      });
    }

    logInfo('환불 재시도 시작', {
      count: pendingRetries.length,
      action: 'retry-refunds',
    });

    // 각 환불 요청 처리
    for (const retry of pendingRetries as PendingRetry[]) {
      // 타임아웃 체크
      if (Date.now() - startTime > CRON_TIMEOUT_MS - 30000) {
        logWarn('Cron 타임아웃 임박, 처리 중단', {
          processed: results.processed,
          remaining: pendingRetries.length - results.processed,
          action: 'retry-refunds',
        });
        break;
      }

      results.processed++;

      try {
        // 결제 키 확인
        if (!retry.payment_key) {
          results.skipped++;
          await updateRefundStatus(adminClient, retry.request_id, 'rejected', {
            rejectionReason: '결제 키가 없어 재시도 불가',
          });
          continue;
        }

        // 토스페이먼츠 환불 API 호출
        let tossResponse;
        try {
          tossResponse = await tossClient.cancelPayment(
            retry.payment_key,
            retry.reason,
            retry.requested_amount
          );
        } catch (error) {
          // 재시도 가능한 에러인지 확인
          const isRetryable =
            error instanceof NetworkError && error.isRetryable;
          const errorMessage =
            error instanceof PaymentError
              ? error.message
              : error instanceof NetworkError
              ? error.message
              : '알 수 없는 오류';

          if (!isRetryable) {
            // 재시도 불가능한 에러 - 최종 실패 처리
            await updateRefundStatus(adminClient, retry.request_id, 'rejected', {
              rejectionReason: `환불 실패 (복구 불가): ${errorMessage}`,
              error: errorMessage,
            });
            results.failed++;
            results.errors.push(`${retry.request_id}: ${errorMessage}`);
            continue;
          }

          // 재시도 가능 - 다음 재시도 스케줄링
          await updateRefundStatus(adminClient, retry.request_id, 'failed', {
            error: errorMessage,
          });
          results.failed++;
          results.errors.push(`${retry.request_id}: ${errorMessage} (재시도 예정)`);
          continue;
        }

        // 토스 환불 성공 - DB 업데이트
        // 결제 정보 조회
        const { data: payment } = await adminClient
          .from('payments')
          .select('*')
          .eq('id', retry.payment_id)
          .single();

        if (!payment) {
          await updateRefundStatus(adminClient, retry.request_id, 'failed', {
            error: '결제 정보를 찾을 수 없음',
          });
          results.failed++;
          continue;
        }

        // 원자적 RPC로 DB 업데이트
        const metadata = payment.metadata as PaymentMetadata | null;
        const isPartialRefund = retry.requested_amount < payment.amount;
        let rpcSucceeded = false;

        if (payment.type === 'credit_purchase' && metadata?.credits) {
          const creditsToDeduct = Math.floor(
            (metadata.credits * retry.requested_amount) / payment.amount
          );

          const { data: rpcResult, error: rpcError } = await adminClient.rpc(
            'process_credit_refund_atomic',
            {
              p_payment_id: payment.id,
              p_user_id: retry.user_id,
              p_refund_amount: retry.requested_amount,
              p_is_partial: isPartialRefund,
              p_credits_to_deduct: creditsToDeduct,
              p_reason: retry.reason,
            }
          );

          if (!rpcError) {
            const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
            rpcSucceeded = result?.success === true;
          }
        } else if (payment.type === 'subscription' && payment.subscription_id) {
          const { data: rpcResult, error: rpcError } = await adminClient.rpc(
            'process_subscription_refund_atomic',
            {
              p_payment_id: payment.id,
              p_subscription_id: payment.subscription_id,
              p_user_id: retry.user_id,
              p_refund_amount: retry.requested_amount,
              p_is_partial: isPartialRefund,
              p_reason: retry.reason,
            }
          );

          if (!rpcError) {
            const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
            rpcSucceeded = result?.success === true;
          }
        } else {
          const { data: rpcResult, error: rpcError } = await adminClient.rpc(
            'process_simple_refund_atomic',
            {
              p_payment_id: payment.id,
              p_refund_amount: retry.requested_amount,
              p_is_partial: isPartialRefund,
              p_reason: retry.reason,
            }
          );

          if (!rpcError) {
            const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
            rpcSucceeded = result?.success === true;
          }
        }

        // 환불 요청 상태 최종 업데이트
        await updateRefundStatus(
          adminClient,
          retry.request_id,
          rpcSucceeded ? 'completed' : 'failed',
          {
            approvedAmount: retry.requested_amount,
            tossResponse,
            error: rpcSucceeded ? undefined : 'DB 업데이트 실패 (토스 환불은 완료됨)',
          }
        );

        if (rpcSucceeded) {
          results.succeeded++;
          logInfo('환불 재시도 성공', {
            requestId: retry.request_id,
            paymentId: retry.payment_id,
            amount: retry.requested_amount,
            retryCount: retry.retry_count,
            action: 'retry-refunds',
          });
        } else {
          results.failed++;
          results.errors.push(`${retry.request_id}: DB 업데이트 실패`);
        }
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        results.errors.push(`${retry.request_id}: ${errorMessage}`);

        logError('환불 재시도 처리 오류', error, {
          requestId: retry.request_id,
          action: 'retry-refunds',
        });
      }
    }

    // 최대 재시도 횟수 초과한 요청 확인
    const { data: maxRetriesData } = await adminClient
      .from('refund_requests')
      .select('id')
      .eq('status', 'failed')
      .gte('retry_count', 3);

    results.maxRetriesReached = maxRetriesData?.length ?? 0;

    if (results.maxRetriesReached > 0) {
      logWarn('최대 재시도 초과 환불 요청 존재', {
        count: results.maxRetriesReached,
        action: 'retry-refunds',
      });
    }

    logInfo('환불 재시도 완료', {
      ...results,
      executionTimeMs: Date.now() - startTime,
      action: 'retry-refunds',
    });

    return NextResponse.json({
      message: '환불 재시도 처리 완료',
      ...results,
      executionTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    logError('환불 재시도 Cron 오류', error, { action: 'retry-refunds' });

    return NextResponse.json(
      {
        error: '환불 재시도 처리 실패',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
        ...results,
        executionTimeMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// 환불 요청 상태 업데이트 헬퍼
async function updateRefundStatus(
  adminClient: ReturnType<typeof createAdminClient>,
  requestId: string,
  status: string,
  options?: {
    approvedAmount?: number;
    rejectionReason?: string;
    tossResponse?: TossPaymentResponse;
    error?: string;
  }
) {
  await adminClient.rpc('update_refund_request_status', {
    p_request_id: requestId,
    p_status: status,
    p_approved_amount: options?.approvedAmount,
    p_rejection_reason: options?.rejectionReason,
    p_toss_response: options?.tossResponse ? JSON.parse(JSON.stringify(options.tossResponse)) : undefined,
    p_error: options?.error,
  });
}
