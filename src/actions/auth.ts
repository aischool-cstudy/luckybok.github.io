'use server';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { loginSchema, registerSchema } from '@/lib/validators/auth';
import type { LoginInput, RegisterInput } from '@/lib/validators/auth';

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function login(input: LoginInput): Promise<ActionResult> {
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

export async function register(input: RegisterInput): Promise<ActionResult> {
  // 입력 검증
  const validated = registerSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: '입력값이 유효하지 않습니다.',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createServerClient();

  const { error } = await supabase.auth.signUp({
    email: validated.data.email,
    password: validated.data.password,
    options: {
      data: {
        name: validated.data.name,
      },
    },
  });

  if (error) {
    return {
      success: false,
      error: getAuthErrorMessage(error.message),
    };
  }

  return { success: true };
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
