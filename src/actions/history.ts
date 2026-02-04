'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, getAuthUser, AuthError } from '@/lib/auth';
import type { GeneratedContent as GeneratedContentDB } from '@/types/database.types';
import { logError } from '@/lib/logger';

/**
 * 히스토리 필터 타입
 */
export interface HistoryFilters {
  language?: string;
  difficulty?: string;
}

/**
 * DB에서 가져온 콘텐츠 타입 (database.types.ts의 Row 타입 재사용)
 */
export type HistoryItem = GeneratedContentDB;

/**
 * 단일 콘텐츠 상세 조회
 */
export async function getContentById(
  id: string
): Promise<{ success: true; data: HistoryItem } | { success: false; error: string }> {
  try {
    const { user, supabase } = await requireAuth();

    const { data, error } = await supabase
      .from('generated_contents')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return { success: false, error: '콘텐츠를 찾을 수 없습니다.' };
    }

    return { success: true, data };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * 콘텐츠 삭제
 */
export async function deleteContent(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { user, supabase } = await requireAuth();

    const { error } = await supabase
      .from('generated_contents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, error: '삭제에 실패했습니다.' };
    }

    revalidatePath('/history');
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * 필터링된 히스토리 조회
 */
export async function getFilteredHistory(
  page = 1,
  limit = 10,
  filters?: HistoryFilters
): Promise<{
  contents: HistoryItem[];
  total: number;
  totalPages: number;
}> {
  const authResult = await getAuthUser();
  if (!authResult) {
    return { contents: [], total: 0, totalPages: 0 };
  }

  const { user, supabase } = authResult;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('generated_contents')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id);

  // 필터 적용
  if (filters?.language) {
    query = query.eq('language', filters.language);
  }
  if (filters?.difficulty) {
    query = query.eq('difficulty', filters.difficulty.toLowerCase());
  }

  const { data: contents, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logError('히스토리 조회 오류', error, {
      action: 'getFilteredHistory',
      userId: user.id,
      page,
      limit,
      filters,
    });
    return { contents: [], total: 0, totalPages: 0 };
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    contents: contents || [],
    total,
    totalPages,
  };
}
