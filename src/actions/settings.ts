'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

// 프로필 업데이트 스키마
const updateProfileSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(50, '이름은 50자 이내로 입력해주세요'),
});

// 비밀번호 변경 스키마
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '현재 비밀번호를 입력해주세요'),
  newPassword: z
    .string()
    .min(8, '새 비밀번호는 8자 이상이어야 합니다')
    .regex(/[A-Z]/, '대문자를 포함해야 합니다')
    .regex(/[a-z]/, '소문자를 포함해야 합니다')
    .regex(/[0-9]/, '숫자를 포함해야 합니다'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * 사용자 프로필 조회
 */
export async function getProfile() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: '로그인이 필요합니다' };
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return { success: false as const, error: '프로필을 찾을 수 없습니다' };
  }

  return {
    success: true as const,
    data: {
      id: profile.id,
      email: user.email || '',
      name: profile.name,
      plan: profile.plan,
      dailyGenerationsRemaining: profile.daily_generations_remaining,
      createdAt: profile.created_at,
    },
  };
}

/**
 * 프로필 업데이트
 */
export async function updateProfile(input: UpdateProfileInput) {
  const validated = updateProfileSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false as const,
      error: '입력값이 유효하지 않습니다',
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: '로그인이 필요합니다' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      name: validated.data.name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    console.error('프로필 업데이트 오류:', error);
    return { success: false as const, error: '프로필 업데이트에 실패했습니다' };
  }

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true as const };
}

/**
 * 비밀번호 변경
 */
export async function changePassword(input: ChangePasswordInput) {
  const validated = changePasswordSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false as const,
      error: '입력값이 유효하지 않습니다',
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();

  // Supabase Auth로 비밀번호 변경
  const { error } = await supabase.auth.updateUser({
    password: validated.data.newPassword,
  });

  if (error) {
    console.error('비밀번호 변경 오류:', error);
    return { success: false as const, error: '비밀번호 변경에 실패했습니다' };
  }

  return { success: true as const };
}

/**
 * 계정 삭제
 */
export async function deleteAccount() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: '로그인이 필요합니다' };
  }

  // 1. 생성된 콘텐츠 삭제
  await supabase.from('generated_contents').delete().eq('user_id', user.id);

  // 2. 프로필 삭제
  await supabase.from('profiles').delete().eq('id', user.id);

  // 3. Auth 사용자 삭제 (admin 권한 필요)
  // 참고: 일반적으로 admin API를 통해 삭제하거나, 서버사이드 함수 사용
  // 여기서는 soft delete 처리하거나 admin API 호출 필요

  // 로그아웃
  await supabase.auth.signOut();

  return { success: true as const };
}
