import { createServerClient as createClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types';
import { serverEnv } from '@/lib/env';

// 타입 별칭 - 명시적 타입 지정을 위해
export type ServerClient = SupabaseClient<Database>;

export async function createServerClient(): Promise<ServerClient> {
  const cookieStore = await cookies();

  return createClient<Database>(
    serverEnv.SUPABASE_URL,
    serverEnv.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component에서 쿠키 설정 시도 시 무시
            // Server Action이나 Route Handler에서만 쿠키 설정 가능
          }
        },
      },
    }
  );
}
