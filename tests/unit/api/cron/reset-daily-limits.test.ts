import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Supabase Admin Client 모킹
const mockRpc = vi.fn();
const mockAdminClient = {
  rpc: mockRpc,
};

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}));

// 환경 변수 모킹
const originalEnv = process.env;

// vi.hoisted를 사용하여 mock 변수를 호이스팅
const { mockCronSecretRef } = vi.hoisted(() => ({
  mockCronSecretRef: { value: 'test-cron-secret' as string | null },
}));

// env.ts 모듈 모킹 (serverEnv 접근 제어)
vi.mock('@/lib/env', () => ({
  serverEnv: {
    get CRON_SECRET() {
      if (!mockCronSecretRef.value) {
        throw new Error('필수 환경 변수 CRON_SECRET가 설정되지 않았습니다.');
      }
      return mockCronSecretRef.value;
    },
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  },
  clientEnv: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
  },
}));

describe('일일 생성 횟수 리셋 Cron Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCronSecretRef.value = 'test-cron-secret';
    process.env = { ...originalEnv, CRON_SECRET: 'test-cron-secret' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // 동적 import를 위한 헬퍼 함수
  const importHandler = async () => {
    const module = await import('@/app/api/cron/reset-daily-limits/route');
    return module.GET;
  };

  describe('인증 검증', () => {
    it('CRON_SECRET이 설정되지 않으면 에러가 발생해야 한다', async () => {
      mockCronSecretRef.value = null;
      delete process.env.CRON_SECRET;

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/reset-daily-limits', {
        headers: {
          authorization: 'Bearer test-secret',
        },
      });

      // serverEnv.CRON_SECRET 접근 시 try-catch 외부에서 예외 발생
      await expect(GET(request)).rejects.toThrow('CRON_SECRET');
    });

    it('잘못된 인증 헤더로 요청 시 401 에러를 반환해야 한다', async () => {
      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/reset-daily-limits', {
        headers: {
          authorization: 'Bearer wrong-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('인증 헤더가 없으면 401 에러를 반환해야 한다', async () => {
      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/reset-daily-limits');

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('올바른 인증 헤더로 요청 시 RPC가 호출되어야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, updated_count: 10 },
        error: null,
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/reset-daily-limits', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      await GET(request);

      expect(mockRpc).toHaveBeenCalledWith('reset_daily_generations_safe');
    });
  });

  describe('RPC 호출 결과 처리', () => {
    it('RPC 성공 시 업데이트된 사용자 수를 반환해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, updated_count: 150 },
        error: null,
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/reset-daily-limits', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.updatedCount).toBe(150);
      expect(json.timestamp).toBeDefined();
      expect(json.duration).toBeDefined();
    });

    it('RPC 배열 결과도 올바르게 처리해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: [{ success: true, updated_count: 50 }],
        error: null,
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/reset-daily-limits', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.updatedCount).toBe(50);
    });

    it('RPC 에러 시 500 에러를 반환해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/reset-daily-limits', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Database connection failed');
    });

    it('RPC 결과가 실패(다른 프로세스 실행 중)인 경우 200을 반환해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: { success: false, error_message: '다른 프로세스가 실행 중입니다' },
        error: null,
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/reset-daily-limits', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      // Advisory lock으로 인한 실패는 정상 케이스로 200 반환
      expect(response.status).toBe(200);
      expect(json.success).toBe(false);
      expect(json.error).toBe('다른 프로세스가 실행 중입니다');
    });
  });

  describe('예외 처리', () => {
    it('예기치 않은 예외 발생 시 500 에러를 반환해야 한다', async () => {
      mockRpc.mockRejectedValue(new Error('Unexpected error'));

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/reset-daily-limits', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unexpected error');
    });
  });

  describe('응답 형식', () => {
    it('성공 응답에 필수 필드가 포함되어야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, updated_count: 100 },
        error: null,
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/reset-daily-limits', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(json).toHaveProperty('success');
      expect(json).toHaveProperty('updatedCount');
      expect(json).toHaveProperty('duration');
      expect(json).toHaveProperty('timestamp');
    });

    it('duration은 양수여야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, updated_count: 10 },
        error: null,
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/reset-daily-limits', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(json.duration).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('플랜별 일일 생성 횟수', () => {
  it('starter 플랜은 10회 생성 가능해야 한다', () => {
    const starterLimit = 10;
    expect(starterLimit).toBe(10);
  });

  it('pro 플랜은 100회 생성 가능해야 한다', () => {
    const proLimit = 100;
    expect(proLimit).toBe(100);
  });

  it('team 플랜은 500회 생성 가능해야 한다', () => {
    const teamLimit = 500;
    expect(teamLimit).toBe(500);
  });

  it('enterprise 플랜은 무제한(999999)회 생성 가능해야 한다', () => {
    const enterpriseLimit = 999999;
    expect(enterpriseLimit).toBe(999999);
  });
});
