'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCreditBalance, getCreditHistory, checkGenerationAvailability } from '@/actions/credits';

// Query Keys
export const creditKeys = {
  all: ['credits'] as const,
  balance: () => [...creditKeys.all, 'balance'] as const,
  history: (page: number, limit: number) => [...creditKeys.all, 'history', { page, limit }] as const,
  availability: () => [...creditKeys.all, 'availability'] as const,
};

/**
 * 크레딧 잔액 조회 훅
 * staleTime: 5분 - 크레딧 변경은 빈번하지 않음
 * refetchOnWindowFocus: false - 불필요한 API 요청 방지
 */
export function useCreditBalance() {
  return useQuery({
    queryKey: creditKeys.balance(),
    queryFn: () => getCreditBalance(),
    staleTime: 5 * 60 * 1000, // 5분
    refetchOnWindowFocus: false,
  });
}

/**
 * 크레딧 히스토리 조회 훅
 * staleTime: 5분 - 히스토리 데이터는 자주 변경되지 않음
 */
export function useCreditHistory(page = 1, limit = 10) {
  return useQuery({
    queryKey: creditKeys.history(page, limit),
    queryFn: () => getCreditHistory(page, limit),
    staleTime: 5 * 60 * 1000, // 5분
    refetchOnWindowFocus: false,
  });
}

/**
 * 생성 가능 여부 조회 훅
 * staleTime: 1분 - 생성 전 확인용이므로 적당한 캐싱
 * refetchOnWindowFocus: false - 실제 생성 시점에 서버에서 재확인
 */
export function useGenerationAvailability() {
  return useQuery({
    queryKey: creditKeys.availability(),
    queryFn: () => checkGenerationAvailability(),
    staleTime: 60 * 1000, // 1분
    refetchOnWindowFocus: false,
  });
}

/**
 * 크레딧 관련 쿼리 무효화 훅
 */
export function useInvalidateCredits() {
  const queryClient = useQueryClient();

  return {
    invalidateBalance: () => queryClient.invalidateQueries({ queryKey: creditKeys.balance() }),
    invalidateHistory: () => queryClient.invalidateQueries({ queryKey: creditKeys.all }),
    invalidateAvailability: () => queryClient.invalidateQueries({ queryKey: creditKeys.availability() }),
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: creditKeys.all }),
  };
}
