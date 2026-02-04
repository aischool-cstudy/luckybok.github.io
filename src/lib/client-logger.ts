/**
 * 클라이언트 사이드 에러 로깅 유틸리티
 * - Error Boundary에서 사용
 * - 민감 정보 마스킹
 * - Sentry 에러 리포팅 연동
 */

import { captureError as sentryCaptureError } from '@/lib/sentry';

/**
 * 문자열에서 민감 정보 마스킹
 */
function maskSensitiveString(str: string): string {
  let masked = str;

  // URL 쿼리 파라미터 마스킹
  masked = masked.replace(
    /([?&])(password|token|key|secret|auth)[^&]*/gi,
    '$1$2=[REDACTED]'
  );

  // 이메일 부분 마스킹
  masked = masked.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    (_match, local: string) => {
      const maskedLocal = local.slice(0, 2) + '***';
      return maskedLocal + '@[REDACTED]';
    }
  );

  return masked;
}

/**
 * Error 객체를 안전하게 직렬화
 */
function sanitizeError(error: Error & { digest?: string }): {
  name: string;
  message: string;
  digest?: string;
  stack?: string;
} {
  return {
    name: error.name,
    message: maskSensitiveString(error.message),
    digest: error.digest,
    // 스택 트레이스는 개발 환경에서만 포함
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack ? maskSensitiveString(error.stack) : undefined,
    }),
  };
}

export interface ClientErrorContext {
  component: string;
  url?: string;
  userAgent?: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * 클라이언트 에러 로그 포맷
 */
function formatClientError(
  error: Error & { digest?: string },
  context: ClientErrorContext
): string {
  const sanitizedError = sanitizeError(error);

  const logData = {
    level: 'error',
    ...sanitizedError,
    context: {
      component: context.component,
      url: context.url ? maskSensitiveString(context.url) : undefined,
      timestamp: context.timestamp,
    },
  };

  // 프로덕션에서는 JSON, 개발에서는 가독성 있는 형식
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(logData);
  }

  return `[${context.timestamp}] CLIENT ERROR (${context.component}): ${sanitizedError.message}${
    sanitizedError.digest ? ` [digest: ${sanitizedError.digest}]` : ''
  }`;
}

/**
 * 클라이언트 에러 로깅 함수
 * Error Boundary에서 사용
 */
export function logClientError(
  error: Error & { digest?: string },
  componentName: string
): void {
  const context: ClientErrorContext = {
    component: componentName,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    timestamp: new Date().toISOString(),
  };

  const formattedLog = formatClientError(error, context);
  console.error(formattedLog);

  // 프로덕션에서는 Sentry로 에러 전송
  if (process.env.NODE_ENV === 'production') {
    sentryCaptureError(error, {
      component: context.component,
      url: context.url,
    });
  }
}

/**
 * 에러 캡처 함수 (외부 모듈용 re-export)
 * Error Boundary 및 기타 컴포넌트에서 직접 사용 가능
 */
export { captureError } from '@/lib/sentry';

/**
 * 클라이언트 사이드 간편 로거
 * - 개발 환경에서는 콘솔 출력
 * - 프로덕션에서는 중요 로그만 Sentry로 전송
 */
class ClientLogger {
  private formatMessage(level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    const errorInfo = error instanceof Error
      ? { name: error.name, message: error.message }
      : error
        ? { message: String(error) }
        : undefined;

    const fullContext = errorInfo ? { ...context, error: errorInfo } : context;
    console.error(this.formatMessage('error', message, fullContext));

    // 프로덕션에서는 Sentry로 전송
    if (process.env.NODE_ENV === 'production' && error instanceof Error) {
      sentryCaptureError(error, context);
    }
  }
}

export const clientLogger = new ClientLogger();
