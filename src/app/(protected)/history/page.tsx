import { Suspense } from 'react';
import { History } from 'lucide-react';
import { getFilteredHistory, type HistoryFilters } from '@/actions/history';
import { HistoryList, HistoryFilters as Filters, Pagination } from '@/components/features/history';

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
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <History className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">생성 히스토리</h1>
            <p className="text-sm text-muted-foreground">
              지금까지 생성한 코딩 교육 콘텐츠 목록
            </p>
          </div>
        </div>

        <Suspense fallback={<div className="h-10 w-[316px] animate-pulse rounded-md bg-muted" />}>
          <Filters />
        </Suspense>
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
