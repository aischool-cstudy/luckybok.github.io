'use server';

import { generateObject, streamObject } from 'ai';
import { createStreamableValue } from '@ai-sdk/rsc';
import { headers } from 'next/headers';
import { requireAuth, getAuthUser, AuthError } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { models, AI_CONFIG } from '@/lib/ai/providers';
import { getDailyLimitByPlan } from '@/config/pricing';
import {
  ensureDailyLimitReset,
  checkGenerationAvailability,
  restoreGenerationCredit,
  deductCredit,
  deductDailyGeneration,
} from '@/lib/ai/daily-limit';
import { z } from 'zod';
import {
  generateContentInputSchema,
  generatedContentSchema,
  quizSchema,
  type GenerateContentInput,
  type GeneratedContent,
  type Quiz,
} from '@/lib/ai/schemas';
import {
  CONTENT_SYSTEM_PROMPT,
  QUIZ_SYSTEM_PROMPT,
  createContentPrompt,
  createQuizPrompt,
  type QuizPromptParams,
} from '@/lib/ai/prompts';
import {
  checkRateLimit,
  getClientIP,
  getRateLimitErrorMessage,
  RATE_LIMIT_PRESETS,
} from '@/lib/rate-limit';
import { logError, logWarn } from '@/lib/logger';

export type GenerateActionResult =
  | { success: true; data: GeneratedContent; contentId: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export type StreamingGenerateResult =
  | {
      success: true;
      stream: ReturnType<typeof createStreamableValue<Partial<GeneratedContent>>>;
    }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// ────────────────────────────────────────────────────────────
// 공통 검증 및 준비 로직
// ────────────────────────────────────────────────────────────

interface GenerationContext {
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  userId: string;
  validatedInput: GenerateContentInput;
  remainingGenerations: number;
  creditsBalance: number;
  useCredits: boolean;
}

type PrepareResult =
  | { success: true; context: GenerationContext }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * 콘텐츠 생성 전 공통 검증 및 준비 로직
 * - Rate Limit 체크
 * - 입력 검증
 * - 사용자 인증 확인
 * - 프로필 및 생성 가능 여부 확인
 * - 언어 제한 확인
 */
async function validateAndPrepareGeneration(
  input: GenerateContentInput
): Promise<PrepareResult> {
  // 0. Rate Limit 체크
  const headersList = await headers();
  const clientIP = getClientIP(headersList);
  const rateLimitResult = await checkRateLimit(
    clientIP,
    'ai_generate',
    RATE_LIMIT_PRESETS.AI_GENERATE
  );

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: getRateLimitErrorMessage(rateLimitResult),
    };
  }

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
  let supabase;
  let user;
  try {
    const authResult = await requireAuth();
    supabase = authResult.supabase;
    user = authResult.user;
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        success: false,
        error: error.message,
      };
    }
    throw error;
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
  const { remainingGenerations } = await ensureDailyLimitReset(supabase, user.id, profile);

  // 생성 횟수 또는 크레딧 확인
  const creditsBalance = profile.credits_balance ?? 0;
  const availability = checkGenerationAvailability(remainingGenerations, creditsBalance);

  if (!availability.canGenerate) {
    return {
      success: false,
      error: availability.errorMessage!,
    };
  }

  // 5. 언어 제한 확인 (Starter 플랜은 Python만)
  if (profile.plan === 'starter' && validated.data.language !== 'python') {
    return {
      success: false,
      error: 'Starter 플랜은 Python만 지원합니다. Pro 플랜으로 업그레이드하면 모든 언어를 사용할 수 있습니다.',
    };
  }

  return {
    success: true,
    context: {
      supabase,
      userId: user.id,
      validatedInput: validated.data,
      remainingGenerations,
      creditsBalance,
      useCredits: availability.useCredits,
    },
  };
}

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

  // 공통 검증 및 준비
  const prepareResult = await validateAndPrepareGeneration(input);
  if (!prepareResult.success) {
    return prepareResult;
  }

  const { supabase, userId, validatedInput, remainingGenerations, creditsBalance, useCredits } =
    prepareResult.context;

  try {
    // AI 콘텐츠 생성
    const prompt = createContentPrompt({
      language: validatedInput.language,
      topic: validatedInput.topic,
      difficulty: validatedInput.difficulty,
      targetAudience: validatedInput.targetAudience,
    });

    // 타임아웃을 적용한 AI 생성
    const generateWithTimeout = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.TIMEOUT.GENERATION);

      try {
        const result = await generateObject({
          model: models.standard,
          system: CONTENT_SYSTEM_PROMPT,
          prompt,
          schema: generatedContentSchema,
          abortSignal: controller.signal,
        });
        return result;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const { object: generatedContent } = await generateWithTimeout();

    const generationTime = Date.now() - startTime;

    // DB에 저장
    const { data: savedContent, error: saveError } = await supabase
      .from('generated_contents')
      .insert({
        user_id: userId,
        language: validatedInput.language,
        topic: validatedInput.topic,
        difficulty: validatedInput.difficulty,
        target_audience: validatedInput.targetAudience,
        title: generatedContent.title,
        content: JSON.stringify(generatedContent),
        code_examples: generatedContent.codeExample,
        model_used: 'llama-4-maverick-17b',
        generation_time_ms: generationTime,
      })
      .select('id')
      .single();

    if (saveError) {
      logError('콘텐츠 저장 오류', saveError, {
        action: 'generateContent',
        userId,
        topic: validatedInput.topic,
        language: validatedInput.language,
      });
      // 저장 실패해도 생성된 콘텐츠는 반환
    }

    // 생성 횟수 또는 크레딧 차감
    if (useCredits) {
      await deductCredit(supabase, userId, creditsBalance, validatedInput.topic);
    } else {
      await deductDailyGeneration(supabase, userId, remainingGenerations);
    }

    return {
      success: true,
      data: generatedContent,
      contentId: savedContent?.id || '',
    };
  } catch (error) {
    logError('콘텐츠 생성 오류', error, {
      action: 'generateContent',
      userId,
      topic: validatedInput.topic,
      language: validatedInput.language,
    });

    const errorMessage = error instanceof Error ? error.message : '';

    // 타임아웃 에러 처리
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: '콘텐츠 생성 시간이 초과되었습니다. 더 간단한 주제로 다시 시도해주세요.',
      };
    }

    // API 키 관련 에러 처리
    if (errorMessage.includes('API key') || errorMessage.includes('authentication') || errorMessage.includes('401')) {
      return {
        success: false,
        error: 'AI API 키가 설정되지 않았거나 유효하지 않습니다. 관리자에게 문의해주세요.',
      };
    }

    // Rate limit 에러 처리
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return {
        success: false,
        error: 'AI 서비스가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.',
      };
    }

    // 크레딧 부족 에러
    if (errorMessage.includes('credit') || errorMessage.includes('billing')) {
      return {
        success: false,
        error: 'AI 서비스 크레딧이 부족합니다. 관리자에게 문의해주세요.',
      };
    }

    // 개발 환경에서는 상세 에러 표시
    if (process.env.NODE_ENV === 'development') {
      return {
        success: false,
        error: `AI 콘텐츠 생성 오류: ${errorMessage || '알 수 없는 오류'}`,
      };
    }

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
  // 공통 검증 및 준비
  const prepareResult = await validateAndPrepareGeneration(input);
  if (!prepareResult.success) {
    return prepareResult;
  }

  const { supabase, userId, validatedInput, remainingGenerations, creditsBalance, useCredits } =
    prepareResult.context;

  // 스트리밍 시작
  const stream = createStreamableValue<Partial<GeneratedContent>>({});
  const startTime = Date.now();

  const prompt = createContentPrompt({
    language: validatedInput.language,
    topic: validatedInput.topic,
    difficulty: validatedInput.difficulty,
    targetAudience: validatedInput.targetAudience,
  });

  // 비동기로 스트리밍 처리
  (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.TIMEOUT.STREAMING);

    try {
      const { partialObjectStream, object } = streamObject({
        model: models.standard,
        system: CONTENT_SYSTEM_PROMPT,
        prompt,
        schema: generatedContentSchema,
        abortSignal: controller.signal,
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
        user_id: userId,
        language: validatedInput.language,
        topic: validatedInput.topic,
        difficulty: validatedInput.difficulty,
        target_audience: validatedInput.targetAudience,
        title: generatedContent.title,
        content: JSON.stringify(generatedContent),
        code_examples: generatedContent.codeExample,
        model_used: 'llama-4-maverick-17b',
        generation_time_ms: generationTime,
      });

      // 생성 횟수 또는 크레딧 차감
      if (useCredits) {
        await deductCredit(supabase, userId, creditsBalance, validatedInput.topic);
      } else {
        await deductDailyGeneration(supabase, userId, remainingGenerations);
      }

      clearTimeout(timeoutId);
      stream.done();
    } catch (error) {
      clearTimeout(timeoutId);
      logError('스트리밍 콘텐츠 생성 오류', error, {
        action: 'generateContentStreaming',
        userId,
        topic: validatedInput.topic,
        language: validatedInput.language,
      });

      // 에러 발생 시 크레딧/생성횟수 복구
      const restoreResult = await restoreGenerationCredit(
        supabase,
        userId,
        useCredits,
        validatedInput.topic
      );

      if (!restoreResult.success) {
        logWarn('크레딧/횟수 복구 실패', {
          action: 'generateContentStreaming',
          userId,
          error: restoreResult.error,
        });
      }

      if (error instanceof Error && error.name === 'AbortError') {
        stream.error('콘텐츠 생성 시간이 초과되었습니다. 크레딧/횟수가 복구되었습니다.');
      } else if (error instanceof Error && error.message.includes('rate limit')) {
        stream.error('AI 서비스가 일시적으로 혼잡합니다. 크레딧/횟수가 복구되었습니다.');
      } else {
        stream.error('AI 콘텐츠 생성 중 오류가 발생했습니다. 크레딧/횟수가 복구되었습니다.');
      }
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
  const authResult = await getAuthUser();
  if (!authResult) return null;

  const { user, supabase } = authResult;

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
  const authResult = await getAuthUser();
  if (!authResult) return { contents: [], total: 0 };

  const { user, supabase } = authResult;
  const offset = (page - 1) * limit;

  const { data: contents, error, count } = await supabase
    .from('generated_contents')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logError('히스토리 조회 오류', error, {
      action: 'getGenerationHistory',
      userId: user.id,
      page,
      limit,
    });
    return { contents: [], total: 0 };
  }

  return {
    contents: contents || [],
    total: count || 0,
  };
}

// ────────────────────────────────────────────────────────────
// 퀴즈 생성 관련
// ────────────────────────────────────────────────────────────

const generateQuizInputSchema = z.object({
  topic: z.string().min(2, '주제는 2자 이상이어야 합니다').max(200),
  language: z.string().min(1),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  contentSummary: z.string().optional(),
  questionCount: z.number().min(3).max(10).default(5),
});

export type GenerateQuizInput = z.infer<typeof generateQuizInputSchema>;

export type QuizActionResult =
  | { success: true; data: Quiz }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * 퀴즈 생성 Server Action
 * - 콘텐츠 기반 또는 주제 기반 퀴즈 생성
 * - 구조화된 출력으로 일관된 형식 보장
 */
export async function generateQuiz(
  input: GenerateQuizInput
): Promise<QuizActionResult> {
  // 0. Rate Limit 체크
  const headersList = await headers();
  const clientIP = getClientIP(headersList);
  const rateLimitResult = await checkRateLimit(
    clientIP,
    'ai_quiz',
    RATE_LIMIT_PRESETS.AI_GENERATE
  );

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: getRateLimitErrorMessage(rateLimitResult),
    };
  }

  // 1. 입력 검증
  const validated = generateQuizInputSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: '입력값이 유효하지 않습니다.',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // 2. 사용자 인증 확인
  let supabase;
  let user;
  try {
    const authResult = await requireAuth();
    supabase = authResult.supabase;
    user = authResult.user;
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        success: false,
        error: error.message,
      };
    }
    throw error;
  }

  // 3. 사용자 프로필 확인 (크레딧 사용 안 함, 무료 기능)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return {
      success: false,
      error: '사용자 정보를 찾을 수 없습니다.',
    };
  }

  try {
    // 퀴즈 프롬프트 생성
    const quizParams: QuizPromptParams = {
      topic: validated.data.topic,
      language: validated.data.language,
      difficulty: validated.data.difficulty,
      contentSummary: validated.data.contentSummary,
      questionCount: validated.data.questionCount,
    };

    const prompt = createQuizPrompt(quizParams);

    // AI 퀴즈 생성 (타임아웃 적용)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.TIMEOUT.FAST);

    try {
      const { object: quiz } = await generateObject({
        model: models.standard,
        system: QUIZ_SYSTEM_PROMPT,
        prompt,
        schema: quizSchema,
        abortSignal: controller.signal,
      });

      clearTimeout(timeoutId);

      return {
        success: true,
        data: quiz,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    logError('퀴즈 생성 오류', error, {
      action: 'generateQuiz',
      userId: user.id,
      topic: validated.data.topic,
    });

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: '퀴즈 생성 시간이 초과되었습니다. 다시 시도해주세요.',
      };
    }

    return {
      success: false,
      error: '퀴즈 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
    };
  }
}

/**
 * 생성된 콘텐츠 기반 퀴즈 생성
 * - contentId로 기존 콘텐츠 조회 후 퀴즈 생성
 */
export async function generateQuizFromContent(
  contentId: string
): Promise<QuizActionResult> {
  // 사용자 인증 확인
  const authResult = await getAuthUser();
  if (!authResult) {
    return { success: false, error: '로그인이 필요합니다.' };
  }

  const { user, supabase } = authResult;

  // 콘텐츠 조회
  const { data: content, error } = await supabase
    .from('generated_contents')
    .select('topic, language, difficulty, content')
    .eq('id', contentId)
    .eq('user_id', user.id)
    .single();

  if (error || !content) {
    return { success: false, error: '콘텐츠를 찾을 수 없습니다.' };
  }

  // 콘텐츠 요약 추출 (JSON 파싱)
  let contentSummary = '';
  try {
    const parsedContent = JSON.parse(content.content);
    contentSummary = parsedContent.summary || '';
  } catch {
    // JSON 파싱 실패 시 무시
  }

  // 퀴즈 생성 호출
  return generateQuiz({
    topic: content.topic,
    language: content.language,
    difficulty: content.difficulty as 'beginner' | 'intermediate' | 'advanced',
    contentSummary,
    questionCount: 5,
  });
}
