import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Sparkles, Rocket, Target, BookOpen } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { OnboardingForm } from '@/components/features/learning/onboarding-form';
import { Badge } from '@/components/ui';

export const metadata: Metadata = {
  title: '시작하기 | CodeGen AI',
  description: '학습 목표와 경험 수준을 설정하고 맞춤형 학습을 시작하세요.',
};

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 이미 온보딩을 완료했는지 확인
  const { data: learnerProfile } = await supabase
    .from('learner_profiles')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .single();

  if (learnerProfile?.onboarding_completed) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-2xl">
        <div className="text-center mb-10">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-purple-600 shadow-xl shadow-primary/30">
                <Rocket className="h-10 w-10 text-white" />
              </div>
            </div>
          </div>

          {/* Title */}
          <Badge className="mb-4 bg-primary/10 text-primary border-0">
            <Sparkles className="h-3 w-3 mr-1" />
            첫 번째 단계
          </Badge>
          <h1 className="text-4xl font-bold mb-3">
            환영합니다!
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            맞춤형 학습 경험을 위해 몇 가지 질문에 답해주세요.
          </p>

          {/* Features */}
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-sm text-blue-600 dark:text-blue-400">
              <Target className="h-4 w-4" />
              맞춤형 학습 목표
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 text-sm text-purple-600 dark:text-purple-400">
              <BookOpen className="h-4 w-4" />
              개인화된 콘텐츠
            </div>
          </div>
        </div>

        <OnboardingForm />
      </div>
    </div>
  );
}
