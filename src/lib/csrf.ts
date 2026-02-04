/**
 * CSRF (Cross-Site Request Forgery) 보호 모듈
 * - HMAC-SHA256 기반 토큰 생성/검증
 * - 더블 서브밋 쿠키 패턴
 * - 타이밍 공격 방지 (constant-time comparison)
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { serverEnv } from '@/lib/env';

// 상수
const CSRF_COOKIE_NAME = '__csrf_token';
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1시간
const TOKEN_LENGTH = 32; // 256 bits

/**
 * CSRF 전용 시크릿 키 파생
 * BILLING_KEY_ENCRYPTION_KEY에서 파생하여 별도의 환경변수 불필요
 */
function getCSRFSecret(): Buffer {
  const baseKey = serverEnv.BILLING_KEY_ENCRYPTION_KEY;
  // HMAC으로 별도의 키 파생 (키 분리 원칙)
  return Buffer.from(
    createHmac('sha256', 'csrf-key-derivation')
      .update(baseKey)
      .digest('hex'),
    'hex'
  );
}

/**
 * CSRF 토큰 데이터 인터페이스
 */
interface CSRFTokenData {
  /** 랜덤 값 */
  nonce: string;
  /** 생성 시각 (Unix timestamp ms) */
  timestamp: number;
  /** 사용자 ID (선택) */
  userId?: string;
}

/**
 * CSRF 토큰 생성
 * 형식: base64(nonce:timestamp:userId):signature
 *
 * @param userId 선택적 사용자 ID (바인딩용)
 * @returns CSRF 토큰 문자열
 */
export function generateCSRFToken(userId?: string): string {
  const secret = getCSRFSecret();
  const nonce = randomBytes(TOKEN_LENGTH).toString('hex');
  const timestamp = Date.now();

  // 토큰 데이터 구성
  const tokenData: CSRFTokenData = {
    nonce,
    timestamp,
    ...(userId && { userId }),
  };

  // 데이터를 base64로 인코딩
  const dataString = Buffer.from(JSON.stringify(tokenData)).toString('base64url');

  // HMAC 서명 생성
  const signature = createHmac('sha256', secret)
    .update(dataString)
    .digest('base64url');

  return `${dataString}.${signature}`;
}

/**
 * CSRF 토큰 검증 결과
 */
export interface CSRFVerifyResult {
  valid: boolean;
  error?: string;
  data?: CSRFTokenData;
}

/**
 * CSRF 토큰 검증
 *
 * @param token 검증할 토큰
 * @param expectedUserId 예상 사용자 ID (바인딩 검증용)
 * @returns 검증 결과
 */
export function verifyCSRFToken(
  token: string,
  expectedUserId?: string
): CSRFVerifyResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: '토큰이 제공되지 않았습니다.' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: '토큰 형식이 올바르지 않습니다.' };
  }

  const [dataString, signature] = parts as [string, string];

  // 서명 검증
  const secret = getCSRFSecret();
  const expectedSignature = createHmac('sha256', secret)
    .update(dataString)
    .digest('base64url');

  // 타이밍 공격 방지를 위한 상수 시간 비교
  const signatureBuffer = Buffer.from(signature, 'base64url');
  const expectedBuffer = Buffer.from(expectedSignature, 'base64url');

  if (signatureBuffer.length !== expectedBuffer.length) {
    return { valid: false, error: '서명이 유효하지 않습니다.' };
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return { valid: false, error: '서명이 유효하지 않습니다.' };
  }

  // 데이터 파싱
  let tokenData: CSRFTokenData;
  try {
    const decoded = Buffer.from(dataString, 'base64url').toString('utf-8');
    tokenData = JSON.parse(decoded) as CSRFTokenData;
  } catch {
    return { valid: false, error: '토큰 데이터 파싱 실패.' };
  }

  // 만료 검증
  const now = Date.now();
  if (now - tokenData.timestamp > TOKEN_EXPIRY_MS) {
    return { valid: false, error: '토큰이 만료되었습니다.' };
  }

  // 사용자 ID 바인딩 검증 (제공된 경우)
  if (expectedUserId && tokenData.userId !== expectedUserId) {
    return { valid: false, error: '토큰이 현재 사용자와 일치하지 않습니다.' };
  }

  return { valid: true, data: tokenData };
}

/**
 * 더블 서브밋 검증
 * 쿠키의 토큰과 제출된 토큰을 비교
 *
 * @param submittedToken 폼에서 제출된 토큰
 * @param expectedUserId 예상 사용자 ID
 * @returns 검증 결과
 */
export async function validateCSRF(
  submittedToken: string,
  expectedUserId?: string
): Promise<CSRFVerifyResult> {
  // 1. 제출된 토큰 검증
  const tokenResult = verifyCSRFToken(submittedToken, expectedUserId);
  if (!tokenResult.valid) {
    return tokenResult;
  }

  // 2. 쿠키에서 토큰 가져오기
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (!cookieToken) {
    return { valid: false, error: '보안 쿠키가 없습니다.' };
  }

  // 3. 쿠키 토큰도 검증
  const cookieResult = verifyCSRFToken(cookieToken, expectedUserId);
  if (!cookieResult.valid) {
    return { valid: false, error: '쿠키 토큰이 유효하지 않습니다.' };
  }

  // 4. 두 토큰의 nonce가 일치하는지 확인
  if (tokenResult.data?.nonce !== cookieResult.data?.nonce) {
    return { valid: false, error: '토큰 불일치.' };
  }

  return { valid: true, data: tokenResult.data };
}

/**
 * CSRF 쿠키 설정
 *
 * @param token CSRF 토큰
 */
export async function setCSRFCookie(token: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true, // JS에서 접근 불가
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: TOKEN_EXPIRY_MS / 1000, // 초 단위
  });
}

/**
 * CSRF 쿠키 조회
 *
 * @returns 쿠키의 CSRF 토큰 또는 null
 */
export async function getCSRFCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE_NAME)?.value ?? null;
}

/**
 * CSRF 쿠키 삭제
 */
export async function clearCSRFCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CSRF_COOKIE_NAME);
}

/**
 * Server Action용 CSRF 검증 래퍼
 * 간편하게 액션 시작 부분에서 사용
 *
 * @example
 * export async function sensitiveAction(input: Input & { _csrf: string }) {
 *   const { _csrf, ...data } = input;
 *   const csrfResult = await validateCSRFForAction(_csrf, userId);
 *   if (!csrfResult.success) {
 *     return csrfResult;
 *   }
 *   // 실제 로직...
 * }
 */
export async function validateCSRFForAction(
  csrfToken: string | undefined,
  userId?: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!csrfToken) {
    return { success: false, error: '보안 토큰이 필요합니다.' };
  }

  const result = await validateCSRF(csrfToken, userId);
  if (!result.valid) {
    return { success: false, error: result.error ?? '보안 토큰이 유효하지 않습니다.' };
  }

  return { success: true };
}

/**
 * CSRF 토큰 재생성 필요 여부 확인
 * 토큰 만료 10분 전부터 재생성 권장
 *
 * @param token 현재 토큰
 * @returns 재생성 필요 여부
 */
export function shouldRefreshToken(token: string): boolean {
  const result = verifyCSRFToken(token);
  if (!result.valid || !result.data) {
    return true;
  }

  const now = Date.now();
  const expiresAt = result.data.timestamp + TOKEN_EXPIRY_MS;
  const refreshThreshold = 10 * 60 * 1000; // 10분

  return (expiresAt - now) < refreshThreshold;
}
