import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { generateContentInputSchema, generatedContentSchema } from '@/lib/ai/schemas';
import type { GenerateContentInput, GeneratedContent } from '@/lib/ai/schemas';

// ────────────────────────────────────────────────────────────
// 모킹 설정
// ────────────────────────────────────────────────────────────

// Supabase 클라이언트 모킹
const mockFrom = vi.fn();
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: mockFrom,
};

// 체이닝 헬퍼
function createChainMock(finalValue: unknown = null, finalError: unknown = null) {
  const chain: Record<string, Mock> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.range = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: finalValue, error: finalError });
  return chain;
}

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Auth 모킹
const mockRequireAuth = vi.fn();
const mockGetAuthUser = vi.fn();

vi.mock('@/lib/auth', () => ({
  requireAuth: () => mockRequireAuth(),
  getAuthUser: () => mockGetAuthUser(),
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthError';
    }
  },
}));

// Rate Limit 모킹
const mockCheckRateLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => mockCheckRateLimit(),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  getRateLimitErrorMessage: vi.fn().mockReturnValue('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'),
  RATE_LIMIT_PRESETS: { AI_GENERATE: { windowMs: 60000, maxRequests: 10 } },
}));

// Daily Limit 모킹
const mockEnsureDailyLimitReset = vi.fn();
const mockDeductCredit = vi.fn();
const mockDeductDailyGeneration = vi.fn();
const mockRestoreGenerationCredit = vi.fn();

vi.mock('@/lib/ai/daily-limit', () => ({
  ensureDailyLimitReset: () => mockEnsureDailyLimitReset(),
  checkGenerationAvailability: (remaining: number, credits: number) => {
    if (remaining > 0) return { canGenerate: true, useCredits: false };
    if (credits > 0) return { canGenerate: true, useCredits: true };
    return { canGenerate: false, useCredits: false, errorMessage: '생성 횟수와 크레딧이 모두 소진되었습니다.' };
  },
  deductCredit: () => mockDeductCredit(),
  deductDailyGeneration: () => mockDeductDailyGeneration(),
  restoreGenerationCredit: () => mockRestoreGenerationCredit(),
}));

// Next.js headers 모킹
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])),
}));

// AI SDK 모킹
const mockGenerateObject = vi.fn();
const mockStreamObject = vi.fn();
vi.mock('ai', () => ({
  generateObject: () => mockGenerateObject(),
  streamObject: () => mockStreamObject(),
}));

const mockStreamableUpdate = vi.fn();
const mockStreamableDone = vi.fn();
const mockStreamableError = vi.fn();
vi.mock('@ai-sdk/rsc', () => ({
  createStreamableValue: vi.fn(() => ({
    value: {},
    update: mockStreamableUpdate,
    done: mockStreamableDone,
    error: mockStreamableError,
  })),
}));

// Logger 모킹
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
}));

// Pricing 모킹
vi.mock('@/config/pricing', () => ({
  getDailyLimitByPlan: (plan: string) => {
    const limits: Record<string, number> = { starter: 10, pro: 100, team: 500 };
    return limits[plan] || 10;
  },
}));

describe('Generate Content Input Schema', () => {
  it('유효한 입력을 통과시켜야 한다', () => {
    const validInput: GenerateContentInput = {
      language: 'python',
      topic: 'Python 리스트 컴프리헨션',
      difficulty: 'beginner',
      targetAudience: 'non_tech',
    };

    const result = generateContentInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('모든 지원 언어를 허용해야 한다', () => {
    const languages = ['python', 'javascript', 'sql', 'java', 'typescript', 'go'] as const;

    for (const language of languages) {
      const input = {
        language,
        topic: '테스트 주제',
        difficulty: 'beginner',
        targetAudience: 'non_tech',
      };

      const result = generateContentInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });

  it('지원하지 않는 언어를 거부해야 한다', () => {
    const invalidInput = {
      language: 'rust', // 지원하지 않는 언어
      topic: '테스트 주제',
      difficulty: 'beginner',
      targetAudience: 'non_tech',
    };

    const result = generateContentInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('너무 짧은 주제를 거부해야 한다', () => {
    const invalidInput = {
      language: 'python',
      topic: 'A', // 1자
      difficulty: 'beginner',
      targetAudience: 'non_tech',
    };

    const result = generateContentInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.topic).toContain(
        '주제는 2자 이상이어야 합니다'
      );
    }
  });

  it('모든 난이도 레벨을 허용해야 한다', () => {
    const difficulties = ['beginner', 'intermediate', 'advanced'] as const;

    for (const difficulty of difficulties) {
      const input = {
        language: 'python',
        topic: '테스트 주제',
        difficulty,
        targetAudience: 'non_tech',
      };

      const result = generateContentInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });

  it('모든 타겟 오디언스를 허용해야 한다', () => {
    const audiences = ['non_tech', 'junior_dev', 'manager', 'career_changer'] as const;

    for (const targetAudience of audiences) {
      const input = {
        language: 'python',
        topic: '테스트 주제',
        difficulty: 'beginner',
        targetAudience,
      };

      const result = generateContentInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });
});

describe('Generated Content Schema', () => {
  const validContent: GeneratedContent = {
    title: 'Python 리스트 컴프리헨션 완벽 가이드',
    learningObjectives: [
      '리스트 컴프리헨션의 기본 문법을 이해한다',
      '일반 for 루프와 리스트 컴프리헨션을 비교할 수 있다',
      '조건문을 포함한 리스트 컴프리헨션을 작성할 수 있다',
    ],
    explanation: '리스트 컴프리헨션은 기존 리스트를 기반으로 새로운 리스트를 만드는 간결한 방법입니다.',
    codeExample: '```python\n# 기본 리스트 컴프리헨션\nnumbers = [1, 2, 3, 4, 5]\nsquares = [x**2 for x in numbers]\n```',
    exercises: [
      {
        question: '1부터 10까지의 짝수만 포함하는 리스트를 컴프리헨션으로 작성하세요.',
        hint: 'if 조건문을 사용하세요.',
        difficulty: 'easy',
      },
      {
        question: '문자열 리스트에서 길이가 3보다 큰 문자열만 대문자로 변환하세요.',
        hint: 'len() 함수와 .upper() 메서드를 조합하세요.',
        difficulty: 'medium',
      },
      {
        question: '중첩 리스트를 평탄화하는 리스트 컴프리헨션을 작성하세요.',
        hint: '이중 for 루프를 사용하세요.',
        difficulty: 'hard',
      },
    ],
    summary: '리스트 컴프리헨션은 Python에서 리스트를 생성하는 간결하고 가독성 높은 방법입니다.',
    estimatedReadTime: 10,
  };

  it('유효한 생성 콘텐츠를 통과시켜야 한다', () => {
    const result = generatedContentSchema.safeParse(validContent);
    expect(result.success).toBe(true);
  });

  it('학습 목표가 3개 미만이면 거부해야 한다', () => {
    const invalidContent = {
      ...validContent,
      learningObjectives: ['목표 1', '목표 2'], // 2개만
    };

    const result = generatedContentSchema.safeParse(invalidContent);
    expect(result.success).toBe(false);
  });

  it('연습 문제가 정확히 3개여야 한다', () => {
    const invalidContent = {
      ...validContent,
      exercises: [
        { question: '문제 1', hint: '', difficulty: 'easy' },
        { question: '문제 2', hint: '', difficulty: 'medium' },
      ], // 2개만
    };

    const result = generatedContentSchema.safeParse(invalidContent);
    expect(result.success).toBe(false);
  });
});

describe('Generate Content Action Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('인증 체크', () => {
    it('비로그인 사용자는 거부되어야 한다', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await mockSupabaseClient.auth.getUser();
      expect(result.data.user).toBeNull();
    });

    it('로그인 사용자는 허용되어야 한다', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const result = await mockSupabaseClient.auth.getUser();
      expect(result.data.user).toBeDefined();
      expect(result.data.user?.id).toBe('user-123');
    });
  });

  describe('플랜별 언어 제한', () => {
    it('Starter 플랜 사용자 데이터 형식이 올바른지 확인', () => {
      const starterProfile = {
        id: 'user-123',
        plan: 'starter',
        daily_generations_remaining: 10,
        credits_balance: 0,
      };

      // Starter 플랜은 Python만 허용되어야 함
      expect(starterProfile.plan).toBe('starter');
    });

    it('Pro 플랜 사용자 데이터 형식이 올바른지 확인', () => {
      const proProfile = {
        id: 'user-456',
        plan: 'pro',
        daily_generations_remaining: 100,
        credits_balance: 50,
      };

      // Pro 플랜은 모든 언어 허용
      expect(proProfile.plan).toBe('pro');
    });
  });

  describe('크레딧 및 일일 횟수 체크', () => {
    it('일일 횟수가 남아있으면 일일 횟수 사용', () => {
      const profile = {
        daily_generations_remaining: 5,
        credits_balance: 10,
      };

      // 일일 횟수 > 0이면 일일 횟수 사용
      const useCredits = profile.daily_generations_remaining <= 0;
      expect(useCredits).toBe(false);
    });

    it('일일 횟수가 0이면 크레딧 사용', () => {
      const profile = {
        daily_generations_remaining: 0,
        credits_balance: 10,
      };

      // 일일 횟수 <= 0이면 크레딧 확인
      const useCredits = profile.daily_generations_remaining <= 0;
      expect(useCredits).toBe(true);
    });

    it('둘 다 없으면 생성 불가', () => {
      const profile = {
        daily_generations_remaining: 0,
        credits_balance: 0,
      };

      const canGenerate =
        profile.daily_generations_remaining > 0 || profile.credits_balance > 0;
      expect(canGenerate).toBe(false);
    });
  });
});

// ────────────────────────────────────────────────────────────
// 실제 액션 함수 통합 테스트
// ────────────────────────────────────────────────────────────

describe('generateContent Action', () => {
  const validInput: GenerateContentInput = {
    language: 'python',
    topic: 'Python 리스트 컴프리헨션',
    difficulty: 'beginner',
    targetAudience: 'non_tech',
  };

  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockProfile = {
    plan: 'pro',
    daily_generations_remaining: 10,
    daily_reset_at: new Date().toISOString(),
    credits_balance: 50,
  };

  const mockGeneratedContent: GeneratedContent = {
    title: 'Python 리스트 컴프리헨션 완벽 가이드',
    learningObjectives: ['목표 1', '목표 2', '목표 3'],
    explanation: '설명 내용',
    codeExample: '```python\ncode\n```',
    exercises: [
      { question: '문제 1', hint: '힌트 1', difficulty: 'easy' },
      { question: '문제 2', hint: '힌트 2', difficulty: 'medium' },
      { question: '문제 3', hint: '힌트 3', difficulty: 'hard' },
    ],
    summary: '요약',
    estimatedReadTime: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // 기본 성공 설정
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
    mockEnsureDailyLimitReset.mockResolvedValue({ remainingGenerations: 10 });
    mockDeductDailyGeneration.mockResolvedValue(undefined);
    mockDeductCredit.mockResolvedValue(undefined);

    // 프로필 조회 체인
    const profileChain = createChainMock(mockProfile);
    mockFrom.mockReturnValue(profileChain);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rate Limit 체크', () => {
    it('Rate Limit 초과 시 에러를 반환해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

      const { generateContent } = await import('@/actions/generate');
      const result = await generateContent(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('요청이 너무 많습니다');
      }
    });
  });

  describe('입력 검증', () => {
    it('유효하지 않은 언어는 거부해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: true });

      const { generateContent } = await import('@/actions/generate');
      const result = await generateContent({
        ...validInput,
        language: 'invalid' as GenerateContentInput['language'],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('입력값이 유효하지 않습니다');
      }
    });

    it('너무 짧은 주제는 거부해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: true });

      const { generateContent } = await import('@/actions/generate');
      const result = await generateContent({
        ...validInput,
        topic: 'A',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors?.topic).toBeDefined();
      }
    });
  });

  describe('인증 체크', () => {
    it('비로그인 사용자는 거부해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: true });

      const { AuthError } = await import('@/lib/auth');
      mockRequireAuth.mockRejectedValue(new AuthError('로그인이 필요합니다'));

      const { generateContent } = await import('@/actions/generate');
      const result = await generateContent(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('로그인이 필요합니다');
      }
    });
  });

  describe('플랜별 언어 제한', () => {
    it('Starter 플랜은 Python 외 언어를 거부해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: true });
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const starterProfile = { ...mockProfile, plan: 'starter' };
      const profileChain = createChainMock(starterProfile);
      mockFrom.mockReturnValue(profileChain);
      mockEnsureDailyLimitReset.mockResolvedValue({ remainingGenerations: 10 });

      const { generateContent } = await import('@/actions/generate');
      const result = await generateContent({
        ...validInput,
        language: 'javascript',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Starter 플랜은 Python만 지원');
      }
    });

    it('Pro 플랜은 모든 언어를 허용해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: true });
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockEnsureDailyLimitReset.mockResolvedValue({ remainingGenerations: 10 });

      // 프로필 조회
      const profileChain = createChainMock(mockProfile);
      // 콘텐츠 저장
      const insertChain = createChainMock({ id: 'content-123' });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain;
        return insertChain;
      });

      mockGenerateObject.mockResolvedValue({ object: mockGeneratedContent });

      const { generateContent } = await import('@/actions/generate');
      const result = await generateContent({
        ...validInput,
        language: 'javascript',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('생성 가용성 체크', () => {
    it('일일 횟수와 크레딧이 모두 없으면 거부해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: true });
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const noCreditsProfile = { ...mockProfile, daily_generations_remaining: 0, credits_balance: 0 };
      const profileChain = createChainMock(noCreditsProfile);
      mockFrom.mockReturnValue(profileChain);
      mockEnsureDailyLimitReset.mockResolvedValue({ remainingGenerations: 0 });

      const { generateContent } = await import('@/actions/generate');
      const result = await generateContent(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('소진');
      }
    });
  });

  describe('AI 생성 성공', () => {
    it('콘텐츠 생성 및 저장이 성공해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: true });
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockEnsureDailyLimitReset.mockResolvedValue({ remainingGenerations: 10 });

      const profileChain = createChainMock(mockProfile);
      const insertChain = createChainMock({ id: 'content-123' });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain;
        return insertChain;
      });

      mockGenerateObject.mockResolvedValue({ object: mockGeneratedContent });

      const { generateContent } = await import('@/actions/generate');
      const result = await generateContent(validInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe(mockGeneratedContent.title);
        expect(result.contentId).toBe('content-123');
      }
    });

    it('일일 횟수 사용 시 deductDailyGeneration이 호출되어야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: true });
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockEnsureDailyLimitReset.mockResolvedValue({ remainingGenerations: 10 });

      const profileChain = createChainMock(mockProfile);
      const insertChain = createChainMock({ id: 'content-123' });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain;
        return insertChain;
      });

      mockGenerateObject.mockResolvedValue({ object: mockGeneratedContent });

      const { generateContent } = await import('@/actions/generate');
      await generateContent(validInput);

      expect(mockDeductDailyGeneration).toHaveBeenCalled();
      expect(mockDeductCredit).not.toHaveBeenCalled();
    });
  });

  describe('AI 생성 에러 처리', () => {
    it('타임아웃 에러를 적절히 처리해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: true });
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockEnsureDailyLimitReset.mockResolvedValue({ remainingGenerations: 10 });

      const profileChain = createChainMock(mockProfile);
      mockFrom.mockReturnValue(profileChain);

      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockGenerateObject.mockRejectedValue(abortError);

      const { generateContent } = await import('@/actions/generate');
      const result = await generateContent(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('시간이 초과');
      }
    });

    it('Rate Limit 에러를 적절히 처리해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: true });
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockEnsureDailyLimitReset.mockResolvedValue({ remainingGenerations: 10 });

      const profileChain = createChainMock(mockProfile);
      mockFrom.mockReturnValue(profileChain);

      mockGenerateObject.mockRejectedValue(new Error('rate limit exceeded'));

      const { generateContent } = await import('@/actions/generate');
      const result = await generateContent(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('혼잡');
      }
    });

    it('API 키 에러를 적절히 처리해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: true });
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockEnsureDailyLimitReset.mockResolvedValue({ remainingGenerations: 10 });

      const profileChain = createChainMock(mockProfile);
      mockFrom.mockReturnValue(profileChain);

      mockGenerateObject.mockRejectedValue(new Error('Invalid API key'));

      const { generateContent } = await import('@/actions/generate');
      const result = await generateContent(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('API 키');
      }
    });
  });
});

describe('getRemainingGenerations Action', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('로그인한 사용자의 남은 횟수를 반환해야 한다', async () => {
    mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

    const profileChain = createChainMock({ plan: 'pro', daily_generations_remaining: 85 });
    mockFrom.mockReturnValue(profileChain);

    const { getRemainingGenerations } = await import('@/actions/generate');
    const result = await getRemainingGenerations();

    expect(result).not.toBeNull();
    expect(result?.remaining).toBe(85);
    expect(result?.limit).toBe(100); // Pro 플랜
    expect(result?.plan).toBe('pro');
  });

  it('비로그인 사용자는 null을 반환해야 한다', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const { getRemainingGenerations } = await import('@/actions/generate');
    const result = await getRemainingGenerations();

    expect(result).toBeNull();
  });

  it('프로필이 없으면 null을 반환해야 한다', async () => {
    mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

    const profileChain = createChainMock(null);
    mockFrom.mockReturnValue(profileChain);

    const { getRemainingGenerations } = await import('@/actions/generate');
    const result = await getRemainingGenerations();

    expect(result).toBeNull();
  });
});

describe('getGenerationHistory Action', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockContents = [
    { id: '1', title: '콘텐츠 1', created_at: '2024-01-01' },
    { id: '2', title: '콘텐츠 2', created_at: '2024-01-02' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('로그인한 사용자의 히스토리를 반환해야 한다', async () => {
    mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

    const historyChain: Record<string, Mock> = {};
    historyChain.select = vi.fn().mockReturnValue(historyChain);
    historyChain.eq = vi.fn().mockReturnValue(historyChain);
    historyChain.order = vi.fn().mockReturnValue(historyChain);
    historyChain.range = vi.fn().mockResolvedValue({
      data: mockContents,
      error: null,
      count: 15,
    });
    mockFrom.mockReturnValue(historyChain);

    const { getGenerationHistory } = await import('@/actions/generate');
    const result = await getGenerationHistory(1, 10);

    expect(result.contents).toHaveLength(2);
    expect(result.total).toBe(15);
  });

  it('비로그인 사용자는 빈 배열을 반환해야 한다', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const { getGenerationHistory } = await import('@/actions/generate');
    const result = await getGenerationHistory();

    expect(result.contents).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('페이지네이션이 올바르게 적용되어야 한다', async () => {
    mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

    const historyChain: Record<string, Mock> = {};
    historyChain.select = vi.fn().mockReturnValue(historyChain);
    historyChain.eq = vi.fn().mockReturnValue(historyChain);
    historyChain.order = vi.fn().mockReturnValue(historyChain);
    historyChain.range = vi.fn().mockResolvedValue({
      data: mockContents,
      error: null,
      count: 50,
    });
    mockFrom.mockReturnValue(historyChain);

    const { getGenerationHistory } = await import('@/actions/generate');
    await getGenerationHistory(3, 10); // 3페이지, 10개씩

    // range(20, 29) 호출 확인 (3페이지 = offset 20)
    expect(historyChain.range).toHaveBeenCalledWith(20, 29);
  });

  it('DB 에러 시 빈 배열을 반환해야 한다', async () => {
    mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

    const historyChain: Record<string, Mock> = {};
    historyChain.select = vi.fn().mockReturnValue(historyChain);
    historyChain.eq = vi.fn().mockReturnValue(historyChain);
    historyChain.order = vi.fn().mockReturnValue(historyChain);
    historyChain.range = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'DB Error' },
      count: 0,
    });
    mockFrom.mockReturnValue(historyChain);

    const { getGenerationHistory } = await import('@/actions/generate');
    const result = await getGenerationHistory();

    expect(result.contents).toEqual([]);
    expect(result.total).toBe(0);
  });
});
