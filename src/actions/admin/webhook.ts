'use server';

/**
 * 웹훅 관리 액션 (관리자용)
 * - 실패한 웹훅 조회
 * - 웹훅 재처리
 */

import { requireAuth, AuthError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { logError } from '@/lib/logger';
import type { ActionResponse } from '@/types/payment.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabaseClient = ReturnType<typeof createAdminClient> & { from: (table: string) => any };

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────

interface FailedWebhook {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  error: string | null;
  retry_count: number;
  created_at: string;
  last_retry_at: string | null;
}

interface WebhookLog extends FailedWebhook {
  status: string;
  processed_at: string | null;
}

// ────────────────────────────────────────────────────────────
// 관리자 권한 확인
// ────────────────────────────────────────────────────────────

async function verifyAdminAccess(): Promise<{ success: true; userId: string } | { success: false; error: string }> {
  let user;
  let supabase;
  try {
    const authResult = await requireAuth();
    user = authResult.user;
    supabase = authResult.supabase;
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    throw error;
  }

  // 프로필에서 관리자 권한 확인 (team_role이 owner 또는 admin이거나, 별도 admin 플래그)
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, team_role')
    .eq('id', user.id)
    .single() as { data: { plan: string; team_role: string | null } | null };

  // 간단한 권한 체크: enterprise 플랜 또는 team owner/admin
  const isAdmin =
    profile?.plan === 'enterprise' ||
    profile?.team_role === 'owner' ||
    profile?.team_role === 'admin';

  if (!isAdmin) {
    return { success: false, error: '관리자 권한이 필요합니다' };
  }

  return { success: true, userId: user.id };
}

// ────────────────────────────────────────────────────────────
// 실패한 웹훅 목록 조회
// ────────────────────────────────────────────────────────────

export async function getFailedWebhooks(
  limit = 100,
  offset = 0
): Promise<ActionResponse<{ webhooks: FailedWebhook[]; total: number }>> {
  try {
    const authResult = await verifyAdminAccess();
    if (!authResult.success) {
      return { success: false, error: authResult.error };
    }

    const adminClient = createAdminClient() as UntypedSupabaseClient;

    // 실패한 웹훅 조회 (재시도 횟수 3회 미만)
    const { data: webhooks, error: queryError } = await adminClient
      .from('webhook_logs')
      .select('id, event_type, payload, error, retry_count, created_at, last_retry_at')
      .eq('status', 'failed')
      .lt('retry_count', 3)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1) as { data: FailedWebhook[] | null; error: unknown };

    if (queryError) {
      logError('실패 웹훅 조회 오류', queryError, { action: 'getFailedWebhooks' });
      return { success: false, error: '웹훅 조회에 실패했습니다' };
    }

    // 전체 개수 조회
    const { count, error: countError } = await adminClient
      .from('webhook_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .lt('retry_count', 3);

    if (countError) {
      logError('웹훅 개수 조회 오류', countError, { action: 'getFailedWebhooks' });
    }

    return {
      success: true,
      data: {
        webhooks: (webhooks as FailedWebhook[]) || [],
        total: count ?? 0,
      },
    };
  } catch (error) {
    logError('getFailedWebhooks 오류', error, { action: 'getFailedWebhooks' });
    return { success: false, error: '웹훅 조회 중 오류가 발생했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 웹훅 재처리
// ────────────────────────────────────────────────────────────

export async function reprocessWebhook(webhookId: string): Promise<ActionResponse<{ processed: boolean }>> {
  try {
    const authResult = await verifyAdminAccess();
    if (!authResult.success) {
      return { success: false, error: authResult.error };
    }

    const adminClient = createAdminClient() as UntypedSupabaseClient;

    // 웹훅 로그 조회
    const { data: webhook, error: fetchError } = await adminClient
      .from('webhook_logs')
      .select('*')
      .eq('id', webhookId)
      .single() as { data: WebhookLog | null; error: unknown };

    if (fetchError || !webhook) {
      return { success: false, error: '웹훅을 찾을 수 없습니다' };
    }

    // 재시도 횟수 확인
    if (webhook.retry_count >= 3) {
      return { success: false, error: '최대 재시도 횟수를 초과했습니다' };
    }

    // 재시도 횟수 증가 및 상태 변경
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (adminClient.from('webhook_logs') as any)
      .update({
        retry_count: webhook.retry_count + 1,
        last_retry_at: new Date().toISOString(),
        status: 'pending',
      })
      .eq('id', webhookId);

    if (updateError) {
      logError('웹훅 재시도 상태 변경 오류', updateError, { webhookId, action: 'reprocessWebhook' });
      return { success: false, error: '재시도 상태 변경에 실패했습니다' };
    }

    // 웹훅 재처리 실행
    try {
      const { handleWebhookReprocess } = await import('@/lib/payment/webhook-handler');
      const result = await handleWebhookReprocess(webhook.event_type, webhook.payload as Record<string, unknown>);

      if (result.success) {
        // 처리 완료 표시
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminClient.from('webhook_logs') as any)
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            error: null,
          })
          .eq('id', webhookId);

        return { success: true, data: { processed: true } };
      } else {
        // 처리 실패
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminClient.from('webhook_logs') as any)
          .update({
            status: 'failed',
            error: result.error,
          })
          .eq('id', webhookId);

        return { success: false, error: result.error || '재처리에 실패했습니다' };
      }
    } catch (processError) {
      // 처리 중 예외 발생
      const errorMessage = processError instanceof Error ? processError.message : '알 수 없는 오류';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient.from('webhook_logs') as any)
        .update({
          status: 'failed',
          error: errorMessage,
        })
        .eq('id', webhookId);

      return { success: false, error: errorMessage };
    }
  } catch (error) {
    logError('reprocessWebhook 오류', error, { action: 'reprocessWebhook' });
    return { success: false, error: '웹훅 재처리 중 오류가 발생했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 웹훅 통계 조회
// ────────────────────────────────────────────────────────────

export async function getWebhookStats(): Promise<
  ActionResponse<{
    total: number;
    processed: number;
    failed: number;
    pending: number;
  }>
> {
  try {
    const authResult = await verifyAdminAccess();
    if (!authResult.success) {
      return { success: false, error: authResult.error };
    }

    const adminClient = createAdminClient() as UntypedSupabaseClient;

    // 상태별 개수 조회
    const results = await Promise.all([
      adminClient.from('webhook_logs').select('*', { count: 'exact', head: true }),
      adminClient.from('webhook_logs').select('*', { count: 'exact', head: true }).eq('status', 'processed'),
      adminClient.from('webhook_logs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      adminClient.from('webhook_logs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ]) as Array<{ count: number | null }>;

    return {
      success: true,
      data: {
        total: results[0]?.count ?? 0,
        processed: results[1]?.count ?? 0,
        failed: results[2]?.count ?? 0,
        pending: results[3]?.count ?? 0,
      },
    };
  } catch (error) {
    logError('getWebhookStats 오류', error, { action: 'getWebhookStats' });
    return { success: false, error: '통계 조회 중 오류가 발생했습니다' };
  }
}
