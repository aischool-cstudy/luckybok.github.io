'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';

const LANGUAGES = [
  { value: 'all', label: '모든 언어' },
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'sql', label: 'SQL' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
];

const DIFFICULTIES = [
  { value: 'all', label: '모든 난이도' },
  { value: 'beginner', label: '입문' },
  { value: 'intermediate', label: '중급' },
  { value: 'advanced', label: '고급' },
];

export function HistoryFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentLanguage = searchParams.get('language') || 'all';
  const currentDifficulty = searchParams.get('difficulty') || 'all';

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    // 필터 변경 시 페이지 1로 리셋
    params.delete('page');

    router.push(`/history?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-3">
      <Select
        value={currentLanguage}
        onValueChange={(value) => updateFilter('language', value)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="언어 선택" />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((lang) => (
            <SelectItem key={lang.value} value={lang.value}>
              {lang.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentDifficulty}
        onValueChange={(value) => updateFilter('difficulty', value)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="난이도 선택" />
        </SelectTrigger>
        <SelectContent>
          {DIFFICULTIES.map((diff) => (
            <SelectItem key={diff.value} value={diff.value}>
              {diff.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
