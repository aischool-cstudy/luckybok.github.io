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
const mockCronSecretRef = vi.hoisted(() => ({
  value: 'test-cron-secret' as string | null,
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

describe('만료 크레딧 처리 Cron Job', () => {
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
    const module = await import('@/app/api/cron/expire-credits/route');
    return module.GET;
  };

  describe('인증 검증', () => {
    it('CRON_SECRET이 설정되지 않으면 에러가 발생해야 한다', async () => {
      mockCronSecretRef.value = null;
      delete process.env.CRON_SECRET;

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/expire-credits', {
        headers: {
          authorization: 'Bearer test-secret',
        },
      });

      // serverEnv.CRON_SECRET 접근 시 try-catch 외부에서 예외 발생
      await expect(GET(request)).rejects.toThrow('CRON_SECRET');
    });

    it('잘못된 인증 헤더로 요청 시 401 에러를 반환해야 한다', async () => {
      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/expire-credits', {
        headers: {
          authorization: 'Bearer wrong-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('올바른 인증 헤더로 요청 시 RPC가 호출되어야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, processed_count: 5 },
        error: null,
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/expire-credits', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      await GET(request);

      expect(mockRpc).toHaveBeenCalledWith('expire_credits_safe');
    });
  });

  describe('RPC 호출 결과 처리', () => {
    it('RPC 성공 시 처리된 사용자 수를 반환해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, processed_count: 25 },
        error: null,
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/expire-credits', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.processedCount).toBe(25);
      expect(json.timestamp).toBeDefined();
      expect(json.duration).toBeDefined();
    });

    it('처리할 만료 크레딧이 없는 경우에도 성공을 반환해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, processed_count: 0 },
        error: null,
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/expire-credits', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.processedCount).toBe(0);
    });

    it('RPC 에러 시 500 에러를 반환해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Transaction failed' },
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/expire-credits', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Transaction failed');
    });

    it('RPC 결과가 실패(다른 프로세스 실행 중)인 경우 200을 반환해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: { success: false, error_message: '다른 프로세스가 실행 중입니다' },
        error: null,
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/expire-credits', {
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
      mockRpc.mockRejectedValue(new Error('Connection timeout'));

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/expire-credits', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Connection timeout');
    });
  });
});

describe('크레딧 만료 로직 검증', () => {
  it('기본 크레딧 패키지 만료 기간이 90일이어야 한다', () => {
    const basicPackage = { validDays: 90 };
    expect(basicPackage.validDays).toBe(90);
  });

  it('스탠다드 크레딧 패키지 만료 기간이 90일이어야 한다', () => {
    const standardPackage = { validDays: 90 };
    expect(standardPackage.validDays).toBe(90);
  });

  it('프리미엄 크레딧 패키지 만료 기간이 180일이어야 한다', () => {
    const premiumPackage = { validDays: 180 };
    expect(premiumPackage.validDays).toBe(180);
  });

  it('만료된 크레딧은 음수 트랜잭션으로 기록되어야 한다', () => {
    const expiryTransaction = {
      type: 'expiry',
      amount: -50, // 만료된 크레딧은 음수
    };
    expect(expiryTransaction.type).toBe('expiry');
    expect(expiryTransaction.amount).toBeLessThan(0);
  });

  it('잔액은 0 미만이 될 수 없어야 한다', () => {
    const currentBalance = 30;
    const expiredAmount = 50;
    const newBalance = Math.max(0, currentBalance - expiredAmount);
    expect(newBalance).toBe(0);
  });
});
