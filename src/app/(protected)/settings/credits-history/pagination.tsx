'use client';

/**
 * 크레딧 내역 페이지네이션 컴포넌트
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CreditHistoryPaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
}

export function CreditHistoryPagination({
  currentPage,
  totalPages,
  total,
}: CreditHistoryPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`/settings/credits-history?${params.toString()}`);
  };

  // 페이지 번호 배열 생성
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // 항상 첫 페이지
    pages.push(1);

    // 현재 페이지 주변
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) {
      pages.push('...');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 1) {
      pages.push('...');
    }

    // 항상 마지막 페이지
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        총 {total}건 중 {(currentPage - 1) * 20 + 1}-
        {Math.min(currentPage * 20, total)}건
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {getPageNumbers().map((page, index) => (
          <Button
            key={index}
            variant={page === currentPage ? 'default' : 'outline'}
            size="icon"
            onClick={() => typeof page === 'number' && handlePageChange(page)}
            disabled={typeof page !== 'number'}
            className={typeof page !== 'number' ? 'cursor-default' : ''}
          >
            {page}
          </Button>
        ))}

        <Button
          variant="outline"
          size="icon"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
