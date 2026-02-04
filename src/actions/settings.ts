'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireAuth, AuthError } from '@/lib/auth';
import { z } from 'zod';
import { logInfo, logWarn, logError } from '@/lib/logger';
import {
  checkRateLimit,
  getClientIP,
  getRateLimitErrorMessage,
  RATE_LIMIT_PRESETS,
} from '@/lib/rate-limit';
import { validateCSRFForAction } from '@/lib/csrf';

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
  _csrf: z.string().optional(), // CSRF 토큰 (선택적 - 하위 호환)
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
});

// 계정 삭제 스키마 (비밀번호 확인 필수)
const deleteAccountSchema = z.object({
  password: z.string().min(1, '비밀번호를 입력해주세요'),
  confirmText: z.literal('계정 삭제', {
    errorMap: () => ({ message: '"계정 삭제"를 정확히 입력해주세요' }),
  }),
  _csrf: z.string().optional(), // CSRF 토큰 (선택적 - 하위 호환)
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

/**
 * 사용자 프로필 조회
 */
export async function getProfile() {
  try {
    const { user, supabase } = await requireAuth();

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
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
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

  try {
    const { user, supabase } = await requireAuth();

    const { error } = await supabase
      .from('profiles')
      .update({
        name: validated.data.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      logError('프로필 업데이트 오류', error, {
        action: 'updateProfile',
        userId: user.id,
      });
      return { success: false as const, error: '프로필 업데이트에 실패했습니다' };
    }

    revalidatePath('/settings');
    revalidatePath('/dashboard');
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
}

/**
 * 비밀번호 변경 (고위험 작업 - Rate Limiting + CSRF 적용)
 */
export async function changePassword(input: ChangePasswordInput) {
  // Rate Limiting (분당 3회)
  const headersList = await headers();
  const clientIP = getClientIP(headersList);
  const rateLimitResult = await checkRateLimit(
    clientIP,
    'change_password',
    RATE_LIMIT_PRESETS.SUBSCRIPTION_CREATE // 분당 3회
  );

  if (!rateLimitResult.allowed) {
    logWarn('비밀번호 변경 Rate Limit 초과', { action: 'changePassword', clientIP });
    return {
      success: false as const,
      error: getRateLimitErrorMessage(rateLimitResult),
    };
  }

  const validated = changePasswordSchema.safeParse(input);

  // CSRF 토큰 검증 (제공된 경우)
  if (validated.success && validated.data._csrf) {
    const csrfResult = await validateCSRFForAction(validated.data._csrf);
    if (!csrfResult.success) {
      logWarn('비밀번호 변경 CSRF 검증 실패', { action: 'changePassword', clientIP });
      return { success: false as const, error: csrfResult.error };
    }
  }
  if (!validated.success) {
    return {
      success: false as const,
      error: '입력값이 유효하지 않습니다',
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    const { user, supabase } = await requireAuth();

    // 현재 비밀번호 확인 (재인증)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: validated.data.currentPassword,
    });

    if (signInError) {
      logWarn('비밀번호 변경 - 현재 비밀번호 불일치', {
        action: 'changePassword',
        userId: user.id,
      });
      return { success: false as const, error: '현재 비밀번호가 올바르지 않습니다' };
    }

    // Supabase Auth로 비밀번호 변경
    const { error } = await supabase.auth.updateUser({
      password: validated.data.newPassword,
    });

    if (error) {
      logError('비밀번호 변경 오류', error, { action: 'changePassword', userId: user.id });
      return { success: false as const, error: '비밀번호 변경에 실패했습니다' };
    }

    logInfo('비밀번호 변경 성공', { action: 'changePassword', userId: user.id });
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
}

/**
 * 계정 삭제 (고위험 작업 - Rate Limiting + CSRF + 비밀번호 확인 필수)
 */
export async function deleteAccount(input: DeleteAccountInput) {
  // Rate Limiting (분당 3회)
  const headersList = await headers();
  const clientIP = getClientIP(headersList);
  const rateLimitResult = await checkRateLimit(
    clientIP,
    'delete_account',
    RATE_LIMIT_PRESETS.SUBSCRIPTION_CREATE // 분당 3회
  );

  if (!rateLimitResult.allowed) {
    logWarn('계정 삭제 Rate Limit 초과', { action: 'deleteAccount', clientIP });
    return {
      success: false as const,
      error: getRateLimitErrorMessage(rateLimitResult),
    };
  }

  // 입력값 검증
  const validated = deleteAccountSchema.safeParse(input);

  // CSRF 토큰 검증 (제공된 경우)
  if (validated.success && validated.data._csrf) {
    const csrfResult = await validateCSRFForAction(validated.data._csrf);
    if (!csrfResult.success) {
      logWarn('계정 삭제 CSRF 검증 실패', { action: 'deleteAccount', clientIP });
      return { success: false as const, error: csrfResult.error };
    }
  }
  if (!validated.success) {
    return {
      success: false as const,
      error: '입력값이 유효하지 않습니다',
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    const { user, supabase } = await requireAuth();

    // 비밀번호 확인 (재인증)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: validated.data.password,
    });

    if (signInError) {
      logWarn('계정 삭제 - 비밀번호 불일치', {
        action: 'deleteAccount',
        userId: user.id,
      });
      return { success: false as const, error: '비밀번호가 올바르지 않습니다' };
    }

    // 1. 생성된 콘텐츠 삭제
    const { error: contentError } = await supabase
      .from('generated_contents')
      .delete()
      .eq('user_id', user.id);

    if (contentError) {
      logError('콘텐츠 삭제 실패', contentError, {
        action: 'deleteAccount',
        userId: user.id,
      });
    }

    // 2. 크레딧 트랜잭션 삭제
    const { error: creditError } = await supabase
      .from('credit_transactions')
      .delete()
      .eq('user_id', user.id);

    if (creditError) {
      logError('크레딧 트랜잭션 삭제 실패', creditError, {
        action: 'deleteAccount',
        userId: user.id,
      });
    }

    // 3. 결제 내역 삭제
    const { error: paymentError } = await supabase
      .from('payments')
      .delete()
      .eq('user_id', user.id);

    if (paymentError) {
      logError('결제 내역 삭제 실패', paymentError, {
        action: 'deleteAccount',
        userId: user.id,
      });
    }

    // 4. 구독 삭제
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', user.id);

    if (subscriptionError) {
      logError('구독 삭제 실패', subscriptionError, {
        action: 'deleteAccount',
        userId: user.id,
      });
    }

    // 5. 프로필 삭제
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    if (profileError) {
      logError('프로필 삭제 실패', profileError, {
        action: 'deleteAccount',
        userId: user.id,
      });
      return { success: false as const, error: '계정 삭제에 실패했습니다' };
    }

    // 6. 로그아웃
    await supabase.auth.signOut();

    logInfo('계정 삭제 완료', { action: 'deleteAccount', userId: user.id });
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false as const, error: error.message };
    }
    logError('계정 삭제 중 오류', error, { action: 'deleteAccount' });
    return { success: false as const, error: '계정 삭제 중 오류가 발생했습니다' };
  }
}
