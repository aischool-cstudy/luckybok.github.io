'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { Button, Input, Label } from '@/components/ui';
import { login } from '@/actions/auth';
import { loginSchema, type LoginInput } from '@/lib/validators/auth';
import { validateClientRedirect } from '@/lib/url-validator';
import { cn } from '@/lib/utils';

interface LoginFormProps {
  redirectTo?: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Open Redirect 방지: URL 검증
  const safeRedirectTo = validateClientRedirect(redirectTo);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);
    setError(null);

    try {
      const result = await login(data);

      if (!result.success) {
        setError(result.error || '로그인에 실패했습니다.');
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, errors]) => {
            form.setError(field as keyof LoginInput, {
              message: errors[0],
            });
          });
        }
        return;
      }

      router.push(safeRedirectTo);
      router.refresh();
    } catch {
      setError('로그인 중 오류가 발생했습니다.');
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
            aria-describedby={form.formState.errors.email ? "email-error" : undefined}
            className={cn(
              "pl-10 h-11",
              form.formState.errors.email && "border-destructive focus-visible:ring-destructive"
            )}
            {...form.register('email')}
          />
        </div>
        {form.formState.errors.email && (
          <p id="email-error" className="text-xs text-destructive flex items-center gap-1" role="alert">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-sm font-medium">비밀번호</Label>
          <a href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            비밀번호를 잊으셨나요?
          </a>
        </div>
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
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={isLoading}
            aria-invalid={!!form.formState.errors.password}
            aria-describedby={form.formState.errors.password ? "password-error" : undefined}
            className={cn(
              "pl-10 h-11",
              form.formState.errors.password && "border-destructive focus-visible:ring-destructive"
            )}
            {...form.register('password')}
          />
        </div>
        {form.formState.errors.password && (
          <p id="password-error" className="text-xs text-destructive flex items-center gap-1" role="alert">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full h-11 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25"
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        {isLoading ? '로그인 중...' : '로그인'}
      </Button>
    </form>
  );
}
