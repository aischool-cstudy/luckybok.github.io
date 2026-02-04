'use client';

import { memo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';
import { Calendar, User, BarChart, ArrowRight, Code } from 'lucide-react';
import { DeleteButton } from './delete-button';
import type { HistoryItem } from '@/actions/history';
import {
  getLanguageLabel,
  getDifficultyLabel,
  getTargetAudienceLabel,
} from '@/lib/history-utils';
import { cn } from '@/lib/utils';

interface HistoryCardProps {
  item: HistoryItem;
}

// 언어별 테마
const LANGUAGE_THEMES: Record<string, { gradient: string; bg: string; text: string }> = {
  python: { gradient: 'from-blue-400 to-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  javascript: { gradient: 'from-yellow-400 to-orange-400', bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400' },
  typescript: { gradient: 'from-blue-400 to-indigo-500', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  sql: { gradient: 'from-orange-400 to-red-400', bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400' },
  java: { gradient: 'from-red-400 to-orange-500', bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
  go: { gradient: 'from-cyan-400 to-teal-400', bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400' },
};

// 난이도별 테마
const DIFFICULTY_THEMES: Record<string, { bg: string; text: string; border: string }> = {
  beginner: { bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/20' },
  intermediate: { bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-500/20' },
  advanced: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20' },
};

export const HistoryCard = memo(function HistoryCard({ item }: HistoryCardProps) {
  const formattedDate = new Date(item.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const langTheme = LANGUAGE_THEMES[item.language] ?? { gradient: 'from-gray-400 to-gray-500', bg: 'bg-gray-500/10', text: 'text-gray-600' };
  const diffTheme = DIFFICULTY_THEMES[item.difficulty] ?? { bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/20' };

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
      {/* 상단 그라데이션 바 */}
      <div className={cn('h-1 bg-gradient-to-r', langTheme.gradient)} />

      <Link href={`/history/${item.id}`} className="block">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            {/* 언어 아이콘 */}
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', langTheme.bg)}>
              <Code className={cn('h-5 w-5', langTheme.text)} />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="line-clamp-2 text-base font-semibold group-hover:text-primary transition-colors">
                {item.title || item.topic}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="secondary" className={cn('text-xs', langTheme.bg, langTheme.text)}>
                  {getLanguageLabel(item.language)}
                </Badge>
                <Badge variant="outline" className={cn('text-xs border', diffTheme.bg, diffTheme.text, diffTheme.border)}>
                  {getDifficultyLabel(item.difficulty)}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
            {item.topic}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {getTargetAudienceLabel(item.target_audience)}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formattedDate}
            </span>
            {item.generation_time_ms && (
              <span className="flex items-center gap-1.5">
                <BarChart className="h-3.5 w-3.5" />
                {(item.generation_time_ms / 1000).toFixed(1)}초
              </span>
            )}
          </div>

          {/* 보기 링크 */}
          <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            자세히 보기
            <ArrowRight className="h-3 w-3" />
          </div>
        </CardContent>
      </Link>

      {/* 삭제 버튼 */}
      <div className="absolute right-3 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <DeleteButton contentId={item.id} />
      </div>
    </Card>
  );
});

HistoryCard.displayName = 'HistoryCard';
