import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loginSchema, registerSchema } from '@/lib/validators/auth';

// Next.js 모듈 모킹
vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Map([['x-forwarded-for', '127.0.0.1']]))),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// Logger 모킹
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

// Rate Limit 모킹
const mockCheckRateLimit = vi.fn();
const mockGetClientIP = vi.fn();
const mockGetRateLimitErrorMessage = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIP: (...args: unknown[]) => mockGetClientIP(...args),
  getRateLimitErrorMessage: (...args: unknown[]) => mockGetRateLimitErrorMessage(...args),
  RATE_LIMIT_PRESETS: {
    AUTH: { maxRequests: 10, windowSeconds: 60 },
    SUBSCRIPTION_CREATE: { maxRequests: 3, windowSeconds: 60 },
  },
}));

// Supabase 클라이언트 모킹
const mockSupabaseClient = {
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// 테스트 대상 함수들 import (모킹 후에 import)
import { login, register, logout } from '@/actions/auth';
import { redirect } from 'next/navigation';

describe('Auth Validators', () => {
  describe('loginSchema', () => {
    it('유효한 로그인 입력을 통과시켜야 한다', () => {
      const validInput = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = loginSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('빈 이메일을 거부해야 한다', () => {
      const invalidInput = {
        email: '',
        password: 'password123',
      };

      const result = loginSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.email).toContain('이메일을 입력해주세요');
      }
    });

    it('잘못된 이메일 형식을 거부해야 한다', () => {
      const invalidInput = {
        email: 'invalid-email',
        password: 'password123',
      };

      const result = loginSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.email).toContain(
          '유효한 이메일 주소를 입력해주세요'
        );
      }
    });

    it('6자 미만 비밀번호를 거부해야 한다', () => {
      const invalidInput = {
        email: 'test@example.com',
        password: '12345',
      };

      const result = loginSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password).toContain(
          '비밀번호는 최소 6자 이상이어야 합니다'
        );
      }
    });
  });

  describe('registerSchema', () => {
    it('유효한 회원가입 입력을 통과시켜야 한다', () => {
      const validInput = {
        name: '홍길동',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      };

      const result = registerSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('2자 미만 이름을 거부해야 한다', () => {
      const invalidInput = {
        name: '홍',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      };

      const result = registerSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.name).toContain(
          '이름은 최소 2자 이상이어야 합니다'
        );
      }
    });

    it('숫자가 없는 비밀번호를 거부해야 한다', () => {
      const invalidInput = {
        name: '홍길동',
        email: 'test@example.com',
        password: 'password',
        confirmPassword: 'password',
      };

      const result = registerSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password).toContain(
          '비밀번호는 영문자와 숫자를 포함해야 합니다'
        );
      }
    });

    it('비밀번호 불일치를 거부해야 한다', () => {
      const invalidInput = {
        name: '홍길동',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'different123',
      };

      const result = registerSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.confirmPassword).toContain(
          '비밀번호가 일치하지 않습니다'
        );
      }
    });
  });
});

describe('Auth Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 기본 Rate Limit 설정 (통과)
    mockGetClientIP.mockReturnValue('127.0.0.1');
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('유효한 자격 증명으로 로그인 성공해야 한다', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-123' }, session: { access_token: 'token' } },
        error: null,
      });

      const result = await login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('잘못된 자격 증명으로 로그인 실패해야 한다', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const result = await login({
        email: 'test@example.com',
        password: 'wrongpassword1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('이메일 또는 비밀번호가 올바르지 않습니다.');
    });

    it('Rate Limit 초과 시 에러 반환해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });
      mockGetRateLimitErrorMessage.mockReturnValue('요청이 너무 많습니다. 1분 후 다시 시도해주세요.');

      const result = await login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('요청이 너무 많습니다. 1분 후 다시 시도해주세요.');
      expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('유효하지 않은 입력에 fieldErrors 반환해야 한다', async () => {
      const result = await login({
        email: 'invalid-email',
        password: '123', // 6자 미만
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('입력값이 유효하지 않습니다.');
      expect(result.fieldErrors).toBeDefined();
      expect(result.fieldErrors?.email).toBeDefined();
      expect(result.fieldErrors?.password).toBeDefined();
    });

    it('이메일 미인증 에러를 올바르게 처리해야 한다', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email not confirmed' },
      });

      const result = await login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('이메일 인증이 필요합니다. 이메일을 확인해주세요.');
    });

    it('알 수 없는 에러를 기본 메시지로 처리해야 한다', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Unknown error occurred' },
      });

      const result = await login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('오류가 발생했습니다. 다시 시도해주세요.');
    });
  });

  describe('register', () => {
    it('유효한 입력으로 회원가입 성공해야 한다 (세션 포함)', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: {
          user: { id: 'new-user-123', email: 'newuser@example.com', user_metadata: { name: '새사용자' } },
          session: { access_token: 'token', refresh_token: 'refresh', expires_at: 1234567890 },
        },
        error: null,
      });

      const result = await register({
        name: '새사용자',
        email: 'newuser@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.user.email).toBe('newuser@example.com');
      expect(result.session?.accessToken).toBe('token');
    });

    it('세션 없이 회원가입 시 자동 로그인 시도해야 한다', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: {
          user: { id: 'new-user-123', email: 'newuser@example.com', user_metadata: { name: '새사용자' } },
          session: null, // 이메일 인증 필요한 경우
        },
        error: null,
      });
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'new-user-123', email: 'newuser@example.com' },
          session: { access_token: 'token', refresh_token: 'refresh', expires_at: 1234567890 },
        },
        error: null,
      });

      const result = await register({
        name: '새사용자',
        email: 'newuser@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalled();
    });

    it('이미 등록된 이메일로 에러 반환해야 한다', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      const result = await register({
        name: '홍길동',
        email: 'existing@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('이미 등록된 이메일입니다.');
    });

    it('Rate Limit 초과 시 에러 반환해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
      mockGetRateLimitErrorMessage.mockReturnValue('회원가입 요청이 너무 많습니다.');

      const result = await register({
        name: '홍길동',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('회원가입 요청이 너무 많습니다.');
    });

    it('유효하지 않은 입력에 fieldErrors 반환해야 한다', async () => {
      const result = await register({
        name: '홍', // 2자 미만
        email: 'invalid',
        password: 'pass', // 6자 미만
        confirmPassword: 'different',
      });

      expect(result.success).toBe(false);
      expect(result.fieldErrors).toBeDefined();
    });

    it('자동 로그인 실패 시 적절한 에러 메시지 반환해야 한다', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: {
          user: { id: 'new-user-123', email: 'newuser@example.com' },
          session: null,
        },
        error: null,
      });
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email not confirmed' },
      });

      const result = await register({
        name: '새사용자',
        email: 'newuser@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('이메일 인증이 필요합니다. 이메일을 확인해주세요.');
    });

    it('signUp 예외 발생 시 에러 처리해야 한다', async () => {
      mockSupabaseClient.auth.signUp.mockRejectedValue(new Error('Network error'));

      const result = await register({
        name: '새사용자',
        email: 'newuser@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('회원가입 처리 중 오류가 발생했습니다.');
    });
  });

  describe('logout', () => {
    it('로그아웃 후 /login으로 리다이렉트해야 한다', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

      await logout();

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith('/login');
    });
  });
});

describe('Auth Error Message Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientIP.mockReturnValue('127.0.0.1');
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });
  });

  it.each([
    ['Invalid login credentials', '이메일 또는 비밀번호가 올바르지 않습니다.'],
    ['Email not confirmed', '이메일 인증이 필요합니다. 이메일을 확인해주세요.'],
    ['User already registered', '이미 등록된 이메일입니다.'],
    ['Password should be at least 6 characters', '비밀번호는 최소 6자 이상이어야 합니다.'],
    ['Email rate limit exceeded', '너무 많은 요청이 있었습니다. 잠시 후 다시 시도해주세요.'],
  ])('"%s" 에러를 "%s"로 변환해야 한다', async (errorMessage, expectedMessage) => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: errorMessage },
    });

    const result = await login({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(result.error).toBe(expectedMessage);
  });
});
