/**
 * 표준화된 API 응답 유틸리티
 *
 * 모든 API 응답에 일관된 형식을 적용합니다.
 */

import { NextResponse } from 'next/server';

/**
 * 표준 API 응답 타입
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * 에러 코드 상수
 */
export const ERROR_CODES = {
  // 인증 관련
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_EXPIRED: 'AUTH_EXPIRED',

  // 입력 관련
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',

  // 리소스 관련
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  FORBIDDEN: 'FORBIDDEN',

  // 비즈니스 로직
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // 결제 관련
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_CANCELLED: 'PAYMENT_CANCELLED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',

  // 서버 관련
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * 에러 코드별 기본 메시지
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ERROR_CODES.AUTH_REQUIRED]: '로그인이 필요합니다.',
  [ERROR_CODES.AUTH_INVALID]: '인증 정보가 올바르지 않습니다.',
  [ERROR_CODES.AUTH_EXPIRED]: '인증이 만료되었습니다. 다시 로그인해주세요.',
  [ERROR_CODES.INVALID_INPUT]: '입력값이 올바르지 않습니다.',
  [ERROR_CODES.MISSING_FIELD]: '필수 입력값이 누락되었습니다.',
  [ERROR_CODES.NOT_FOUND]: '요청한 리소스를 찾을 수 없습니다.',
  [ERROR_CODES.ALREADY_EXISTS]: '이미 존재하는 리소스입니다.',
  [ERROR_CODES.FORBIDDEN]: '접근 권한이 없습니다.',
  [ERROR_CODES.INSUFFICIENT_CREDITS]: '크레딧이 부족합니다.',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  [ERROR_CODES.QUOTA_EXCEEDED]: '일일 사용량을 초과했습니다.',
  [ERROR_CODES.PAYMENT_FAILED]: '결제 처리에 실패했습니다.',
  [ERROR_CODES.PAYMENT_CANCELLED]: '결제가 취소되었습니다.',
  [ERROR_CODES.SUBSCRIPTION_EXPIRED]: '구독이 만료되었습니다.',
  [ERROR_CODES.INTERNAL_ERROR]: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: '서비스를 일시적으로 사용할 수 없습니다.',
  [ERROR_CODES.TIMEOUT]: '요청 시간이 초과되었습니다.',
};

/**
 * 에러 코드별 HTTP 상태 코드
 */
const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  [ERROR_CODES.AUTH_REQUIRED]: 401,
  [ERROR_CODES.AUTH_INVALID]: 401,
  [ERROR_CODES.AUTH_EXPIRED]: 401,
  [ERROR_CODES.INVALID_INPUT]: 400,
  [ERROR_CODES.MISSING_FIELD]: 400,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.ALREADY_EXISTS]: 409,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.INSUFFICIENT_CREDITS]: 402,
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 429,
  [ERROR_CODES.QUOTA_EXCEEDED]: 429,
  [ERROR_CODES.PAYMENT_FAILED]: 402,
  [ERROR_CODES.PAYMENT_CANCELLED]: 402,
  [ERROR_CODES.SUBSCRIPTION_EXPIRED]: 402,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
  [ERROR_CODES.TIMEOUT]: 504,
};

/**
 * 성공 응답 생성
 */
export function successResponse<T>(
  data: T,
  status = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

/**
 * 에러 응답 생성
 */
export function errorResponse(
  code: ErrorCode,
  message?: string,
  details?: unknown
): NextResponse<ApiResponse<never>> {
  const status = ERROR_STATUS_CODES[code] || 500;
  const defaultMessage = ERROR_MESSAGES[code] || '오류가 발생했습니다.';

  const errorBody: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  } = {
    code,
    message: message || defaultMessage,
  };

  if (details !== undefined) {
    errorBody.details = details;
  }

  return NextResponse.json(
    {
      success: false,
      error: errorBody,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

/**
 * Server Action용 성공 결과
 */
export function actionSuccess<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

/**
 * Server Action용 에러 결과
 */
export function actionError(
  code: ErrorCode,
  message?: string
): { success: false; error: string; code: ErrorCode } {
  return {
    success: false,
    error: message || ERROR_MESSAGES[code] || '오류가 발생했습니다.',
    code,
  };
}

/**
 * Action 결과 타입
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: ErrorCode };

// =====================================================
// 자주 사용되는 Server Action 에러 응답 헬퍼
// =====================================================

/**
 * 인증 필요 에러
 */
export function authRequiredError(): { success: false; error: string } {
  return { success: false, error: ERROR_MESSAGES[ERROR_CODES.AUTH_REQUIRED] };
}

/**
 * 리소스 찾을 수 없음 에러
 */
export function notFoundError(entity: string): { success: false; error: string } {
  return { success: false, error: `${entity}을(를) 찾을 수 없습니다` };
}

/**
 * 입력값 검증 에러
 */
export function validationError(message?: string): { success: false; error: string } {
  return { success: false, error: message || ERROR_MESSAGES[ERROR_CODES.INVALID_INPUT] };
}

/**
 * 크레딧 부족 에러
 */
export function insufficientCreditsError(): { success: false; error: string } {
  return { success: false, error: ERROR_MESSAGES[ERROR_CODES.INSUFFICIENT_CREDITS] };
}

/**
 * 권한 없음 에러
 */
export function forbiddenError(): { success: false; error: string } {
  return { success: false, error: ERROR_MESSAGES[ERROR_CODES.FORBIDDEN] };
}

/**
 * Rate Limit 에러
 */
export function rateLimitError(retryAfter?: number): { success: false; error: string } {
  const message = retryAfter
    ? `요청이 너무 많습니다. ${retryAfter}초 후 다시 시도해주세요.`
    : ERROR_MESSAGES[ERROR_CODES.RATE_LIMIT_EXCEEDED];
  return { success: false, error: message };
}

/**
 * 결제 실패 에러
 */
export function paymentFailedError(message?: string): { success: false; error: string } {
  return { success: false, error: message || ERROR_MESSAGES[ERROR_CODES.PAYMENT_FAILED] };
}

/**
 * 내부 서버 에러
 */
export function internalError(operation?: string): { success: false; error: string } {
  const message = operation
    ? `${operation} 중 오류가 발생했습니다`
    : ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR];
  return { success: false, error: message };
}
