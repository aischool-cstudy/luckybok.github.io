/**
 * Next.js Instrumentation Hook
 * - 서버 시작 시 초기화되는 코드
 * - 환경 변수 검증
 * - 에러 모니터링 (Sentry)
 */

import { validateEnv } from '@/lib/env';
import { initSentry } from '@/lib/sentry';
import { logger } from '@/lib/logger';

export async function register() {
  // 서버 사이드 초기화
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 환경 변수 검증 (필수 변수 누락 시 서버 시작 실패)
    try {
      validateEnv();
      logger.info('[Instrumentation] Environment variables validated');
    } catch (error) {
      logger.error('[Instrumentation] Environment validation failed', error);
      // 개발 환경에서는 경고만 출력, 프로덕션에서는 에러 throw
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }

    // Sentry 초기화 (프로덕션에서만 활성화)
    await initSentry();

    logger.info('[Instrumentation] Server runtime initialized');
  }

  // Edge 런타임에서의 초기화
  if (process.env.NEXT_RUNTIME === 'edge') {
    logger.info('[Instrumentation] Edge runtime initialized');
  }
}

/**
 * 요청별 에러 캡처
 */
export function onRequestError(
  error: { digest: string } & Error,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string };
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
    revalidateReason: 'on-demand' | 'stale' | undefined;
    renderSource:
      | 'react-server-components'
      | 'react-server-components-payload'
      | undefined;
  }
) {
  // 에러 로깅
  logger.error('[Request Error]', error, {
    digest: error.digest,
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath,
  });
}
