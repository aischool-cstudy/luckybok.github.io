import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase 클라이언트 모킹
const mockGetUser = vi.fn();
const mockSupabaseClient = {
  auth: {
    getUser: mockGetUser,
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// 테스트 대상 import
import { requireAuth, getAuthUser, getAuthUserId, AuthError } from '@/lib/auth';

describe('Auth Helper Functions', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: { name: '테스트 사용자' },
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AuthError', () => {
    it('AuthError 인스턴스를 생성할 수 있어야 한다', () => {
      const error = new AuthError('테스트 에러');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AuthError);
      expect(error.message).toBe('테스트 에러');
      expect(error.name).toBe('AuthError');
    });

    it('Error 타입 체크에서 AuthError를 구분할 수 있어야 한다', () => {
      const authError = new AuthError('인증 에러');
      const genericError = new Error('일반 에러');

      expect(authError instanceof AuthError).toBe(true);
      expect(genericError instanceof AuthError).toBe(false);
    });
  });

  describe('requireAuth', () => {
    it('인증된 사용자의 경우 user와 supabase를 반환해야 한다', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await requireAuth();

      expect(result.user).toEqual(mockUser);
      expect(result.supabase).toBe(mockSupabaseClient);
      expect(mockGetUser).toHaveBeenCalledTimes(1);
    });

    it('인증되지 않은 사용자의 경우 AuthError를 던져야 한다', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(requireAuth()).rejects.toThrow(AuthError);
      await expect(requireAuth()).rejects.toThrow('로그인이 필요합니다');
    });

    it('auth 에러가 발생한 경우 AuthError를 던져야 한다', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Session expired' },
      });

      await expect(requireAuth()).rejects.toThrow(AuthError);
      await expect(requireAuth()).rejects.toThrow('로그인이 필요합니다');
    });

    it('user가 undefined인 경우에도 AuthError를 던져야 한다', async () => {
      mockGetUser.mockResolvedValue({
        data: {},
        error: null,
      });

      await expect(requireAuth()).rejects.toThrow(AuthError);
    });
  });

  describe('getAuthUser', () => {
    it('인증된 사용자의 경우 AuthResult를 반환해야 한다', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await getAuthUser();

      expect(result).not.toBeNull();
      expect(result?.user).toEqual(mockUser);
      expect(result?.supabase).toBe(mockSupabaseClient);
    });

    it('인증되지 않은 사용자의 경우 null을 반환해야 한다', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await getAuthUser();

      expect(result).toBeNull();
    });

    it('auth 에러가 발생한 경우 null을 반환해야 한다', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Network error' },
      });

      const result = await getAuthUser();

      expect(result).toBeNull();
    });

    it('예외가 발생해도 null을 반환해야 한다 (에러를 던지지 않음)', async () => {
      mockGetUser.mockRejectedValue(new Error('Unexpected error'));

      const result = await getAuthUser();

      expect(result).toBeNull();
    });
  });

  describe('getAuthUserId', () => {
    it('인증된 사용자의 경우 user ID를 반환해야 한다', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userId = await getAuthUserId();

      expect(userId).toBe('user-123');
    });

    it('인증되지 않은 사용자의 경우 null을 반환해야 한다', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const userId = await getAuthUserId();

      expect(userId).toBeNull();
    });

    it('에러 발생 시 null을 반환해야 한다', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Auth error' },
      });

      const userId = await getAuthUserId();

      expect(userId).toBeNull();
    });
  });
});

describe('Auth Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('여러 번 호출해도 각각 독립적으로 동작해야 한다', async () => {
    // 첫 번째 호출: 인증됨
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    // 두 번째 호출: 인증 안됨
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result1 = await getAuthUserId();
    const result2 = await getAuthUserId();

    expect(result1).toBe('user-1');
    expect(result2).toBeNull();
    expect(mockGetUser).toHaveBeenCalledTimes(2);
  });
});
