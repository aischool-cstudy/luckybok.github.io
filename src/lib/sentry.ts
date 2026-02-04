/**
 * Sentry 에러 모니터링 유틸리티
 * - 프로덕션 환경에서만 활성화
 * - @sentry/nextjs 패키지 설치 시 자동 활성화
 * - SDK 미설치 시 콘솔 로깅으로 폴백
 *
 * 설치 방법: npm install @sentry/nextjs
 */

export interface SentryContext {
  component?: string;
  action?: string;
  userId?: string;
  [key: string]: unknown;
}

// Sentry SDK 타입 (동적 import용)
interface SentrySDK {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: Error) => void;
  captureMessage: (message: string, level?: string) => void;
  setContext: (name: string, context: Record<string, unknown>) => void;
  setUser: (user: { id: string; email?: string } | null) => void;
  setTag: (key: string, value: string) => void;
}

/**
 * Sentry 초기화 여부 확인
 */
let isSentryInitialized = false;
let sentryModule: SentrySDK | null = null;

/**
 * Sentry SDK 동적 로드 시도
 */
async function loadSentry(): Promise<SentrySDK | null> {
  if (sentryModule) return sentryModule;

  try {
    // @ts-expect-error - 선택적 의존성으로 설치되지 않았을 수 있음
    const Sentry = await import('@sentry/nextjs');
    sentryModule = Sentry as SentrySDK;
    return sentryModule;
  } catch {
    // Sentry SDK가 설치되지 않음 - 정상적인 상황
    return null;
  }
}

/**
 * Sentry 초기화
 * - 프로덕션 환경에서만 활성화
 * - DSN이 설정된 경우에만 초기화
 */
export async function initSentry(): Promise<void> {
  if (isSentryInitialized) return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (process.env.NODE_ENV === 'production' && dsn) {
    const Sentry = await loadSentry();

    if (!Sentry) {
      console.log('[Sentry] SDK not installed - using console logging');
      return;
    }

    try {
      Sentry.init({
        dsn,
        // 성능 샘플링 비율 (10%)
        tracesSampleRate: 0.1,
        // 에러 샘플링 비율 (100%)
        sampleRate: 1.0,
        // 환경 구분
        environment: process.env.NODE_ENV,
        // 디버그 모드 비활성화
        debug: false,
        // 릴리즈 버전
        release: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
      });

      isSentryInitialized = true;
      console.log('[Sentry] Initialized successfully');
    } catch (error) {
      // Sentry 초기화 실패해도 앱은 정상 동작
      console.warn('[Sentry] Failed to initialize:', error);
    }
  } else {
    console.log('[Sentry] Skipped - not in production or DSN not configured');
  }
}

/**
 * 에러 캡처 및 Sentry로 전송
 */
export async function captureError(
  error: Error,
  context?: SentryContext
): Promise<void> {
  // 콘솔에 항상 로깅
  console.error('[Error Captured]', {
    name: error.name,
    message: error.message,
    ...context,
  });

  if (process.env.NODE_ENV === 'production' && isSentryInitialized) {
    const Sentry = await loadSentry();
    if (!Sentry) return;

    try {
      // 컨텍스트 설정
      if (context) {
        Sentry.setContext('custom', context);

        if (context.userId) {
          Sentry.setUser({ id: context.userId });
        }
      }

      // 에러 전송
      Sentry.captureException(error);
    } catch {
      // Sentry 전송 실패시 무시 (앱 동작에 영향 없음)
    }
  }
}

/**
 * 메시지 캡처 (에러가 아닌 중요 이벤트)
 */
export async function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: SentryContext
): Promise<void> {
  console.log(`[${level.toUpperCase()}]`, message, context);

  if (process.env.NODE_ENV === 'production' && isSentryInitialized) {
    const Sentry = await loadSentry();
    if (!Sentry) return;

    try {
      if (context) {
        Sentry.setContext('custom', context);
      }

      Sentry.captureMessage(message, level);
    } catch {
      // 무시
    }
  }
}

/**
 * 사용자 정보 설정
 */
export async function setUser(userId: string | null, email?: string): Promise<void> {
  if (process.env.NODE_ENV === 'production' && isSentryInitialized) {
    const Sentry = await loadSentry();
    if (!Sentry) return;

    try {
      if (userId) {
        Sentry.setUser({ id: userId, email });
      } else {
        Sentry.setUser(null);
      }
    } catch {
      // 무시
    }
  }
}

/**
 * 추가 컨텍스트 태그 설정
 */
export async function setTag(key: string, value: string): Promise<void> {
  if (process.env.NODE_ENV === 'production' && isSentryInitialized) {
    const Sentry = await loadSentry();
    if (!Sentry) return;

    try {
      Sentry.setTag(key, value);
    } catch {
      // 무시
    }
  }
}
