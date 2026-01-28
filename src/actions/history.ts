'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import type { GeneratedContent as GeneratedContentDB } from '@/types/database.types';

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
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' };
  }

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
}

/**
 * 콘텐츠 삭제
 */
export async function deleteContent(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' };
  }

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
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { contents: [], total: 0, totalPages: 0 };
  }

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
    console.error('히스토리 조회 오류:', error);
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
