/**
 * URL 검증 유틸리티
 *
 * Open Redirect 취약점 방지를 위한 URL 검증 함수들
 */

import { clientEnv } from '@/lib/env';

/**
 * 허용된 리다이렉트 경로 패턴
 * - 슬래시로 시작하는 상대 경로만 허용
 * - 외부 URL 및 프로토콜 상대 URL 차단
 */
const ALLOWED_PATH_PREFIXES = [
  '/dashboard',
  '/generate',
  '/history',
  '/settings',
  '/payment',
  '/onboarding',
] as const;

/**
 * 허용된 호스트 목록
 * - 프로덕션/개발 환경의 앱 URL만 허용
 */
function getAllowedHosts(): string[] {
  const hosts: string[] = [];

  // 앱 URL에서 호스트 추출
  try {
    const appUrl = new URL(clientEnv.APP_URL);
    hosts.push(appUrl.host);
  } catch {
    // APP_URL이 유효하지 않으면 localhost만 허용
  }

  // 개발 환경에서는 localhost 허용
  if (clientEnv.IS_DEVELOPMENT) {
    hosts.push('localhost:3000');
    hosts.push('localhost');
    hosts.push('127.0.0.1:3000');
    hosts.push('127.0.0.1');
  }

  return hosts;
}

/**
 * 안전한 상대 경로인지 확인
 *
 * @param path - 검증할 경로
 * @returns 안전한 상대 경로이면 true
 *
 * @example
 * isValidRelativePath('/dashboard') // true
 * isValidRelativePath('//evil.com') // false (프로토콜 상대 URL)
 * isValidRelativePath('/\\evil.com') // false (백슬래시 우회 시도)
 */
export function isValidRelativePath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // 공백 제거
  const trimmed = path.trim();

  // 빈 문자열 거부
  if (!trimmed) {
    return false;
  }

  // 단일 슬래시로 시작해야 함
  if (!trimmed.startsWith('/')) {
    return false;
  }

  // 프로토콜 상대 URL 거부 (//로 시작)
  if (trimmed.startsWith('//')) {
    return false;
  }

  // 백슬래시 포함 거부 (우회 시도 방지)
  if (trimmed.includes('\\')) {
    return false;
  }

  // 널 바이트 거부
  if (trimmed.includes('\0')) {
    return false;
  }

  // URL 인코딩된 슬래시/백슬래시 거부
  if (trimmed.includes('%2f') || trimmed.includes('%2F') ||
      trimmed.includes('%5c') || trimmed.includes('%5C')) {
    return false;
  }

  // 프로토콜 포함 여부 확인 (javascript:, data: 등)
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * 허용된 리다이렉트 경로인지 확인
 *
 * @param path - 검증할 경로
 * @returns 허용된 경로이면 true
 */
export function isAllowedRedirectPath(path: string): boolean {
  if (!isValidRelativePath(path)) {
    return false;
  }

  // 허용된 경로 접두사로 시작하는지 확인
  return ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * URL이 허용된 호스트인지 확인
 *
 * @param url - 검증할 URL (절대 URL)
 * @returns 허용된 호스트이면 true
 */
export function isAllowedHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowedHosts = getAllowedHosts();
    return allowedHosts.includes(parsed.host);
  } catch {
    return false;
  }
}

/**
 * 리다이렉트 URL 검증 및 안전한 URL 반환
 *
 * @param redirectTo - 리다이렉트할 URL 또는 경로
 * @param fallback - 검증 실패 시 반환할 기본 경로
 * @returns 안전한 리다이렉트 경로
 *
 * @example
 * getSafeRedirectUrl('/dashboard') // '/dashboard'
 * getSafeRedirectUrl('https://evil.com') // '/dashboard' (기본값)
 * getSafeRedirectUrl('//evil.com') // '/dashboard' (기본값)
 * getSafeRedirectUrl(undefined) // '/dashboard' (기본값)
 */
export function getSafeRedirectUrl(
  redirectTo: string | undefined | null,
  fallback = '/dashboard'
): string {
  // null/undefined 처리
  if (!redirectTo) {
    return fallback;
  }

  // 문자열이 아닌 경우
  if (typeof redirectTo !== 'string') {
    return fallback;
  }

  const trimmed = redirectTo.trim();

  // 빈 문자열
  if (!trimmed) {
    return fallback;
  }

  // 상대 경로인 경우
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    // 안전한 상대 경로인지 확인
    if (isValidRelativePath(trimmed)) {
      // 허용된 경로 접두사인지 확인 (선택적 - 더 엄격한 검증)
      // 필요에 따라 isAllowedRedirectPath(trimmed)로 변경 가능
      return trimmed;
    }
    return fallback;
  }

  // 절대 URL인 경우 - 호스트 검증
  try {
    const parsed = new URL(trimmed);

    // http/https만 허용
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fallback;
    }

    // 허용된 호스트인지 확인
    if (isAllowedHost(trimmed)) {
      // 호스트가 허용된 경우 경로만 추출하여 반환
      return parsed.pathname + parsed.search + parsed.hash;
    }

    return fallback;
  } catch {
    // URL 파싱 실패 - 잘못된 URL
    return fallback;
  }
}

/**
 * 클라이언트 사이드 리다이렉트 검증
 * LoginForm, RegisterForm 등에서 사용
 *
 * @param redirectTo - 검증할 리다이렉트 경로
 * @returns 검증된 안전한 경로
 */
export function validateClientRedirect(redirectTo?: string): string {
  return getSafeRedirectUrl(redirectTo, '/dashboard');
}
