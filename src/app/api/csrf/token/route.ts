import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateCSRFToken, setCSRFCookie } from '@/lib/csrf';
import { checkRateLimit, getClientIP, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
import { logError } from '@/lib/logger';

// API 라우트 설정: CSRF 토큰은 매번 새로 생성
export const revalidate = 0;

/**
 * CSRF 토큰 발급 API
 *
 * POST /api/csrf/token
 *
 * - 인증된 사용자: 사용자 ID 바인딩된 토큰 발급
 * - 비인증 사용자: 세션 기반 토큰 발급
 * - 쿠키에도 동일 토큰 저장 (더블 서브밋 패턴)
 */
export async function POST(request: Request): Promise<Response> {
  // Rate Limit 체크
  const clientIP = getClientIP(new Headers(request.headers));
  const rateLimitResult = await checkRateLimit(
    clientIP,
    'csrf_token',
    RATE_LIMIT_PRESETS.GENERAL_READ // 분당 30회
  );

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      { status: 429 }
    );
  }

  try {
    // 사용자 인증 확인 (선택적)
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 토큰 생성 (인증된 경우 사용자 ID 바인딩)
    const token = generateCSRFToken(user?.id);

    // 쿠키에 토큰 저장
    await setCSRFCookie(token);

    return NextResponse.json({
      token,
      expiresIn: 3600, // 1시간 (초 단위)
    });
  } catch (error) {
    logError('CSRF 토큰 발급 오류', error, {
      action: 'csrf/token',
    });

    return NextResponse.json(
      { error: '토큰 발급에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS 요청 처리 (CORS preflight)
 */
export async function OPTIONS(): Promise<Response> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
