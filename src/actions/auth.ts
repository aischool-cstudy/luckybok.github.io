'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { loginSchema, registerSchema } from '@/lib/validators/auth';
import type { LoginInput, RegisterInput } from '@/lib/validators/auth';
import { logError, logInfo, logWarn } from '@/lib/logger';
import {
  checkRateLimit,
  getClientIP,
  getRateLimitErrorMessage,
  RATE_LIMIT_PRESETS,
} from '@/lib/rate-limit';

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export type RegisterResult = ActionResult & {
  session?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    user: {
      id: string;
      email: string;
      name?: string;
    };
  };
};

export async function login(input: LoginInput): Promise<ActionResult> {
  // Rate Limiting 체크
  const headersList = await headers();
  const clientIP = getClientIP(headersList);
  const rateLimitResult = await checkRateLimit(clientIP, 'auth_login', RATE_LIMIT_PRESETS.AUTH);

  if (!rateLimitResult.allowed) {
    logWarn('로그인 Rate Limit 초과', { action: 'login', clientIP });
    return {
      success: false,
      error: getRateLimitErrorMessage(rateLimitResult),
    };
  }

  // 입력 검증
  const validated = loginSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: '입력값이 유효하지 않습니다.',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: validated.data.email,
    password: validated.data.password,
  });

  if (error) {
    return {
      success: false,
      error: getAuthErrorMessage(error.message),
    };
  }

  return { success: true };
}

export async function register(input: RegisterInput): Promise<RegisterResult> {
  try {
    // 0. Rate Limiting 체크 (회원가입은 더 엄격: 분당 3회)
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = await checkRateLimit(
      clientIP,
      'auth_register',
      RATE_LIMIT_PRESETS.SUBSCRIPTION_CREATE // 분당 3회
    );

    if (!rateLimitResult.allowed) {
      logWarn('회원가입 Rate Limit 초과', { action: 'register', clientIP });
      return {
        success: false,
        error: getRateLimitErrorMessage(rateLimitResult),
      };
    }

    // 1. 입력 검증
    const validated = registerSchema.safeParse(input);
    if (!validated.success) {
      const fieldErrors = validated.error.flatten().fieldErrors as Record<string, string[]>;
      logError('회원가입 입력 검증 실패', validated.error, { action: 'register' });
      return {
        success: false,
        error: '입력값이 유효하지 않습니다.',
        fieldErrors,
      };
    }

    // 2. Supabase 클라이언트 생성
    let supabase;
    try {
      supabase = await createServerClient();
    } catch (clientError) {
      logError('Supabase 클라이언트 생성 실패', clientError, { action: 'register' });
      return {
        success: false,
        error: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
      };
    }

    // 3. 회원가입 시도
    let signUpData;
    try {
      const result = await supabase.auth.signUp({
        email: validated.data.email,
        password: validated.data.password,
        options: {
          data: {
            name: validated.data.name,
          },
        },
      });

      if (result.error) {
        logError('Supabase signUp 실패', result.error, {
          action: 'register',
          errorCode: result.error.code,
        });
        return {
          success: false,
          error: getAuthErrorMessage(result.error.message),
        };
      }

      signUpData = result.data;
    } catch (signUpError) {
      logError('signUp 예외 발생', signUpError, { action: 'register' });
      return {
        success: false,
        error: '회원가입 처리 중 오류가 발생했습니다.',
      };
    }

    // 4. 세션 확보 (자동 로그인)
    let session = signUpData.session;

    if (!session) {
      // 이메일 인증이 필요한 경우 - 직접 로그인 시도
      try {
        const signInResult = await supabase.auth.signInWithPassword({
          email: validated.data.email,
          password: validated.data.password,
        });

        if (signInResult.error) {
          logError('자동 로그인 실패', signInResult.error, {
            action: 'register',
            errorCode: signInResult.error.code,
          });

          if (signInResult.error.message.includes('not confirmed')) {
            return {
              success: false,
              error: '이메일 인증이 필요합니다. 이메일을 확인해주세요.',
            };
          }

          return {
            success: false,
            error: '회원가입은 완료되었으나 자동 로그인에 실패했습니다.',
          };
        }

        session = signInResult.data.session;
      } catch (signInError) {
        logError('signIn 예외 발생', signInError, { action: 'register' });
        return {
          success: false,
          error: '자동 로그인 처리 중 오류가 발생했습니다.',
        };
      }
    }

    // 5. 최종 세션 확인
    if (!session) {
      logError('세션 생성 실패', null, {
        action: 'register',
        userId: signUpData.user?.id,
      });
      return {
        success: false,
        error: '세션 생성에 실패했습니다. 로그인 페이지에서 다시 시도해주세요.',
      };
    }

    // 6. 성공 로그
    logInfo('회원가입 성공', {
      action: 'register',
      userId: signUpData.user?.id,
    });

    // 7. 세션 정보 반환 (클라이언트에서 localStorage 저장용)
    return {
      success: true,
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at!,
        user: {
          id: signUpData.user!.id,
          email: signUpData.user!.email!,
          name: signUpData.user?.user_metadata?.name,
        },
      },
    };
  } catch (unexpectedError) {
    // 최상위 예외 처리 - 예상치 못한 모든 오류 캐치
    logError('회원가입 예상치 못한 예외', unexpectedError, { action: 'register' });
    return {
      success: false,
      error: '예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    };
  }
}

export async function logout(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

function getAuthErrorMessage(errorMessage: string): string {
  // Supabase 에러 메시지를 사용자 친화적으로 변환
  const errorMap: Record<string, string> = {
    'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'Email not confirmed': '이메일 인증이 필요합니다. 이메일을 확인해주세요.',
    'User already registered': '이미 등록된 이메일입니다.',
    'Password should be at least 6 characters': '비밀번호는 최소 6자 이상이어야 합니다.',
    'Email rate limit exceeded': '너무 많은 요청이 있었습니다. 잠시 후 다시 시도해주세요.',
  };

  return errorMap[errorMessage] || '오류가 발생했습니다. 다시 시도해주세요.';
}
