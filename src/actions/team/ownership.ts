'use server';

/**
 * Team Ownership Actions
 * - 소유권 양도
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
import {
  type TeamActionResult,
  transferOwnershipSchema,
} from './types';
import { z } from 'zod';

// =====================================================
// 팀 소유권 양도 (Owner 전용)
// =====================================================

export async function transferTeamOwnership(
  input: z.infer<typeof transferOwnershipSchema>
): Promise<TeamActionResult<void>> {
  // 0. Rate Limiting (고위험 작업)
  const headersList = await headers();
  const clientIP = getClientIP(headersList);
  const rateLimitResult = await checkRateLimit(
    clientIP,
    'transfer_ownership',
    RATE_LIMIT_PRESETS.SUBSCRIPTION_CREATE // 분당 3회
  );

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: getRateLimitErrorMessage(rateLimitResult),
    };
  }

  // 1. 입력 검증
  const validated = transferOwnershipSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: '유효한 사용자 ID가 필요합니다.',
    };
  }

  // CSRF 토큰 검증 (제공된 경우)
  if (validated.data._csrf) {
    const csrfResult = await validateCSRFForAction(validated.data._csrf);
    if (!csrfResult.success) {
      return { success: false, error: csrfResult.error };
    }
  }

  const newOwnerId = validated.data.newOwnerId;

  // 2. 사용자 인증
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

  // 3. 팀 권한 확인 (owner만 가능)
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
      error: '팀 소유권 양도는 소유자만 가능합니다.',
    };
  }

  // 4. 자기 자신에게는 양도 불가
  if (newOwnerId === user.id) {
    return {
      success: false,
      error: '자기 자신에게 소유권을 양도할 수 없습니다.',
    };
  }

  // 5. 새 소유자가 팀 멤버인지 확인
  const { data: newOwnerMember, error: memberError } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', newOwnerId)
    .eq('team_id', profile.team_id)
    .single();

  if (memberError || !newOwnerMember) {
    return {
      success: false,
      error: '해당 사용자는 팀 멤버가 아닙니다.',
    };
  }

  // 6. 현재 owner의 멤버십 조회
  const { data: currentOwnerMember } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('team_id', profile.team_id)
    .single();

  if (!currentOwnerMember) {
    return {
      success: false,
      error: '현재 소유자 정보를 찾을 수 없습니다.',
    };
  }

  // 7. 트랜잭션으로 소유권 양도 (두 멤버의 역할 변경 + 팀 owner_id 변경)
  // 새 소유자 역할 변경
  const { error: newOwnerError } = await supabase
    .from('team_members')
    .update({ role: 'owner' })
    .eq('id', newOwnerMember.id);

  if (newOwnerError) {
    logError('새 소유자 역할 변경 오류', newOwnerError, {
      action: 'transferTeamOwnership',
      userId: user.id,
      teamId: profile.team_id,
      newOwnerId,
    });
    return {
      success: false,
      error: '소유권 양도 중 오류가 발생했습니다.',
    };
  }

  // 현재 소유자를 admin으로 변경
  const { error: currentOwnerError } = await supabase
    .from('team_members')
    .update({ role: 'admin' })
    .eq('id', currentOwnerMember.id);

  if (currentOwnerError) {
    logError('현재 소유자 역할 변경 오류', currentOwnerError, {
      action: 'transferTeamOwnership',
      userId: user.id,
      teamId: profile.team_id,
    });
    // 롤백: 새 소유자 역할 복원
    await supabase
      .from('team_members')
      .update({ role: newOwnerMember.role })
      .eq('id', newOwnerMember.id);
    return {
      success: false,
      error: '소유권 양도 중 오류가 발생했습니다.',
    };
  }

  // 팀 owner_id 변경
  const { error: teamError } = await supabase
    .from('teams')
    .update({ owner_id: newOwnerId })
    .eq('id', profile.team_id);

  if (teamError) {
    logError('팀 소유자 변경 오류', teamError, {
      action: 'transferTeamOwnership',
      userId: user.id,
      teamId: profile.team_id,
    });
    // 롤백: 멤버 역할 복원
    await supabase
      .from('team_members')
      .update({ role: 'owner' })
      .eq('id', currentOwnerMember.id);
    await supabase
      .from('team_members')
      .update({ role: newOwnerMember.role })
      .eq('id', newOwnerMember.id);
    return {
      success: false,
      error: '소유권 양도 중 오류가 발생했습니다.',
    };
  }

  return {
    success: true,
    data: undefined,
  };
}
