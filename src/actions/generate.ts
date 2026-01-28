'use server';

import { generateObject, streamObject } from 'ai';
import { createStreamableValue } from 'ai/rsc';
import { createServerClient } from '@/lib/supabase/server';
import { models } from '@/lib/ai/providers';
import { getDailyLimitByPlan } from '@/config/pricing';
import {
  generateContentInputSchema,
  generatedContentSchema,
  type GenerateContentInput,
  type GeneratedContent,
} from '@/lib/ai/schemas';
import { CONTENT_SYSTEM_PROMPT, createContentPrompt } from '@/lib/ai/prompts';

export type GenerateActionResult =
  | { success: true; data: GeneratedContent; contentId: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export type StreamingGenerateResult =
  | {
      success: true;
      stream: ReturnType<typeof createStreamableValue<Partial<GeneratedContent>>>;
    }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * 콘텐츠 생성 Server Action
 * - AI를 사용해 코딩 교육 콘텐츠 생성
 * - 사용자의 일일 생성 횟수 체크
 * - 생성된 콘텐츠를 DB에 저장
 */
export async function generateContent(
  input: GenerateContentInput
): Promise<GenerateActionResult> {
  const startTime = Date.now();

  // 1. 입력 검증
  const validated = generateContentInputSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: '입력값이 유효하지 않습니다.',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // 2. 사용자 인증 확인
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: '로그인이 필요합니다.',
    };
  }

  // 3. 사용자 프로필 및 생성 횟수 확인
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, daily_generations_remaining, daily_reset_at, credits_balance')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return {
      success: false,
      error: '사용자 정보를 찾을 수 없습니다.',
    };
  }

  // 4. 일일 생성 횟수 체크 및 리셋
  const now = new Date();
  const resetAt = profile.daily_reset_at ? new Date(profile.daily_reset_at) : null;
  let remainingGenerations = profile.daily_generations_remaining;

  // 날짜가 바뀌었으면 리셋
  if (!resetAt || now.toDateString() !== resetAt.toDateString()) {
    const dailyLimit = getDailyLimitByPlan(profile.plan);
    remainingGenerations = dailyLimit;

    await supabase
      .from('profiles')
      .update({
        daily_generations_remaining: dailyLimit,
        daily_reset_at: now.toISOString(),
      })
      .eq('id', user.id);
  }

  // 생성 횟수 또는 크레딧 확인
  const creditsBalance = profile.credits_balance ?? 0;
  let useCredits = false;

  if (remainingGenerations <= 0) {
    // 일일 횟수가 없으면 크레딧 확인
    if (creditsBalance <= 0) {
      return {
        success: false,
        error: '오늘의 생성 횟수를 모두 사용했습니다. 크레딧을 충전하거나 플랜을 업그레이드해주세요.',
      };
    }
    useCredits = true;
  }

  // 5. 언어 제한 확인 (Starter 플랜은 Python만)
  if (profile.plan === 'starter' && validated.data.language !== 'python') {
    return {
      success: false,
      error: 'Starter 플랜은 Python만 지원합니다. Pro 플랜으로 업그레이드하면 모든 언어를 사용할 수 있습니다.',
    };
  }

  try {
    // 6. AI 콘텐츠 생성 (소문자 표준 사용)
    const prompt = createContentPrompt({
      language: validated.data.language,
      topic: validated.data.topic,
      difficulty: validated.data.difficulty,
      targetAudience: validated.data.targetAudience,
    });

    const { object: generatedContent } = await generateObject({
      model: models.standard,
      system: CONTENT_SYSTEM_PROMPT,
      prompt,
      schema: generatedContentSchema,
      mode: 'json',
    });

    const generationTime = Date.now() - startTime;

    // 7. DB에 저장 (소문자 표준으로 직접 저장)
    const { data: savedContent, error: saveError } = await supabase
      .from('generated_contents')
      .insert({
        user_id: user.id,
        language: validated.data.language,
        topic: validated.data.topic,
        difficulty: validated.data.difficulty,
        target_audience: validated.data.targetAudience,
        title: generatedContent.title,
        content: JSON.stringify(generatedContent),
        code_examples: generatedContent.codeExample,
        model_used: 'claude-sonnet-4-20250514',
        generation_time_ms: generationTime,
      })
      .select('id')
      .single();

    if (saveError) {
      console.error('콘텐츠 저장 오류:', saveError);
      // 저장 실패해도 생성된 콘텐츠는 반환
    }

    // 8. 생성 횟수 또는 크레딧 차감
    if (useCredits) {
      // 크레딧 차감
      const newCreditsBalance = creditsBalance - 1;

      // 크레딧 트랜잭션 기록
      await supabase.from('credit_transactions').insert({
        user_id: user.id,
        type: 'usage',
        amount: -1,
        balance: newCreditsBalance,
        description: `콘텐츠 생성: ${validated.data.topic}`,
      });

      // 잔액 업데이트
      await supabase
        .from('profiles')
        .update({ credits_balance: newCreditsBalance })
        .eq('id', user.id);
    } else {
      // 일일 횟수 차감
      await supabase
        .from('profiles')
        .update({
          daily_generations_remaining: remainingGenerations - 1,
        })
        .eq('id', user.id);
    }

    return {
      success: true,
      data: generatedContent,
      contentId: savedContent?.id || '',
    };
  } catch (error) {
    console.error('콘텐츠 생성 오류:', error);
    return {
      success: false,
      error: 'AI 콘텐츠 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
    };
  }
}

/**
 * 스트리밍 콘텐츠 생성 Server Action
 * - 실시간으로 콘텐츠를 스트리밍하여 UX 개선
 * - 생성 완료 후 DB에 저장
 */
export async function generateContentStreaming(
  input: GenerateContentInput
): Promise<StreamingGenerateResult> {
  // 1. 입력 검증
  const validated = generateContentInputSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: '입력값이 유효하지 않습니다.',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // 2. 사용자 인증 확인
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: '로그인이 필요합니다.',
    };
  }

  // 3. 사용자 프로필 및 생성 횟수 확인
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, daily_generations_remaining, daily_reset_at, credits_balance')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return {
      success: false,
      error: '사용자 정보를 찾을 수 없습니다.',
    };
  }

  // 4. 일일 생성 횟수 체크 및 리셋
  const now = new Date();
  const resetAt = profile.daily_reset_at ? new Date(profile.daily_reset_at) : null;
  let remainingGenerations = profile.daily_generations_remaining;

  if (!resetAt || now.toDateString() !== resetAt.toDateString()) {
    const dailyLimit = getDailyLimitByPlan(profile.plan);
    remainingGenerations = dailyLimit;

    await supabase
      .from('profiles')
      .update({
        daily_generations_remaining: dailyLimit,
        daily_reset_at: now.toISOString(),
      })
      .eq('id', user.id);
  }

  const creditsBalance = profile.credits_balance ?? 0;
  let useCredits = false;

  if (remainingGenerations <= 0) {
    if (creditsBalance <= 0) {
      return {
        success: false,
        error: '오늘의 생성 횟수를 모두 사용했습니다. 크레딧을 충전하거나 플랜을 업그레이드해주세요.',
      };
    }
    useCredits = true;
  }

  // 5. 언어 제한 확인 (Starter 플랜은 Python만)
  if (profile.plan === 'starter' && validated.data.language !== 'python') {
    return {
      success: false,
      error: 'Starter 플랜은 Python만 지원합니다. Pro 플랜으로 업그레이드하면 모든 언어를 사용할 수 있습니다.',
    };
  }

  // 6. 스트리밍 시작
  const stream = createStreamableValue<Partial<GeneratedContent>>({});
  const startTime = Date.now();

  const prompt = createContentPrompt({
    language: validated.data.language,
    topic: validated.data.topic,
    difficulty: validated.data.difficulty,
    targetAudience: validated.data.targetAudience,
  });

  // 비동기로 스트리밍 처리
  (async () => {
    try {
      const { partialObjectStream, object } = streamObject({
        model: models.standard,
        system: CONTENT_SYSTEM_PROMPT,
        prompt,
        schema: generatedContentSchema,
        mode: 'json',
      });

      // 스트리밍 업데이트
      for await (const partialObject of partialObjectStream) {
        stream.update(partialObject as Partial<GeneratedContent>);
      }

      // 최종 결과 가져오기
      const generatedContent = await object;
      const generationTime = Date.now() - startTime;

      // DB에 저장
      await supabase.from('generated_contents').insert({
        user_id: user.id,
        language: validated.data.language,
        topic: validated.data.topic,
        difficulty: validated.data.difficulty,
        target_audience: validated.data.targetAudience,
        title: generatedContent.title,
        content: JSON.stringify(generatedContent),
        code_examples: generatedContent.codeExample,
        model_used: 'claude-sonnet-4-20250514',
        generation_time_ms: generationTime,
      });

      // 생성 횟수 또는 크레딧 차감
      if (useCredits) {
        const newCreditsBalance = creditsBalance - 1;
        await supabase.from('credit_transactions').insert({
          user_id: user.id,
          type: 'usage',
          amount: -1,
          balance: newCreditsBalance,
          description: `콘텐츠 생성: ${validated.data.topic}`,
        });
        await supabase
          .from('profiles')
          .update({ credits_balance: newCreditsBalance })
          .eq('id', user.id);
      } else {
        await supabase
          .from('profiles')
          .update({ daily_generations_remaining: remainingGenerations - 1 })
          .eq('id', user.id);
      }

      stream.done();
    } catch (error) {
      console.error('스트리밍 콘텐츠 생성 오류:', error);
      stream.error('AI 콘텐츠 생성 중 오류가 발생했습니다.');
    }
  })();

  return {
    success: true,
    stream: stream,
  };
}

/**
 * 사용자의 남은 생성 횟수 조회
 */
export async function getRemainingGenerations(): Promise<{
  remaining: number;
  limit: number;
  plan: string;
} | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, daily_generations_remaining')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    remaining: profile.daily_generations_remaining,
    limit: getDailyLimitByPlan(profile.plan),
    plan: profile.plan,
  };
}

/**
 * 사용자의 생성 히스토리 조회
 */
export async function getGenerationHistory(page = 1, limit = 10) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { contents: [], total: 0 };

  const offset = (page - 1) * limit;

  const { data: contents, error, count } = await supabase
    .from('generated_contents')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('히스토리 조회 오류:', error);
    return { contents: [], total: 0 };
  }

  return {
    contents: contents || [],
    total: count || 0,
  };
}
