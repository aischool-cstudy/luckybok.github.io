/**
 * 보안 로깅 유틸리티
 * - 민감 정보 필터링
 * - 구조화된 로그 출력
 */

// 민감 필드 목록 (로그에서 마스킹)
const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'billingKey',
  'billing_key',
  'encryptedBillingKey',
  'encrypted_billing_key',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'expiry',
  'customerKey',
  'customer_key',
  'paymentKey',
  'payment_key',
  'authKey',
  'auth_key',
  'authorization',
  'cookie',
  'session',
  'creditCard',
  'credit_card',
] as const;

// 민감 필드 정규식 패턴
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /billing[_-]?key/i,
  /card[_-]?number/i,
  /customer[_-]?key/i,
  /payment[_-]?key/i,
  /auth[_-]?key/i,
  /authorization/i,
];

/**
 * 객체에서 민감 정보를 마스킹
 * 외부에서 웹훅 로깅 등에 사용 가능
 */
export function sanitizeForLogging<T>(value: T): T {
  return sanitizeValue(value) as T;
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  // 깊이 제한 (순환 참조 방지)
  if (depth > 5) {
    return '[DEPTH_LIMIT]';
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // 긴 문자열 자르기 (토큰, 키 등)
    if (value.length > 100) {
      return `${value.substring(0, 20)}...[TRUNCATED]`;
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value)) {
      // 민감 필드 확인
      const isSensitive =
        SENSITIVE_FIELDS.includes(key.toLowerCase() as (typeof SENSITIVE_FIELDS)[number]) ||
        SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeValue(val, depth + 1);
      }
    }

    return sanitized;
  }

  return String(value);
}

/**
 * Error 객체를 안전하게 직렬화
 */
function sanitizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      // stack은 개발 환경에서만 포함
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      // 커스텀 속성 (PaymentError의 code 등)
      ...('code' in error && { code: (error as { code: string }).code }),
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  if (typeof error === 'object' && error !== null) {
    return sanitizeValue(error) as Record<string, unknown>;
  }

  return { message: String(error) };
}

export interface LogContext {
  userId?: string;
  action?: string;
  orderId?: string;
  paymentId?: string;
  subscriptionId?: string;
  [key: string]: unknown;
}

/**
 * 보안 로거 클래스
 */
class SecureLogger {
  private formatLog(
    level: 'info' | 'warn' | 'error',
    message: string,
    context?: LogContext,
    error?: unknown
  ): string {
    const timestamp = new Date().toISOString();
    const sanitizedContext = context ? sanitizeValue(context) : undefined;
    const sanitizedError = error ? sanitizeError(error) : undefined;

    const logData: Record<string, unknown> = {
      timestamp,
      level,
      message,
    };

    if (sanitizedContext) {
      logData.context = sanitizedContext;
    }
    if (sanitizedError) {
      logData.error = sanitizedError;
    }

    // 프로덕션에서는 JSON 형식, 개발에서는 가독성 있는 형식
    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify(logData);
    }

    return `[${timestamp}] ${level.toUpperCase()}: ${message}${
      sanitizedContext ? ` | context: ${JSON.stringify(sanitizedContext)}` : ''
    }${sanitizedError ? ` | error: ${JSON.stringify(sanitizedError)}` : ''}`;
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatLog('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatLog('warn', message, context));
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    console.error(this.formatLog('error', message, context, error));
  }
}

// 싱글톤 인스턴스
export const logger = new SecureLogger();

// 편의 함수들
export function logInfo(message: string, context?: LogContext): void {
  logger.info(message, context);
}

export function logWarn(message: string, context?: LogContext): void {
  logger.warn(message, context);
}

export function logError(message: string, error?: unknown, context?: LogContext): void {
  logger.error(message, error, context);
}
