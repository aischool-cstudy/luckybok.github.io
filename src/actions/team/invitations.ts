'use server';

/**
 * Team Invitations Actions
 * - 초대 목록 조회
 * - 초대 취소
 */

import { createServerClient } from '@/lib/supabase/server';
import { logError } from '@/lib/logger';
import type { TeamInvitation } from '@/types/database.types';
import { type TeamActionResult } from './types';

// =====================================================
// 팀 초대 목록 조회
// =====================================================

export async function getTeamInvitations(): Promise<TeamActionResult<TeamInvitation[]>> {
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
      error: '초대 목록을 조회할 권한이 없습니다.',
    };
  }

  const { data: invitations, error: queryError } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('team_id', profile.team_id)
    .order('created_at', { ascending: false });

  if (queryError) {
    logError('초대 목록 조회 오류', queryError, {
      action: 'getTeamInvitations',
      userId: user.id,
      teamId: profile.team_id,
    });
    return {
      success: false,
      error: '초대 목록 조회 중 오류가 발생했습니다.',
    };
  }

  return {
    success: true,
    data: invitations || [],
  };
}

// =====================================================
// 초대 취소
// =====================================================

export async function cancelTeamInvitation(invitationId: string): Promise<TeamActionResult<void>> {
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
      error: '초대를 취소할 권한이 없습니다.',
    };
  }

  const { error: deleteError } = await supabase
    .from('team_invitations')
    .delete()
    .eq('id', invitationId)
    .eq('team_id', profile.team_id)
    .eq('status', 'pending');

  if (deleteError) {
    logError('초대 취소 오류', deleteError, {
      action: 'cancelTeamInvitation',
      userId: user.id,
      teamId: profile.team_id,
      invitationId,
    });
    return {
      success: false,
      error: '초대 취소 중 오류가 발생했습니다.',
    };
  }

  return {
    success: true,
    data: undefined,
  };
}
