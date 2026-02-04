import { HistoryCard } from './history-card';
import type { HistoryItem } from '@/actions/history';
import { FileText, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui';

interface HistoryListProps {
  items: HistoryItem[];
}

export function HistoryList({ items }: HistoryListProps) {
  if (items.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-muted-foreground/20 p-16">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5" />
        <div className="relative flex flex-col items-center justify-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10">
            <FileText className="h-10 w-10 text-blue-500" />
          </div>
          <h3 className="mb-2 text-xl font-semibold">생성한 콘텐츠가 없습니다</h3>
          <p className="mb-8 text-muted-foreground max-w-sm">
            AI를 활용해 맞춤형 코딩 교육 콘텐츠를 생성해보세요!
          </p>
          <Link href="/generate">
            <Button size="lg" className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25">
              <Sparkles className="h-4 w-4 mr-2" />
              첫 콘텐츠 생성하기
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
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
