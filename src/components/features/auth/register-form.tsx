'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, User, Mail, Lock, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';
import { Button, Input, Label } from '@/components/ui';
import { register as registerUser } from '@/actions/auth';
import { registerSchema, type RegisterInput } from '@/lib/validators/auth';
import { cn } from '@/lib/utils';
import { clientLogger } from '@/lib/client-logger';

export function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(data: RegisterInput) {
    setIsLoading(true);
    setError(null);

    try {
      // 1. 회원가입 API 호출
      let result;
      try {
        result = await registerUser(data);
      } catch (apiError) {
        // API 호출 자체 실패 (네트워크 오류 등)
        clientLogger.error('[회원가입 API 호출 실패]', apiError, {
          type: 'API_CALL_ERROR',
        });
        throw new Error('서버에 연결할 수 없습니다. 네트워크를 확인해주세요.');
      }

      // 2. API 응답 검증
      if (!result) {
        clientLogger.error('[회원가입 오류] API 응답이 없습니다.');
        throw new Error('서버 응답이 없습니다.');
      }

      // 3. 실패 응답 처리
      if (!result.success) {
        clientLogger.error('[회원가입 실패]', undefined, {
          error: result.error,
          fieldErrors: result.fieldErrors,
          type: 'REGISTRATION_FAILED',
        });

        setError(result.error || '회원가입에 실패했습니다.');

        // 필드별 에러 설정
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, errors]) => {
            if (errors && errors.length > 0) {
              form.setError(field as keyof RegisterInput, {
                message: errors[0],
              });
            }
          });
        }
        return;
      }

      // 4. 세션 토큰 localStorage 저장
      if (result.session) {
        try {
          const tokenData = {
            accessToken: result.session.accessToken,
            refreshToken: result.session.refreshToken,
            expiresAt: result.session.expiresAt,
            user: result.session.user,
            savedAt: new Date().toISOString(),
          };

          localStorage.setItem('codegen-auth-token', JSON.stringify(tokenData));
          localStorage.setItem('codegen-user', JSON.stringify(result.session.user));

          clientLogger.info('[회원가입 성공] 토큰 저장 완료', {
            userId: result.session.user.id,
            email: result.session.user.email,
            expiresAt: new Date(result.session.expiresAt * 1000).toISOString(),
          });
        } catch (storageError) {
          // localStorage 저장 실패 (private 모드 등)
          clientLogger.warn('[회원가입 경고] localStorage 저장 실패', { error: storageError });
          // 저장 실패해도 진행 (쿠키 기반 세션은 유지됨)
        }
      }

      // 5. 메인 페이지로 즉시 리다이렉트
      clientLogger.info('[회원가입 완료] 대시보드로 이동합니다.');
      router.push('/dashboard');
      router.refresh();

    } catch (err) {
      // 최상위 예외 처리
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';

      clientLogger.error('[회원가입 예외]', err, {
        type: 'UNEXPECTED_ERROR',
      });

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-2 rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">이름</Label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <User
              className={cn(
                "h-4 w-4 transition-colors",
                form.formState.errors.name ? "text-destructive" : "text-muted-foreground"
              )}
              aria-hidden="true"
            />
          </div>
          <Input
            id="name"
            type="text"
            placeholder="홍길동"
            autoComplete="name"
            disabled={isLoading}
            aria-invalid={!!form.formState.errors.name}
            aria-describedby={form.formState.errors.name ? "name-error" : undefined}
            className={cn(
              "pl-10 h-11",
              form.formState.errors.name && "border-destructive focus-visible:ring-destructive"
            )}
            {...form.register('name')}
          />
        </div>
        {form.formState.errors.name && (
          <p id="name-error" className="text-xs text-destructive flex items-center gap-1" role="alert">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium">이메일</Label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Mail
              className={cn(
                "h-4 w-4 transition-colors",
                form.formState.errors.email ? "text-destructive" : "text-muted-foreground"
              )}
              aria-hidden="true"
            />
          </div>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            disabled={isLoading}
            aria-invalid={!!form.formState.errors.email}
            aria-describedby={form.formState.errors.email ? "register-email-error" : undefined}
            className={cn(
              "pl-10 h-11",
              form.formState.errors.email && "border-destructive focus-visible:ring-destructive"
            )}
            {...form.register('email')}
          />
        </div>
        {form.formState.errors.email && (
          <p id="register-email-error" className="text-xs text-destructive flex items-center gap-1" role="alert">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium">비밀번호</Label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Lock
              className={cn(
                "h-4 w-4 transition-colors",
                form.formState.errors.password ? "text-destructive" : "text-muted-foreground"
              )}
              aria-hidden="true"
            />
          </div>
          <Input
            id="password"
            type="password"
            placeholder="영문, 숫자 포함 6자 이상"
            autoComplete="new-password"
            disabled={isLoading}
            aria-invalid={!!form.formState.errors.password}
            aria-describedby={form.formState.errors.password ? "register-password-error" : undefined}
            className={cn(
              "pl-10 h-11",
              form.formState.errors.password && "border-destructive focus-visible:ring-destructive"
            )}
            {...form.register('password')}
          />
        </div>
        {form.formState.errors.password && (
          <p id="register-password-error" className="text-xs text-destructive flex items-center gap-1" role="alert">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-sm font-medium">비밀번호 확인</Label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <KeyRound
              className={cn(
                "h-4 w-4 transition-colors",
                form.formState.errors.confirmPassword ? "text-destructive" : "text-muted-foreground"
              )}
              aria-hidden="true"
            />
          </div>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="비밀번호를 다시 입력해주세요"
            autoComplete="new-password"
            disabled={isLoading}
            aria-invalid={!!form.formState.errors.confirmPassword}
            aria-describedby={form.formState.errors.confirmPassword ? "confirm-password-error" : undefined}
            className={cn(
              "pl-10 h-11",
              form.formState.errors.confirmPassword && "border-destructive focus-visible:ring-destructive"
            )}
            {...form.register('confirmPassword')}
          />
        </div>
        {form.formState.errors.confirmPassword && (
          <p id="confirm-password-error" className="text-xs text-destructive flex items-center gap-1" role="alert">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full h-11 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/25"
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        {isLoading ? '가입 처리 중...' : '무료로 시작하기'}
      </Button>
    </form>
  );
}
