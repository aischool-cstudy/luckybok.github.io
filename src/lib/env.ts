/**
 * 환경 변수 검증 및 타입 안전한 접근
 *
 * 모든 환경 변수는 이 모듈을 통해 접근하여 타입 안전성을 보장합니다.
 * non-null assertion(!) 대신 명시적 검증을 사용합니다.
 */

import { logger } from '@/lib/logger';

// 환경 변수 검증 에러
export class EnvError extends Error {
  constructor(
    public readonly variable: string,
    message: string
  ) {
    super(message);
    this.name = 'EnvError';
  }
}

/**
 * 필수 환경 변수 가져오기
 * 없으면 에러 발생
 */
function getRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new EnvError(
      key,
      `필수 환경 변수 ${key}가 설정되지 않았습니다. .env.local 파일을 확인하세요.`
    );
  }
  return value;
}

/**
 * 선택적 환경 변수 가져오기
 * 없으면 기본값 반환
 */
function getOptional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * 클라이언트 환경 변수 (NEXT_PUBLIC_*)
 * 브라우저에서 접근 가능
 */
export const clientEnv = {
  get SUPABASE_URL(): string {
    return getRequired('NEXT_PUBLIC_SUPABASE_URL');
  },

  get SUPABASE_ANON_KEY(): string {
    return getRequired('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  },

  get TOSS_CLIENT_KEY(): string {
    return getRequired('NEXT_PUBLIC_TOSS_CLIENT_KEY');
  },

  get APP_URL(): string {
    return getOptional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
  },

  get APP_ENV(): 'development' | 'staging' | 'production' {
    const env = getOptional('NEXT_PUBLIC_APP_ENV', 'development');
    if (!['development', 'staging', 'production'].includes(env)) {
      return 'development';
    }
    return env as 'development' | 'staging' | 'production';
  },

  get IS_PRODUCTION(): boolean {
    return this.APP_ENV === 'production';
  },

  get IS_DEVELOPMENT(): boolean {
    return this.APP_ENV === 'development';
  },
} as const;

/**
 * 서버 전용 환경 변수
 * 브라우저에서 접근 불가 (서버 컴포넌트, API 라우트, Server Actions에서만 사용)
 */
export const serverEnv = {
  // Supabase
  get SUPABASE_URL(): string {
    return getRequired('NEXT_PUBLIC_SUPABASE_URL');
  },

  get SUPABASE_ANON_KEY(): string {
    return getRequired('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  },

  get SUPABASE_SERVICE_ROLE_KEY(): string {
    return getRequired('SUPABASE_SERVICE_ROLE_KEY');
  },

  // TossPayments
  get TOSS_SECRET_KEY(): string {
    return getRequired('TOSS_SECRET_KEY');
  },

  get TOSS_WEBHOOK_SECRET(): string {
    return getRequired('TOSS_WEBHOOK_SECRET');
  },

  get BILLING_KEY_ENCRYPTION_KEY(): string {
    const key = getRequired('BILLING_KEY_ENCRYPTION_KEY');
    if (key.length !== 32) {
      throw new EnvError(
        'BILLING_KEY_ENCRYPTION_KEY',
        'BILLING_KEY_ENCRYPTION_KEY는 정확히 32자여야 합니다.'
      );
    }
    return key;
  },

  // AI APIs
  get ANTHROPIC_API_KEY(): string {
    return getRequired('ANTHROPIC_API_KEY');
  },

  get OPENAI_API_KEY(): string | undefined {
    return process.env.OPENAI_API_KEY;
  },

  // Cron Jobs
  get CRON_SECRET(): string {
    return getRequired('CRON_SECRET');
  },

  // Monitoring (선택)
  get SENTRY_DSN(): string | undefined {
    return process.env.SENTRY_DSN;
  },

  // Vercel KV (선택)
  get KV_REST_API_URL(): string | undefined {
    return process.env.KV_REST_API_URL;
  },

  get KV_REST_API_TOKEN(): string | undefined {
    return process.env.KV_REST_API_TOKEN;
  },
} as const;

/**
 * 환경 변수 검증 (애플리케이션 시작 시 호출)
 * 필수 환경 변수가 모두 설정되었는지 확인
 */
export function validateEnv(): void {
  const errors: string[] = [];

  // 클라이언트 환경 변수 검증
  const clientVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_TOSS_CLIENT_KEY',
  ];

  for (const key of clientVars) {
    if (!process.env[key]) {
      errors.push(`${key} 누락`);
    }
  }

  // 서버 환경 변수 검증 (서버 환경에서만)
  if (typeof window === 'undefined') {
    const serverVars = [
      'SUPABASE_SERVICE_ROLE_KEY',
      'TOSS_SECRET_KEY',
      'TOSS_WEBHOOK_SECRET',
      'BILLING_KEY_ENCRYPTION_KEY',
      'ANTHROPIC_API_KEY',
      'CRON_SECRET',
    ];

    for (const key of serverVars) {
      if (!process.env[key]) {
        errors.push(`${key} 누락`);
      }
    }

    // BILLING_KEY_ENCRYPTION_KEY 길이 검증
    const billingKey = process.env.BILLING_KEY_ENCRYPTION_KEY;
    if (billingKey && billingKey.length !== 32) {
      errors.push('BILLING_KEY_ENCRYPTION_KEY는 32자여야 합니다');
    }
  }

  if (errors.length > 0) {
    logger.error('환경 변수 검증 실패', undefined, { errors });
    throw new Error(
      `환경 변수 검증 실패:\n${errors.map((e) => `  - ${e}`).join('\n')}\n\n.env.local 파일을 확인하세요.`
    );
  }
}
