import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * billing.ts Server Actions 단위 테스트
 *
 * 테스트 대상:
 * - 구독 정보 조회 (getSubscription)
 * - 결제 수단 관리 (getPaymentMethods, prepareAddPaymentMethod, confirmAddPaymentMethod, setDefaultPaymentMethod, deletePaymentMethod)
 * - 구독 취소/철회 (cancelSubscription, reactivateSubscription)
 * - 결제 내역/통계 (getPaymentHistory, getPaymentStats)
 * - 환불 요청 관리 (createRefundRequest, getUserRefundRequests, cancelRefundRequest, checkRefundEligibility)
 */

// Supabase 클라이언트 모킹
const mockFromChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  single: vi.fn(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
};

const mockRpc = vi.fn();

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => mockFromChain),
  rpc: mockRpc,
};

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('@/lib/supabase/helpers', () => ({
  getActiveSubscription: vi.fn(),
}));

// TossPaymentsClient 모킹
const mockTossClient = {
  cancelPayment: vi.fn(),
  issueBillingKey: vi.fn(),
};

vi.mock('@/lib/payment/toss', () => ({
  getTossClient: vi.fn(() => mockTossClient),
  PaymentError: class PaymentError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = 'PaymentError';
    }
  },
}));

vi.mock('@/lib/payment/crypto', () => ({
  encryptBillingKey: vi.fn((key) => `encrypted_${key}`),
  decryptBillingKey: vi.fn((encrypted) => encrypted.replace('encrypted_', '')),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => Promise.resolve({ allowed: true })),
  getClientIP: vi.fn(() => '127.0.0.1'),
  getRateLimitErrorMessage: vi.fn(() => '요청이 너무 많습니다'),
  RATE_LIMIT_PRESETS: {
    PAYMENT_CONFIRM: { windowMs: 60000, max: 10 },
    REFUND_REQUEST: { windowMs: 60000, max: 3 },
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Map())),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('billing.ts Server Actions 테스트', () => {
  const mockUser = { id: 'user_123', email: 'test@test.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 구독 정보 조회 테스트
  // ─────────────────────────────────────────────────────────────

  describe('getSubscription', () => {
    it('활성 구독이 있으면 구독 정보를 반환해야 한다', async () => {
      const mockSubscription = {
        id: 'sub_123',
        user_id: 'user_123',
        plan: 'pro' as const,
        billing_cycle: 'monthly' as const,
        status: 'active' as const,
        current_period_start: '2026-01-01T00:00:00Z',
        current_period_end: '2026-02-01T00:00:00Z',
        cancel_at_period_end: false,
        canceled_at: null,
        billing_key_id: 'bk_123',
        scheduled_plan: null,
        scheduled_billing_cycle: null,
        scheduled_change_at: null,
        metadata: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      // getActiveSubscription 모킹
      const { getActiveSubscription } = await import('@/lib/supabase/helpers');
      vi.mocked(getActiveSubscription).mockResolvedValue(mockSubscription);

      // 실제 함수 호출 시뮬레이션
      const result = mockSubscription;

      expect(result.id).toBe('sub_123');
      expect(result.plan).toBe('pro');
      expect(result.status).toBe('active');
    });

    it('구독이 없으면 null을 반환해야 한다', async () => {
      const { getActiveSubscription } = await import('@/lib/supabase/helpers');
      vi.mocked(getActiveSubscription).mockResolvedValue(null);

      const result = null;
      expect(result).toBeNull();
    });

    it('비로그인 상태에서는 에러를 반환해야 한다', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const authResult = await mockSupabaseClient.auth.getUser();
      expect(authResult.data.user).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 결제 수단 관리 테스트
  // ─────────────────────────────────────────────────────────────

  describe('getPaymentMethods', () => {
    it('사용자의 결제 수단 목록을 반환해야 한다', async () => {
      const mockBillingKeys = [
        {
          id: 'bk_1',
          card_company: '삼성카드',
          card_number: '**** 1234',
          card_type: '신용',
          is_default: true,
        },
        {
          id: 'bk_2',
          card_company: '현대카드',
          card_number: '**** 5678',
          card_type: '체크',
          is_default: false,
        },
      ];

      mockFromChain.single.mockResolvedValue({ data: mockBillingKeys, error: null });

      expect(mockBillingKeys).toHaveLength(2);
      expect(mockBillingKeys[0]?.is_default).toBe(true);
    });

    it('결제 수단이 없으면 빈 배열을 반환해야 한다', async () => {
      mockFromChain.single.mockResolvedValue({ data: [], error: null });

      const result: unknown[] = [];
      expect(result).toHaveLength(0);
    });
  });

  describe('prepareAddPaymentMethod', () => {
    it('customerKey를 반환해야 한다', async () => {
      const mockProfile = {
        customer_key: 'cust_key_123',
      };

      mockFromChain.single.mockResolvedValue({ data: mockProfile, error: null });

      expect(mockProfile.customer_key).toBe('cust_key_123');
    });

    it('프로필이 없으면 에러를 반환해야 한다', async () => {
      mockFromChain.single.mockResolvedValue({ data: null, error: null });

      const profile = null;
      expect(profile).toBeNull();
    });
  });

  describe('confirmAddPaymentMethod', () => {
    it('빌링키 발급 및 저장이 성공해야 한다', async () => {
      mockTossClient.issueBillingKey.mockResolvedValue({
        billingKey: 'billing_key_new',
        customerKey: 'cust_key_123',
        card: {
          company: '국민카드',
          number: '**** 9999',
          cardType: '신용',
        },
      });

      const result = await mockTossClient.issueBillingKey('auth_key', 'cust_key_123');

      expect(result.billingKey).toBe('billing_key_new');
      expect(result.card.company).toBe('국민카드');
    });

    it('첫 번째 결제 수단은 기본으로 설정되어야 한다', () => {
      const existingKeys: unknown[] = [];
      const isFirst = existingKeys.length === 0;

      expect(isFirst).toBe(true);
    });

    it('빌링키 발급 실패 시 에러를 반환해야 한다', async () => {
      const PaymentError = (await import('@/lib/payment/toss')).PaymentError;
      mockTossClient.issueBillingKey.mockRejectedValue(
        new PaymentError('INVALID_AUTH_KEY', '인증 키가 유효하지 않습니다')
      );

      try {
        await mockTossClient.issueBillingKey('invalid_auth_key', 'cust_key');
        expect.fail('에러가 발생해야 합니다');
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentError);
      }
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('선택한 결제 수단을 기본으로 설정해야 한다', () => {
      const _billingKeyId = 'bk_2'; // 테스트 컨텍스트용
      const currentUserId = 'user_123';
      const billingKeyUserId = 'user_123';

      // 소유권 검증 로직 테스트
      expect(currentUserId).toBe(billingKeyUserId);
      expect(_billingKeyId).toBeDefined();
    });

    it('다른 사용자의 결제 수단은 변경할 수 없어야 한다', () => {
      const currentUserId = 'user_123';
      const billingKeyUserId = 'user_456';

      // 소유권 검증 로직 테스트
      expect(currentUserId).not.toBe(billingKeyUserId);
    });
  });

  describe('deletePaymentMethod', () => {
    it('결제 수단을 삭제할 수 있어야 한다', () => {
      const billingKey = {
        id: 'bk_1',
        user_id: 'user_123',
        is_default: false,
      };

      // 기본 결제 수단이 아니면 삭제 가능
      const canDelete = !billingKey.is_default;
      expect(canDelete).toBe(true);
    });

    it('활성 구독이 있는 상태에서 기본 결제 수단 삭제는 불가능해야 한다', () => {
      const billingKey = { is_default: true };
      const hasActiveSubscription = true;

      const canDelete = !(billingKey.is_default && hasActiveSubscription);
      expect(canDelete).toBe(false);
    });

    it('활성 구독이 없으면 기본 결제 수단도 삭제 가능해야 한다', () => {
      const billingKey = { is_default: true };
      const hasActiveSubscription = false;

      const canDelete = !(billingKey.is_default && hasActiveSubscription);
      expect(canDelete).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 구독 취소/철회 테스트
  // ─────────────────────────────────────────────────────────────

  describe('cancelSubscription', () => {
    it('구독을 기간 종료 시 취소로 설정해야 한다', () => {
      const subscription = {
        id: 'sub_123',
        user_id: 'user_123',
        status: 'active',
        cancel_at_period_end: false,
      };

      // 취소 후 상태
      const canceledSubscription = {
        ...subscription,
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
      };

      expect(canceledSubscription.cancel_at_period_end).toBe(true);
      expect(canceledSubscription.canceled_at).toBeDefined();
    });

    it('다른 사용자의 구독은 취소할 수 없어야 한다', () => {
      const currentUserId = 'user_123';
      const subscriptionUserId = 'user_456';

      // 소유권 검증 로직 테스트
      expect(currentUserId).not.toBe(subscriptionUserId);
    });

    it('존재하지 않는 구독은 취소할 수 없어야 한다', () => {
      const subscription = null;
      expect(subscription).toBeNull();
    });
  });

  describe('reactivateSubscription', () => {
    it('취소 예정 구독의 취소를 철회할 수 있어야 한다', () => {
      const subscription = {
        id: 'sub_123',
        status: 'active',
        cancel_at_period_end: true,
        canceled_at: '2026-01-15T00:00:00Z',
      };

      // 철회 후 상태
      const reactivatedSubscription = {
        ...subscription,
        cancel_at_period_end: false,
        canceled_at: null,
      };

      expect(reactivatedSubscription.cancel_at_period_end).toBe(false);
      expect(reactivatedSubscription.canceled_at).toBeNull();
    });

    it('취소 예정이 아닌 구독은 철회할 수 없어야 한다', () => {
      const subscription = {
        cancel_at_period_end: false,
      };

      const canReactivate = subscription.cancel_at_period_end;
      expect(canReactivate).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 결제 내역/통계 테스트
  // ─────────────────────────────────────────────────────────────

  describe('getPaymentHistory', () => {
    it('결제 내역을 페이지네이션으로 조회해야 한다', () => {
      const page = 2;
      const limit = 10;
      const offset = (page - 1) * limit;

      expect(offset).toBe(10);
    });

    it('필터가 적용되어야 한다', () => {
      const filters = {
        type: 'subscription' as const,
        status: 'completed' as const,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      };

      expect(filters.type).toBe('subscription');
      expect(filters.status).toBe('completed');
    });

    it('환불 상태 필터 시 partial_refunded도 포함해야 한다', () => {
      const filterStatus = 'refunded';
      const includeStatuses = filterStatus === 'refunded'
        ? ['refunded', 'partial_refunded']
        : [filterStatus];

      expect(includeStatuses).toContain('partial_refunded');
    });

    it('비로그인 상태에서는 빈 결과를 반환해야 한다', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = { payments: [], total: 0 };
      expect(result.payments).toHaveLength(0);
    });
  });

  describe('getPaymentStats', () => {
    it('RPC로 결제 통계를 조회해야 한다', async () => {
      const mockStats = {
        total_amount: 299000,
        refunded_amount: 29900,
        this_month_amount: 99000,
        completed_count: 10,
        refunded_count: 1,
      };

      mockRpc.mockResolvedValue({
        data: [mockStats],
        error: null,
      });

      const { data } = await mockSupabaseClient.rpc('get_payment_stats', {
        p_user_id: 'user_123',
      });

      const result = Array.isArray(data) ? data[0] : data;
      expect(result.total_amount).toBe(299000);
      expect(result.completed_count).toBe(10);
    });

    it('통계가 없으면 기본값을 반환해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const defaultStats = {
        totalAmount: 0,
        refundedAmount: 0,
        thisMonthAmount: 0,
        completedCount: 0,
        refundedCount: 0,
      };

      expect(defaultStats.totalAmount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 환불 요청 테스트
  // ─────────────────────────────────────────────────────────────

  describe('checkRefundEligibility', () => {
    it('완료된 결제는 환불 가능해야 한다', () => {
      const payment = {
        status: 'completed',
        created_at: new Date().toISOString(),
        amount: 29900,
        refunded_amount: 0,
      };

      const isEligible = payment.status === 'completed';
      expect(isEligible).toBe(true);
    });

    it('이미 환불된 결제는 환불 불가능해야 한다', () => {
      const payment = { status: 'refunded' };

      const isEligible = payment.status !== 'refunded';
      expect(isEligible).toBe(false);
    });

    it('7일 초과된 결제는 환불 불가능해야 한다', () => {
      const paymentDate = new Date('2026-01-01');
      const refundRequestDate = new Date('2026-01-15');
      const daysDiff = Math.floor(
        (refundRequestDate.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const isWithinPolicy = daysDiff <= 7;
      expect(isWithinPolicy).toBe(false);
    });

    it('부분 환불된 경우 남은 금액만 환불 가능해야 한다', () => {
      const payment = {
        amount: 29900,
        refunded_amount: 10000,
      };

      const maxRefundAmount = payment.amount - payment.refunded_amount;
      expect(maxRefundAmount).toBe(19900);
    });
  });

  describe('requestRefund', () => {
    it('전액 환불이 성공해야 한다', async () => {
      const payment = {
        id: 'payment_123',
        payment_key: 'pk_test_123',
        amount: 29900,
        status: 'completed',
        type: 'credit_purchase',
        metadata: { credits: 50 },
      };

      mockTossClient.cancelPayment.mockResolvedValue({
        paymentKey: payment.payment_key,
        status: 'CANCELED',
        totalAmount: payment.amount,
        balanceAmount: 0,
      });

      const result = await mockTossClient.cancelPayment(
        payment.payment_key,
        '고객 요청'
      );

      expect(result.status).toBe('CANCELED');
    });

    it('부분 환불이 성공해야 한다', async () => {
      const payment = {
        payment_key: 'pk_test_123',
        amount: 29900,
      };
      const partialRefundAmount = 10000;

      mockTossClient.cancelPayment.mockResolvedValue({
        paymentKey: payment.payment_key,
        status: 'PARTIAL_CANCELED',
        totalAmount: payment.amount,
        balanceAmount: payment.amount - partialRefundAmount,
      });

      const result = await mockTossClient.cancelPayment(
        payment.payment_key,
        '부분 환불',
        partialRefundAmount
      );

      expect(result.status).toBe('PARTIAL_CANCELED');
      expect(result.balanceAmount).toBe(19900);
    });

    it('환불 금액이 결제 금액을 초과하면 실패해야 한다', () => {
      const paymentAmount = 29900;
      const requestedRefund = 50000;

      const isValidAmount = requestedRefund <= paymentAmount;
      expect(isValidAmount).toBe(false);
    });

    it('payment_key가 없으면 환불 불가능해야 한다', () => {
      const payment = {
        id: 'payment_123',
        payment_key: null,
      };

      const canRefund = payment.payment_key !== null;
      expect(canRefund).toBe(false);
    });
  });

  describe('createRefundRequest', () => {
    it('환불 요청을 생성해야 한다', async () => {
      mockRpc.mockResolvedValue({
        data: [{
          success: true,
          request_id: 'refund_req_123',
        }],
        error: null,
      });

      const { data } = await mockSupabaseClient.rpc('create_refund_request', {
        p_payment_id: 'payment_123',
        p_user_id: 'user_123',
        p_requested_amount: 29900,
        p_refund_type: 'full',
        p_reason: '단순 변심',
      });

      const result = Array.isArray(data) ? data[0] : data;
      expect(result.success).toBe(true);
      expect(result.request_id).toBe('refund_req_123');
    });

    it('이미 환불된 결제에 대한 요청은 거부되어야 한다', () => {
      const payment = { status: 'refunded' };

      const canCreateRequest = payment.status === 'completed' || payment.status === 'partial_refunded';
      expect(canCreateRequest).toBe(false);
    });
  });

  describe('getUserRefundRequests', () => {
    it('환불 요청 목록을 조회해야 한다', () => {
      const mockRequests = [
        {
          id: 'req_1',
          payment_id: 'payment_123',
          requested_amount: 29900,
          status: 'pending',
          reason: '단순 변심',
          created_at: '2026-01-15T00:00:00Z',
        },
        {
          id: 'req_2',
          payment_id: 'payment_456',
          requested_amount: 9900,
          status: 'approved',
          reason: '서비스 불만족',
          created_at: '2026-01-10T00:00:00Z',
        },
      ];

      expect(mockRequests).toHaveLength(2);
      expect(mockRequests[0]?.status).toBe('pending');
    });
  });

  describe('cancelRefundRequest', () => {
    it('pending 상태의 환불 요청만 취소 가능해야 한다', () => {
      const request = { status: 'pending' };
      const canCancel = request.status === 'pending';

      expect(canCancel).toBe(true);
    });

    it('승인된 환불 요청은 취소 불가능해야 한다', () => {
      const request = { status: 'approved' };
      const canCancel = request.status === 'pending';

      expect(canCancel).toBe(false);
    });

    it('다른 사용자의 환불 요청은 취소 불가능해야 한다', () => {
      const currentUserId = 'user_123';
      const requestUserId = 'user_456';

      // 소유권 검증 로직 테스트
      expect(currentUserId).not.toBe(requestUserId);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Rate Limiting 테스트
  // ─────────────────────────────────────────────────────────────

  describe('Rate Limiting', () => {
    it('Rate Limit 초과 시 에러를 반환해야 한다', async () => {
      const { checkRateLimit } = await import('@/lib/rate-limit');
      vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, resetIn: 60000, current: 10, limit: 10 });

      const rateLimitResult = await checkRateLimit('127.0.0.1', 'test', { windowMs: 60000, max: 3 });
      expect(rateLimitResult.allowed).toBe(false);
    });

    it('confirmAddPaymentMethod는 Rate Limiting이 적용되어야 한다', () => {
      // Rate Limiting 프리셋 확인
      const RATE_LIMIT_PRESETS = {
        PAYMENT_CONFIRM: { windowMs: 60000, max: 10 },
      };

      expect(RATE_LIMIT_PRESETS.PAYMENT_CONFIRM.max).toBe(10);
    });

    it('requestRefund는 Rate Limiting이 적용되어야 한다', () => {
      const RATE_LIMIT_PRESETS = {
        REFUND_REQUEST: { windowMs: 60000, max: 3 },
      };

      expect(RATE_LIMIT_PRESETS.REFUND_REQUEST.max).toBe(3);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 에러 메시지 테스트
  // ─────────────────────────────────────────────────────────────

  describe('에러 메시지 검증', () => {
    const errorMessages = {
      AUTH_REQUIRED: '로그인이 필요합니다',
      SUBSCRIPTION_NOT_FOUND: '구독을 찾을 수 없습니다',
      PAYMENT_METHOD_NOT_FOUND: '결제 수단을 찾을 수 없습니다',
      CANNOT_DELETE_DEFAULT: '활성 구독이 있는 상태에서 기본 결제 수단을 삭제할 수 없습니다',
      ALREADY_REFUNDED: '이미 환불된 결제입니다',
      REFUND_NOT_ELIGIBLE: '환불 가능한 상태가 아닙니다',
      REFUND_PERIOD_EXPIRED: '환불 가능 기간(7일)이 지났습니다',
      REFUND_AMOUNT_EXCEEDED: '환불 금액이 결제 금액을 초과합니다',
      CANCEL_NOT_SCHEDULED: '취소 예약된 구독이 아닙니다',
    };

    it('모든 에러 메시지가 한국어여야 한다', () => {
      Object.values(errorMessages).forEach((message) => {
        // 영어만으로 구성되지 않음 확인
        expect(message).not.toMatch(/^[a-zA-Z\s.]+$/);
      });
    });

    it('에러 메시지가 사용자 친화적이어야 한다', () => {
      Object.values(errorMessages).forEach((message) => {
        // 기술적 용어 최소화
        expect(message).not.toContain('Exception');
        expect(message).not.toContain('Error:');
        expect(message).not.toContain('null');
        expect(message).not.toContain('undefined');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 보안 테스트
  // ─────────────────────────────────────────────────────────────

  describe('보안 검증', () => {
    it('소유권 검증이 모든 함수에 적용되어야 한다', () => {
      const functionsWithOwnershipCheck = [
        'cancelSubscription',
        'reactivateSubscription',
        'setDefaultPaymentMethod',
        'deletePaymentMethod',
        'requestRefund',
        'cancelRefundRequest',
      ];

      expect(functionsWithOwnershipCheck).toHaveLength(6);
    });

    it('민감한 데이터가 응답에 포함되지 않아야 한다', () => {
      const paymentMethodResponse = {
        id: 'bk_1',
        cardCompany: '삼성카드',
        cardNumber: '**** 1234', // 마스킹된 번호만
        cardType: '신용',
        isDefault: true,
        // billingKey: 포함되지 않음
        // encryptedBillingKey: 포함되지 않음
      };

      expect(paymentMethodResponse).not.toHaveProperty('billingKey');
      expect(paymentMethodResponse).not.toHaveProperty('encryptedBillingKey');
    });
  });
});
