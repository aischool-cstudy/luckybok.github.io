/**
 * Rate Limiting 유틸리티
 * - Vercel KV (Redis) 기반 분산 Rate Limiter (선택적)
 * - 메모리 폴백 (기본)
 * - 슬라이딩 윈도우 알고리즘
 */

import { logWarn } from '@/lib/logger';

// KV 클라이언트 타입 정의 (선택적 의존성)
interface KVClient {
  zcount: (key: string, min: number, max: number) => Promise<number>;
  zrange: (key: string, start: number, stop: number, options?: { withScores: boolean }) => Promise<Array<{ score: number; member: string }>>;
  zadd: (key: string, options: { score: number; member: string }) => Promise<number>;
  zremrangebyscore: (key: string, min: number, max: number) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  keys: (pattern: string) => Promise<string[]>;
  del: (...keys: string[]) => Promise<number>;
}

// KV 사용 가능 여부
const isKVConfigured = (): boolean => {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
};

// KV 모듈 동적 임포트 (설치되지 않았을 경우 대비)
let kvModule: { kv: KVClient } | null = null;
let kvLoadAttempted = false;

async function getKV(): Promise<KVClient | undefined> {
  // KV가 설정되지 않았으면 시도하지 않음
  if (!isKVConfigured()) {
    return undefined;
  }

  if (!kvLoadAttempted) {
    kvLoadAttempted = true;
    try {
      // 동적 import를 변수로 분리하여 webpack 정적 분석 우회
      const moduleName = '@vercel/kv';
      kvModule = await import(/* webpackIgnore: true */ moduleName);
    } catch {
      kvModule = null;
    }
  }
  return kvModule?.kv;
}

// 메모리 폴백용 저장소 (KV 미설정 시 사용)
const memoryStore = new Map<string, number[]>();

// 메모리 정리 (5분마다)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of memoryStore.entries()) {
      const filtered = timestamps.filter((t) => now - t < 60 * 60 * 1000);
      if (filtered.length === 0) {
        memoryStore.delete(key);
      } else {
        memoryStore.set(key, filtered);
      }
    }
  }, 5 * 60 * 1000);
}

// Rate Limit 설정 타입
export interface RateLimitConfig {
  /** 윈도우 시간 (밀리초) */
  windowMs: number;
  /** 윈도우 내 최대 요청 수 */
  max: number;
}

// 미리 정의된 Rate Limit 프리셋
export const RATE_LIMIT_PRESETS = {
  /** 기본: 분당 30회 */
  DEFAULT: { windowMs: 60 * 1000, max: 30 },
  /** 결제 준비: 분당 10회 */
  PAYMENT_PREPARE: { windowMs: 60 * 1000, max: 10 },
  /** 결제 확인: 분당 5회 */
  PAYMENT_CONFIRM: { windowMs: 60 * 1000, max: 5 },
  /** 구독 생성: 분당 3회 */
  SUBSCRIPTION_CREATE: { windowMs: 60 * 1000, max: 3 },
  /** 환불 요청: 분당 3회 (민감한 작업) */
  REFUND_REQUEST: { windowMs: 60 * 1000, max: 3 },
  /** 일반 조회: 분당 30회 */
  GENERAL_READ: { windowMs: 60 * 1000, max: 30 },
  /** AI 생성: 분당 20회 */
  AI_GENERATE: { windowMs: 60 * 1000, max: 20 },
  /** 인증: 분당 5회 */
  AUTH: { windowMs: 60 * 1000, max: 5 },
} as const;

export interface RateLimitResult {
  /** 허용 여부 */
  allowed: boolean;
  /** 남은 요청 수 */
  remaining: number;
  /** 리셋까지 남은 시간 (밀리초) */
  resetIn: number;
  /** 현재 윈도우 내 요청 수 */
  current: number;
  /** 최대 허용 요청 수 */
  limit: number;
}

/**
 * KV 기반 Rate Limit 체크
 */
async function checkRateLimitKV(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const kv = await getKV();
  if (!kv) {
    return checkRateLimitMemory(key, config);
  }

  try {
    // 윈도우 내 요청 수 조회
    const count = await kv.zcount(key, windowStart, now);

    if (count >= config.max) {
      // 가장 오래된 요청의 만료 시간 계산
      const oldest = await kv.zrange(key, 0, 0, { withScores: true });
      const oldestEntry = oldest[0];
      const resetIn = oldestEntry
        ? Math.max(0, oldestEntry.score + config.windowMs - now)
        : config.windowMs;

      return {
        allowed: false,
        remaining: 0,
        resetIn,
        current: count,
        limit: config.max,
      };
    }

    // 새 요청 기록
    const requestId = `${now}-${Math.random().toString(36).substr(2, 9)}`;
    await kv.zadd(key, { score: now, member: requestId });

    // 윈도우 외 기록 정리 및 TTL 설정
    await kv.zremrangebyscore(key, 0, windowStart);
    await kv.expire(key, Math.ceil(config.windowMs / 1000) + 60); // 여유 1분

    return {
      allowed: true,
      remaining: config.max - count - 1,
      resetIn: config.windowMs,
      current: count + 1,
      limit: config.max,
    };
  } catch {
    logWarn('KV Rate Limit 에러, 메모리 폴백 사용', {
      action: 'rate_limit_kv_error',
      key,
    });
    // KV 에러 시 메모리 폴백
    return checkRateLimitMemory(key, config);
  }
}

/**
 * 메모리 기반 Rate Limit 체크 (폴백)
 */
function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const timestamps = memoryStore.get(key) || [];
  const windowTimestamps = timestamps.filter((t) => t > windowStart);
  const current = windowTimestamps.length;
  const allowed = current < config.max;

  if (allowed) {
    windowTimestamps.push(now);
    memoryStore.set(key, windowTimestamps);
  }

  const oldestInWindow = windowTimestamps[0];
  const resetIn = oldestInWindow
    ? Math.max(0, oldestInWindow + config.windowMs - now)
    : 0;

  return {
    allowed,
    remaining: Math.max(0, config.max - current - (allowed ? 1 : 0)),
    resetIn,
    current: current + (allowed ? 1 : 0),
    limit: config.max,
  };
}

/**
 * Rate Limit 체크
 *
 * @param identifier - 고유 식별자 (IP 또는 userId)
 * @param action - 액션 이름 (키 구분용)
 * @param config - Rate Limit 설정
 * @returns Rate Limit 결과
 *
 * @example
 * const result = await checkRateLimit('user-123', 'payment_prepare', RATE_LIMIT_PRESETS.PAYMENT_PREPARE);
 * if (!result.allowed) {
 *   return { success: false, error: '요청이 너무 많습니다.' };
 * }
 */
export async function checkRateLimit(
  identifier: string,
  action: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `ratelimit:${action}:${identifier}`;

  if (isKVConfigured()) {
    return checkRateLimitKV(key, config);
  }

  // KV 미설정 시 메모리 사용
  return checkRateLimitMemory(key, config);
}

/**
 * 동기식 Rate Limit 체크 (메모리 전용, 하위 호환)
 * @deprecated checkRateLimit(async)을 사용하세요
 */
export function checkRateLimitSync(
  identifier: string,
  action: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `ratelimit:${action}:${identifier}`;
  return checkRateLimitMemory(key, config);
}

/**
 * Rate Limit 에러 메시지 생성
 */
export function getRateLimitErrorMessage(result: RateLimitResult): string {
  const seconds = Math.ceil(result.resetIn / 1000);
  if (seconds > 60) {
    const minutes = Math.ceil(seconds / 60);
    return `요청이 너무 많습니다. ${minutes}분 후 다시 시도해주세요.`;
  }
  return `요청이 너무 많습니다. ${seconds}초 후 다시 시도해주세요.`;
}

/**
 * IP 주소 추출 헬퍼
 */
export function getClientIP(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIP = forwardedFor.split(',')[0];
    return firstIP?.trim() ?? 'unknown';
  }

  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  return 'unknown';
}

/**
 * Rate Limit 초기화 (테스트용)
 */
export async function clearRateLimitStore(): Promise<void> {
  memoryStore.clear();

  if (isKVConfigured()) {
    try {
      const kv = await getKV();
      if (kv) {
        // KV의 ratelimit 키들 삭제
        const keys = await kv.keys('ratelimit:*');
        if (keys.length > 0) {
          await kv.del(...keys);
        }
      }
    } catch {
      // KV 에러 무시
    }
  }
}

/**
 * 특정 키의 Rate Limit 초기화
 */
export async function clearRateLimit(
  identifier: string,
  action: string
): Promise<void> {
  const key = `ratelimit:${action}:${identifier}`;
  memoryStore.delete(key);

  if (isKVConfigured()) {
    try {
      const kv = await getKV();
      if (kv) {
        await kv.del(key);
      }
    } catch {
      // KV 에러 무시
    }
  }
}

// ────────────────────────────────────────────────────────────
// Rate Limit HOF (Higher-Order Function)
// ────────────────────────────────────────────────────────────

/**
 * Rate Limit 결과 타입
 */
export type RateLimitedResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; rateLimited: true };

/**
 * Rate Limit이 적용된 Server Action 반환 타입
 */
export type ActionResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Rate Limit HOF 옵션
 */
export interface WithRateLimitOptions {
  /** Rate Limit 액션 이름 (키 구분용) */
  action: string;
  /** Rate Limit 설정 (프리셋 사용 권장) */
  config: RateLimitConfig;
}

/**
 * Rate Limit을 적용하는 HOF (Higher-Order Function)
 *
 * Server Action에 Rate Limit을 쉽게 적용할 수 있습니다.
 * IP 기반으로 Rate Limit을 체크하며, 제한 초과 시 에러 메시지를 반환합니다.
 *
 * @example
 * ```typescript
 * import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
 *
 * export const myAction = withRateLimit(
 *   { action: 'my_action', config: RATE_LIMIT_PRESETS.DEFAULT },
 *   async (input: MyInput) => {
 *     // 실제 비즈니스 로직
 *     return { success: true, data: result };
 *   }
 * );
 * ```
 */
export function withRateLimit<TInput, TOutput extends ActionResult<unknown>>(
  options: WithRateLimitOptions,
  handler: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    // headers()는 dynamic import로 가져와야 함 (서버 전용)
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const clientIP = getClientIP(headersList);

    const rateLimitResult = await checkRateLimit(
      clientIP,
      options.action,
      options.config
    );

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: getRateLimitErrorMessage(rateLimitResult),
      } as TOutput;
    }

    return handler(input);
  };
}

/**
 * Rate Limit을 적용하는 HOF (입력 없는 버전)
 *
 * @example
 * ```typescript
 * export const myAction = withRateLimitNoInput(
 *   { action: 'my_action', config: RATE_LIMIT_PRESETS.GENERAL_READ },
 *   async () => {
 *     // 실제 비즈니스 로직
 *     return { success: true, data: result };
 *   }
 * );
 * ```
 */
export function withRateLimitNoInput<TOutput extends ActionResult<unknown>>(
  options: WithRateLimitOptions,
  handler: () => Promise<TOutput>
): () => Promise<TOutput> {
  return async (): Promise<TOutput> => {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const clientIP = getClientIP(headersList);

    const rateLimitResult = await checkRateLimit(
      clientIP,
      options.action,
      options.config
    );

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: getRateLimitErrorMessage(rateLimitResult),
      } as TOutput;
    }

    return handler();
  };
}
