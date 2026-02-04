'use server';

/**
 * Team Core Actions
 * - 팀 생성
 * - 팀 정보 조회
 * - 팀 업데이트
 * - 팀 삭제
 */

import { headers } from 'next/headers';
import { requireAuth, AuthError } from '@/lib/auth';
import { validateCSRFForAction } from '@/lib/csrf';
import {
  checkRateLimit,
  getClientIP,
  getRateLimitErrorMessage,
  RATE_LIMIT_PRESETS,
} from '@/lib/rate-limit';
import { logError, logWarn } from '@/lib/logger';
import type {
  Team,
  TeamWithMembers,
} from '@/types/database.types';
import {
  type TeamActionResult,
  createTeamSchema,
  updateTeamSchema,
  deleteTeamSchema,
  generateSlug,
} from './types';
import { z } from 'zod';

// =====================================================
// 팀 생성
// =====================================================

export async function createTeam(
  input: z.infer<typeof createTeamSchema>
): Promise<TeamActionResult<Team>> {
  // 1. 입력 검증
  const validated = createTeamSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: '입력값이 유효하지 않습니다.',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // 2. 사용자 인증 확인
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

  // 3. 사용자 플랜 확인 (Team 이상만 팀 생성 가능)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, team_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return {
      success: false,
      error: '사용자 정보를 찾을 수 없습니다.',
    };
  }

  if (!['team', 'enterprise'].includes(profile.plan)) {
    return {
      success: false,
      error: '팀 생성은 Team 플랜 이상에서만 가능합니다.',
    };
  }

  if (profile.team_id) {
    return {
      success: false,
      error: '이미 팀에 소속되어 있습니다. 기존 팀을 탈퇴한 후 새 팀을 생성해주세요.',
    };
  }

  // 4. 팀 생성
  const slug = generateSlug(validated.data.name);

  const { data: team, error: createError } = await supabase
    .from('teams')
    .insert({
      name: validated.data.name,
      slug,
      description: validated.data.description || null,
      owner_id: user.id,
      max_members: 5, // Team 플랜 기본값
    })
    .select()
    .single();

  if (createError || !team) {
    logError('팀 생성 오류', createError, {
      action: 'createTeam',
      userId: user.id,
      teamName: validated.data.name,
    });
    return {
      success: false,
      error: '팀 생성 중 오류가 발생했습니다.',
    };
  }

  // 5. 팀 멤버로 owner 추가
  const { error: memberError } = await supabase.from('team_members').insert({
    team_id: team.id,
    user_id: user.id,
    role: 'owner',
    invited_by: user.id,
  });

  if (memberError) {
    logError('팀 멤버 추가 오류', memberError, {
      action: 'createTeam',
      userId: user.id,
      teamId: team.id,
    });
    // 롤백: 팀 삭제
    await supabase.from('teams').delete().eq('id', team.id);
    return {
      success: false,
      error: '팀 멤버 설정 중 오류가 발생했습니다.',
    };
  }

  return {
    success: true,
    data: team,
  };
}

// =====================================================
// 팀 정보 조회
// =====================================================

export async function getMyTeam(): Promise<TeamActionResult<TeamWithMembers | null>> {
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

  // 사용자의 팀 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single();

  if (!profile?.team_id) {
    return {
      success: true,
      data: null,
    };
  }

  // 팀 정보와 멤버 조회
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('id', profile.team_id)
    .single();

  if (teamError || !team) {
    return {
      success: false,
      error: '팀 정보를 찾을 수 없습니다.',
    };
  }

  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', team.id);

  if (membersError) {
    logWarn('팀 멤버 조회 오류', {
      action: 'getMyTeam',
      userId: user.id,
      teamId: profile.team_id,
      error: membersError,
    });
  }

  return {
    success: true,
    data: {
      ...team,
      members: members || [],
      memberCount: members?.length || 0,
    },
  };
}

// =====================================================
// 팀 정보 업데이트
// =====================================================

export async function updateTeam(
  input: z.infer<typeof updateTeamSchema>
): Promise<TeamActionResult<Team>> {
  const validated = updateTeamSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: '입력값이 유효하지 않습니다.',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

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

  if (profile.team_role !== 'owner') {
    return {
      success: false,
      error: '팀 정보를 수정할 권한이 없습니다.',
    };
  }

  const { data: team, error: updateError } = await supabase
    .from('teams')
    .update({
      ...(validated.data.name && { name: validated.data.name }),
      ...(validated.data.description !== undefined && { description: validated.data.description }),
    })
    .eq('id', profile.team_id)
    .select()
    .single();

  if (updateError || !team) {
    logError('팀 업데이트 오류', updateError, {
      action: 'updateTeam',
      userId: user.id,
      teamId: profile.team_id,
    });
    return {
      success: false,
      error: '팀 정보 수정 중 오류가 발생했습니다.',
    };
  }

  return {
    success: true,
    data: team,
  };
}

// =====================================================
// 팀 삭제 (Owner 전용)
// =====================================================

export async function deleteTeam(
  input: z.infer<typeof deleteTeamSchema>
): Promise<TeamActionResult<void>> {
  // 0. Rate Limiting (고위험 작업)
  const headersList = await headers();
  const clientIP = getClientIP(headersList);
  const rateLimitResult = await checkRateLimit(
    clientIP,
    'delete_team',
    RATE_LIMIT_PRESETS.SUBSCRIPTION_CREATE // 분당 3회
  );

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: getRateLimitErrorMessage(rateLimitResult),
    };
  }

  // 입력 검증
  const validated = deleteTeamSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: '"팀 삭제"를 정확히 입력해주세요.',
    };
  }

  // CSRF 토큰 검증 (제공된 경우)
  if (validated.data._csrf) {
    const csrfResult = await validateCSRFForAction(validated.data._csrf);
    if (!csrfResult.success) {
      return { success: false, error: csrfResult.error };
    }
  }

  // 1. 사용자 인증
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

  // 2. 팀 권한 확인 (owner만 가능)
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

  if (profile.team_role !== 'owner') {
    return {
      success: false,
      error: '팀 삭제는 소유자만 가능합니다.',
    };
  }

  const teamId = profile.team_id;

  // 3. 팀 초대 삭제 (pending 상태)
  const { error: invitationError } = await supabase
    .from('team_invitations')
    .delete()
    .eq('team_id', teamId);

  if (invitationError) {
    logWarn('팀 초대 삭제 오류', {
      action: 'deleteTeam',
      userId: user.id,
      teamId,
      error: invitationError,
    });
  }

  // 4. 팀 API 키 비활성화
  const { error: apiKeyError } = await supabase
    .from('team_api_keys')
    .update({ is_active: false })
    .eq('team_id', teamId);

  if (apiKeyError) {
    logWarn('API 키 비활성화 오류', {
      action: 'deleteTeam',
      userId: user.id,
      teamId,
      error: apiKeyError,
    });
  }

  // 5. 팀 멤버 삭제 (profiles의 team_id는 trigger로 자동 null 처리됨)
  const { error: memberError } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId);

  if (memberError) {
    logError('팀 멤버 삭제 오류', memberError, {
      action: 'deleteTeam',
      userId: user.id,
      teamId,
    });
    return {
      success: false,
      error: '팀 삭제 중 오류가 발생했습니다.',
    };
  }

  // 6. 팀 삭제
  const { error: teamDeleteError } = await supabase
    .from('teams')
    .delete()
    .eq('id', teamId);

  if (teamDeleteError) {
    logError('팀 삭제 오류', teamDeleteError, {
      action: 'deleteTeam',
      userId: user.id,
      teamId,
    });
    return {
      success: false,
      error: '팀 삭제 중 오류가 발생했습니다.',
    };
  }

  return {
    success: true,
    data: undefined,
  };
}
