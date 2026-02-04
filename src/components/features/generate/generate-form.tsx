'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Sparkles, Zap, Code, Target, Users, AlertCircle, Crown } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@/components/ui';
import { generateContent } from '@/actions/generate';
import {
  generateContentInputSchema,
  type GenerateContentInput,
  type GeneratedContent,
} from '@/lib/ai/schemas';
import {
  LANGUAGE_OPTIONS,
  DIFFICULTY_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
} from '@/config/constants';
import { cn } from '@/lib/utils';

interface GenerateFormProps {
  onGenerated?: (content: GeneratedContent) => void;
  remainingGenerations?: number;
  plan?: string;
}

export function GenerateForm({
  onGenerated,
  remainingGenerations = 0,
  plan = 'starter',
}: GenerateFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<GenerateContentInput>({
    resolver: zodResolver(generateContentInputSchema),
    defaultValues: {
      language: 'python',
      topic: '',
      difficulty: 'beginner',
      targetAudience: 'non_tech',
    },
  });

  async function onSubmit(data: GenerateContentInput) {
    if (remainingGenerations <= 0) {
      setError('오늘의 생성 횟수를 모두 사용했습니다.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await generateContent(data);

      if (!result.success) {
        setError(result.error);
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, errors]) => {
            form.setError(field as keyof GenerateContentInput, {
              message: errors[0],
            });
          });
        }
        setIsLoading(false);
        return;
      }

      // 생성 완료 후 결과 전달
      onGenerated?.(result.data);
    } catch {
      setError('콘텐츠 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  const isStarter = plan === 'starter';
  const isPro = plan === 'pro' || plan === 'team' || plan === 'enterprise';

  return (
    <Card className="w-full max-w-2xl overflow-hidden shadow-lg">
      {/* 상단 그라데이션 바 */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />

      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">AI 콘텐츠 생성</CardTitle>
              <CardDescription>
                Claude AI가 맞춤형 교육 자료를 생성합니다
              </CardDescription>
            </div>
          </div>
          {isPro && (
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
              <Crown className="h-3 w-3 mr-1" />
              Pro
            </Badge>
          )}
        </div>

        {/* 남은 횟수 표시 */}
        <div className={cn(
          'flex items-center justify-between p-3 rounded-xl border transition-colors',
          remainingGenerations <= 3
            ? 'bg-orange-500/5 border-orange-500/20'
            : 'bg-primary/5 border-primary/10'
        )}>
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              remainingGenerations <= 3 ? 'bg-orange-500/10' : 'bg-primary/10'
            )}>
              <Zap className={cn(
                'h-4 w-4',
                remainingGenerations <= 3 ? 'text-orange-500' : 'text-primary'
              )} />
            </div>
            <span className="text-sm text-muted-foreground">오늘 남은 생성 횟수</span>
          </div>
          <span className={cn(
            'text-2xl font-bold',
            remainingGenerations <= 3 ? 'text-orange-500' : 'text-primary'
          )}>
            {remainingGenerations}회
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              id="form-error"
              className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20"
            >
              <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* 프로그래밍 언어 선택 */}
          <div className="space-y-2">
            <Label htmlFor="language" className="flex items-center gap-2 text-sm font-medium">
              <Code className="h-4 w-4 text-blue-500" />
              프로그래밍 언어
            </Label>
            <Controller
              name="language"
              control={form.control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isLoading}
                >
                  <SelectTrigger id="language" className="h-11">
                    <SelectValue placeholder="언어 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        disabled={isStarter && option.value !== 'python'}
                      >
                        <span className="flex items-center gap-2">
                          {option.label}
                          {isStarter && option.value !== 'python' && (
                            <Badge variant="secondary" className="text-xs">Pro</Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.language && (
              <p className="text-sm text-destructive">
                {form.formState.errors.language.message}
              </p>
            )}
          </div>

          {/* 주제 입력 */}
          <div className="space-y-2">
            <Label htmlFor="topic" className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-purple-500" />
              학습 주제
            </Label>
            <Input
              id="topic"
              className="h-11"
              placeholder="예: 리스트 컴프리헨션, REST API 만들기, SELECT 쿼리 기초"
              disabled={isLoading}
              {...form.register('topic')}
            />
            {form.formState.errors.topic && (
              <p className="text-sm text-destructive">
                {form.formState.errors.topic.message}
              </p>
            )}
          </div>

          {/* 난이도 선택 */}
          <div className="space-y-2">
            <Label htmlFor="difficulty" className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4 text-green-500" />
              난이도
            </Label>
            <Controller
              name="difficulty"
              control={form.control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isLoading}
                >
                  <SelectTrigger id="difficulty" className="h-11">
                    <SelectValue placeholder="난이도 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.difficulty && (
              <p className="text-sm text-destructive">
                {form.formState.errors.difficulty.message}
              </p>
            )}
          </div>

          {/* 학습자 유형 선택 */}
          <div className="space-y-2">
            <Label htmlFor="targetAudience" className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-orange-500" />
              학습자 유형
            </Label>
            <Controller
              name="targetAudience"
              control={form.control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isLoading}
                >
                  <SelectTrigger id="targetAudience" className="h-11">
                    <SelectValue placeholder="학습자 유형 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_AUDIENCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.targetAudience && (
              <p className="text-sm text-destructive">
                {form.formState.errors.targetAudience.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className={cn(
              'w-full h-12 text-base font-semibold transition-all',
              !isLoading && remainingGenerations > 0 &&
                'bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25'
            )}
            disabled={isLoading || remainingGenerations <= 0}
            aria-busy={isLoading}
            aria-describedby={error ? 'form-error' : undefined}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                AI가 콘텐츠를 생성하고 있어요...
              </span>
            ) : remainingGenerations <= 0 ? (
              <span className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                오늘 생성 횟수를 모두 사용했어요
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                콘텐츠 생성하기
              </span>
            )}
          </Button>

          {/* 안내 문구 */}
          {!isLoading && remainingGenerations > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              생성에는 약 30초가 소요됩니다
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
