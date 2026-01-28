'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button, Input, Label } from '@/components/ui';
import { updateProfile } from '@/actions/settings';
import { toast } from 'sonner';

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          type="email"
          value={initialData.email}
          disabled
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">이메일은 변경할 수 없습니다</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">이름</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="이름을 입력하세요"
          disabled={isPending}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isPending || !isDirty}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        저장
      </Button>
    </form>
  );
}
