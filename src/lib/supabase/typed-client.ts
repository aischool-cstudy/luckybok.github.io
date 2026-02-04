/**
 * 타입 안전한 Supabase 클라이언트 헬퍼
 *
 * @supabase/supabase-js v2.93+ 와 TypeScript 5.9+ 사이의 타입 추론 문제를 해결합니다.
 * 모든 테이블 작업에 명시적 타입을 적용하여 타입 안전성을 보장합니다.
 */

import type { SupabaseClient, PostgrestSingleResponse, PostgrestResponse } from '@supabase/supabase-js';
import type {
  Database,
  Profile,
  ProfileInsert,
  ProfileUpdate,
  Payment,
  PaymentInsert,
  PaymentUpdate,
  Subscription,
  SubscriptionInsert,
  SubscriptionUpdate,
  BillingKey,
  BillingKeyInsert,
  BillingKeyUpdate,
  CreditTransaction,
  CreditTransactionInsert,
  CreditTransactionUpdate,
  WebhookLog,
  WebhookLogInsert,
  WebhookLogUpdate,
  GeneratedContent,
  GeneratedContentInsert,
  GeneratedContentUpdate,
} from '@/types/database.types';

// 타입별 테이블 매핑
type TableTypes = {
  profiles: { Row: Profile; Insert: ProfileInsert; Update: ProfileUpdate };
  payments: { Row: Payment; Insert: PaymentInsert; Update: PaymentUpdate };
  subscriptions: { Row: Subscription; Insert: SubscriptionInsert; Update: SubscriptionUpdate };
  billing_keys: { Row: BillingKey; Insert: BillingKeyInsert; Update: BillingKeyUpdate };
  credit_transactions: { Row: CreditTransaction; Insert: CreditTransactionInsert; Update: CreditTransactionUpdate };
  webhook_logs: { Row: WebhookLog; Insert: WebhookLogInsert; Update: WebhookLogUpdate };
  generated_contents: { Row: GeneratedContent; Insert: GeneratedContentInsert; Update: GeneratedContentUpdate };
};

type TableName = keyof TableTypes;

/**
 * 타입 안전한 테이블 접근 헬퍼
 *
 * 사용 예시:
 * ```typescript
 * const client = createAdminClient();
 *
 * // SELECT
 * const { data } = await typedFrom(client, 'profiles').select('*').eq('id', userId);
 * // data는 Profile[] | null 타입으로 추론됨
 *
 * // INSERT
 * await typedInsert(client, 'payments', { user_id, order_id, ... });
 *
 * // UPDATE
 * await typedUpdate(client, 'subscriptions', { status: 'canceled' }, 'id', subId);
 * ```
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>;

/**
 * 테이블에서 SELECT 쿼리 빌더를 반환합니다.
 * 반환된 쿼리 빌더의 결과는 명시적 타입으로 캐스팅됩니다.
 */
export function typedFrom<T extends TableName>(
  client: AnySupabaseClient,
  table: T
) {
  return client.from(table) as unknown as {
    select: (columns?: string) => {
      eq: (column: string, value: unknown) => Promise<PostgrestResponse<TableTypes[T]['Row']>>;
      neq: (column: string, value: unknown) => Promise<PostgrestResponse<TableTypes[T]['Row']>>;
      single: () => Promise<PostgrestSingleResponse<TableTypes[T]['Row']>>;
      order: (column: string, options?: { ascending?: boolean }) => {
        limit: (count: number) => Promise<PostgrestResponse<TableTypes[T]['Row']>>;
      } & Promise<PostgrestResponse<TableTypes[T]['Row']>>;
      limit: (count: number) => Promise<PostgrestResponse<TableTypes[T]['Row']>>;
      range: (from: number, to: number) => Promise<PostgrestResponse<TableTypes[T]['Row']>>;
      then: (resolve: (value: PostgrestResponse<TableTypes[T]['Row']>) => void) => Promise<void>;
    };
    insert: (values: TableTypes[T]['Insert'] | TableTypes[T]['Insert'][]) => {
      select: (columns?: string) => {
        single: () => Promise<PostgrestSingleResponse<TableTypes[T]['Row']>>;
        then: (resolve: (value: PostgrestResponse<TableTypes[T]['Row']>) => void) => Promise<void>;
      };
      then: (resolve: (value: PostgrestResponse<null>) => void) => Promise<void>;
    };
    update: (values: TableTypes[T]['Update']) => {
      eq: (column: string, value: unknown) => {
        select: (columns?: string) => {
          single: () => Promise<PostgrestSingleResponse<TableTypes[T]['Row']>>;
          then: (resolve: (value: PostgrestResponse<TableTypes[T]['Row']>) => void) => Promise<void>;
        };
        then: (resolve: (value: PostgrestResponse<null>) => void) => Promise<void>;
      };
    };
    delete: () => {
      eq: (column: string, value: unknown) => Promise<PostgrestResponse<null>>;
    };
  };
}

/**
 * INSERT 작업을 수행합니다.
 */
export async function typedInsert<T extends TableName>(
  client: AnySupabaseClient,
  table: T,
  values: TableTypes[T]['Insert']
): Promise<PostgrestResponse<null>> {
  return client.from(table).insert(values as never) as unknown as Promise<PostgrestResponse<null>>;
}

/**
 * INSERT 후 데이터를 반환합니다.
 */
export async function typedInsertReturning<T extends TableName>(
  client: AnySupabaseClient,
  table: T,
  values: TableTypes[T]['Insert']
): Promise<PostgrestSingleResponse<TableTypes[T]['Row']>> {
  const result = await client.from(table).insert(values as never).select().single();
  return result as unknown as PostgrestSingleResponse<TableTypes[T]['Row']>;
}

/**
 * UPDATE 작업을 수행합니다.
 */
export async function typedUpdate<T extends TableName>(
  client: AnySupabaseClient,
  table: T,
  values: TableTypes[T]['Update'],
  column: string,
  value: unknown
): Promise<PostgrestResponse<null>> {
  return client.from(table).update(values as never).eq(column, value) as unknown as Promise<PostgrestResponse<null>>;
}

/**
 * SELECT * 후 단일 레코드를 반환합니다.
 */
export async function typedSelectSingle<T extends TableName>(
  client: AnySupabaseClient,
  table: T,
  column: string,
  value: unknown
): Promise<PostgrestSingleResponse<TableTypes[T]['Row']>> {
  const result = await client.from(table).select('*').eq(column, value).single();
  return result as unknown as PostgrestSingleResponse<TableTypes[T]['Row']>;
}

/**
 * SELECT * 후 여러 레코드를 반환합니다.
 */
export async function typedSelectMany<T extends TableName>(
  client: AnySupabaseClient,
  table: T,
  column?: string,
  value?: unknown
): Promise<PostgrestResponse<TableTypes[T]['Row']>> {
  const query = client.from(table).select('*');
  if (column && value !== undefined) {
    return (await query.eq(column, value)) as unknown as PostgrestResponse<TableTypes[T]['Row']>;
  }
  return (await query) as unknown as PostgrestResponse<TableTypes[T]['Row']>;
}

// RPC 함수 타입 정의
type RpcFunctions = Database['public']['Functions'];
type RpcFunctionName = keyof RpcFunctions;

/**
 * RPC 함수를 타입 안전하게 호출합니다.
 */
export async function typedRpc<T extends RpcFunctionName>(
  client: AnySupabaseClient,
  fn: T,
  args: RpcFunctions[T]['Args']
): Promise<PostgrestSingleResponse<RpcFunctions[T]['Returns']>> {
  const result = await client.rpc(fn as string, args as never);
  return result as unknown as PostgrestSingleResponse<RpcFunctions[T]['Returns']>;
}
