import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

// ────────────────────────────────────────────────────────────
// 모킹 설정
// ────────────────────────────────────────────────────────────

// Supabase 클라이언트 모킹
const mockFrom = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
    signInWithPassword: mockSignInWithPassword,
    updateUser: mockUpdateUser,
    signOut: mockSignOut,
  },
  from: mockFrom,
};

// 체이닝 헬퍼
function createChainMock(options: {
  data?: unknown;
  error?: unknown;
} = {}) {
  const chain: Record<string, Mock> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({
    data: options.data ?? null,
    error: options.error ?? null,
  });
  // delete의 경우 single이 아닌 직접 반환
  chain.eq.mockImplementation(() => {
    const result = {
      ...chain,
      then: (resolve: (value: { error: unknown }) => void) => {
        resolve({ error: options.error ?? null });
        return result;
      },
    };
    return result;
  });
  return chain;
}

// Auth 모킹
const mockRequireAuth = vi.fn();

vi.mock('@/lib/auth', () => ({
  requireAuth: () => mockRequireAuth(),
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthError';
    }
  },
}));

// Rate Limit 모킹
const mockCheckRateLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => mockCheckRateLimit(),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  getRateLimitErrorMessage: vi.fn().mockReturnValue('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'),
  RATE_LIMIT_PRESETS: { SUBSCRIPTION_CREATE: { windowMs: 60000, maxRequests: 3 } },
}));

// CSRF 모킹
const mockValidateCSRFForAction = vi.fn();
vi.mock('@/lib/csrf', () => ({
  validateCSRFForAction: (token: string) => mockValidateCSRFForAction(token),
}));

// Next.js 모킹
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Logger 모킹
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
}));

// ────────────────────────────────────────────────────────────
// 테스트 데이터
// ────────────────────────────────────────────────────────────

const mockUser = { id: 'user-123', email: 'test@example.com' };

const mockProfile = {
  id: 'user-123',
  name: '홍길동',
  plan: 'pro',
  daily_generations_remaining: 85,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
};

// ────────────────────────────────────────────────────────────
// 테스트
// ────────────────────────────────────────────────────────────

describe('getProfile Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('성공 케이스', () => {
    it('로그인한 사용자의 프로필을 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: mockProfile });
      mockFrom.mockReturnValue(chain);

      const { getProfile } = await import('@/actions/settings');
      const result = await getProfile();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(mockProfile.id);
        expect(result.data.name).toBe(mockProfile.name);
        expect(result.data.email).toBe(mockUser.email);
        expect(result.data.plan).toBe(mockProfile.plan);
        expect(result.data.dailyGenerationsRemaining).toBe(85);
      }
    });
  });

  describe('실패 케이스', () => {
    it('비로그인 사용자를 거부해야 한다', async () => {
      const { AuthError } = await import('@/lib/auth');
      mockRequireAuth.mockRejectedValue(new AuthError('로그인이 필요합니다'));

      const { getProfile } = await import('@/actions/settings');
      const result = await getProfile();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('로그인이 필요합니다');
      }
    });

    it('프로필이 없으면 에러를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: null, error: { message: 'Not found' } });
      mockFrom.mockReturnValue(chain);

      const { getProfile } = await import('@/actions/settings');
      const result = await getProfile();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('프로필을 찾을 수 없습니다');
      }
    });
  });
});

describe('updateProfile Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('입력 검증', () => {
    it('빈 이름을 거부해야 한다', async () => {
      const { updateProfile } = await import('@/actions/settings');
      const result = await updateProfile({ name: '' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors?.name).toBeDefined();
      }
    });

    it('50자 초과 이름을 거부해야 한다', async () => {
      const { updateProfile } = await import('@/actions/settings');
      const result = await updateProfile({ name: 'A'.repeat(51) });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors?.name).toBeDefined();
      }
    });

    it('유효한 이름을 허용해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain: Record<string, Mock> = {};
      chain.update = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue(chain);

      const { updateProfile } = await import('@/actions/settings');
      const result = await updateProfile({ name: '김철수' });

      expect(result.success).toBe(true);
    });
  });

  describe('성공 케이스', () => {
    it('프로필 업데이트가 성공해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain: Record<string, Mock> = {};
      chain.update = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue(chain);

      const { updateProfile } = await import('@/actions/settings');
      const result = await updateProfile({ name: '새이름' });

      expect(result.success).toBe(true);
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: '새이름' })
      );
    });

    it('업데이트 후 revalidatePath가 호출되어야 한다', async () => {
      const { revalidatePath } = await import('next/cache');
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain: Record<string, Mock> = {};
      chain.update = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue(chain);

      const { updateProfile } = await import('@/actions/settings');
      await updateProfile({ name: '새이름' });

      expect(revalidatePath).toHaveBeenCalledWith('/settings');
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('실패 케이스', () => {
    it('비로그인 사용자를 거부해야 한다', async () => {
      const { AuthError } = await import('@/lib/auth');
      mockRequireAuth.mockRejectedValue(new AuthError('로그인이 필요합니다'));

      const { updateProfile } = await import('@/actions/settings');
      const result = await updateProfile({ name: '새이름' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('로그인이 필요합니다');
      }
    });

    it('DB 에러 시 에러를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain: Record<string, Mock> = {};
      chain.update = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockResolvedValue({ error: { message: 'DB Error' } });
      mockFrom.mockReturnValue(chain);

      const { updateProfile } = await import('@/actions/settings');
      const result = await updateProfile({ name: '새이름' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('프로필 업데이트에 실패');
      }
    });
  });
});

describe('changePassword Action', () => {
  const validInput = {
    currentPassword: 'OldPassword123',
    newPassword: 'NewPassword456',
    confirmPassword: 'NewPassword456',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockValidateCSRFForAction.mockResolvedValue({ success: true });
  });

  describe('Rate Limit', () => {
    it('Rate Limit 초과 시 거부해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });

      const { changePassword } = await import('@/actions/settings');
      const result = await changePassword(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('요청이 너무 많습니다');
      }
    });
  });

  describe('CSRF 검증', () => {
    it('CSRF 토큰이 제공되면 검증해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockSignInWithPassword.mockResolvedValue({ error: null });
      mockUpdateUser.mockResolvedValue({ error: null });

      const { changePassword } = await import('@/actions/settings');
      await changePassword({ ...validInput, _csrf: 'valid-token' });

      expect(mockValidateCSRFForAction).toHaveBeenCalledWith('valid-token');
    });

    it('CSRF 검증 실패 시 거부해야 한다', async () => {
      mockValidateCSRFForAction.mockResolvedValue({ success: false, error: 'CSRF 토큰이 유효하지 않습니다' });

      const { changePassword } = await import('@/actions/settings');
      const result = await changePassword({ ...validInput, _csrf: 'invalid-token' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('CSRF');
      }
    });
  });

  describe('입력 검증', () => {
    it('빈 현재 비밀번호를 거부해야 한다', async () => {
      const { changePassword } = await import('@/actions/settings');
      const result = await changePassword({
        currentPassword: '',
        newPassword: 'NewPassword456',
        confirmPassword: 'NewPassword456',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors?.currentPassword).toBeDefined();
      }
    });

    it('8자 미만 새 비밀번호를 거부해야 한다', async () => {
      const { changePassword } = await import('@/actions/settings');
      const result = await changePassword({
        currentPassword: 'OldPassword123',
        newPassword: 'Short1',
        confirmPassword: 'Short1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors?.newPassword).toBeDefined();
      }
    });

    it('대문자 없는 새 비밀번호를 거부해야 한다', async () => {
      const { changePassword } = await import('@/actions/settings');
      const result = await changePassword({
        currentPassword: 'OldPassword123',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors?.newPassword).toBeDefined();
      }
    });

    it('소문자 없는 새 비밀번호를 거부해야 한다', async () => {
      const { changePassword } = await import('@/actions/settings');
      const result = await changePassword({
        currentPassword: 'OldPassword123',
        newPassword: 'NEWPASSWORD123',
        confirmPassword: 'NEWPASSWORD123',
      });

      expect(result.success).toBe(false);
    });

    it('숫자 없는 새 비밀번호를 거부해야 한다', async () => {
      const { changePassword } = await import('@/actions/settings');
      const result = await changePassword({
        currentPassword: 'OldPassword123',
        newPassword: 'NewPasswordABC',
        confirmPassword: 'NewPasswordABC',
      });

      expect(result.success).toBe(false);
    });

    it('비밀번호 확인 불일치를 거부해야 한다', async () => {
      const { changePassword } = await import('@/actions/settings');
      const result = await changePassword({
        currentPassword: 'OldPassword123',
        newPassword: 'NewPassword456',
        confirmPassword: 'DifferentPassword789',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors?.confirmPassword).toBeDefined();
      }
    });
  });

  describe('현재 비밀번호 확인', () => {
    it('현재 비밀번호가 틀리면 거부해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid credentials' } });

      const { changePassword } = await import('@/actions/settings');
      const result = await changePassword(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('현재 비밀번호가 올바르지 않습니다');
      }
    });
  });

  describe('성공 케이스', () => {
    it('비밀번호 변경이 성공해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockSignInWithPassword.mockResolvedValue({ error: null });
      mockUpdateUser.mockResolvedValue({ error: null });

      const { changePassword } = await import('@/actions/settings');
      const result = await changePassword(validInput);

      expect(result.success).toBe(true);
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewPassword456' });
    });
  });

  describe('실패 케이스', () => {
    it('비로그인 사용자를 거부해야 한다', async () => {
      const { AuthError } = await import('@/lib/auth');
      mockRequireAuth.mockRejectedValue(new AuthError('로그인이 필요합니다'));

      const { changePassword } = await import('@/actions/settings');
      const result = await changePassword(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('로그인이 필요합니다');
      }
    });

    it('updateUser 실패 시 에러를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockSignInWithPassword.mockResolvedValue({ error: null });
      mockUpdateUser.mockResolvedValue({ error: { message: 'Update failed' } });

      const { changePassword } = await import('@/actions/settings');
      const result = await changePassword(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('비밀번호 변경에 실패');
      }
    });
  });
});

describe('deleteAccount Action', () => {
  const validInput = {
    password: 'CurrentPassword123',
    confirmText: '계정 삭제' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockValidateCSRFForAction.mockResolvedValue({ success: true });
  });

  describe('Rate Limit', () => {
    it('Rate Limit 초과 시 거부해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });

      const { deleteAccount } = await import('@/actions/settings');
      const result = await deleteAccount(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('요청이 너무 많습니다');
      }
    });
  });

  describe('CSRF 검증', () => {
    it('CSRF 검증 실패 시 거부해야 한다', async () => {
      mockValidateCSRFForAction.mockResolvedValue({ success: false, error: 'CSRF 토큰이 유효하지 않습니다' });

      const { deleteAccount } = await import('@/actions/settings');
      const result = await deleteAccount({ ...validInput, _csrf: 'invalid-token' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('CSRF');
      }
    });
  });

  describe('입력 검증', () => {
    it('빈 비밀번호를 거부해야 한다', async () => {
      const { deleteAccount } = await import('@/actions/settings');
      const result = await deleteAccount({
        password: '',
        confirmText: '계정 삭제' as const,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors?.password).toBeDefined();
      }
    });

    it('잘못된 확인 텍스트를 거부해야 한다', async () => {
      const { deleteAccount } = await import('@/actions/settings');
      const result = await deleteAccount({
        password: 'CurrentPassword123',
        confirmText: '삭제' as unknown as '계정 삭제',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors?.confirmText).toBeDefined();
      }
    });
  });

  describe('비밀번호 확인', () => {
    it('비밀번호가 틀리면 거부해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid credentials' } });

      const { deleteAccount } = await import('@/actions/settings');
      const result = await deleteAccount(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('비밀번호가 올바르지 않습니다');
      }
    });
  });

  describe('연쇄 삭제', () => {
    it('모든 관련 데이터가 삭제되어야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockSignInWithPassword.mockResolvedValue({ error: null });
      mockSignOut.mockResolvedValue({ error: null });

      // 모든 테이블에 대한 삭제 체인
      const deleteChain: Record<string, Mock> = {};
      deleteChain.delete = vi.fn().mockReturnValue(deleteChain);
      deleteChain.eq = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue(deleteChain);

      const { deleteAccount } = await import('@/actions/settings');
      const result = await deleteAccount(validInput);

      expect(result.success).toBe(true);

      // 각 테이블에 대한 삭제 호출 확인
      expect(mockFrom).toHaveBeenCalledWith('generated_contents');
      expect(mockFrom).toHaveBeenCalledWith('credit_transactions');
      expect(mockFrom).toHaveBeenCalledWith('payments');
      expect(mockFrom).toHaveBeenCalledWith('subscriptions');
      expect(mockFrom).toHaveBeenCalledWith('profiles');
    });

    it('삭제 후 로그아웃이 호출되어야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockSignInWithPassword.mockResolvedValue({ error: null });
      mockSignOut.mockResolvedValue({ error: null });

      const deleteChain: Record<string, Mock> = {};
      deleteChain.delete = vi.fn().mockReturnValue(deleteChain);
      deleteChain.eq = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue(deleteChain);

      const { deleteAccount } = await import('@/actions/settings');
      await deleteAccount(validInput);

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('실패 케이스', () => {
    it('비로그인 사용자를 거부해야 한다', async () => {
      const { AuthError } = await import('@/lib/auth');
      mockRequireAuth.mockRejectedValue(new AuthError('로그인이 필요합니다'));

      const { deleteAccount } = await import('@/actions/settings');
      const result = await deleteAccount(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('로그인이 필요합니다');
      }
    });

    it('프로필 삭제 실패 시 에러를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockSignInWithPassword.mockResolvedValue({ error: null });

      // 프로필 삭제만 실패
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const deleteChain: Record<string, Mock> = {};
        deleteChain.delete = vi.fn().mockReturnValue(deleteChain);

        // 5번째 호출(profiles)에서만 에러
        if (callCount === 5) {
          deleteChain.eq = vi.fn().mockResolvedValue({ error: { message: 'Profile delete failed' } });
        } else {
          deleteChain.eq = vi.fn().mockResolvedValue({ error: null });
        }

        return deleteChain;
      });

      const { deleteAccount } = await import('@/actions/settings');
      const result = await deleteAccount(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('계정 삭제에 실패');
      }
    });

    it('일부 데이터 삭제 실패해도 계속 진행해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockSignInWithPassword.mockResolvedValue({ error: null });
      mockSignOut.mockResolvedValue({ error: null });

      // 콘텐츠 삭제만 실패 (프로필은 성공)
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const deleteChain: Record<string, Mock> = {};
        deleteChain.delete = vi.fn().mockReturnValue(deleteChain);

        // 1번째 호출(generated_contents)에서만 에러
        if (callCount === 1) {
          deleteChain.eq = vi.fn().mockResolvedValue({ error: { message: 'Content delete failed' } });
        } else {
          deleteChain.eq = vi.fn().mockResolvedValue({ error: null });
        }

        return deleteChain;
      });

      const { deleteAccount } = await import('@/actions/settings');
      const result = await deleteAccount(validInput);

      // 프로필 삭제가 성공하면 전체 성공
      expect(result.success).toBe(true);
    });
  });
});
