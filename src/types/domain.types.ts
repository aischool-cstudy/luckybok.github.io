/**
 * 도메인 모델 타입 정의
 * 비즈니스 로직에서 사용되는 핵심 타입들
 */

// ===== 공통 상수 Re-export (Single Source of Truth: config/constants.ts) =====
export {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_DESCRIPTIONS,
  TARGET_AUDIENCES,
  TARGET_AUDIENCE_LABELS,
  TARGET_AUDIENCE_DESCRIPTIONS,
  TARGET_AUDIENCE_ANALOGY_DOMAINS,
  LANGUAGE_OPTIONS,
  DIFFICULTY_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
  type SupportedLanguage,
  type DifficultyLevel,
  type TargetAudience,
} from '@/config/constants';

// ===== AI 모델 =====

export const AI_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-3-5-haiku-20241022',
  'gpt-4o',
  'gpt-4o-mini',
] as const;

export type AIModel = (typeof AI_MODELS)[number];

export const AI_MODEL_INFO: Record<
  AIModel,
  { label: string; provider: 'anthropic' | 'openai'; tier: 'premium' | 'standard' }
> = {
  'claude-sonnet-4-20250514': {
    label: 'Claude Sonnet 4',
    provider: 'anthropic',
    tier: 'premium',
  },
  'claude-3-5-haiku-20241022': {
    label: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    tier: 'standard',
  },
  'gpt-4o': {
    label: 'GPT-4o',
    provider: 'openai',
    tier: 'premium',
  },
  'gpt-4o-mini': {
    label: 'GPT-4o Mini',
    provider: 'openai',
    tier: 'standard',
  },
};

// ===== 플랜 =====
// 참고: 플랜 제한은 config/pricing.ts에서 관리

export const PLANS = ['starter', 'pro', 'team', 'enterprise'] as const;

export type Plan = (typeof PLANS)[number];

// ===== 콘텐츠 구조 =====

import type { SupportedLanguage } from '@/config/constants';

/**
 * 코드 예제 구조
 */
export interface CodeExample {
  title: string;
  description: string;
  code: string;
  language: SupportedLanguage;
  explanation?: string;
}

/**
 * 퀴즈 문제 구조
 */
export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

/**
 * 퀴즈 구조
 */
export interface Quiz {
  title: string;
  questions: QuizQuestion[];
}

/**
 * 생성된 콘텐츠의 전체 구조
 */
export interface GeneratedContentStructure {
  title: string;
  introduction: string;
  mainContent: string;
  codeExamples: CodeExample[];
  quiz: Quiz;
  summary?: string;
}

// ===== 콘텐츠 생성 입력 =====

import type { DifficultyLevel, TargetAudience } from '@/config/constants';

/**
 * 콘텐츠 생성 요청 파라미터
 */
export interface ContentGenerationInput {
  language: SupportedLanguage;
  topic: string;
  difficulty: DifficultyLevel;
  targetAudience: TargetAudience;
  model?: AIModel;
}

/**
 * 콘텐츠 생성 결과
 */
export interface ContentGenerationResult {
  success: boolean;
  content?: GeneratedContentStructure;
  contentId?: string;
  tokensUsed?: number;
  generationTimeMs?: number;
  error?: string;
}
