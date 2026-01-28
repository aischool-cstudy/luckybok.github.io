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
 */
export function useCreditBalance() {
  return useQuery({
    queryKey: creditKeys.balance(),
    queryFn: () => getCreditBalance(),
    staleTime: 10 * 1000, // 10초
    refetchOnWindowFocus: true,
  });
}

/**
 * 크레딧 히스토리 조회 훅
 */
export function useCreditHistory(page = 1, limit = 10) {
  return useQuery({
    queryKey: creditKeys.history(page, limit),
    queryFn: () => getCreditHistory(page, limit),
    staleTime: 30 * 1000, // 30초
  });
}

/**
 * 생성 가능 여부 조회 훅
 */
export function useGenerationAvailability() {
  return useQuery({
    queryKey: creditKeys.availability(),
    queryFn: () => checkGenerationAvailability(),
    staleTime: 10 * 1000, // 10초
    refetchOnWindowFocus: true,
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
