import { describe, it, expect, vi, beforeEach } from 'vitest';

// Logger 모킹
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

// Next.js headers 모킹
vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Map([['x-forwarded-for', '127.0.0.1']]))),
}));

// Auth 모킹
vi.mock('@/lib/auth', () => {
  class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthError';
    }
  }
  return {
    requireAuth: vi.fn(),
    AuthError,
  };
});

// Rate Limit 모킹
const mockCheckRateLimit = vi.fn();
const mockGetClientIP = vi.fn();
const mockGetRateLimitErrorMessage = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIP: (...args: unknown[]) => mockGetClientIP(...args),
  getRateLimitErrorMessage: (...args: unknown[]) => mockGetRateLimitErrorMessage(...args),
  RATE_LIMIT_PRESETS: {
    SUBSCRIPTION_CREATE: { maxRequests: 5, windowSeconds: 60 },
    PAYMENT_CONFIRM: { maxRequests: 10, windowSeconds: 60 },
  },
}));

// RPC 결과 파싱 모킹
vi.mock('@/lib/supabase/helpers', () => ({
  parseRpcResult: vi.fn((result) => {
    if (Array.isArray(result)) {
      const item = result[0];
      if (item?.success === false) {
        return { success: false, error: item.error_message || 'Unknown error' };
      }
      return { success: true, data: item };
    }
    if (result?.success === false) {
      return { success: false, error: result.error_message || 'Unknown error' };
    }
    return { success: true, data: result };
  }),
}));

// Supabase 클라이언트 모킹
const mockFromChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => mockFromChain),
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockSupabaseClient),
}));

// TossPayments 모킹
const mockTossClient = {
  issueBillingKey: vi.fn(),
  chargeBilling: vi.fn(),
  cancelPayment: vi.fn(),
};

vi.mock('@/lib/payment/toss', () => {
  class PaymentError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = 'PaymentError';
    }
  }
  return {
    getTossClient: vi.fn(() => mockTossClient),
    PaymentError,
    mapTossErrorToUserMessage: vi.fn((code: string) => {
      const messages: Record<string, string> = {
        INVALID_CARD_NUMBER: '유효하지 않은 카드 번호입니다',
        EXCEED_MAX_CARD_INSTALLMENT_PLAN: '할부 개월수가 초과되었습니다',
      };
      return messages[code] || '결제에 실패했습니다';
    }),
  };
});

// 암호화 모킹
vi.mock('@/lib/payment/crypto', () => ({
  generateOrderId: vi.fn(() => 'SUB_20260203120000_AB12CD34'),
  encryptBillingKey: vi.fn((key) => `encrypted_${key}`),
  decryptBillingKey: vi.fn((encrypted) => encrypted.replace('encrypted_', '')),
}));

// Proration 모킹
vi.mock('@/lib/payment/proration', () => ({
  calculateProration: vi.fn(() => ({
    changeType: 'upgrade',
    proratedAmount: 5000,
    newPlanAmount: 29900,
    effectiveDate: new Date(),
    requiresPayment: true,
    daysRemaining: 15,
  })),
  formatProrationSummary: vi.fn(() => '비례 배분 요약'),
}));

// Plans config 모킹
vi.mock('@/config/pricing', () => ({
  plans: {
    pro: {
      name: 'Pro',
      price: {
        monthly: 29900,
        yearly: 299000,
      },
    },
    team: {
      name: 'Team',
      price: {
        monthly: 99000,
        yearly: 990000,
      },
    },
  },
  creditPackages: [
    { id: 'basic', name: '베이직', credits: 50, price: 9900, validDays: 90 },
    { id: 'standard', name: '스탠다드', credits: 150, price: 24900, validDays: 90 },
    { id: 'premium', name: '프리미엄', credits: 350, price: 49900, validDays: 180 },
  ],
}));

// 테스트 대상 함수 import
import { requireAuth } from '@/lib/auth';
const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>;

describe('Subscription Create Actions', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    // 체인 메서드 리셋
    mockFromChain.select.mockReturnThis();
    mockFromChain.insert.mockReturnThis();
    mockFromChain.update.mockReturnThis();
    mockFromChain.delete.mockReturnThis();
    mockFromChain.eq.mockReturnThis();
    mockFromChain.in.mockReturnThis();
    mockFromChain.order.mockReturnThis();
    mockFromChain.limit.mockReturnThis();
    mockFromChain.single.mockReset();

    // 기본 Rate Limit 설정 (통과)
    mockGetClientIP.mockReturnValue('127.0.0.1');
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 4 });
  });

  describe('prepareSubscription', () => {
    // 동적 import로 테스트
    it('Rate Limit 초과 시 에러를 반환해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
      mockGetRateLimitErrorMessage.mockReturnValue('요청이 너무 많습니다.');

      const { prepareSubscription } = await import('@/actions/subscription/create');
      const result = await prepareSubscription({ plan: 'pro', billingCycle: 'monthly' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('요청이 너무 많습니다.');
    });

    it('비로그인 사용자는 에러를 반환해야 한다', async () => {
      const { AuthError } = await import('@/lib/auth');
      mockRequireAuth.mockRejectedValue(new AuthError('로그인이 필요합니다'));

      const { prepareSubscription } = await import('@/actions/subscription/create');
      const result = await prepareSubscription({ plan: 'pro', billingCycle: 'monthly' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('로그인이 필요합니다');
    });

    it('이미 같은 플랜을 구독 중이면 에러를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      // 첫 번째 single() 호출: 프로필 조회
      mockFromChain.single.mockResolvedValueOnce({
        data: { customer_key: 'cust_123', plan: 'pro' },
        error: null,
      });

      const { prepareSubscription } = await import('@/actions/subscription/create');
      const result = await prepareSubscription({ plan: 'pro', billingCycle: 'monthly' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('이미 해당 플랜을 구독 중입니다');
    });

    it('이미 활성 구독이 있으면 에러를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      // 프로필 조회
      mockFromChain.single.mockResolvedValueOnce({
        data: { customer_key: 'cust_123', plan: 'starter' },
        error: null,
      });
      // 활성 구독 조회
      mockFromChain.single.mockResolvedValueOnce({
        data: { id: 'sub_123', status: 'active' },
        error: null,
      });

      const { prepareSubscription } = await import('@/actions/subscription/create');
      const result = await prepareSubscription({ plan: 'pro', billingCycle: 'monthly' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('이미 활성 구독이 있습니다');
    });

    it('성공 시 결제 정보를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      // 프로필 조회 - 활성 구독 없음
      mockFromChain.single.mockResolvedValueOnce({
        data: { customer_key: 'cust_123', plan: 'starter' },
        error: null,
      });
      // 활성 구독 조회 - 없음
      mockFromChain.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });
      // 결제 레코드 생성
      mockFromChain.insert.mockReturnValue({
        ...mockFromChain,
        single: vi.fn().mockResolvedValue({ data: { id: 'payment_123' }, error: null }),
      });

      const { prepareSubscription } = await import('@/actions/subscription/create');
      const result = await prepareSubscription({ plan: 'pro', billingCycle: 'monthly' });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.orderId).toBeDefined();
      expect(result.data?.amount).toBe(29900);
      expect(result.data?.plan).toBe('pro');
    });
  });

  describe('confirmSubscription', () => {
    const validInput = {
      authKey: 'auth_key_123',
      customerKey: '550e8400-e29b-41d4-a716-446655440000', // UUID 형식
      orderId: 'SUB_20260203120000_AB12CD34',
      plan: 'pro' as const,
      billingCycle: 'monthly' as const,
    };

    it('Rate Limit 초과 시 에러를 반환해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
      mockGetRateLimitErrorMessage.mockReturnValue('요청이 너무 많습니다.');

      const { confirmSubscription } = await import('@/actions/subscription/create');
      const result = await confirmSubscription(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('요청이 너무 많습니다.');
    });

    it('결제 정보를 찾을 수 없으면 에러를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockFromChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const { confirmSubscription } = await import('@/actions/subscription/create');
      const result = await confirmSubscription(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('결제 정보를 찾을 수 없습니다');
    });

    it('이미 처리된 결제는 에러를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockFromChain.single.mockResolvedValueOnce({
        data: { id: 'payment_123', status: 'paid', amount: 29900 },
        error: null,
      });

      const { confirmSubscription } = await import('@/actions/subscription/create');
      const result = await confirmSubscription(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('이미 처리된 결제입니다');
    });

    it('빌링키 발급 성공 후 결제가 성공해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      // 결제 레코드 조회
      mockFromChain.single.mockResolvedValueOnce({
        data: { id: 'payment_123', status: 'pending', amount: 29900 },
        error: null,
      });

      // 빌링키 발급
      mockTossClient.issueBillingKey.mockResolvedValue({
        billingKey: 'billing_key_123',
        card: {
          company: '신한카드',
          number: '1234****5678',
          cardType: 'CREDIT',
        },
      });

      // 빌링키 저장 성공 mock
      mockFromChain.single.mockResolvedValueOnce({
        data: { id: 'billing_key_record_123' },
        error: null,
      });

      // 첫 번째 결제
      mockTossClient.chargeBilling.mockResolvedValue({
        paymentKey: 'pk_123',
        method: '카드',
        totalAmount: 29900,
        receipt: { url: 'https://receipt.test.com' },
        approvedAt: new Date().toISOString(),
      });

      // RPC 성공
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ success: true, subscription_id: 'sub_new_123' }],
        error: null,
      });

      const { confirmSubscription } = await import('@/actions/subscription/create');
      const result = await confirmSubscription(validInput);

      expect(result.success).toBe(true);
      expect(result.data?.subscriptionId).toBeDefined();
    });

    it('빌링키 발급 실패 시 에러를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      mockFromChain.single.mockResolvedValueOnce({
        data: { id: 'payment_123', status: 'pending', amount: 29900 },
        error: null,
      });

      // 빌링키 발급 실패
      const { PaymentError } = await import('@/lib/payment/toss');
      mockTossClient.issueBillingKey.mockRejectedValue(
        new PaymentError('INVALID_CARD_NUMBER', '유효하지 않은 카드 번호')
      );

      const { confirmSubscription } = await import('@/actions/subscription/create');
      const result = await confirmSubscription(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('유효하지 않은 카드');
    });
  });
});

describe('Subscription Current Actions', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFromChain.select.mockReturnThis();
    mockFromChain.eq.mockReturnThis();
    mockFromChain.in.mockReturnThis();
    mockFromChain.order.mockReturnThis();
    mockFromChain.limit.mockReturnThis();
    mockFromChain.single.mockReset();
  });

  describe('getCurrentSubscription', () => {
    it('비로그인 사용자는 에러를 반환해야 한다', async () => {
      const { AuthError } = await import('@/lib/auth');
      mockRequireAuth.mockRejectedValue(new AuthError('로그인이 필요합니다'));

      const { getCurrentSubscription } = await import('@/actions/subscription/current');
      const result = await getCurrentSubscription();

      expect(result.success).toBe(false);
      expect(result.error).toBe('로그인이 필요합니다');
    });

    it('활성 구독이 없으면 null을 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockFromChain.single.mockResolvedValue({ data: null, error: null });

      const { getCurrentSubscription } = await import('@/actions/subscription/current');
      const result = await getCurrentSubscription();

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('활성 구독 정보를 올바르게 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);

      mockFromChain.single.mockResolvedValue({
        data: {
          id: 'sub_123',
          plan: 'pro',
          status: 'active',
          current_period_end: futureDate.toISOString(),
          cancel_at_period_end: false,
          billing_keys: {
            card_company: '신한카드',
            card_number: '1234****5678',
          },
        },
        error: null,
      });

      const { getCurrentSubscription } = await import('@/actions/subscription/current');
      const result = await getCurrentSubscription();

      expect(result.success).toBe(true);
      expect(result.data?.plan).toBe('pro');
      expect(result.data?.status).toBe('active');
      expect(result.data?.cardInfo?.company).toBe('신한카드');
    });

    it('취소된 구독은 cancel_at_period_end가 true일 때만 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      // 즉시 취소된 경우 (cancel_at_period_end: false)
      mockFromChain.single.mockResolvedValue({
        data: {
          id: 'sub_123',
          status: 'canceled',
          cancel_at_period_end: false,
        },
        error: null,
      });

      const { getCurrentSubscription } = await import('@/actions/subscription/current');
      const result = await getCurrentSubscription();

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });
});

describe('Subscription Plan Changes Actions', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFromChain.select.mockReturnThis();
    mockFromChain.insert.mockReturnThis();
    mockFromChain.update.mockReturnThis();
    mockFromChain.delete.mockReturnThis();
    mockFromChain.eq.mockReturnThis();
    mockFromChain.in.mockReturnThis();
    mockFromChain.order.mockReturnThis();
    mockFromChain.limit.mockReturnThis();
    mockFromChain.single.mockReset();

    mockGetClientIP.mockReturnValue('127.0.0.1');
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 4 });
  });

  describe('preparePlanChange', () => {
    it('Rate Limit 초과 시 에러를 반환해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
      mockGetRateLimitErrorMessage.mockReturnValue('요청이 너무 많습니다.');

      const { preparePlanChange } = await import('@/actions/subscription/plan-changes');
      const result = await preparePlanChange({ newPlan: 'team', newBillingCycle: 'monthly' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('요청이 너무 많습니다.');
    });

    it('활성 구독이 없으면 에러를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockFromChain.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const { preparePlanChange } = await import('@/actions/subscription/plan-changes');
      const result = await preparePlanChange({ newPlan: 'team', newBillingCycle: 'monthly' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('활성 구독이 없습니다');
    });

    it('성공 시 비례 배분 정보를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);

      // 현재 구독 조회
      mockFromChain.single.mockResolvedValueOnce({
        data: {
          id: 'sub_123',
          plan: 'pro',
          billing_cycle: 'monthly',
          current_period_end: futureDate.toISOString(),
          profiles: { customer_key: 'cust_123' },
        },
        error: null,
      });

      const { preparePlanChange } = await import('@/actions/subscription/plan-changes');
      const result = await preparePlanChange({ newPlan: 'team', newBillingCycle: 'monthly' });

      expect(result.success).toBe(true);
      expect(result.data?.changeType).toBe('upgrade');
      expect(result.data?.proratedAmount).toBeDefined();
    });
  });

  describe('cancelScheduledPlanChange', () => {
    it('활성 구독이 없으면 에러를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockFromChain.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const { cancelScheduledPlanChange } = await import('@/actions/subscription/plan-changes');
      const result = await cancelScheduledPlanChange();

      expect(result.success).toBe(false);
      expect(result.error).toBe('활성 구독이 없습니다');
    });

    it('예약된 플랜 변경이 없으면 에러를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockFromChain.single.mockResolvedValue({
        data: { id: 'sub_123', scheduled_plan: null },
        error: null,
      });

      const { cancelScheduledPlanChange } = await import('@/actions/subscription/plan-changes');
      const result = await cancelScheduledPlanChange();

      expect(result.success).toBe(false);
      expect(result.error).toBe('예약된 플랜 변경이 없습니다');
    });

    it('예약된 플랜 변경을 취소할 수 있어야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockFromChain.single.mockResolvedValue({
        data: { id: 'sub_123', scheduled_plan: 'team' },
        error: null,
      });
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ success: true }],
        error: null,
      });

      const { cancelScheduledPlanChange } = await import('@/actions/subscription/plan-changes');
      const result = await cancelScheduledPlanChange();

      expect(result.success).toBe(true);
    });
  });

  describe('getScheduledPlanChange', () => {
    it('구독이 없으면 null을 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockFromChain.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const { getScheduledPlanChange } = await import('@/actions/subscription/plan-changes');
      const result = await getScheduledPlanChange();

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('예약된 플랜 변경 정보를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockFromChain.single.mockResolvedValue({
        data: {
          plan: 'pro',
          billing_cycle: 'monthly',
          scheduled_plan: 'team',
          scheduled_billing_cycle: 'yearly',
          scheduled_change_at: '2026-03-01T00:00:00Z',
        },
        error: null,
      });

      const { getScheduledPlanChange } = await import('@/actions/subscription/plan-changes');
      const result = await getScheduledPlanChange();

      expect(result.success).toBe(true);
      expect(result.data?.hasScheduledChange).toBe(true);
      expect(result.data?.currentPlan).toBe('pro');
      expect(result.data?.scheduledPlan).toBe('team');
    });
  });
});

describe('Subscription Renewal Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFromChain.select.mockReturnThis();
    mockFromChain.insert.mockReturnThis();
    mockFromChain.update.mockReturnThis();
    mockFromChain.delete.mockReturnThis();
    mockFromChain.eq.mockReturnThis();
    mockFromChain.in.mockReturnThis();
    mockFromChain.order.mockReturnThis();
    mockFromChain.limit.mockReturnThis();
    mockFromChain.single.mockReset();
  });

  describe('renewSubscription', () => {
    it('구독을 찾을 수 없으면 에러를 반환해야 한다', async () => {
      mockFromChain.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const { renewSubscription } = await import('@/actions/subscription/renewal');
      const result = await renewSubscription('non_existent_sub');

      expect(result.success).toBe(false);
      expect(result.error).toBe('구독을 찾을 수 없습니다');
    });

    it('활성 상태가 아닌 구독은 갱신할 수 없어야 한다', async () => {
      mockFromChain.single.mockResolvedValue({
        data: { id: 'sub_123', status: 'canceled' },
        error: null,
      });

      const { renewSubscription } = await import('@/actions/subscription/renewal');
      const result = await renewSubscription('sub_123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('활성 상태의 구독만 갱신할 수 있습니다');
    });

    it('취소 예정인 구독은 갱신하지 않고 canceled로 변경해야 한다', async () => {
      mockFromChain.single.mockResolvedValue({
        data: {
          id: 'sub_123',
          user_id: 'user_123',
          status: 'active',
          cancel_at_period_end: true,
        },
        error: null,
      });

      const { renewSubscription } = await import('@/actions/subscription/renewal');
      const result = await renewSubscription('sub_123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('취소 예정인 구독입니다');
      // update가 호출되었는지 확인
      expect(mockFromChain.update).toHaveBeenCalled();
    });

    it('결제 수단이 없으면 에러를 반환해야 한다', async () => {
      mockFromChain.single.mockResolvedValue({
        data: {
          id: 'sub_123',
          status: 'active',
          cancel_at_period_end: false,
          billing_keys: null,
        },
        error: null,
      });

      const { renewSubscription } = await import('@/actions/subscription/renewal');
      const result = await renewSubscription('sub_123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('결제 수단이 없습니다');
    });

    it('갱신 결제가 성공해야 한다', async () => {
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 1);

      // 구독 조회
      mockFromChain.single.mockResolvedValueOnce({
        data: {
          id: 'sub_123',
          user_id: 'user_123',
          plan: 'pro',
          billing_cycle: 'monthly',
          status: 'active',
          cancel_at_period_end: false,
          current_period_end: currentPeriodEnd.toISOString(),
          billing_keys: {
            encrypted_billing_key: 'encrypted_billing_key_123',
            customer_key: 'cust_123',
          },
        },
        error: null,
      });

      // 결제 레코드 생성
      mockFromChain.single.mockResolvedValueOnce({
        data: { id: 'payment_renewal_123' },
        error: null,
      });

      // 결제 실행
      mockTossClient.chargeBilling.mockResolvedValue({
        paymentKey: 'pk_renewal_123',
        method: '카드',
        totalAmount: 29900,
        receipt: { url: 'https://receipt.test.com' },
        approvedAt: new Date().toISOString(),
      });

      // RPC 성공
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ success: true }],
        error: null,
      });

      const { renewSubscription } = await import('@/actions/subscription/renewal');
      const result = await renewSubscription('sub_123');

      expect(result.success).toBe(true);
      expect(result.data?.paymentId).toBe('payment_renewal_123');
    });

    it('결제 실패 시 재시도를 예약해야 한다', async () => {
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 1);

      // 구독 조회
      mockFromChain.single.mockResolvedValueOnce({
        data: {
          id: 'sub_123',
          user_id: 'user_123',
          plan: 'pro',
          billing_cycle: 'monthly',
          status: 'active',
          cancel_at_period_end: false,
          current_period_end: currentPeriodEnd.toISOString(),
          billing_keys: {
            encrypted_billing_key: 'encrypted_billing_key_123',
            customer_key: 'cust_123',
          },
          metadata: {},
        },
        error: null,
      });

      // 결제 레코드 생성
      mockFromChain.single.mockResolvedValueOnce({
        data: { id: 'payment_renewal_123' },
        error: null,
      });

      // 결제 실패
      const { PaymentError } = await import('@/lib/payment/toss');
      mockTossClient.chargeBilling.mockRejectedValue(
        new PaymentError('INSUFFICIENT_BALANCE', '잔액 부족')
      );

      const { renewSubscription } = await import('@/actions/subscription/renewal');
      const result = await renewSubscription('sub_123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('1/3회 시도');
      expect(mockFromChain.update).toHaveBeenCalled();
    });

    it('최대 재시도 횟수 초과 시 past_due로 변경해야 한다', async () => {
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 1);

      // 구독 조회 - 이미 2번 재시도함
      mockFromChain.single.mockResolvedValueOnce({
        data: {
          id: 'sub_123',
          user_id: 'user_123',
          plan: 'pro',
          billing_cycle: 'monthly',
          status: 'active',
          cancel_at_period_end: false,
          current_period_end: currentPeriodEnd.toISOString(),
          billing_keys: {
            encrypted_billing_key: 'encrypted_billing_key_123',
            customer_key: 'cust_123',
          },
          metadata: { renewal_retry_count: 2 },
        },
        error: null,
      });

      // 결제 레코드 생성
      mockFromChain.single.mockResolvedValueOnce({
        data: { id: 'payment_renewal_123' },
        error: null,
      });

      // 결제 실패
      const { PaymentError } = await import('@/lib/payment/toss');
      mockTossClient.chargeBilling.mockRejectedValue(
        new PaymentError('INSUFFICIENT_BALANCE', '잔액 부족')
      );

      const { renewSubscription } = await import('@/actions/subscription/renewal');
      const result = await renewSubscription('sub_123');

      expect(result.success).toBe(false);
      // past_due로 변경 확인
      expect(mockFromChain.update).toHaveBeenCalled();
    });
  });
});
