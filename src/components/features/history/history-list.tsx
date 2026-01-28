import { HistoryCard } from './history-card';
import type { HistoryItem } from '@/actions/history';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui';

interface HistoryListProps {
  items: HistoryItem[];
}

export function HistoryList({ items }: HistoryListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">생성한 콘텐츠가 없습니다</h3>
        <p className="mb-6 text-sm text-muted-foreground">
          새로운 코딩 교육 콘텐츠를 생성해보세요!
        </p>
        <Link href="/generate">
          <Button>콘텐츠 생성하기</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <HistoryCard key={item.id} item={item} />
      ))}
    </div>
  );
}
