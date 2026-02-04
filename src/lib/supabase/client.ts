import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';
import { clientEnv } from '@/lib/env';

export function createClient() {
  return createBrowserClient<Database>(
    clientEnv.SUPABASE_URL,
    clientEnv.SUPABASE_ANON_KEY
  );
}
