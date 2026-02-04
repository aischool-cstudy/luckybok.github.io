'use client';

import { useTransition, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, User, Check, AlertCircle, GraduationCap } from 'lucide-react';
import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { updateLearnerAge, getLearnerProfile } from '@/actions/learning/onboarding';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ageSchema = z.object({
  age: z.number().min(10, '나이는 10세 이상이어야 합니다').max(100, '나이는 100세 이하여야 합니다'),
});

type AgeFormData = z.infer<typeof ageSchema>;

export function LearningProfileSection() {
  const [isPending, startTransition] = useTransition();
  const [currentAge, setCurrentAge] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<AgeFormData>({
    resolver: zodResolver(ageSchema),
    defaultValues: {
      age: undefined,
    },
  });

  useEffect(() => {
    async function loadProfile() {
      const result = await getLearnerProfile();
      if (result.success && result.data) {
        setCurrentAge(result.data.age);
        if (result.data.age) {
          reset({ age: result.data.age });
        }
      }
      setIsLoading(false);
    }
    loadProfile();
  }, [reset]);

  const onSubmit = (data: AgeFormData) => {
    startTransition(async () => {
      const result = await updateLearnerAge({ age: data.age });
      if (result.success) {
        setCurrentAge(data.age);
        reset({ age: data.age });
        toast.success('나이가 저장되었습니다');
      } else {
        toast.error(result.error || '나이 저장에 실패했습니다');
      }
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5 text-primary" />
            학습 프로필
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <GraduationCap className="h-5 w-5 text-primary" />
          학습 프로필
        </CardTitle>
        <CardDescription>
          나이를 설정하면 더 맞춤화된 학습 콘텐츠를 제공받을 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="age" className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              나이
            </Label>
            <div className="relative max-w-xs">
              <Input
                id="age"
                type="number"
                min={10}
                max={100}
                {...register('age', { valueAsNumber: true })}
                placeholder={currentAge ? String(currentAge) : '나이를 입력하세요'}
                disabled={isPending}
                className={cn(
                  "h-11",
                  errors.age && "border-destructive focus-visible:ring-destructive"
                )}
              />
            </div>
            {errors.age && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.age.message}
              </p>
            )}
            {currentAge && !isDirty && (
              <p className="text-xs text-muted-foreground">
                현재 저장된 나이: {currentAge}세
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isPending || !isDirty}
            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/25"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            나이 저장
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
