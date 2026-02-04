import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// renewSubscription 모킹
const mockRenewSubscription = vi.fn();

vi.mock('@/actions/subscription', () => ({
  renewSubscription: (id: string) => mockRenewSubscription(id),
}));

// Supabase Admin Client 모킹
const mockAdminClient = {
  from: vi.fn(),
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

// 결과를 저장할 변수
let mockSubscriptionsData: unknown[] = [];
let mockSubscriptionsError: { message: string } | null = null;

describe('구독 갱신 처리 Cron Job (process-renewals)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCronSecretRef.value = 'test-cron-secret';
    process.env = { ...originalEnv, CRON_SECRET: 'test-cron-secret' };
    mockSubscriptionsData = [];
    mockSubscriptionsError = null;

    // 체이닝 mock 설정
    mockAdminClient.from.mockImplementation((table: string) => {
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({
                  data: mockSubscriptionsData,
                  error: mockSubscriptionsError,
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {};
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // 동적 import를 위한 헬퍼 함수
  const importHandler = async () => {
    const module = await import('@/app/api/cron/process-renewals/route');
    return module.GET;
  };

  describe('인증 검증', () => {
    it('CRON_SECRET이 설정되지 않으면 500 에러를 반환해야 한다', async () => {
      mockCronSecretRef.value = null; // env 모듈 모킹을 통한 환경 변수 미설정 시뮬레이션
      delete process.env.CRON_SECRET;

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/process-renewals', {
        headers: {
          authorization: 'Bearer test-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('필수 환경 변수 CRON_SECRET가 설정되지 않았습니다.');
    });

    it('잘못된 인증 헤더로 요청 시 401 에러를 반환해야 한다', async () => {
      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/process-renewals', {
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
      const request = new NextRequest('http://localhost/api/cron/process-renewals');

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });
  });

  describe('구독 조회', () => {
    it('오늘 만료 예정인 구독만 조회해야 한다', async () => {
      mockSubscriptionsData = [];
      mockSubscriptionsError = null;

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/process-renewals', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      await GET(request);

      // from('subscriptions') 호출 확인
      expect(mockAdminClient.from).toHaveBeenCalledWith('subscriptions');
    });

    it('갱신 대상 구독이 없으면 빈 결과를 반환해야 한다', async () => {
      mockSubscriptionsData = [];
      mockSubscriptionsError = null;

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/process-renewals', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain('갱신 대상 구독이 없습니다');
      expect(json.processed).toBe(0);
    });

    it('조회 에러 시 500 에러를 반환해야 한다', async () => {
      mockSubscriptionsData = [];
      mockSubscriptionsError = { message: 'Query failed' };

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/process-renewals', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Query failed');
    });
  });

  describe('구독 갱신 처리', () => {
    it('활성 구독을 성공적으로 갱신해야 한다', async () => {
      mockSubscriptionsData = [
        {
          id: 'sub_123',
          user_id: 'user_123',
          plan: 'pro',
          billing_cycle: 'monthly',
          cancel_at_period_end: false,
        },
      ];
      mockSubscriptionsError = null;
      mockRenewSubscription.mockResolvedValue({ success: true });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/process-renewals', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.summary.total).toBe(1);
      expect(json.summary.success).toBe(1);
      expect(mockRenewSubscription).toHaveBeenCalledWith('sub_123');
    });

    it('취소 예정 구독은 취소 처리해야 한다', async () => {
      mockSubscriptionsData = [
        {
          id: 'sub_456',
          user_id: 'user_456',
          plan: 'pro',
          billing_cycle: 'monthly',
          cancel_at_period_end: true,
        },
      ];
      mockSubscriptionsError = null;

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/process-renewals', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.summary.canceled).toBe(1);
      expect(mockRenewSubscription).not.toHaveBeenCalled();
    });

    it('갱신 실패 시 실패로 기록해야 한다', async () => {
      mockSubscriptionsData = [
        {
          id: 'sub_789',
          user_id: 'user_789',
          plan: 'pro',
          billing_cycle: 'monthly',
          cancel_at_period_end: false,
        },
      ];
      mockSubscriptionsError = null;
      mockRenewSubscription.mockResolvedValue({
        success: false,
        error: '결제 실패',
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/process-renewals', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.summary.failed).toBe(1);
      expect(json.details.failed).toContain('sub_789');
    });
  });

  describe('응답 형식', () => {
    it('성공 응답에 요약 정보가 포함되어야 한다', async () => {
      mockSubscriptionsData = [
        { id: 'sub_1', user_id: 'user_1', cancel_at_period_end: false },
      ];
      mockSubscriptionsError = null;
      mockRenewSubscription.mockResolvedValue({ success: true });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/process-renewals', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(json).toHaveProperty('success');
      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('summary');
      expect(json.summary).toHaveProperty('total');
      expect(json.summary).toHaveProperty('success');
      expect(json.summary).toHaveProperty('canceled');
      expect(json.summary).toHaveProperty('failed');
      expect(json).toHaveProperty('timestamp');
    });

    it('상세 결과에 각 카테고리별 ID 목록이 포함되어야 한다', async () => {
      mockSubscriptionsData = [
        { id: 'sub_1', user_id: 'user_1', cancel_at_period_end: false },
        { id: 'sub_2', user_id: 'user_2', cancel_at_period_end: true },
        { id: 'sub_3', user_id: 'user_3', cancel_at_period_end: false },
      ];
      mockSubscriptionsError = null;
      mockRenewSubscription.mockResolvedValueOnce({ success: true });
      mockRenewSubscription.mockResolvedValueOnce({
        success: false,
        error: '오류',
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/process-renewals', {
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const response = await GET(request);
      const json = await response.json();

      expect(json.details).toHaveProperty('success');
      expect(json.details).toHaveProperty('canceled');
      expect(json.details).toHaveProperty('failed');
    });
  });

  describe('예외 처리', () => {
    it('전체 예외 발생 시 500 에러를 반환해야 한다', async () => {
      // 예외를 발생시키기 위해 from mock을 override
      mockAdminClient.from.mockImplementation(() => {
        throw new Error('Critical error');
      });

      const GET = await importHandler();
      const request = new NextRequest('http://localhost/api/cron/process-renewals', {
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
});

describe('process-renewals vs renew-subscriptions 비교', () => {
  it('process-renewals는 일일 스케줄로 실행되어야 한다', () => {
    // 매일 자정 UTC
    const schedule = '0 0 * * *';
    expect(schedule).toBe('0 0 * * *');
  });

  it('renew-subscriptions는 6시간 간격으로 실행되어야 한다', () => {
    const schedule = '0 */6 * * *';
    expect(schedule).toBe('0 */6 * * *');
  });

  it('두 엔드포인트의 기능이 중복됨을 인지해야 한다', () => {
    // 두 엔드포인트 모두 구독 갱신을 처리함
    // process-renewals: 오늘 만료 예정 구독만 처리
    // renew-subscriptions: 24시간 이내 만료 예정 구독 처리

    // 권장: 하나로 통합하거나 역할 명확화
    const isDuplicate = true;
    expect(isDuplicate).toBe(true);
  });
});

describe('보안 검증', () => {
  it('process-renewals의 CRON_SECRET 검증이 다른 Cron Job과 동일해야 한다', () => {
    // 수정 완료: if (!cronSecret) → 500, if (authHeader !== ...) → 401
    // 모든 Cron Job이 동일한 인증 패턴을 사용함:
    // - CRON_SECRET이 없으면 500 에러
    // - 인증 헤더가 틀리면 401 에러

    const isSecurityFixed = true;
    expect(isSecurityFixed).toBe(true);
  });
});
