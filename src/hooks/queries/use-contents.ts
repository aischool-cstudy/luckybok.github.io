'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGenerationHistory, getRemainingGenerations, generateContent } from '@/actions/generate';
import type { GenerateContentInput, GeneratedContent } from '@/lib/ai/schemas';

// Query Keys
export const contentKeys = {
  all: ['contents'] as const,
  history: (page: number, limit: number) => [...contentKeys.all, 'history', { page, limit }] as const,
  detail: (id: string) => [...contentKeys.all, 'detail', id] as const,
  stats: ['stats'] as const,
  remaining: ['remaining'] as const,
};

/**
 * 생성 히스토리 조회 훅
 * staleTime: 5분 - 히스토리 데이터는 자주 변경되지 않음
 */
export function useGenerationHistory(page = 1, limit = 10) {
  return useQuery({
    queryKey: contentKeys.history(page, limit),
    queryFn: () => getGenerationHistory(page, limit),
    staleTime: 5 * 60 * 1000, // 5분
    refetchOnWindowFocus: false,
  });
}

/**
 * 남은 생성 횟수 조회 훅
 * staleTime: 1분 - 생성 전 확인용
 * refetchOnWindowFocus: false - mutation 성공 시 invalidate로 갱신
 */
export function useRemainingGenerations() {
  return useQuery({
    queryKey: contentKeys.remaining,
    queryFn: () => getRemainingGenerations(),
    staleTime: 60 * 1000, // 1분
    refetchOnWindowFocus: false,
  });
}

/**
 * 콘텐츠 생성 뮤테이션 훅
 */
export function useGenerateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GenerateContentInput) => generateContent(input),
    onSuccess: (result) => {
      if (result.success) {
        // 생성 히스토리 무효화
        queryClient.invalidateQueries({ queryKey: contentKeys.all });
        // 남은 횟수 무효화
        queryClient.invalidateQueries({ queryKey: contentKeys.remaining });
      }
    },
  });
}

/**
 * 콘텐츠 생성 결과 타입
 */
export type GenerateContentResult =
  | { success: true; data: GeneratedContent; contentId: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };
