/**
 * Team Actions 공유 타입 및 스키마
 */

import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';

// =====================================================
// 타입 정의
// =====================================================

export type TeamActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// =====================================================
// 스키마 정의
// =====================================================

export const createTeamSchema = z.object({
  name: z.string().min(2, '팀 이름은 2자 이상이어야 합니다.').max(100, '팀 이름은 100자 이하여야 합니다.'),
  description: z.string().max(500, '설명은 500자 이하여야 합니다.').optional(),
});

export const inviteTeamMemberSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력해주세요.'),
  role: z.enum(['admin', 'member']).default('member'),
});

export const updateTeamSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'API 키 이름을 입력해주세요.').max(100),
  permissions: z.array(z.string()).optional(),
  expiresInDays: z.number().min(1).max(365).optional(),
  _csrf: z.string().optional(), // CSRF 토큰
});

// 소유권 양도 스키마 (CSRF 포함)
export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid('유효한 사용자 ID가 필요합니다.'),
  _csrf: z.string().optional(), // CSRF 토큰
});

// 멤버 제거 스키마 (CSRF 포함)
export const removeMemberSchema = z.object({
  memberId: z.string().uuid('유효한 멤버 ID가 필요합니다.'),
  _csrf: z.string().optional(), // CSRF 토큰
});

// API 키 삭제 스키마 (CSRF 포함)
export const deleteApiKeySchema = z.object({
  keyId: z.string().uuid('유효한 API 키 ID가 필요합니다.'),
  _csrf: z.string().optional(), // CSRF 토큰
});

// 팀 삭제 스키마 (CSRF 포함)
export const deleteTeamSchema = z.object({
  confirmText: z.literal('팀 삭제', {
    errorMap: () => ({ message: '"팀 삭제"를 정확히 입력해주세요' }),
  }),
  _csrf: z.string().optional(), // CSRF 토큰
});

// 멤버 역할 변경 스키마
export const updateMemberRoleSchema = z.object({
  memberId: z.string().uuid('유효한 멤버 ID가 필요합니다.'),
  newRole: z.enum(['admin', 'member']),
  _csrf: z.string().optional(), // CSRF 토큰
});

// =====================================================
// 유틸리티 함수
// =====================================================

export function generateSlug(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-zA-Z0-9가-힣]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // 랜덤 접미사 추가로 유니크성 보장
  const suffix = randomBytes(4).toString('hex');
  return `${baseSlug}-${suffix}`;
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  // API 키 형식: cgai_team_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
  const keyBody = randomBytes(24).toString('hex');
  const key = `cgai_team_${keyBody}`;
  const prefix = key.substring(0, 16); // cgai_team_xxxx
  const hash = createHash('sha256').update(key).digest('hex');

  return { key, prefix, hash };
}
