/**
 * Supabase 에러 처리 표준화 모듈
 * PostgrestError 타입별 에러 처리 및 사용자 친화적 메시지 반환
 */

import type { PostgrestError } from '@supabase/supabase-js';
import { logError } from '@/lib/logger';

// ────────────────────────────────────────────────────────────
// PostgreSQL 에러 코드 (주요 코드)
// ────────────────────────────────────────────────────────────

export const PG_ERROR_CODES = {
  // 연결 관련
  CONNECTION_EXCEPTION: '08000',
  CONNECTION_DOES_NOT_EXIST: '08003',
  CONNECTION_FAILURE: '08006',

  // 권한 관련
  INSUFFICIENT_PRIVILEGE: '42501',

  // 무결성 제약 위반
  INTEGRITY_CONSTRAINT_VIOLATION: '23000',
  NOT_NULL_VIOLATION: '23502',
  FOREIGN_KEY_VIOLATION: '23503',
  UNIQUE_VIOLATION: '23505',
  CHECK_VIOLATION: '23514',

  // 데이터 관련
  INVALID_TEXT_REPRESENTATION: '22P02',
  NUMERIC_VALUE_OUT_OF_RANGE: '22003',
  STRING_DATA_RIGHT_TRUNCATION: '22001',

  // PostgREST 고유 에러
  PGRST_NO_RESULT: 'PGRST116', // .single() 결과 없음
  PGRST_MULTIPLE_RESULTS: 'PGRST103', // .single() 복수 결과
  PGRST_JWT_EXPIRED: 'PGRST301',
  PGRST_JWT_INVALID: 'PGRST302',
} as const;

// ────────────────────────────────────────────────────────────
// 에러 타입 정의
// ────────────────────────────────────────────────────────────

export type SupabaseErrorCode =
  | 'NOT_FOUND'
  | 'DUPLICATE'
  | 'FOREIGN_KEY'
  | 'VALIDATION'
  | 'AUTH'
  | 'CONNECTION'
  | 'PERMISSION'
  | 'UNKNOWN';

export interface SupabaseErrorResult {
  code: SupabaseErrorCode;
  message: string;
  originalError: PostgrestError;
  isRetryable: boolean;
}

// ────────────────────────────────────────────────────────────
// 에러 메시지 맵
// ────────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<SupabaseErrorCode, string> = {
  NOT_FOUND: '요청한 데이터를 찾을 수 없습니다.',
  DUPLICATE: '이미 존재하는 데이터입니다.',
  FOREIGN_KEY: '참조 데이터가 올바르지 않습니다.',
  VALIDATION: '입력 데이터가 유효하지 않습니다.',
  AUTH: '인증이 필요하거나 만료되었습니다.',
  CONNECTION: '데이터베이스 연결에 실패했습니다.',
  PERMISSION: '해당 작업을 수행할 권한이 없습니다.',
  UNKNOWN: '알 수 없는 오류가 발생했습니다.',
};

// ────────────────────────────────────────────────────────────
// 에러 분류 함수
// ────────────────────────────────────────────────────────────

/**
 * PostgrestError를 분석하여 분류된 에러 결과 반환
 */
export function classifySupabaseError(error: PostgrestError): SupabaseErrorResult {
  const code = error.code;

  // PostgREST 에러
  if (code === PG_ERROR_CODES.PGRST_NO_RESULT) {
    return {
      code: 'NOT_FOUND',
      message: ERROR_MESSAGES.NOT_FOUND,
      originalError: error,
      isRetryable: false,
    };
  }

  if (code === PG_ERROR_CODES.PGRST_JWT_EXPIRED || code === PG_ERROR_CODES.PGRST_JWT_INVALID) {
    return {
      code: 'AUTH',
      message: ERROR_MESSAGES.AUTH,
      originalError: error,
      isRetryable: false,
    };
  }

  // 무결성 제약 위반
  if (code === PG_ERROR_CODES.UNIQUE_VIOLATION) {
    return {
      code: 'DUPLICATE',
      message: ERROR_MESSAGES.DUPLICATE,
      originalError: error,
      isRetryable: false,
    };
  }

  if (code === PG_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
    return {
      code: 'FOREIGN_KEY',
      message: ERROR_MESSAGES.FOREIGN_KEY,
      originalError: error,
      isRetryable: false,
    };
  }

  if (
    code === PG_ERROR_CODES.NOT_NULL_VIOLATION ||
    code === PG_ERROR_CODES.CHECK_VIOLATION ||
    code === PG_ERROR_CODES.INVALID_TEXT_REPRESENTATION ||
    code === PG_ERROR_CODES.NUMERIC_VALUE_OUT_OF_RANGE ||
    code === PG_ERROR_CODES.STRING_DATA_RIGHT_TRUNCATION
  ) {
    return {
      code: 'VALIDATION',
      message: ERROR_MESSAGES.VALIDATION,
      originalError: error,
      isRetryable: false,
    };
  }

  // 권한 에러
  if (code === PG_ERROR_CODES.INSUFFICIENT_PRIVILEGE) {
    return {
      code: 'PERMISSION',
      message: ERROR_MESSAGES.PERMISSION,
      originalError: error,
      isRetryable: false,
    };
  }

  // 연결 에러 (재시도 가능)
  if (
    code === PG_ERROR_CODES.CONNECTION_EXCEPTION ||
    code === PG_ERROR_CODES.CONNECTION_DOES_NOT_EXIST ||
    code === PG_ERROR_CODES.CONNECTION_FAILURE
  ) {
    return {
      code: 'CONNECTION',
      message: ERROR_MESSAGES.CONNECTION,
      originalError: error,
      isRetryable: true,
    };
  }

  // 알 수 없는 에러
  return {
    code: 'UNKNOWN',
    message: ERROR_MESSAGES.UNKNOWN,
    originalError: error,
    isRetryable: false,
  };
}

// ────────────────────────────────────────────────────────────
// 에러 핸들링 유틸리티
// ────────────────────────────────────────────────────────────

interface HandleSupabaseErrorOptions {
  action: string;
  context?: Record<string, unknown>;
  silent?: boolean;
}

/**
 * Supabase 에러를 표준화된 방식으로 처리
 *
 * @example
 * ```typescript
 * const { data, error } = await supabase.from('profiles').select().single();
 *
 * if (error) {
 *   const result = handleSupabaseError(error, { action: 'getProfile' });
 *   return { success: false, error: result.message };
 * }
 * ```
 */
export function handleSupabaseError(
  error: PostgrestError,
  options: HandleSupabaseErrorOptions
): SupabaseErrorResult {
  const result = classifySupabaseError(error);

  // 로깅 (silent 옵션이 아닌 경우)
  if (!options.silent) {
    logError(`Supabase Error [${result.code}]`, error, {
      action: options.action,
      errorCode: result.code,
      isRetryable: result.isRetryable,
      ...options.context,
    });
  }

  return result;
}

/**
 * NOT_FOUND 에러인지 확인 (결과 없음)
 */
export function isNotFoundError(error: PostgrestError | null): boolean {
  return error?.code === PG_ERROR_CODES.PGRST_NO_RESULT;
}

/**
 * 중복 에러인지 확인
 */
export function isDuplicateError(error: PostgrestError | null): boolean {
  return error?.code === PG_ERROR_CODES.UNIQUE_VIOLATION;
}

/**
 * 재시도 가능한 에러인지 확인
 */
export function isRetryableError(error: PostgrestError | null): boolean {
  if (!error) return false;
  const result = classifySupabaseError(error);
  return result.isRetryable;
}

// ────────────────────────────────────────────────────────────
// 재시도 유틸리티
// ────────────────────────────────────────────────────────────

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  action: string;
}

/**
 * 재시도 로직이 포함된 Supabase 작업 실행
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => {
 *     const { data, error } = await supabase.from('profiles').select().single();
 *     if (error) throw error;
 *     return data;
 *   },
 *   { action: 'getProfile', maxRetries: 3 }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  const { maxRetries = 3, baseDelayMs = 100, action } = options;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      lastError = error;

      // PostgrestError인 경우 재시도 가능 여부 확인
      if (isPostgrestError(error) && !isRetryableError(error)) {
        const result = handleSupabaseError(error, { action });
        return { success: false, error: result.message };
      }

      // 마지막 시도가 아니면 대기 후 재시도
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));

        logError(`Retry attempt ${attempt}/${maxRetries}`, error, { action });
      }
    }
  }

  // 모든 재시도 실패
  logError('All retries failed', lastError, { action, maxRetries });

  if (isPostgrestError(lastError)) {
    const result = classifySupabaseError(lastError);
    return { success: false, error: result.message };
  }

  return { success: false, error: '작업 처리에 실패했습니다.' };
}

/**
 * PostgrestError 타입 가드
 */
function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'details' in error
  );
}
