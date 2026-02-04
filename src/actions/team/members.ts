'use server';

/**
 * Team Members Actions
 * - 팀 멤버 목록 조회
 * - 팀 멤버 초대
 * - 초대 수락
 * - 팀 탈퇴
 * - 멤버 역할 변경
 * - 멤버 제거
 */

import { requireAuth, AuthError } from '@/lib/auth';
import { validateCSRFForAction } from '@/lib/csrf';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { sendTeamInvitationEmail } from '@/lib/email';
import type {
  TeamMember,
  TeamInvitation,
  TeamMemberWithProfile,
} from '@/types/database.types';
import {
  type TeamActionResult,
  inviteTeamMemberSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
} from './types';
import { z } from 'zod';

// =====================================================
// 팀 멤버 목록 조회
// =====================================================

export async function getTeamMembers(): Promise<TeamActionResult<TeamMemberWithProfile[]>> {
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

  // 사용자의 팀 ID 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single();

  if (!profile?.team_id) {
    return {
      success: false,
      error: '팀에 소속되어 있지 않습니다.',
    };
  }

  // 팀 멤버와 프로필 정보 조회
  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select(`
      *,
      profile:profiles(id, email, name)
    `)
    .eq('team_id', profile.team_id)
    .order('role', { ascending: true });

  if (membersError) {
    logError('팀 멤버 조회 오류', membersError, {
      action: 'getTeamMembers',
      userId: user.id,
      teamId: profile.team_id,
    });
    return {
      success: false,
      error: '팀 멤버 조회 중 오류가 발생했습니다.',
    };
  }

  const result = (members || []).map((member: {
    id: string;
    team_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'member';
    joined_at: string;
    invited_by: string | null;
    created_at: string;
    updated_at: string;
    profile: unknown;
  }) => ({
    ...member,
    profile: member.profile as TeamMemberWithProfile['profile'],
  }));

  return {
    success: true,
    data: result,
  };
}

// =====================================================
// 팀 멤버 초대
// =====================================================

export async function inviteTeamMember(
  input: z.infer<typeof inviteTeamMemberSchema>
): Promise<TeamActionResult<TeamInvitation>> {
  // 1. 입력 검증
  const validated = inviteTeamMemberSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: '입력값이 유효하지 않습니다.',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // 2. 사용자 인증 및 권한 확인
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

  // 3. 팀 권한 확인 (owner 또는 admin만 초대 가능)
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, team_id, team_role')
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
      error: '팀 멤버를 초대할 권한이 없습니다.',
    };
  }

  // 4. 팀 멤버 수 제한 확인
  const { data: team } = await supabase
    .from('teams')
    .select('name, max_members')
    .eq('id', profile.team_id)
    .single();

  const { count: memberCount } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', profile.team_id);

  const { count: pendingCount } = await supabase
    .from('team_invitations')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', profile.team_id)
    .eq('status', 'pending');

  const totalCount = (memberCount || 0) + (pendingCount || 0);

  if (team && totalCount >= team.max_members) {
    return {
      success: false,
      error: `팀 멤버 수가 최대 한도(${team.max_members}명)에 도달했습니다.`,
    };
  }

  // 5. 이미 멤버인지 확인
  const { data: existingMember } = await supabase
    .from('profiles')
    .select('id, team_id')
    .eq('email', validated.data.email)
    .single();

  if (existingMember?.team_id === profile.team_id) {
    return {
      success: false,
      error: '이미 팀 멤버입니다.',
    };
  }

  // 6. 이미 초대된 이메일인지 확인
  const { data: existingInvitation } = await supabase
    .from('team_invitations')
    .select('id')
    .eq('team_id', profile.team_id)
    .eq('email', validated.data.email)
    .eq('status', 'pending')
    .single();

  if (existingInvitation) {
    return {
      success: false,
      error: '이미 초대가 발송된 이메일입니다.',
    };
  }

  // 7. 초대 생성
  const { data: invitation, error: inviteError } = await supabase
    .from('team_invitations')
    .insert({
      team_id: profile.team_id,
      email: validated.data.email,
      role: validated.data.role,
      invited_by: user.id,
    })
    .select()
    .single();

  if (inviteError || !invitation) {
    logError('팀 초대 생성 오류', inviteError, {
      action: 'inviteTeamMember',
      userId: user.id,
      teamId: profile.team_id,
      invitedEmail: validated.data.email,
    });
    return {
      success: false,
      error: '초대 발송 중 오류가 발생했습니다.',
    };
  }

  // 8. 초대 이메일 발송
  const emailResult = await sendTeamInvitationEmail({
    to: validated.data.email,
    inviterName: profile.name || user.email || '팀 관리자',
    teamName: team?.name || '팀',
    invitationToken: invitation.token,
    expiresAt: invitation.expires_at,
  });

  if (!emailResult.success) {
    logWarn('팀 초대 이메일 발송 실패', {
      action: 'inviteTeamMember',
      userId: user.id,
      teamId: profile.team_id,
      invitedEmail: validated.data.email,
      error: emailResult.error,
    });
    // 이메일 발송 실패해도 초대는 생성됨 (수동으로 링크 공유 가능)
  } else {
    logInfo('팀 초대 이메일 발송 성공', {
      action: 'inviteTeamMember',
      userId: user.id,
      teamId: profile.team_id,
      invitedEmail: validated.data.email,
    });
  }

  return {
    success: true,
    data: invitation,
  };
}

// =====================================================
// 초대 수락
// =====================================================

export async function acceptTeamInvitation(
  token: string
): Promise<TeamActionResult<TeamMember>> {
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

  // 1. 사용자 이메일 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, team_id')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return {
      success: false,
      error: '사용자 정보를 찾을 수 없습니다.',
    };
  }

  if (profile.team_id) {
    return {
      success: false,
      error: '이미 팀에 소속되어 있습니다. 기존 팀을 탈퇴한 후 초대를 수락해주세요.',
    };
  }

  // 2. 초대 조회
  const { data: invitation, error: invitationError } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .single();

  if (invitationError || !invitation) {
    return {
      success: false,
      error: '유효하지 않거나 만료된 초대입니다.',
    };
  }

  // 3. 이메일 일치 확인
  if (invitation.email.toLowerCase() !== profile.email.toLowerCase()) {
    return {
      success: false,
      error: '이 초대는 다른 이메일 주소로 발송되었습니다.',
    };
  }

  // 4. 만료 확인
  if (new Date(invitation.expires_at) < new Date()) {
    await supabase
      .from('team_invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id);

    return {
      success: false,
      error: '초대가 만료되었습니다. 새로운 초대를 요청해주세요.',
    };
  }

  // 5. 팀 멤버로 추가
  const { data: member, error: memberError } = await supabase
    .from('team_members')
    .insert({
      team_id: invitation.team_id,
      user_id: user.id,
      role: invitation.role,
      invited_by: invitation.invited_by,
    })
    .select()
    .single();

  if (memberError || !member) {
    logError('팀 멤버 추가 오류', memberError, {
      action: 'acceptTeamInvitation',
      userId: user.id,
      teamId: invitation.team_id,
    });
    return {
      success: false,
      error: '팀 가입 중 오류가 발생했습니다.',
    };
  }

  // 6. 초대 상태 업데이트
  await supabase
    .from('team_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by: user.id,
    })
    .eq('id', invitation.id);

  return {
    success: true,
    data: member,
  };
}

// =====================================================
// 팀 탈퇴
// =====================================================

export async function leaveTeam(): Promise<TeamActionResult<void>> {
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

  // 1. 팀 멤버 정보 조회
  const { data: membership } = await supabase
    .from('team_members')
    .select('id, team_id, role')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return {
      success: false,
      error: '팀에 소속되어 있지 않습니다.',
    };
  }

  // 2. owner는 탈퇴 불가 (팀 삭제 또는 양도 필요)
  if (membership.role === 'owner') {
    return {
      success: false,
      error: '팀 소유자는 탈퇴할 수 없습니다. 팀을 삭제하거나 소유권을 이전해주세요.',
    };
  }

  // 3. 팀 멤버에서 제거
  const { error: deleteError } = await supabase
    .from('team_members')
    .delete()
    .eq('id', membership.id);

  if (deleteError) {
    logError('팀 탈퇴 오류', deleteError, {
      action: 'leaveTeam',
      userId: user.id,
      membershipId: membership.id,
    });
    return {
      success: false,
      error: '팀 탈퇴 중 오류가 발생했습니다.',
    };
  }

  return {
    success: true,
    data: undefined,
  };
}

// =====================================================
// 팀 멤버 역할 변경 (Owner/Admin 전용)
// =====================================================

export async function updateTeamMemberRole(
  input: z.infer<typeof updateMemberRoleSchema>
): Promise<TeamActionResult<TeamMember>> {
  // 1. 입력 검증
  const validated = updateMemberRoleSchema.safeParse(input);
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

  // 2. 사용자 인증
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

  // 3. 팀 권한 확인 (owner 또는 admin만 가능)
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
      error: '멤버 역할을 변경할 권한이 없습니다.',
    };
  }

  // 4. 대상 멤버 조회
  const { data: targetMember, error: memberError } = await supabase
    .from('team_members')
    .select('*')
    .eq('id', validated.data.memberId)
    .eq('team_id', profile.team_id)
    .single();

  if (memberError || !targetMember) {
    return {
      success: false,
      error: '해당 멤버를 찾을 수 없습니다.',
    };
  }

  // 5. owner 역할은 변경 불가
  if (targetMember.role === 'owner') {
    return {
      success: false,
      error: '팀 소유자의 역할은 변경할 수 없습니다.',
    };
  }

  // 6. admin이 다른 admin의 역할을 변경하려는 경우 차단
  if (profile.team_role === 'admin' && targetMember.role === 'admin') {
    return {
      success: false,
      error: '관리자는 다른 관리자의 역할을 변경할 수 없습니다.',
    };
  }

  // 7. 역할 업데이트
  const { data: updatedMember, error: updateError } = await supabase
    .from('team_members')
    .update({ role: validated.data.newRole })
    .eq('id', validated.data.memberId)
    .select()
    .single();

  if (updateError || !updatedMember) {
    logError('멤버 역할 변경 오류', updateError, {
      action: 'updateTeamMemberRole',
      userId: user.id,
      teamId: profile.team_id,
      targetMemberId: validated.data.memberId,
    });
    return {
      success: false,
      error: '멤버 역할 변경 중 오류가 발생했습니다.',
    };
  }

  return {
    success: true,
    data: updatedMember,
  };
}

// =====================================================
// 팀 멤버 강제 제거 (Owner/Admin 전용)
// =====================================================

export async function removeTeamMember(
  input: z.infer<typeof removeMemberSchema>
): Promise<TeamActionResult<void>> {
  // 1. 입력 검증
  const validated = removeMemberSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: '유효한 멤버 ID가 필요합니다.',
    };
  }

  // CSRF 토큰 검증 (제공된 경우)
  if (validated.data._csrf) {
    const csrfResult = await validateCSRFForAction(validated.data._csrf);
    if (!csrfResult.success) {
      return { success: false, error: csrfResult.error };
    }
  }

  const memberId = validated.data.memberId;

  // 2. 사용자 인증
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

  // 3. 팀 권한 확인 (owner 또는 admin만 가능)
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
      error: '멤버를 제거할 권한이 없습니다.',
    };
  }

  // 4. 대상 멤버 조회
  const { data: targetMember, error: memberError } = await supabase
    .from('team_members')
    .select('*')
    .eq('id', memberId)
    .eq('team_id', profile.team_id)
    .single();

  if (memberError || !targetMember) {
    return {
      success: false,
      error: '해당 멤버를 찾을 수 없습니다.',
    };
  }

  // 5. 자기 자신은 제거 불가 (leaveTeam 사용)
  if (targetMember.user_id === user.id) {
    return {
      success: false,
      error: '자기 자신은 제거할 수 없습니다. 팀 탈퇴 기능을 사용해주세요.',
    };
  }

  // 6. owner는 제거 불가
  if (targetMember.role === 'owner') {
    return {
      success: false,
      error: '팀 소유자는 제거할 수 없습니다.',
    };
  }

  // 7. admin이 다른 admin을 제거하려는 경우 차단
  if (profile.team_role === 'admin' && targetMember.role === 'admin') {
    return {
      success: false,
      error: '관리자는 다른 관리자를 제거할 수 없습니다.',
    };
  }

  // 8. 멤버 제거
  const { error: deleteError } = await supabase
    .from('team_members')
    .delete()
    .eq('id', memberId);

  if (deleteError) {
    logError('멤버 제거 오류', deleteError, {
      action: 'removeTeamMember',
      userId: user.id,
      teamId: profile.team_id,
      memberId,
    });
    return {
      success: false,
      error: '멤버 제거 중 오류가 발생했습니다.',
    };
  }

  return {
    success: true,
    data: undefined,
  };
}
