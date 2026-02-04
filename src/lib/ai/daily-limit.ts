/**
 * 일일 생성 횟수 관리 유틸리티
 * - 일일 리셋 체크 및 실행
 * - 생성 실패 시 크레딧/횟수 복구
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getDailyLimitByPlan } from '@/config/pricing';
import type { Database } from '@/types/database.types';
import { logError } from '@/lib/logger';

type Profile = {
  plan: string;
  daily_generations_remaining: number;
  daily_reset_at: string | null;
  credits_balance: number | null;
};

/**
 * 일일 생성 횟수 리셋이 필요한지 확인하고 리셋 수행
 * @returns 현재 남은 생성 횟수
 */
export async function ensureDailyLimitReset(
  supabase: SupabaseClient<Database>,
  userId: string,
  profile: Profile
): Promise<{ remainingGenerations: number; wasReset: boolean }> {
  const now = new Date();
  const resetAt = profile.daily_reset_at ? new Date(profile.daily_reset_at) : null;
  let remainingGenerations = profile.daily_generations_remaining;
  let wasReset = false;

  // 날짜가 바뀌었으면 리셋
  if (!resetAt || now.toDateString() !== resetAt.toDateString()) {
    const dailyLimit = getDailyLimitByPlan(profile.plan);
    remainingGenerations = dailyLimit;
    wasReset = true;

    await supabase
      .from('profiles')
      .update({
        daily_generations_remaining: dailyLimit,
        daily_reset_at: now.toISOString(),
      })
      .eq('id', userId);
  }

  return { remainingGenerations, wasReset };
}

/**
 * 생성 횟수 또는 크레딧 사용 가능 여부 확인
 * @returns 사용 가능 여부와 크레딧 사용 여부
 */
export function checkGenerationAvailability(
  remainingGenerations: number,
  creditsBalance: number
): { canGenerate: boolean; useCredits: boolean; errorMessage?: string } {
  if (remainingGenerations > 0) {
    return { canGenerate: true, useCredits: false };
  }

  if (creditsBalance > 0) {
    return { canGenerate: true, useCredits: true };
  }

  return {
    canGenerate: false,
    useCredits: false,
    errorMessage:
      '오늘의 생성 횟수를 모두 사용했습니다. 크레딧을 충전하거나 플랜을 업그레이드해주세요.',
  };
}

/**
 * 생성 실패 시 크레딧 또는 일일 횟수 복구
 * RPC 함수를 통해 원자적으로 처리
 * 재시도 로직 포함 (최대 3회, 지수 백오프)
 */
export async function restoreGenerationCredit(
  supabase: SupabaseClient<Database>,
  userId: string,
  useCredits: boolean,
  topic?: string
): Promise<{ success: boolean; restoredValue?: number; error?: string }> {
  const maxRetries = 3;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.rpc('restore_generation_credit', {
        p_user_id: userId,
        p_use_credits: useCredits,
        p_topic: topic,
      });

      if (error) {
        lastError = error.message;
        logError('크레딧/횟수 복구 RPC 오류', error, {
          action: 'restoreGenerationCredit',
          userId,
          attempt,
          maxRetries,
        });

        // 재시도 가능한 에러인지 확인 (연결 문제 등)
        const isRetryable =
          error.code?.startsWith('08') || // 연결 관련 에러
          error.message?.includes('timeout') ||
          error.message?.includes('connection');

        if (!isRetryable || attempt === maxRetries) {
          break;
        }

        // 지수 백오프 대기
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }

      // RPC 결과 확인 (배열로 반환됨)
      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.success) {
        return { success: false, error: result?.error_message || '복구 실패' };
      }

      return { success: true, restoredValue: result.restored_value };
    } catch (error) {
      lastError = error instanceof Error ? error.message : '알 수 없는 오류';
      logError('크레딧/횟수 복구 예외', error, {
        action: 'restoreGenerationCredit',
        userId,
        attempt,
        maxRetries,
      });

      if (attempt < maxRetries) {
        // 지수 백오프 대기
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
    }
  }

  // 모든 재시도 실패 - 중요 알림 필요
  logError('크레딧/횟수 복구 최종 실패 - 수동 복구 필요', lastError, {
    action: 'restoreGenerationCredit',
    userId,
    useCredits,
    topic,
    critical: true,
  });

  return {
    success: false,
    error: lastError || '복구에 실패했습니다. 고객지원에 문의해주세요.',
  };
}

/**
 * 크레딧 차감 처리
 */
export async function deductCredit(
  supabase: SupabaseClient<Database>,
  userId: string,
  creditsBalance: number,
  topic: string
): Promise<void> {
  const newCreditsBalance = creditsBalance - 1;

  // 크레딧 트랜잭션 기록
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'usage',
    amount: -1,
    balance: newCreditsBalance,
    description: `콘텐츠 생성: ${topic}`,
  });

  // 잔액 업데이트
  await supabase.from('profiles').update({ credits_balance: newCreditsBalance }).eq('id', userId);
}

/**
 * 일일 생성 횟수 차감 처리
 */
export async function deductDailyGeneration(
  supabase: SupabaseClient<Database>,
  userId: string,
  remainingGenerations: number
): Promise<void> {
  await supabase
    .from('profiles')
    .update({
      daily_generations_remaining: remainingGenerations - 1,
    })
    .eq('id', userId);
}
