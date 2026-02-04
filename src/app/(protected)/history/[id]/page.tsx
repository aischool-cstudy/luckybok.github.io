import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Code, User, BarChart, Clock, Sparkles } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { getContentById } from '@/actions/history';
import {
  parseContentJson,
  getLanguageLabel,
  getDifficultyLabel,
  getTargetAudienceLabel,
} from '@/lib/history-utils';
import { ContentDisplay } from '@/components/features/generate';
import { DeleteButton, ExportPDFButton } from '@/components/features/history';
import { createServerClient } from '@/lib/supabase/server';
import type { Plan } from '@/types/domain.types';
import { cn } from '@/lib/utils';

// 동적 페이지: 사용자 권한 확인 필요 (캐싱 비활성화)
export const revalidate = 0;

// Next.js 16 cacheComponents 호환: 최소 1개의 플레이스홀더 필요
// 실제 콘텐츠는 런타임에 동적으로 생성됨
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

interface ContentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ContentDetailPage({ params }: ContentDetailPageProps) {
  const { id } = await params;
  const result = await getContentById(id);

  if (!result.success) {
    notFound();
  }

  // 플랜 정보 조회
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userPlan: Plan = 'starter';
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single();
    if (profile) {
      userPlan = profile.plan;
    }
  }

  const item = result.data;
  const content = parseContentJson(item.content);

  const formattedDate = new Date(item.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // 언어별 테마
  const langThemes: Record<string, { gradient: string; bg: string; text: string }> = {
    python: { gradient: 'from-blue-400 to-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
    javascript: { gradient: 'from-yellow-400 to-orange-400', bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400' },
    typescript: { gradient: 'from-blue-400 to-indigo-500', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
    sql: { gradient: 'from-orange-400 to-red-400', bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400' },
    java: { gradient: 'from-red-400 to-orange-500', bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
    go: { gradient: 'from-cyan-400 to-teal-400', bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400' },
  };
  const langTheme = langThemes[item.language] || { gradient: 'from-gray-400 to-gray-500', bg: 'bg-gray-500/10', text: 'text-gray-600' };

  return (
    <div className="space-y-6">
      {/* 네비게이션 */}
      <div className="flex items-center justify-between">
        <Link href="/history">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            목록으로
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <ExportPDFButton contentId={id} plan={userPlan} />
          <DeleteButton contentId={id} variant="full" redirectTo="/history" />
        </div>
      </div>

      {/* 메타 정보 */}
      <Card className="overflow-hidden">
        <div className={cn('h-1.5 bg-gradient-to-r', langTheme.gradient)} />
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', langTheme.bg)}>
                <Code className={cn('h-6 w-6', langTheme.text)} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{item.title || item.topic}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className={cn('text-xs', langTheme.bg, langTheme.text)}>
                    {getLanguageLabel(item.language)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {getDifficultyLabel(item.difficulty)}
                  </Badge>
                </div>
              </div>
            </div>
            <Badge variant="secondary" className="self-start sm:self-auto bg-green-500/10 text-green-600">
              <Sparkles className="h-3 w-3 mr-1" />
              AI 생성
            </Badge>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                <User className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">대상</p>
                <p className="text-sm font-medium">{getTargetAudienceLabel(item.target_audience)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
                <Calendar className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">생성일</p>
                <p className="text-sm font-medium">{formattedDate}</p>
              </div>
            </div>
            {item.generation_time_ms && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
                  <Clock className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">생성 시간</p>
                  <p className="text-sm font-medium">{(item.generation_time_ms / 1000).toFixed(1)}초</p>
                </div>
              </div>
            )}
            {item.tokens_used && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
                  <BarChart className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">토큰 사용</p>
                  <p className="text-sm font-medium">{item.tokens_used.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 콘텐츠 표시 */}
      {content ? (
        <ContentDisplay content={content} />
      ) : (
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-red-400 to-pink-400" />
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
              <Code className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-muted-foreground">
              콘텐츠를 표시할 수 없습니다. 데이터 형식이 올바르지 않습니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export async function generateMetadata({ params }: ContentDetailPageProps) {
  const { id } = await params;
  const result = await getContentById(id);

  if (!result.success) {
    return {
      title: '콘텐츠를 찾을 수 없음 | CodeGen AI',
    };
  }

  return {
    title: `${result.data.title || result.data.topic} | CodeGen AI`,
    description: `${result.data.topic} - ${getLanguageLabel(result.data.language)} ${getDifficultyLabel(result.data.difficulty)} 콘텐츠`,
  };
}
