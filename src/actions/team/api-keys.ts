'use server';

/**
 * Team API Keys Actions
 * - API 키 생성
 * - API 키 목록 조회
 * - API 키 삭제
 */

import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { validateCSRFForAction } from '@/lib/csrf';
import {
  checkRateLimit,
  getClientIP,
  getRateLimitErrorMessage,
  RATE_LIMIT_PRESETS,
} from '@/lib/rate-limit';
import { logError } from '@/lib/logger';
import type { TeamApiKey } from '@/types/database.types';
import {
  type TeamActionResult,
  createApiKeySchema,
  deleteApiKeySchema,
  generateApiKey,
} from './types';
import { z } from 'zod';

// =====================================================
// API 키 생성
// =====================================================

export async function createTeamApiKey(
  input: z.infer<typeof createApiKeySchema>
): Promise<TeamActionResult<{ apiKey: TeamApiKey; key: string }>> {
  // 0. Rate Limiting
  const headersList = await headers();
  const clientIP = getClientIP(headersList);
  const rateLimitResult = await checkRateLimit(
    clientIP,
    'create_api_key',
    RATE_LIMIT_PRESETS.SUBSCRIPTION_CREATE // 분당 3회
  );

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: getRateLimitErrorMessage(rateLimitResult),
    };
  }

  // 1. 입력 검증
  const validated = createApiKeySchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: '입력값이 유효하지 않습니다.',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // CSRF 토큰 검증 (제공된 경우)
  if (validated.data._csrf) {
    const csrfResult = await validateCSRFForAction(validated.data._csrf);
    if (!csrfResult.success) {
      return { success: false, error: csrfResult.error };
    }
  }

  // 2. 사용자 인증 및 권한 확인
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: '로그인이 필요합니다.',
    };
  }

  // 3. 팀 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id, team_role')
    .eq('id', user.id)
    .single();

  if (!profile?.team_id) {
    return {
      success: false,
      error: '팀에 소속되어 있지 않습니다.',
    };
  }

  if (!['owner', 'admin'].includes(profile.team_role || '')) {
    return {
      success: false,
      error: 'API 키를 생성할 권한이 없습니다.',
    };
  }

  // 4. API 키 생성
  const { key, prefix, hash } = generateApiKey();

  const expiresAt = validated.data.expiresInDays
    ? new Date(Date.now() + validated.data.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data: apiKey, error: createError } = await supabase
    .from('team_api_keys')
    .insert({
      team_id: profile.team_id,
      name: validated.data.name,
      key_prefix: prefix,
      key_hash: hash,
      permissions: validated.data.permissions || ['content:generate'],
      created_by: user.id,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (createError || !apiKey) {
    logError('API 키 생성 오류', createError, {
      action: 'createTeamApiKey',
      userId: user.id,
      teamId: profile.team_id,
      keyName: validated.data.name,
    });
    return {
      success: false,
      error: 'API 키 생성 중 오류가 발생했습니다.',
    };
  }

  // 주의: key는 이 응답에서만 반환됨 (다시 조회 불가)
  return {
    success: true,
    data: {
      apiKey,
      key, // 전체 API 키 (한 번만 노출)
    },
  };
}

// =====================================================
// API 키 목록 조회
// =====================================================

export async function getTeamApiKeys(): Promise<TeamActionResult<TeamApiKey[]>> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: '로그인이 필요합니다.',
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id, team_role')
    .eq('id', user.id)
    .single();

  if (!profile?.team_id) {
    return {
      success: false,
      error: '팀에 소속되어 있지 않습니다.',
    };
  }

  if (!['owner', 'admin'].includes(profile.team_role || '')) {
    return {
      success: false,
      error: 'API 키를 조회할 권한이 없습니다.',
    };
  }

  const { data: apiKeys, error: queryError } = await supabase
    .from('team_api_keys')
    .select('*')
    .eq('team_id', profile.team_id)
    .order('created_at', { ascending: false });

  if (queryError) {
    logError('API 키 조회 오류', queryError, {
      action: 'getTeamApiKeys',
      userId: user.id,
      teamId: profile.team_id,
    });
    return {
      success: false,
      error: 'API 키 조회 중 오류가 발생했습니다.',
    };
  }

  return {
    success: true,
    data: apiKeys || [],
  };
}

// =====================================================
// API 키 삭제 (비활성화)
// =====================================================

export async function deleteTeamApiKey(
  input: z.infer<typeof deleteApiKeySchema>
): Promise<TeamActionResult<void>> {
  // 입력 검증
  const validated = deleteApiKeySchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: '유효한 API 키 ID가 필요합니다.',
    };
  }

  // CSRF 토큰 검증 (제공된 경우)
  if (validated.data._csrf) {
    const csrfResult = await validateCSRFForAction(validated.data._csrf);
    if (!csrfResult.success) {
      return { success: false, error: csrfResult.error };
    }
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: '로그인이 필요합니다.',
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id, team_role')
    .eq('id', user.id)
    .single();

  if (!profile?.team_id) {
    return {
      success: false,
      error: '팀에 소속되어 있지 않습니다.',
    };
  }

  if (!['owner', 'admin'].includes(profile.team_role || '')) {
    return {
      success: false,
      error: 'API 키를 삭제할 권한이 없습니다.',
    };
  }

  const { error: updateError } = await supabase
    .from('team_api_keys')
    .update({ is_active: false })
    .eq('id', validated.data.keyId)
    .eq('team_id', profile.team_id);

  if (updateError) {
    logError('API 키 삭제 오류', updateError, {
      action: 'deleteTeamApiKey',
      userId: user.id,
      teamId: profile.team_id,
      keyId: validated.data.keyId,
    });
    return {
      success: false,
      error: 'API 키 삭제 중 오류가 발생했습니다.',
    };
  }

  return {
    success: true,
    data: undefined,
  };
}
