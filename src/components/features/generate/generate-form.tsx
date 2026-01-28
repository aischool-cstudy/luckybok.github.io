'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Sparkles } from 'lucide-react';
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

interface GenerateFormProps {
  onGenerated?: (content: GeneratedContent) => void;
  onStreamUpdate?: (partial: Partial<GeneratedContent>) => void;
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

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          콘텐츠 생성
        </CardTitle>
        <CardDescription>
          AI가 맞춤형 코딩 교육 콘텐츠를 생성합니다.
          {remainingGenerations > 0 && (
            <span className="ml-2 text-primary">
              남은 횟수: {remainingGenerations}회
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* 프로그래밍 언어 선택 */}
          <div className="space-y-2">
            <Label htmlFor="language">프로그래밍 언어</Label>
            <Controller
              name="language"
              control={form.control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isLoading}
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder="언어 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        disabled={isStarter && option.value !== 'python'}
                      >
                        {option.label}
                        {isStarter && option.value !== 'python' && ' (Pro 전용)'}
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
            <Label htmlFor="topic">학습 주제</Label>
            <Input
              id="topic"
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
            <Label htmlFor="difficulty">난이도</Label>
            <Controller
              name="difficulty"
              control={form.control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isLoading}
                >
                  <SelectTrigger id="difficulty">
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
            <Label htmlFor="targetAudience">학습자 유형</Label>
            <Controller
              name="targetAudience"
              control={form.control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isLoading}
                >
                  <SelectTrigger id="targetAudience">
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
            className="w-full"
            disabled={isLoading || remainingGenerations <= 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                생성 중... (약 30초 소요)
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                콘텐츠 생성하기
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
