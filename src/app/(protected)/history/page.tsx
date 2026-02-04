import { Suspense } from 'react';
import { History, FileText } from 'lucide-react';
import { getFilteredHistory, type HistoryFilters } from '@/actions/history';
import { HistoryList, HistoryFilters as Filters, Pagination } from '@/components/features/history';
import { Badge } from '@/components/ui/badge';

// 동적 페이지: 사용자별 히스토리 데이터 표시 (캐싱 비활성화)
export const revalidate = 0;

interface HistoryPageProps {
  searchParams: Promise<{
    page?: string;
    language?: string;
    difficulty?: string;
  }>;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const filters: HistoryFilters = {
    language: params.language,
    difficulty: params.difficulty,
  };

  const { contents, total, totalPages } = await getFilteredHistory(page, 10, filters);

  return (
    <div className="space-y-8">
      {/* 페이지 헤더 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-violet-500/10 p-8 border">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-gradient-to-br from-blue-500/20 to-transparent blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20">
              <History className="h-7 w-7 text-blue-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">생성 히스토리</h1>
                {total > 0 && (
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                    <FileText className="h-3 w-3 mr-1" />
                    {total}개
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                지금까지 생성한 코딩 교육 콘텐츠 목록
              </p>
            </div>
          </div>

          <Suspense fallback={<div className="h-10 w-[316px] animate-pulse rounded-xl bg-muted" />}>
            <Filters />
          </Suspense>
        </div>
      </div>

      {/* 콘텐츠 목록 */}
      <HistoryList items={contents} />

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <Suspense fallback={null}>
          <Pagination currentPage={page} totalPages={totalPages} total={total} />
        </Suspense>
      )}
    </div>
  );
}

export const metadata = {
  title: '생성 히스토리 | CodeGen AI',
  description: '생성한 코딩 교육 콘텐츠 목록을 확인하세요.',
};
