'use client';

/**
 * 결제 내역 필터 컴포넌트
 * - 결제 유형, 상태, 기간 필터
 * - 빠른 날짜 선택 (오늘, 이번 주, 이번 달, 최근 3개월)
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Calendar, Filter, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface PaymentHistoryFiltersProps {
  currentFilters: {
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  };
}

// 빠른 날짜 필터 옵션
type QuickDateFilter = 'today' | 'this_week' | 'this_month' | 'last_3_months' | 'custom' | null;

const QUICK_DATE_OPTIONS: { value: QuickDateFilter; label: string }[] = [
  { value: 'today', label: '오늘' },
  { value: 'this_week', label: '이번 주' },
  { value: 'this_month', label: '이번 달' },
  { value: 'last_3_months', label: '최근 3개월' },
];

// 날짜 범위 계산 함수
function getDateRange(filter: QuickDateFilter): { start: string; end: string } {
  const today = new Date();
  const formatDate = (d: Date): string => d.toISOString().split('T')[0] ?? '';

  switch (filter) {
    case 'today':
      return { start: formatDate(today), end: formatDate(today) };
    case 'this_week': {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      return { start: formatDate(startOfWeek), end: formatDate(today) };
    }
    case 'this_month': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: formatDate(startOfMonth), end: formatDate(today) };
    }
    case 'last_3_months': {
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      return { start: formatDate(threeMonthsAgo), end: formatDate(today) };
    }
    default:
      return { start: '', end: '' };
  }
}

// 현재 날짜 범위가 어떤 빠른 필터에 해당하는지 확인
function detectQuickFilter(startDate?: string, endDate?: string): QuickDateFilter {
  if (!startDate && !endDate) return null;

  for (const option of QUICK_DATE_OPTIONS) {
    const range = getDateRange(option.value);
    if (range.start === startDate && range.end === endDate) {
      return option.value;
    }
  }

  return 'custom';
}

export function PaymentHistoryFilters({ currentFilters }: PaymentHistoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [type, setType] = useState(currentFilters.type || 'all');
  const [status, setStatus] = useState(currentFilters.status || 'all');
  const [startDate, setStartDate] = useState(currentFilters.startDate || '');
  const [endDate, setEndDate] = useState(currentFilters.endDate || '');
  const [isExpanded, setIsExpanded] = useState(
    !!(currentFilters.type || currentFilters.status || currentFilters.startDate || currentFilters.endDate)
  );

  // 현재 선택된 빠른 날짜 필터 감지
  const activeQuickFilter = useMemo(
    () => detectQuickFilter(startDate, endDate),
    [startDate, endDate]
  );

  // 활성 필터 개수 계산
  const activeFilterCount = [
    type !== 'all' ? 1 : 0,
    status !== 'all' ? 1 : 0,
    startDate ? 1 : 0,
    endDate ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', '1'); // 필터 변경 시 첫 페이지로

    if (type !== 'all') params.set('type', type);
    if (status !== 'all') params.set('status', status);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    router.push(`/settings/payment-history?${params.toString()}`);
  }, [type, status, startDate, endDate, router]);

  const clearFilters = useCallback(() => {
    setType('all');
    setStatus('all');
    setStartDate('');
    setEndDate('');
    router.push('/settings/payment-history');
  }, [router]);

  // 빠른 날짜 필터 적용
  const applyQuickDateFilter = useCallback(
    (filter: QuickDateFilter) => {
      if (!filter || filter === 'custom') return;

      const range = getDateRange(filter);
      setStartDate(range.start);
      setEndDate(range.end);

      // 즉시 적용
      const params = new URLSearchParams();
      params.set('page', '1');
      if (type !== 'all') params.set('type', type);
      if (status !== 'all') params.set('status', status);
      params.set('startDate', range.start);
      params.set('endDate', range.end);

      router.push(`/settings/payment-history?${params.toString()}`);
    },
    [type, status, router]
  );

  return (
    <div className="space-y-4">
      {/* 필터 토글 버튼 */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          필터
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1 text-muted-foreground"
          >
            <X className="h-4 w-4" />
            필터 초기화
          </Button>
        )}
      </div>

      {/* 확장된 필터 패널 */}
      {isExpanded && (
        <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
          {/* 빠른 날짜 필터 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              빠른 선택
            </Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_DATE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={activeQuickFilter === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyQuickDateFilter(option.value)}
                  className="h-8"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 결제 유형 */}
            <div className="space-y-2">
              <Label htmlFor="type">결제 유형</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="subscription">구독 결제</SelectItem>
                  <SelectItem value="credit_purchase">크레딧 구매</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 결제 상태 */}
            <div className="space-y-2">
              <Label htmlFor="status">결제 상태</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                  <SelectItem value="refunded">환불</SelectItem>
                  <SelectItem value="failed">실패</SelectItem>
                  <SelectItem value="partial_refunded">부분 환불</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 시작일 */}
            <div className="space-y-2">
              <Label htmlFor="startDate">시작일</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* 종료일 */}
            <div className="space-y-2">
              <Label htmlFor="endDate">종료일</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* 적용 버튼 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              초기화
            </Button>
            <Button size="sm" onClick={applyFilters}>
              <Search className="h-4 w-4 mr-2" />
              적용
            </Button>
          </div>
        </div>
      )}

      {/* 활성 필터 태그 */}
      {activeFilterCount > 0 && !isExpanded && (
        <div className="flex flex-wrap gap-2">
          {type !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {type === 'subscription' ? '구독 결제' : '크레딧 구매'}
              <button
                onClick={() => {
                  setType('all');
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('type');
                  params.set('page', '1');
                  router.push(`/settings/payment-history?${params.toString()}`);
                }}
                className="ml-1 hover:bg-muted rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {status !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {status === 'completed' ? '완료' : status === 'refunded' ? '환불' : '실패'}
              <button
                onClick={() => {
                  setStatus('all');
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('status');
                  params.set('page', '1');
                  router.push(`/settings/payment-history?${params.toString()}`);
                }}
                className="ml-1 hover:bg-muted rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(startDate || endDate) && (
            <Badge variant="secondary" className="gap-1">
              {startDate && endDate
                ? `${startDate} ~ ${endDate}`
                : startDate
                  ? `${startDate} ~`
                  : `~ ${endDate}`}
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('startDate');
                  params.delete('endDate');
                  params.set('page', '1');
                  router.push(`/settings/payment-history?${params.toString()}`);
                }}
                className="ml-1 hover:bg-muted rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
