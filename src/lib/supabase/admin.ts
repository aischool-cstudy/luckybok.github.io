import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { serverEnv } from '@/lib/env';

// 타입 별칭 - 타입 안전성을 위해 명시적으로 정의
type Tables = Database['public']['Tables'];
type TableName = keyof Tables;

// 관리자 클라이언트 생성 함수
// Service Role Key 사용 - RLS 우회, 서버 사이드에서만 사용
function createTypedAdminClient() {
  return createClient<Database>(
    serverEnv.SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// 싱글톤 클라이언트 (재사용을 위해)
let adminClientInstance: ReturnType<typeof createTypedAdminClient> | null = null;

/**
 * 관리자 Supabase 클라이언트 생성
 * Service Role Key를 사용하여 RLS를 우회합니다.
 * 서버 사이드에서만 사용하세요.
 */
export function createAdminClient() {
  if (!adminClientInstance) {
    adminClientInstance = createTypedAdminClient();
  }
  return adminClientInstance;
}

// 타입 헬퍼 - 테이블 Row 타입 추출
export type TableRow<T extends TableName> = Tables[T]['Row'];
export type TableInsert<T extends TableName> = Tables[T]['Insert'];
export type TableUpdate<T extends TableName> = Tables[T]['Update'];

// 편의를 위한 타입 별칭
export type AdminClient = ReturnType<typeof createTypedAdminClient>;
