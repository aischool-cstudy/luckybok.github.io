/**
 * 인증 관련 헬퍼 함수
 *
 * Server Actions에서 반복되는 인증 코드를 추출하여 재사용성을 높임
 */

import { createServerClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────

export interface AuthResult {
  user: User;
  supabase: SupabaseClient<Database>;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// ────────────────────────────────────────────────────────────
// 인증 헬퍼 함수
// ────────────────────────────────────────────────────────────

/**
 * 인증된 사용자를 반환하거나 에러를 던짐
 * Server Actions에서 인증 검사에 사용
 *
 * @throws {AuthError} 인증되지 않은 경우
 * @example
 * ```typescript
 * try {
 *   const { user, supabase } = await requireAuth();
 *   // user 사용
 * } catch (error) {
 *   if (error instanceof AuthError) {
 *     return { success: false, error: error.message };
 *   }
 *   throw error;
 * }
 * ```
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new AuthError('로그인이 필요합니다');
  }

  return { user, supabase };
}

/**
 * 인증 여부를 확인하고 결과를 반환 (에러를 던지지 않음)
 * 조건부 로직이 필요한 경우 사용
 *
 * @example
 * ```typescript
 * const result = await getAuthUser();
 * if (!result) {
 *   return { success: false, error: '로그인이 필요합니다' };
 * }
 * const { user, supabase } = result;
 * ```
 */
export async function getAuthUser(): Promise<AuthResult | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}

/**
 * 사용자 ID만 필요한 경우 사용
 * 에러 발생 시 null 반환
 */
export async function getAuthUserId(): Promise<string | null> {
  const result = await getAuthUser();
  return result?.user.id ?? null;
}
