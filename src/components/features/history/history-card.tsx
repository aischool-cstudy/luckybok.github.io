'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Calendar, User, BarChart } from 'lucide-react';
import { DeleteButton } from './delete-button';
import type { HistoryItem } from '@/actions/history';
import {
  getLanguageLabel,
  getDifficultyLabel,
  getTargetAudienceLabel,
} from '@/lib/history-utils';

interface HistoryCardProps {
  item: HistoryItem;
}

export function HistoryCard({ item }: HistoryCardProps) {
  const formattedDate = new Date(item.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const difficultyColors: Record<string, string> = {
    beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  };

  const languageColors: Record<string, string> = {
    python: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    javascript: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    typescript: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    sql: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
    java: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    go: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100',
  };

  return (
    <Card className="group relative transition-shadow hover:shadow-md">
      <Link href={`/history/${item.id}`} className="block">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 text-base font-semibold group-hover:text-primary">
              {item.title || item.topic}
            </CardTitle>
            <div className="flex gap-1.5 shrink-0">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  languageColors[item.language] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {getLanguageLabel(item.language)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  difficultyColors[item.difficulty] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {getDifficultyLabel(item.difficulty)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
            {item.topic}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {getTargetAudienceLabel(item.target_audience)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formattedDate}
            </span>
            {item.generation_time_ms && (
              <span className="flex items-center gap-1">
                <BarChart className="h-3.5 w-3.5" />
                {(item.generation_time_ms / 1000).toFixed(1)}초 소요
              </span>
            )}
          </div>
        </CardContent>
      </Link>
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DeleteButton contentId={item.id} />
      </div>
    </Card>
  );
}
