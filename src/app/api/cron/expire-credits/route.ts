/**
 * 만료 크레딧 처리 Cron Job
 * 스케줄: 매일 01:00 UTC (0 1 * * *)
 *
 * Vercel Cron Jobs에서 호출됨
 * Advisory lock으로 중복 실행 방지
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';
import { logInfo, logWarn, logError } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Cron 인증 검증
  const authHeader = request.headers.get('authorization');
  const cronSecret = serverEnv.CRON_SECRET;

  if (authHeader !== `Bearer ${cronSecret}`) {
    logWarn('Cron 인증 실패', { action: 'cron/expire-credits' });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const adminClient = createAdminClient();

  try {
    // Advisory lock을 사용하는 안전한 만료 처리 함수 호출
    const { data, error } = await adminClient.rpc('expire_credits_safe');

    if (error) {
      logError('크레딧 만료 처리 오류', error, {
        action: 'cron/expire-credits',
      });
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          duration: Date.now() - startTime,
        },
        { status: 500 }
      );
    }

    // RPC 결과 확인
    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.success) {
      logWarn('크레딧 만료 처리 실패', {
        action: 'cron/expire-credits',
        errorMessage: result?.error_message,
      });
      return NextResponse.json(
        {
          success: false,
          error: result?.error_message || '처리 실패',
          duration: Date.now() - startTime,
        },
        { status: 200 } // 다른 프로세스 실행 중인 경우 200으로 반환
      );
    }

    logInfo('크레딧 만료 처리 완료', {
      action: 'cron/expire-credits',
      processedCount: result.processed_count,
    });

    return NextResponse.json({
      success: true,
      processedCount: result.processed_count,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logError('크레딧 만료 처리 예외', error, {
      action: 'cron/expire-credits',
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
