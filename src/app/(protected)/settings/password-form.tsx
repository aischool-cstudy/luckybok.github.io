'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff, Lock, KeyRound, Shield, Check, AlertCircle } from 'lucide-react';
import { Button, Input, Label } from '@/components/ui';
import { changePassword } from '@/actions/settings';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, '현재 비밀번호를 입력해주세요'),
    newPassword: z
      .string()
      .min(8, '새 비밀번호는 8자 이상이어야 합니다')
      .regex(/[A-Z]/, '대문자를 포함해야 합니다')
      .regex(/[a-z]/, '소문자를 포함해야 합니다')
      .regex(/[0-9]/, '숫자를 포함해야 합니다'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['confirmPassword'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

export function PasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = (data: PasswordFormData) => {
    startTransition(async () => {
      const result = await changePassword(data);
      if (result.success) {
        toast.success('비밀번호가 변경되었습니다');
        reset();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="currentPassword" className="text-sm font-medium flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          현재 비밀번호
        </Label>
        <div className="relative">
          <Input
            id="currentPassword"
            type={showCurrentPassword ? 'text' : 'password'}
            {...register('currentPassword')}
            placeholder="현재 비밀번호"
            disabled={isPending}
            className={cn(
              "pl-10 pr-10 h-11",
              errors.currentPassword && "border-destructive focus-visible:ring-destructive"
            )}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Lock className={cn(
              "h-4 w-4",
              errors.currentPassword ? "text-destructive" : "text-muted-foreground"
            )} />
          </div>
          <button
            type="button"
            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showCurrentPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.currentPassword && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors.currentPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword" className="text-sm font-medium flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          새 비밀번호
        </Label>
        <div className="relative">
          <Input
            id="newPassword"
            type={showNewPassword ? 'text' : 'password'}
            {...register('newPassword')}
            placeholder="새 비밀번호"
            disabled={isPending}
            className={cn(
              "pl-10 pr-10 h-11",
              errors.newPassword && "border-destructive focus-visible:ring-destructive"
            )}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <KeyRound className={cn(
              "h-4 w-4",
              errors.newPassword ? "text-destructive" : "text-muted-foreground"
            )} />
          </div>
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showNewPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.newPassword && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors.newPassword.message}
          </p>
        )}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            8자 이상, 대/소문자, 숫자 포함
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-sm font-medium flex items-center gap-2">
          <Check className="h-4 w-4 text-muted-foreground" />
          새 비밀번호 확인
        </Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type="password"
            {...register('confirmPassword')}
            placeholder="새 비밀번호 확인"
            disabled={isPending}
            className={cn(
              "pl-10 h-11",
              errors.confirmPassword && "border-destructive focus-visible:ring-destructive"
            )}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Check className={cn(
              "h-4 w-4",
              errors.confirmPassword ? "text-destructive" : "text-muted-foreground"
            )} />
          </div>
        </div>
        {errors.confirmPassword && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/25"
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Shield className="mr-2 h-4 w-4" />
        )}
        비밀번호 변경
      </Button>
    </form>
  );
}
