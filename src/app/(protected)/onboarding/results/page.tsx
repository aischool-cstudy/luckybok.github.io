import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Trophy, LayoutDashboard, BookOpen, ArrowRight, Clock, Target, CheckCircle2, Sparkles, Code2 } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ProgrammingLanguage, ExperienceLevel } from '@/types/database.types';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: '테스트 결과 | CodeGen AI',
  description: '레벨 테스트 결과를 확인하세요.',
};

interface ResultsPageProps {
  searchParams: Promise<{ test_id?: string }>;
}

const LEVEL_LABELS: Record<ExperienceLevel, { label: string; gradient: string; bg: string; text: string; description: string }> =
  {
    beginner: {
      label: '초급',
      gradient: 'from-green-400 to-emerald-500',
      bg: 'bg-green-500/10',
      text: 'text-green-600 dark:text-green-400',
      description: '기초부터 차근차근 배워나가요!',
    },
    intermediate: {
      label: '중급',
      gradient: 'from-blue-400 to-indigo-500',
      bg: 'bg-blue-500/10',
      text: 'text-blue-600 dark:text-blue-400',
      description: '기본기가 탄탄하시네요!',
    },
    advanced: {
      label: '고급',
      gradient: 'from-purple-400 to-pink-500',
      bg: 'bg-purple-500/10',
      text: 'text-purple-600 dark:text-purple-400',
      description: '실력이 출중하시네요!',
    },
  };

const LANGUAGE_LABELS: Record<ProgrammingLanguage, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  sql: 'SQL',
  java: 'Java',
  typescript: 'TypeScript',
  go: 'Go',
};

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const { test_id } = await searchParams;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  if (!test_id) {
    redirect('/dashboard');
  }

  // 테스트 결과 조회
  const { data: test, error } = await supabase
    .from('level_tests')
    .select('*')
    .eq('id', test_id)
    .eq('user_id', user.id)
    .single();

  if (error || !test) {
    redirect('/dashboard');
  }

  const level = test.determined_level as ExperienceLevel;
  const language = test.language as ProgrammingLanguage;
  const percentage = Math.round((test.score / test.total_questions) * 100);
  const levelInfo = LEVEL_LABELS[level];

  // 학습자 프로필의 다른 선호 언어 조회
  const { data: learnerProfile } = await supabase
    .from('learner_profiles')
    .select('preferred_languages')
    .eq('user_id', user.id)
    .single();

  const otherLanguages = (learnerProfile?.preferred_languages ?? []).filter(
    (l: string) => l !== language
  );

  // 해당 언어의 기존 테스트 여부 확인 (다른 언어들)
  const { data: existingTests } = await supabase
    .from('level_tests')
    .select('language')
    .eq('user_id', user.id);

  const testedLanguages = new Set<string>(existingTests?.map((t) => t.language) ?? []);
  const untestedLanguages = otherLanguages.filter((l: string) => !testedLanguages.has(l));

  return (
    <div className="min-h-screen p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
      <div className={cn("absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-3xl", levelInfo.bg)} />

      <div className="relative z-10 max-w-2xl mx-auto space-y-8 py-8">
        {/* Header */}
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className={cn("absolute inset-0 blur-xl rounded-full", levelInfo.bg)} />
              <div className={cn("relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br shadow-xl", levelInfo.gradient)}>
                <Trophy className="h-10 w-10 text-white" />
              </div>
            </div>
          </div>
          <Badge className="mb-4 bg-primary/10 text-primary border-0">
            <Sparkles className="h-3 w-3 mr-1" />
            테스트 완료
          </Badge>
          <h1 className="text-4xl font-bold mb-3">축하합니다!</h1>
          <p className="text-muted-foreground text-lg">
            {LANGUAGE_LABELS[language]} 레벨 테스트 결과입니다.
          </p>
        </div>

        {/* Result Card */}
        <Card className="overflow-hidden">
          <div className={cn("h-2 bg-gradient-to-r", levelInfo.gradient)} />
          <CardHeader className="text-center pb-4 pt-8">
            <CardDescription>측정된 레벨</CardDescription>
            <CardTitle className={cn("text-6xl font-bold mt-2 bg-gradient-to-r bg-clip-text text-transparent", levelInfo.gradient)}>
              {levelInfo.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6 pb-8">
            <div className={cn("inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium", levelInfo.bg, levelInfo.text)}>
              <CheckCircle2 className="h-4 w-4" />
              {levelInfo.description}
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-muted/50 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 mx-auto mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div className="text-3xl font-bold">{test.score}</div>
                <div className="text-xs text-muted-foreground">맞힌 문제</div>
              </div>
              <div className="p-4 rounded-2xl bg-muted/50 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 mx-auto mb-2">
                  <Target className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-3xl font-bold">{test.total_questions}</div>
                <div className="text-xs text-muted-foreground">전체 문제</div>
              </div>
              <div className="p-4 rounded-2xl bg-muted/50 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 mx-auto mb-2">
                  <Trophy className="h-5 w-5 text-purple-500" />
                </div>
                <div className="text-3xl font-bold">{percentage}%</div>
                <div className="text-xs text-muted-foreground">정답률</div>
              </div>
            </div>

            {test.time_taken_seconds && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
                <Clock className="h-4 w-4" />
                소요 시간: {Math.floor(test.time_taken_seconds / 60)}분{' '}
                {test.time_taken_seconds % 60}초
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild className="flex-1 h-12 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25">
            <Link href="/dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              대시보드로 이동
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1 h-12">
            <Link href={`/generate?language=${language}&level=${level}`} className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {LANGUAGE_LABELS[language]} 학습 시작
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Other Languages */}
        {untestedLanguages.length > 0 && (
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-orange-400 to-amber-400" />
            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                <Code2 className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-lg">다른 언어도 테스트해보세요</CardTitle>
                <CardDescription>선호 언어 중 아직 테스트하지 않은 언어가 있어요.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {untestedLanguages.map((lang: string) => (
                  <Button key={lang} asChild variant="outline" size="sm" className="rounded-full">
                    <Link href={`/onboarding/level-test?language=${lang}`} className="flex items-center gap-1">
                      {LANGUAGE_LABELS[lang as ProgrammingLanguage]} 테스트
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
