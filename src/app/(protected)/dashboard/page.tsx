import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Sparkles,
  Zap,
  Clock,
  Crown,
  ArrowRight,
  FileText,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { Button } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// 동적 페이지: 사용자별 실시간 데이터 표시 (캐싱 비활성화)
export const revalidate = 0;

export const metadata: Metadata = {
  title: '대시보드',
  description: 'CodeGen AI 대시보드',
};

// 플랜별 테마
const PLAN_THEMES: Record<string, {
  gradient: string;
  iconColor: string;
  badgeColor: string;
}> = {
  starter: {
    gradient: 'from-slate-500 to-slate-600',
    iconColor: 'text-slate-500',
    badgeColor: 'bg-slate-500',
  },
  pro: {
    gradient: 'from-blue-500 to-indigo-500',
    iconColor: 'text-blue-500',
    badgeColor: 'bg-blue-500',
  },
  team: {
    gradient: 'from-purple-500 to-pink-500',
    iconColor: 'text-purple-500',
    badgeColor: 'bg-purple-500',
  },
  enterprise: {
    gradient: 'from-amber-500 to-orange-500',
    iconColor: 'text-amber-500',
    badgeColor: 'bg-amber-500',
  },
};

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // user가 없으면 로그인 페이지로 (레이아웃에서 처리되지만 안전장치)
  if (!user) {
    return null;
  }

  const today = new Date().toISOString().split('T')[0];

  // 프로필 조회 (없으면 생성)
  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // 프로필이 없으면 생성 (트리거 실패 대비)
  if (!profile) {
    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.name || user.email?.split('@')[0],
        plan: 'starter',
        daily_generations_remaining: 10,
        credits_balance: 0,
      })
      .select()
      .single();
    profile = newProfile;
  }

  // 병렬로 콘텐츠 데이터 조회
  const [recentContentsResult, todayCountResult] = await Promise.all([
    // 최근 생성 콘텐츠 조회
    supabase
      .from('generated_contents')
      .select('id, title, language, topic, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    // 오늘 생성 횟수 조회
    supabase
      .from('generated_contents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00`),
  ]);

  const recentContents = recentContentsResult.data;
  const todayCount = todayCountResult.count ?? 0;
  const currentPlan = profile?.plan || 'starter';
  const planTheme: { gradient: string; iconColor: string; badgeColor: string } = PLAN_THEMES[currentPlan] ?? {
    gradient: 'from-slate-500 to-slate-600',
    iconColor: 'text-slate-500',
    badgeColor: 'bg-slate-500',
  };
  const remainingGenerations = profile?.daily_generations_remaining ?? 10;

  return (
    <div className="space-y-8">
      {/* 환영 섹션 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 p-8 border">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3 mr-1" />
              AI 콘텐츠 생성기
            </Badge>
          </div>
          <h1 className="text-3xl font-bold">
            안녕하세요, {profile?.name || user?.email?.split('@')[0]}님! 👋
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            오늘도 AI와 함께 멋진 교육 콘텐츠를 만들어보세요
          </p>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* 남은 생성 횟수 */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                  <Zap className="h-4 w-4 text-green-500" />
                </div>
                오늘 남은 생성 횟수
              </CardDescription>
            </div>
            <CardTitle className={cn(
              'text-5xl font-bold',
              remainingGenerations <= 3 ? 'text-orange-500' : 'text-green-500'
            )}>
              {remainingGenerations}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              매일 자정에 초기화됩니다
            </div>
            {/* 프로그레스 바 */}
            <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  remainingGenerations <= 3
                    ? 'bg-orange-500'
                    : 'bg-gradient-to-r from-green-400 to-emerald-500'
                )}
                style={{ width: `${Math.min((remainingGenerations / 10) * 100, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* 오늘 생성 */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </div>
                오늘 생성한 콘텐츠
              </CardDescription>
            </div>
            <CardTitle className="text-5xl font-bold text-blue-500">
              {todayCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 기준
            </div>
          </CardContent>
        </Card>

        {/* 현재 플랜 */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
          <div className={cn(
            'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity',
            `${planTheme.gradient.replace('from-', 'from-').replace('to-', 'to-')}/5`
          )} />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-2">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  currentPlan === 'starter' ? 'bg-slate-500/10' : 'bg-gradient-to-br from-primary/10 to-purple-500/10'
                )}>
                  <Crown className={cn('h-4 w-4', planTheme.iconColor)} />
                </div>
                현재 플랜
              </CardDescription>
            </div>
            <CardTitle className={cn(
              'text-4xl font-bold capitalize',
              planTheme.iconColor
            )}>
              {currentPlan}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentPlan === 'starter' ? (
              <Link
                href="/payment/subscribe"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
              >
                Pro로 업그레이드
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : (
              <Badge variant="secondary" className={cn('text-xs', planTheme.badgeColor, 'text-white')}>
                프리미엄 사용 중
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 빠른 시작 */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>빠른 시작</CardTitle>
                <CardDescription>
                  새로운 코딩 교육 콘텐츠를 생성하세요
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">AI 기반 콘텐츠 생성</p>
                <p className="text-xs text-muted-foreground">Claude AI가 맞춤형 교육 자료를 생성합니다</p>
              </div>
            </div>
            <Button asChild className="w-full h-11 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25">
              <Link href="/generate" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                콘텐츠 생성하기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* 최근 생성 콘텐츠 */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10">
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle>최근 생성 콘텐츠</CardTitle>
                  <CardDescription>
                    최근에 생성한 콘텐츠 목록입니다
                  </CardDescription>
                </div>
              </div>
              {recentContents && recentContents.length > 0 && (
                <Link
                  href="/history"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  전체 보기
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recentContents && recentContents.length > 0 ? (
              <ul className="space-y-2">
                {recentContents.map((content, index) => (
                  <li key={content.id}>
                    <Link
                      href={`/history/${content.id}`}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group/item"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 text-blue-500 text-xs font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover/item:text-primary transition-colors">
                          {content.title || content.topic}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="capitalize">{content.language}</span>
                          <span>•</span>
                          <span>{new Date(content.created_at!).toLocaleDateString('ko-KR')}</span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-8">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  아직 생성한 콘텐츠가 없습니다
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/generate">첫 콘텐츠 만들기</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
