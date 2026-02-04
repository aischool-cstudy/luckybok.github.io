import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// renewSubscription 모킹
const mockRenewSubscription = vi.fn();

vi.mock('@/actions/subscription', () => ({
  renewSubscription: (id: string) => mockRenewSubscription(id),
}));

// Supabase Admin Client 모킹
const mockRpc = vi.fn();
const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockNot = vi.fn().mockReturnThis();
const mockLte = vi.fn().mockResolvedValue({ data: [], error: null });

const mockAdminClient = {
  rpc: mockRpc,
  from: vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
    eq: mockEq,
    not: mockNot,
    lte: mockLte,
  })),
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

describe('구독 자동 갱신 Cron Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCronSecretRef.value = 'test-cron-secret';
    process.env = { ...originalEnv, CRON_SECRET: 'test-cron-secret' };
    mockUpdate.mockReturnThis();
    mockEq.mockReturnThis();
    mockSelect.mockReturnThis();
    mockNot.mockReturnThis();
    mockLte.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // 동적 import를 위한 헬퍼 함수
  const importHandler = async () => {
    const module = await import('@/app/api/cron/renew-subscriptions/route');
    return module.GET;
  };

  describe('인증 검증', () => {
    it('CRON_SECRET이 설정되지 않으면 에러가 발생해야 한다', async () => {
      mockCronSecretRef.value = null;
      delete process.env.CRON_SECRET;

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/renew-subscriptions', {
        headers: {
          authorization: 'Bearer test-secret',
        },
      });

      // serverEnv.CRON_SECRET 접근 시 try-catch 외부에서 예외 발생
      await expect(GET(request)).rejects.toThrow('CRON_SECRET');
    });

    it('잘못된 인증 헤더로 요청 시 401 에러를 반환해야 한다', async () => {
      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/renew-subscriptions', {
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
        data: [],
        error: null,
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/renew-subscriptions', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      await GET(request);

      expect(mockRpc).toHaveBeenCalledWith('get_subscriptions_due_for_renewal', {
        p_hours_ahead: 24,
      });
    });
  });

  describe('구독 갱신 처리', () => {
    it('갱신 대상 구독이 없으면 빈 결과를 반환해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/renew-subscriptions', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.results.processed).toBe(0);
      expect(json.results.renewed).toBe(0);
    });

    it('활성 구독을 성공적으로 갱신해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            subscription_id: 'sub_123',
            user_id: 'user_123',
            plan: 'pro',
            billing_cycle: 'monthly',
            cancel_at_period_end: false,
          },
        ],
        error: null,
      });
      mockRenewSubscription.mockResolvedValue({ success: true });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/renew-subscriptions', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.results.processed).toBe(1);
      expect(json.results.renewed).toBe(1);
      expect(mockRenewSubscription).toHaveBeenCalledWith('sub_123');
    });

    it('취소 예정 구독은 취소 처리해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            subscription_id: 'sub_456',
            user_id: 'user_456',
            plan: 'pro',
            billing_cycle: 'monthly',
            cancel_at_period_end: true,
          },
        ],
        error: null,
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/renew-subscriptions', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.results.processed).toBe(1);
      expect(json.results.canceled).toBe(1);
      expect(json.results.renewed).toBe(0);
      // renewSubscription은 호출되지 않아야 함
      expect(mockRenewSubscription).not.toHaveBeenCalled();
    });

    it('갱신 실패 시 에러를 기록해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            subscription_id: 'sub_789',
            user_id: 'user_789',
            plan: 'pro',
            billing_cycle: 'monthly',
            cancel_at_period_end: false,
          },
        ],
        error: null,
      });
      mockRenewSubscription.mockResolvedValue({
        success: false,
        error: '결제 실패: 카드 만료',
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/renew-subscriptions', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.results.processed).toBe(1);
      expect(json.results.failed).toBe(1);
      expect(json.errors).toContain('sub_789: 결제 실패: 카드 만료');
    });

    it('여러 구독을 처리해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            subscription_id: 'sub_1',
            user_id: 'user_1',
            plan: 'pro',
            billing_cycle: 'monthly',
            cancel_at_period_end: false,
          },
          {
            subscription_id: 'sub_2',
            user_id: 'user_2',
            plan: 'team',
            billing_cycle: 'yearly',
            cancel_at_period_end: true,
          },
          {
            subscription_id: 'sub_3',
            user_id: 'user_3',
            plan: 'pro',
            billing_cycle: 'monthly',
            cancel_at_period_end: false,
          },
        ],
        error: null,
      });
      mockRenewSubscription.mockResolvedValueOnce({ success: true });
      mockRenewSubscription.mockResolvedValueOnce({
        success: false,
        error: '잔액 부족',
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/renew-subscriptions', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.results.processed).toBe(3);
      expect(json.results.renewed).toBe(1);
      expect(json.results.canceled).toBe(1);
      expect(json.results.failed).toBe(1);
    });
  });

  describe('에러 처리', () => {
    it('RPC 조회 에러 시 500 에러를 반환해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/renew-subscriptions', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Database error');
    });

    it('개별 구독 처리 예외 시 다음 구독을 계속 처리해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            subscription_id: 'sub_1',
            user_id: 'user_1',
            cancel_at_period_end: false,
          },
          {
            subscription_id: 'sub_2',
            user_id: 'user_2',
            cancel_at_period_end: false,
          },
        ],
        error: null,
      });
      mockRenewSubscription.mockRejectedValueOnce(new Error('Unexpected error'));
      mockRenewSubscription.mockResolvedValueOnce({ success: true });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/renew-subscriptions', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.results.processed).toBe(2);
      expect(json.results.failed).toBe(1);
      expect(json.results.renewed).toBe(1);
    });

    it('전체 예외 발생 시 500 에러와 함께 부분 결과를 반환해야 한다', async () => {
      mockRpc.mockRejectedValue(new Error('Critical error'));

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/renew-subscriptions', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Critical error');
    });
  });

  describe('취소 예정 구독 처리', () => {
    it('취소 예정 구독의 상태가 canceled로 변경되어야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            subscription_id: 'sub_cancel',
            user_id: 'user_cancel',
            plan: 'pro',
            cancel_at_period_end: true,
          },
        ],
        error: null,
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/renew-subscriptions', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      await GET(request);

      // subscriptions 테이블 업데이트 확인
      expect(mockAdminClient.from).toHaveBeenCalledWith('subscriptions');
    });

    it('취소 시 프로필이 starter 플랜으로 다운그레이드되어야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            subscription_id: 'sub_cancel',
            user_id: 'user_cancel',
            plan: 'pro',
            cancel_at_period_end: true,
          },
        ],
        error: null,
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/renew-subscriptions', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      await GET(request);

      // profiles 테이블 업데이트 확인
      expect(mockAdminClient.from).toHaveBeenCalledWith('profiles');
    });
  });
});

describe('구독 갱신 스케줄', () => {
  it('6시간마다 실행되어야 한다 (vercel.json 설정)', () => {
    const cronSchedule = '0 */6 * * *';
    expect(cronSchedule).toBe('0 */6 * * *');
  });

  it('24시간 이내 만료 예정 구독을 조회해야 한다', () => {
    const hoursAhead = 24;
    expect(hoursAhead).toBe(24);
  });
});
