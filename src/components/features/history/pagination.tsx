'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
}

export function Pagination({ currentPage, totalPages, total }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (totalPages <= 1) {
    return null;
  }

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete('page');
    } else {
      params.set('page', page.toString());
    }
    router.push(`/history?${params.toString()}`);
  };

  // 페이지 번호 범위 계산 (현재 페이지 중심으로 최대 5개)
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();
  const firstPage = pageNumbers[0];
  const lastPage = pageNumbers[pageNumbers.length - 1];

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        총 <span className="font-medium">{total}</span>개의 콘텐츠
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          이전
        </Button>

        <div className="flex items-center gap-1 px-2">
          {firstPage !== undefined && firstPage > 1 && (
            <>
              <PageButton page={1} currentPage={currentPage} onClick={goToPage} />
              {firstPage > 2 && (
                <span className="px-2 text-muted-foreground">...</span>
              )}
            </>
          )}

          {pageNumbers.map((page) => (
            <PageButton
              key={page}
              page={page}
              currentPage={currentPage}
              onClick={goToPage}
            />
          ))}

          {lastPage !== undefined && lastPage < totalPages && (
            <>
              {lastPage < totalPages - 1 && (
                <span className="px-2 text-muted-foreground">...</span>
              )}
              <PageButton
                page={totalPages}
                currentPage={currentPage}
                onClick={goToPage}
              />
            </>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          다음
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface PageButtonProps {
  page: number;
  currentPage: number;
  onClick: (page: number) => void;
}

function PageButton({ page, currentPage, onClick }: PageButtonProps) {
  const isActive = page === currentPage;

  return (
    <button
      onClick={() => onClick(page)}
      className={`h-8 w-8 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
      }`}
    >
      {page}
    </button>
  );
}
