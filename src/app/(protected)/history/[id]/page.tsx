import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Code, User, BarChart } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';
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

  return (
    <div className="space-y-6">
      {/* 네비게이션 */}
      <div className="flex items-center justify-between">
        <Link href="/history">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <ExportPDFButton contentId={id} plan={userPlan} />
          <DeleteButton contentId={id} variant="full" redirectTo="/history" />
        </div>
      </div>

      {/* 메타 정보 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">언어:</span>
              <span className="font-medium">{getLanguageLabel(item.language)}</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">난이도:</span>
              <span className="font-medium">{getDifficultyLabel(item.difficulty)}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">대상:</span>
              <span className="font-medium">{getTargetAudienceLabel(item.target_audience)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">생성일:</span>
              <span className="font-medium">{formattedDate}</span>
            </div>
            {item.generation_time_ms && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">생성 시간:</span>
                <span className="font-medium">
                  {(item.generation_time_ms / 1000).toFixed(1)}초
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 콘텐츠 표시 */}
      {content ? (
        <ContentDisplay content={content} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center">
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
