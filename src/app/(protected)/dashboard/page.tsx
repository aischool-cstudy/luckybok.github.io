import type { Metadata } from 'next';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { Button } from '@/components/ui';

export const metadata: Metadata = {
  title: '대시보드',
  description: 'CodeGen AI 대시보드',
};

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 프로필 정보 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single();

  // 최근 생성 콘텐츠 조회
  const { data: recentContents } = await supabase
    .from('generated_contents')
    .select('id, title, language, topic, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(5);

  // 오늘 생성 횟수 조회
  const today = new Date().toISOString().split('T')[0];
  const { count: todayCount } = await supabase
    .from('generated_contents')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)
    .gte('created_at', `${today}T00:00:00`);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          안녕하세요, {profile?.name || user?.email?.split('@')[0]}님!
        </h1>
        <p className="text-muted-foreground mt-2">
          AI로 코딩 교육 콘텐츠를 생성해보세요.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>오늘 남은 생성 횟수</CardDescription>
            <CardTitle className="text-4xl">
              {profile?.daily_generations_remaining ?? 10}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              매일 자정에 초기화됩니다
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>오늘 생성한 콘텐츠</CardDescription>
            <CardTitle className="text-4xl">{todayCount ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              총 {recentContents?.length ?? 0}개의 최근 콘텐츠
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>현재 플랜</CardDescription>
            <CardTitle className="text-4xl capitalize">
              {profile?.plan || 'Free'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              무료 플랜 사용 중
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>빠른 시작</CardTitle>
            <CardDescription>
              새로운 코딩 교육 콘텐츠를 생성하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/generate">콘텐츠 생성하기</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 생성 콘텐츠</CardTitle>
            <CardDescription>
              최근에 생성한 콘텐츠 목록입니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentContents && recentContents.length > 0 ? (
              <ul className="space-y-2">
                {recentContents.map((content) => (
                  <li key={content.id}>
                    <Link
                      href={`/history/${content.id}`}
                      className="text-sm hover:underline"
                    >
                      {content.title || content.topic}
                    </Link>
                    <span className="text-xs text-muted-foreground ml-2">
                      {new Date(content.created_at!).toLocaleDateString('ko-KR')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                아직 생성한 콘텐츠가 없습니다.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
