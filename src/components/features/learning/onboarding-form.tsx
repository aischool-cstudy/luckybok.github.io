'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { ArrowRight, Loader2, Check, Code2, Target, Clock, User } from 'lucide-react';
import { saveOnboardingProfile } from '@/actions/learning/onboarding';
import { useToast } from '@/hooks/use-toast';

const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: '입문자', description: '프로그래밍을 처음 시작해요' },
  { value: 'intermediate', label: '중급자', description: '기본 문법은 알고 있어요' },
  { value: 'advanced', label: '숙련자', description: '실무 경험이 있어요' },
] as const;

const LEARNING_GOALS = [
  { id: 'career_change', label: '개발자 취업/이직' },
  { id: 'skill_improvement', label: '실무 역량 향상' },
  { id: 'automation', label: '업무 자동화' },
  { id: 'data_analysis', label: '데이터 분석' },
  { id: 'side_project', label: '사이드 프로젝트' },
  { id: 'hobby', label: '취미/교양' },
] as const;

const PROGRAMMING_LANGUAGES = [
  { id: 'python', label: 'Python', icon: '🐍' },
  { id: 'javascript', label: 'JavaScript', icon: '🌐' },
  { id: 'typescript', label: 'TypeScript', icon: '📘' },
  { id: 'java', label: 'Java', icon: '☕' },
  { id: 'sql', label: 'SQL', icon: '🗄️' },
  { id: 'go', label: 'Go', icon: '🔷' },
] as const;

const onboardingFormSchema = z.object({
  experience_level: z.enum(['beginner', 'intermediate', 'advanced'], {
    required_error: '경험 수준을 선택해주세요',
  }),
  learning_goals: z.array(z.string()).min(1, '최소 1개의 학습 목표를 선택해주세요'),
  preferred_languages: z
    .array(z.enum(['python', 'javascript', 'sql', 'java', 'typescript', 'go']))
    .min(1, '최소 1개의 프로그래밍 언어를 선택해주세요'),
  weekly_time_commitment: z.number().min(1).max(40),
  age: z.number().min(10, '나이는 10세 이상이어야 합니다').max(100, '나이는 100세 이하여야 합니다').optional(),
});

type OnboardingFormData = z.infer<typeof onboardingFormSchema>;

export function OnboardingForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState(0);

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingFormSchema),
    defaultValues: {
      experience_level: undefined,
      learning_goals: [],
      preferred_languages: [],
      weekly_time_commitment: 5,
      age: undefined,
    },
  });

  const steps = [
    { title: '나이', icon: User, field: 'age' },
    { title: '경험 수준', icon: Target, field: 'experience_level' },
    { title: '학습 목표', icon: Target, field: 'learning_goals' },
    { title: '프로그래밍 언어', icon: Code2, field: 'preferred_languages' },
    { title: '학습 시간', icon: Clock, field: 'weekly_time_commitment' },
  ];

  const handleNext = async () => {
    const currentField = steps[currentStep]?.field as keyof OnboardingFormData | undefined;
    if (!currentField) return;

    const isValid = await form.trigger(currentField);

    if (isValid) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = (data: OnboardingFormData) => {
    startTransition(async () => {
      const result = await saveOnboardingProfile({
        experience_level: data.experience_level,
        learning_goals: data.learning_goals,
        preferred_languages: data.preferred_languages,
        weekly_time_commitment: data.weekly_time_commitment,
        age: data.age,
      });

      if (result.success) {
        toast({
          title: '온보딩 완료!',
          description: '맞춤형 학습을 시작할 준비가 되었습니다.',
        });
        router.push('/dashboard');
      } else {
        toast({
          title: '오류 발생',
          description: result.error || '온보딩 저장에 실패했습니다.',
          variant: 'destructive',
        });
      }
    });
  };

  const weeklyHours = form.watch('weekly_time_commitment');

  return (
    <Card className="border-0 shadow-2xl bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center mb-4">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <div key={step.field} className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                    index < currentStep
                      ? 'border-primary bg-primary text-primary-foreground'
                      : index === currentStep
                      ? 'border-primary text-primary'
                      : 'border-muted text-muted-foreground'
                  }`}
                >
                  {index < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <StepIcon className="h-5 w-5" />
                  )}
                </div>
                <span className={`mt-2 text-xs ${index === currentStep ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
        <CardTitle className="text-xl">{steps[currentStep]?.title ?? ''}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 0: Age */}
            {currentStep === 0 && (
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>나이 (선택)</FormLabel>
                    <FormDescription>
                      나이를 입력하면 더 맞춤화된 학습 콘텐츠를 제공받을 수 있습니다.
                      입력한 나이는 영구적으로 저장되며 나중에 설정에서 변경할 수 있습니다.
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="예: 25"
                        min={10}
                        max={100}
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(value === '' ? undefined : parseInt(value, 10));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Step 1: Experience Level */}
            {currentStep === 1 && (
              <FormField
                control={form.control}
                name="experience_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>현재 프로그래밍 경험 수준을 선택해주세요</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="경험 수준 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXPERIENCE_LEVELS.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            <div className="flex flex-col">
                              <span className="font-medium">{level.label}</span>
                              <span className="text-xs text-muted-foreground">{level.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Step 2: Learning Goals */}
            {currentStep === 2 && (
              <FormField
                control={form.control}
                name="learning_goals"
                render={() => (
                  <FormItem>
                    <FormLabel>학습 목표를 선택해주세요 (복수 선택 가능)</FormLabel>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {LEARNING_GOALS.map((goal) => (
                        <FormField
                          key={goal.id}
                          control={form.control}
                          name="learning_goals"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={goal.id}
                                className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(goal.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, goal.id])
                                        : field.onChange(field.value?.filter((value) => value !== goal.id));
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="cursor-pointer font-normal">{goal.label}</FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Step 3: Programming Languages */}
            {currentStep === 3 && (
              <FormField
                control={form.control}
                name="preferred_languages"
                render={() => (
                  <FormItem>
                    <FormLabel>배우고 싶은 언어를 선택해주세요 (복수 선택 가능)</FormLabel>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {PROGRAMMING_LANGUAGES.map((lang) => (
                        <FormField
                          key={lang.id}
                          control={form.control}
                          name="preferred_languages"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={lang.id}
                                className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(lang.id as 'python' | 'javascript' | 'sql' | 'java' | 'typescript' | 'go')}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, lang.id])
                                        : field.onChange(field.value?.filter((value) => value !== lang.id));
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="cursor-pointer font-normal flex items-center gap-2">
                                  <span>{lang.icon}</span>
                                  <span>{lang.label}</span>
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Step 4: Weekly Time Commitment */}
            {currentStep === 4 && (
              <FormField
                control={form.control}
                name="weekly_time_commitment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>주당 학습 가능 시간</FormLabel>
                    <FormDescription>
                      일주일에 코딩 학습에 투자할 수 있는 시간을 알려주세요.
                    </FormDescription>
                    <FormControl>
                      <div className="space-y-4 pt-4">
                        <Slider
                          min={1}
                          max={40}
                          step={1}
                          value={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                          className="w-full"
                        />
                        <div className="text-center">
                          <span className="text-3xl font-bold text-primary">{weeklyHours}</span>
                          <span className="text-muted-foreground ml-2">시간 / 주</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>1시간</span>
                          <span>40시간</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0}
              >
                이전
              </Button>

              {currentStep < steps.length - 1 ? (
                <Button type="button" onClick={handleNext}>
                  다음
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      완료
                      <Check className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
