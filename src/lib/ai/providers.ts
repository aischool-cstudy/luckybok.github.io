import { groq } from '@ai-sdk/groq';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { logWarn, logError } from '@/lib/logger';

// AI SDK 모델 타입 (각 프로바이더에서 반환하는 타입과 호환)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AIModel = ReturnType<typeof groq> | ReturnType<typeof openai> | ReturnType<typeof anthropic>;

/**
 * AI 모델 프로바이더 설정 (폴백 전략 포함)
 *
 * Priority Order:
 * 1. Groq (무료 티어) - Llama 4 Maverick
 * 2. OpenAI (저비용) - gpt-4o-mini
 * 3. Anthropic (폴백) - claude-3-haiku
 *
 * @see https://console.groq.com/docs/models
 * @see https://platform.openai.com/docs/models
 * @see https://docs.anthropic.com/claude/docs/models-overview
 */

// ─────────────────────────────────────────────────────────────────
// 개별 프로바이더 모델 정의
// ─────────────────────────────────────────────────────────────────

export const groqModels = {
  // Structured Outputs 완전 지원
  maverick: groq('meta-llama/llama-4-maverick-17b-128e-instruct'),
  // 빠른 응답용 (structured outputs 미지원)
  versatile: groq('llama-3.3-70b-versatile'),
} as const;

export const openaiModels = {
  // 저비용 고성능 (structured outputs 지원)
  mini: openai('gpt-4o-mini'),
  // 고품질 (비용 높음)
  standard: openai('gpt-4o'),
} as const;

export const anthropicModels = {
  // 빠르고 저렴한 모델
  haiku: anthropic('claude-3-5-haiku-latest'),
  // 균형 잡힌 모델
  sonnet: anthropic('claude-sonnet-4-20250514'),
} as const;

// ─────────────────────────────────────────────────────────────────
// 기본 모델 설정 (호환성 유지)
// ─────────────────────────────────────────────────────────────────

export const models = {
  // 고품질 콘텐츠 생성
  premium: groqModels.maverick,
  // 일반 콘텐츠 생성
  standard: groqModels.maverick,
  // 빠른 응답
  fast: groqModels.versatile,
} as const;

export type ModelKey = keyof typeof models;

// ─────────────────────────────────────────────────────────────────
// 폴백 체인 정의
// ─────────────────────────────────────────────────────────────────

export type ProviderName = 'groq' | 'openai' | 'anthropic';

export interface ModelWithProvider {
  model: AIModel;
  provider: ProviderName;
  name: string;
}

/**
 * 폴백 체인 - 순서대로 시도
 * 1. Groq (무료, 빠름)
 * 2. OpenAI (저비용, 안정적)
 * 3. Anthropic (고품질, 안정적)
 */
export const FALLBACK_CHAIN: ModelWithProvider[] = [
  { model: groqModels.maverick, provider: 'groq', name: 'llama-4-maverick' },
  { model: openaiModels.mini, provider: 'openai', name: 'gpt-4o-mini' },
  { model: anthropicModels.haiku, provider: 'anthropic', name: 'claude-3-haiku' },
];

/**
 * 빠른 응답용 폴백 체인
 */
export const FAST_FALLBACK_CHAIN: ModelWithProvider[] = [
  { model: groqModels.versatile, provider: 'groq', name: 'llama-3.3-70b' },
  { model: openaiModels.mini, provider: 'openai', name: 'gpt-4o-mini' },
  { model: anthropicModels.haiku, provider: 'anthropic', name: 'claude-3-haiku' },
];

// ─────────────────────────────────────────────────────────────────
// 폴백 실행 유틸리티
// ─────────────────────────────────────────────────────────────────

export interface FallbackResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  provider?: ProviderName;
  modelName?: string;
  attempts: number;
}

/**
 * 폴백 체인으로 AI 함수 실행
 *
 * @param chain - 사용할 폴백 체인
 * @param fn - 실행할 AI 함수 (model을 인자로 받음)
 * @param options - 폴백 옵션
 * @returns 실행 결과
 */
export async function executeWithFallback<T>(
  chain: ModelWithProvider[],
  fn: (model: AIModel) => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    onFallback?: (provider: ProviderName, error: Error) => void;
  } = {}
): Promise<FallbackResult<T>> {
  const { maxRetries = 1, retryDelay = 500, onFallback } = options;
  let attempts = 0;

  for (const { model, provider, name } of chain) {
    for (let retry = 0; retry <= maxRetries; retry++) {
      attempts++;

      try {
        const data = await fn(model);
        return {
          success: true,
          data,
          provider,
          modelName: name,
          attempts,
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        // 재시도 가능한 에러인지 확인
        const isRetryable = isRetryableError(err);

        if (retry < maxRetries && isRetryable) {
          // 같은 프로바이더로 재시도
          await sleep(retryDelay * (retry + 1));
          continue;
        }

        // 다음 프로바이더로 폴백
        logWarn(`AI 프로바이더 실패, 폴백 시도`, {
          provider,
          model: name,
          error: err.message,
          attempt: attempts,
        });

        onFallback?.(provider, err);
        break; // 다음 체인으로 이동
      }
    }
  }

  // 모든 프로바이더 실패
  logError('모든 AI 프로바이더 실패', null, {
    chainLength: chain.length,
    attempts,
  });

  return {
    success: false,
    error: 'AI 서비스가 일시적으로 사용 불가합니다. 잠시 후 다시 시도해주세요.',
    attempts,
  };
}

/**
 * 재시도 가능한 에러인지 확인
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Rate limit
  if (message.includes('rate limit') || message.includes('429')) {
    return false; // 다음 프로바이더로 폴백
  }

  // 인증 에러
  if (message.includes('api key') || message.includes('401') || message.includes('403')) {
    return false; // 다음 프로바이더로 폴백
  }

  // 서버 에러 (재시도 가능)
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return true;
  }

  // 타임아웃 (재시도 가능)
  if (message.includes('timeout') || error.name === 'AbortError') {
    return true;
  }

  // 네트워크 에러 (재시도 가능)
  if (message.includes('network') || message.includes('fetch')) {
    return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────
// 프로바이더 상태 확인
// ─────────────────────────────────────────────────────────────────

export interface ProviderStatus {
  groq: boolean;
  openai: boolean;
  anthropic: boolean;
}

/**
 * 환경 변수 기반 프로바이더 사용 가능 여부 확인
 */
export function getAvailableProviders(): ProviderStatus {
  return {
    groq: !!process.env.GROQ_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
  };
}

/**
 * 사용 가능한 프로바이더만 포함된 폴백 체인 반환
 */
export function getActiveChain(chain: ModelWithProvider[]): ModelWithProvider[] {
  const available = getAvailableProviders();
  return chain.filter(({ provider }) => available[provider]);
}

/**
 * AI 생성 관련 상수
 */
export const AI_CONFIG = {
  // 타임아웃 설정 (ms)
  TIMEOUT: {
    GENERATION: 60000,  // 콘텐츠 생성: 60초
    STREAMING: 120000,  // 스트리밍 생성: 120초
    FAST: 30000,        // 빠른 응답: 30초
  },
  // 토큰 제한
  MAX_TOKENS: {
    CONTENT: 4000,
    SUMMARY: 1000,
    QUIZ: 500,
  },
  // 재시도 설정
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY_MS: 1000,
  },
} as const;
