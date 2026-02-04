'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { requireAuth, AuthError } from '@/lib/auth';
import { logError, logInfo } from '@/lib/logger';
import {
  checkRateLimit,
  getClientIP,
  getRateLimitErrorMessage,
  RATE_LIMIT_PRESETS,
} from '@/lib/rate-limit';
import type {
  LearnerProfile,
  LevelTestQuestionClient,
  LevelTestResult,
  OnboardingResult,
  ExperienceLevel,
  ProgrammingLanguage,
  LevelTestAnswer,
} from '@/types/database.types';

// ─────────────────────────────────────────────────────────
// 스키마 정의
// ─────────────────────────────────────────────────────────

const onboardingSchema = z.object({
  experience_level: z.enum(['beginner', 'intermediate', 'advanced']),
  learning_goals: z.array(z.string()).min(1, '최소 1개의 학습 목표를 선택해주세요'),
  preferred_languages: z
    .array(z.enum(['python', 'javascript', 'sql', 'java', 'typescript', 'go']))
    .min(1, '최소 1개의 프로그래밍 언어를 선택해주세요'),
  weekly_time_commitment: z.number().min(1).max(40).default(5),
  age: z.number().min(10, '나이는 10세 이상이어야 합니다').max(100, '나이는 100세 이하여야 합니다').optional(),
});

const levelTestSubmitSchema = z.object({
  language: z.enum(['python', 'javascript', 'sql', 'java', 'typescript', 'go']),
  answers: z.array(
    z.object({
      question_id: z.string().uuid(),
      selected_answer: z.string(),
    })
  ),
  time_taken_seconds: z.number().optional(),
});

// ─────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type LevelTestSubmitInput = z.infer<typeof levelTestSubmitSchema>;

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ─────────────────────────────────────────────────────────
// 학습자 프로필 조회
// ─────────────────────────────────────────────────────────

export async function getLearnerProfile(): Promise<ActionResult<LearnerProfile | null>> {
  try {
    const { user, supabase } = await requireAuth();

    const { data, error } = await supabase
      .from('learner_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116: 결과 없음
      logError('학습자 프로필 조회 실패', error, { userId: user.id });
      return { success: false, error: '프로필 조회에 실패했습니다.' };
    }

    return { success: true, data: data as LearnerProfile | null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('학습자 프로필 조회 예외', error as Error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

// ─────────────────────────────────────────────────────────
// 온보딩 완료 여부 확인
// ─────────────────────────────────────────────────────────

export async function checkOnboardingStatus(): Promise<
  ActionResult<{ completed: boolean; profile: LearnerProfile | null }>
> {
  try {
    const { user, supabase } = await requireAuth();

    const { data, error } = await supabase
      .from('learner_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      logError('온보딩 상태 확인 실패', error, { userId: user.id });
      return { success: false, error: '상태 확인에 실패했습니다.' };
    }

    return {
      success: true,
      data: {
        completed: data?.onboarding_completed ?? false,
        profile: data as LearnerProfile | null,
      },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('온보딩 상태 확인 예외', error as Error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

// ─────────────────────────────────────────────────────────
// 온보딩 프로필 저장
// ─────────────────────────────────────────────────────────

export async function saveOnboardingProfile(
  input: OnboardingInput
): Promise<ActionResult<OnboardingResult>> {
  try {
    // Rate Limiting
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = await checkRateLimit(
      clientIP,
      'onboarding_save',
      RATE_LIMIT_PRESETS.DEFAULT
    );

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: getRateLimitErrorMessage(rateLimitResult),
      };
    }

    // 입력 검증
    const validated = onboardingSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? '입력값이 유효하지 않습니다.',
      };
    }

    const { user, supabase } = await requireAuth();

    // RPC 함수로 온보딩 완료 처리
    const { data, error } = await supabase.rpc('complete_onboarding', {
      p_user_id: user.id,
      p_experience_level: validated.data.experience_level,
      p_learning_goals: validated.data.learning_goals,
      p_preferred_languages: validated.data.preferred_languages,
      p_weekly_time_commitment: validated.data.weekly_time_commitment,
      p_age: validated.data.age ?? null,
    });

    if (error) {
      logError('온보딩 저장 실패', error, { userId: user.id });
      return { success: false, error: '온보딩 저장에 실패했습니다.' };
    }

    // RPC 결과 처리 (배열 또는 단일 객체 반환 가능)
    const result = (Array.isArray(data) ? data[0] : data) as OnboardingResult | undefined;

    if (!result?.success) {
      return {
        success: false,
        error: result?.error_message ?? '온보딩 저장에 실패했습니다.',
      };
    }

    logInfo('온보딩 완료', {
      userId: user.id,
      profileId: result.profile_id,
    });

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('온보딩 저장 예외', error as Error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

// ─────────────────────────────────────────────────────────
// 레벨 테스트 문제 조회
// ─────────────────────────────────────────────────────────

export async function getLevelTestQuestions(
  language: ProgrammingLanguage,
  questionsPerLevel: number = 5
): Promise<ActionResult<LevelTestQuestionClient[]>> {
  try {
    const { supabase } = await requireAuth();

    // RPC 함수로 문제 조회 (난이도별 랜덤 선택)
    const { data, error } = await supabase.rpc('get_level_test_questions', {
      p_language: language,
      p_questions_per_level: questionsPerLevel,
    });

    if (error) {
      logError('레벨 테스트 문제 조회 실패', error, { language });
      return { success: false, error: '문제 조회에 실패했습니다.' };
    }

    // 클라이언트용 데이터로 변환 (정답 제외)
    type RPCQuestionResult = {
      id: string;
      difficulty: string;
      question: string;
      code_snippet: string | null;
      options: unknown;
      topic: string;
      order_index: number;
    };

    const clientQuestions: LevelTestQuestionClient[] = (data ?? []).map(
      (q: RPCQuestionResult) => ({
        id: q.id,
        language,
        difficulty: q.difficulty as 'beginner' | 'intermediate' | 'advanced',
        question: q.question,
        code_snippet: q.code_snippet,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
        topic: q.topic,
        order_index: q.order_index,
      })
    );

    return { success: true, data: clientQuestions };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('레벨 테스트 문제 조회 예외', error as Error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

// ─────────────────────────────────────────────────────────
// 레벨 테스트 제출
// ─────────────────────────────────────────────────────────

export async function submitLevelTest(
  input: LevelTestSubmitInput
): Promise<ActionResult<LevelTestResult>> {
  try {
    // Rate Limiting
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = await checkRateLimit(
      clientIP,
      'level_test_submit',
      RATE_LIMIT_PRESETS.DEFAULT
    );

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: getRateLimitErrorMessage(rateLimitResult),
      };
    }

    // 입력 검증
    const validated = levelTestSubmitSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? '입력값이 유효하지 않습니다.',
      };
    }

    const { user, supabase } = await requireAuth();

    // RPC 함수로 레벨 테스트 제출
    const { data, error } = await supabase.rpc('submit_level_test', {
      p_user_id: user.id,
      p_language: validated.data.language,
      p_answers: validated.data.answers,
      p_time_taken_seconds: validated.data.time_taken_seconds ?? undefined,
    });

    if (error) {
      logError('레벨 테스트 제출 실패', error, { userId: user.id });
      return { success: false, error: '테스트 제출에 실패했습니다.' };
    }

    // RPC 결과 처리 (배열 또는 단일 객체 반환 가능)
    type LevelTestRPCResult = {
      test_id: string;
      score: number;
      total_questions: number;
      determined_level: string;
      percentage: number;
    };
    const result = (Array.isArray(data) ? data[0] : data) as LevelTestRPCResult | undefined;

    if (!result) {
      return { success: false, error: '테스트 결과를 처리할 수 없습니다.' };
    }

    logInfo('레벨 테스트 완료', {
      userId: user.id,
      language: validated.data.language,
      score: result.score,
      level: result.determined_level,
    });

    return {
      success: true,
      data: {
        test_id: result.test_id,
        score: result.score,
        total_questions: result.total_questions,
        determined_level: result.determined_level as ExperienceLevel,
        percentage: Number(result.percentage),
      },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('레벨 테스트 제출 예외', error as Error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

// ─────────────────────────────────────────────────────────
// 사용자의 언어별 레벨 조회
// ─────────────────────────────────────────────────────────

export async function getUserLevelByLanguage(
  language: ProgrammingLanguage
): Promise<
  ActionResult<{
    determined_level: ExperienceLevel;
    score: number;
    total_questions: number;
    tested_at: string;
  } | null>
> {
  try {
    const { user, supabase } = await requireAuth();

    const { data, error } = await supabase.rpc('get_user_level_by_language', {
      p_user_id: user.id,
      p_language: language,
    });

    if (error) {
      logError('언어별 레벨 조회 실패', error, { userId: user.id, language });
      return { success: false, error: '레벨 조회에 실패했습니다.' };
    }

    const result = data?.[0];

    if (!result) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        determined_level: result.determined_level as ExperienceLevel,
        score: result.score,
        total_questions: result.total_questions,
        tested_at: result.tested_at,
      },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('언어별 레벨 조회 예외', error as Error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

// ─────────────────────────────────────────────────────────
// 사용자의 모든 레벨 테스트 기록 조회
// ─────────────────────────────────────────────────────────

export async function getUserLevelTests(): Promise<
  ActionResult<
    Array<{
      id: string;
      language: ProgrammingLanguage;
      score: number;
      total_questions: number;
      determined_level: ExperienceLevel;
      time_taken_seconds: number | null;
      created_at: string;
    }>
  >
> {
  try {
    const { user, supabase } = await requireAuth();

    const { data, error } = await supabase
      .from('level_tests')
      .select('id, language, score, total_questions, determined_level, time_taken_seconds, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logError('레벨 테스트 기록 조회 실패', error, { userId: user.id });
      return { success: false, error: '기록 조회에 실패했습니다.' };
    }

    return {
      success: true,
      data: (data ?? []).map((test) => ({
        id: test.id,
        language: test.language as ProgrammingLanguage,
        score: test.score,
        total_questions: test.total_questions,
        determined_level: test.determined_level as ExperienceLevel,
        time_taken_seconds: test.time_taken_seconds,
        created_at: test.created_at,
      })),
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('레벨 테스트 기록 조회 예외', error as Error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

// ─────────────────────────────────────────────────────────
// 레벨 테스트 상세 결과 조회 (오답 해설 포함)
// ─────────────────────────────────────────────────────────

export async function getLevelTestDetail(testId: string): Promise<
  ActionResult<{
    test: {
      id: string;
      language: ProgrammingLanguage;
      score: number;
      total_questions: number;
      determined_level: ExperienceLevel;
      time_taken_seconds: number | null;
      created_at: string;
    };
    answers: Array<{
      question_id: string;
      question: string;
      code_snippet: string | null;
      selected_answer: string;
      correct_answer: string;
      is_correct: boolean;
      explanation: string | null;
      topic: string;
    }>;
  }>
> {
  try {
    const { user, supabase } = await requireAuth();

    // 테스트 결과 조회
    const { data: testData, error: testError } = await supabase
      .from('level_tests')
      .select('*')
      .eq('id', testId)
      .eq('user_id', user.id)
      .single();

    if (testError || !testData) {
      return { success: false, error: '테스트 결과를 찾을 수 없습니다.' };
    }

    // 답안에 해당하는 문제 정보 조회
    const answers = (testData.answers as unknown as LevelTestAnswer[]) ?? [];
    const questionIds = answers.map((a) => a.question_id);

    if (questionIds.length === 0) {
      return {
        success: true,
        data: {
          test: {
            id: testData.id,
            language: testData.language as ProgrammingLanguage,
            score: testData.score,
            total_questions: testData.total_questions,
            determined_level: testData.determined_level as ExperienceLevel,
            time_taken_seconds: testData.time_taken_seconds,
            created_at: testData.created_at,
          },
          answers: [],
        },
      };
    }

    const { data: questions, error: questionsError } = await supabase
      .from('level_test_questions')
      .select('id, question, code_snippet, correct_answer, explanation, topic')
      .in('id', questionIds);

    if (questionsError) {
      logError('문제 정보 조회 실패', questionsError);
      return { success: false, error: '문제 정보 조회에 실패했습니다.' };
    }

    // 답안과 문제 정보 결합
    const questionMap = new Map(questions?.map((q) => [q.id, q]) ?? []);
    const detailedAnswers = answers.map((answer) => {
      const question = questionMap.get(answer.question_id);
      return {
        question_id: answer.question_id,
        question: question?.question ?? '',
        code_snippet: question?.code_snippet ?? null,
        selected_answer: answer.selected_answer,
        correct_answer: question?.correct_answer ?? '',
        is_correct: answer.selected_answer === question?.correct_answer,
        explanation: question?.explanation ?? null,
        topic: question?.topic ?? '',
      };
    });

    return {
      success: true,
      data: {
        test: {
          id: testData.id,
          language: testData.language as ProgrammingLanguage,
          score: testData.score,
          total_questions: testData.total_questions,
          determined_level: testData.determined_level as ExperienceLevel,
          time_taken_seconds: testData.time_taken_seconds,
          created_at: testData.created_at,
        },
        answers: detailedAnswers,
      },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('테스트 상세 조회 예외', error as Error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

// ─────────────────────────────────────────────────────────
// 나이 업데이트 (영구 저장)
// ─────────────────────────────────────────────────────────

const updateAgeSchema = z.object({
  age: z.number().min(10, '나이는 10세 이상이어야 합니다').max(100, '나이는 100세 이하여야 합니다'),
});

export type UpdateAgeInput = z.infer<typeof updateAgeSchema>;

export async function updateLearnerAge(
  input: UpdateAgeInput
): Promise<ActionResult<{ age: number }>> {
  try {
    // Rate Limiting
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = await checkRateLimit(
      clientIP,
      'update_age',
      RATE_LIMIT_PRESETS.DEFAULT
    );

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: getRateLimitErrorMessage(rateLimitResult),
      };
    }

    // 입력 검증
    const validated = updateAgeSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? '입력값이 유효하지 않습니다.',
      };
    }

    const { user, supabase } = await requireAuth();

    // RPC 함수로 나이 업데이트
    const { data, error } = await supabase.rpc('update_learner_age', {
      p_user_id: user.id,
      p_age: validated.data.age,
    });

    if (error) {
      logError('나이 업데이트 실패', error, { userId: user.id });
      return { success: false, error: '나이 저장에 실패했습니다.' };
    }

    // RPC 결과 처리
    const result = (Array.isArray(data) ? data[0] : data) as { success: boolean; error_message: string | null } | undefined;

    if (!result?.success) {
      return {
        success: false,
        error: result?.error_message ?? '나이 저장에 실패했습니다.',
      };
    }

    logInfo('나이 업데이트 완료', {
      userId: user.id,
      age: validated.data.age,
    });

    return { success: true, data: { age: validated.data.age } };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('나이 업데이트 예외', error as Error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}
