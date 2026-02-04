import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Brain, Code2, Timer, Target } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { LevelTestForm } from '@/components/features/learning/level-test-form';
import { Badge } from '@/components/ui';
import type { ProgrammingLanguage } from '@/types/database.types';

export const metadata: Metadata = {
  title: '레벨 테스트 | CodeGen AI',
  description: '현재 실력을 확인하고 맞춤형 학습 계획을 받아보세요.',
};

interface LevelTestPageProps {
  searchParams: Promise<{ language?: string }>;
}

const VALID_LANGUAGES: ProgrammingLanguage[] = [
  'python',
  'javascript',
  'sql',
  'java',
  'typescript',
  'go',
];

const LANGUAGE_THEMES: Record<string, { gradient: string; bg: string; text: string }> = {
  python: { gradient: 'from-blue-400 to-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  javascript: { gradient: 'from-yellow-400 to-orange-400', bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400' },
  typescript: { gradient: 'from-blue-400 to-indigo-500', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  sql: { gradient: 'from-orange-400 to-red-400', bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400' },
  java: { gradient: 'from-red-400 to-orange-500', bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
  go: { gradient: 'from-cyan-400 to-teal-400', bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400' },
};

export default async function LevelTestPage({ searchParams }: LevelTestPageProps) {
  const { language } = await searchParams;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 언어 파라미터 검증
  if (!language || !VALID_LANGUAGES.includes(language as ProgrammingLanguage)) {
    redirect('/onboarding');
  }

  // 온보딩이 완료되었는지 확인
  const { data: learnerProfile } = await supabase
    .from('learner_profiles')
    .select('onboarding_completed, preferred_languages')
    .eq('user_id', user.id)
    .single();

  if (!learnerProfile?.onboarding_completed) {
    redirect('/onboarding');
  }

  // RPC 함수로 문제 조회
  const { data: questions, error } = await supabase.rpc('get_level_test_questions', {
    p_language: language,
    p_questions_per_level: 5,
  });

  if (error || !questions || questions.length === 0) {
    // 문제가 없는 경우 대시보드로 이동
    redirect('/dashboard');
  }

  // 클라이언트에 전달할 데이터 (정답 제외)
  const clientQuestions = questions.map((q) => ({
    id: q.id,
    difficulty: q.difficulty as 'beginner' | 'intermediate' | 'advanced',
    question: q.question,
    code_snippet: q.code_snippet,
    options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options as string[],
    topic: q.topic,
    order_index: q.order_index,
  }));

  const langTheme = LANGUAGE_THEMES[language] ?? { gradient: 'from-blue-400 to-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' };

  return (
    <div className="min-h-screen p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className={`absolute inset-0 ${langTheme.bg} blur-xl rounded-full`} />
              <div className={`relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${langTheme.gradient} shadow-xl`}>
                <Code2 className="h-10 w-10 text-white" />
              </div>
            </div>
          </div>

          {/* Title */}
          <Badge className={`mb-4 ${langTheme.bg} ${langTheme.text} border-0`}>
            <Brain className="h-3 w-3 mr-1" />
            레벨 테스트
          </Badge>
          <h1 className="text-3xl font-bold mb-3">
            {language.charAt(0).toUpperCase() + language.slice(1)} 실력 테스트
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            현재 실력을 확인하고 맞춤형 학습 계획을 받아보세요.
          </p>

          {/* Test Info */}
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-sm">
              <Target className="h-4 w-4 text-primary" />
              {clientQuestions.length}문항
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-sm">
              <Timer className="h-4 w-4 text-primary" />
              약 10분 소요
            </div>
          </div>
        </div>

        <LevelTestForm
          language={language as ProgrammingLanguage}
          questions={clientQuestions}
        />
      </div>
    </div>
  );
}
