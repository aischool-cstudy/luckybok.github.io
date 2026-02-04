'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mail, User, Check, AlertCircle, Lock } from 'lucide-react';
import { Button, Input, Label, Badge } from '@/components/ui';
import { updateProfile } from '@/actions/settings';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const profileSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(50, '이름은 50자 이내로 입력해주세요'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  initialData: {
    name: string;
    email: string;
  };
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: initialData.name,
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    startTransition(async () => {
      const result = await updateProfile(data);
      if (result.success) {
        toast.success('프로필이 업데이트되었습니다');
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          이메일
        </Label>
        <div className="relative">
          <Input
            id="email"
            type="email"
            value={initialData.email}
            disabled
            className="bg-muted/50 pl-10 h-11"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <Badge variant="secondary" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
            변경 불가
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          이름
        </Label>
        <div className="relative">
          <Input
            id="name"
            {...register('name')}
            placeholder="이름을 입력하세요"
            disabled={isPending}
            className={cn(
              "pl-10 h-11",
              errors.name && "border-destructive focus-visible:ring-destructive"
            )}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <User className={cn(
              "h-4 w-4",
              errors.name ? "text-destructive" : "text-muted-foreground"
            )} />
          </div>
        </div>
        {errors.name && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors.name.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending || !isDirty}
        className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25"
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Check className="mr-2 h-4 w-4" />
        )}
        변경사항 저장
      </Button>
    </form>
  );
}
