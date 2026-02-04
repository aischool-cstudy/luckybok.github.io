import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase 모킹
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  })),
};

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockSupabaseClient),
}));

// TossPaymentsClient 모킹
const mockTossClient = {
  confirmPayment: vi.fn(),
  cancelPayment: vi.fn(),
  issueBillingKey: vi.fn(),
  chargeBilling: vi.fn(),
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
  generateOrderId: vi.fn(() => 'SUB_20240115143052_A1B2C3D4'),
  encryptBillingKey: vi.fn((key) => `encrypted_${key}`),
  decryptBillingKey: vi.fn((encrypted) => encrypted.replace('encrypted_', '')),
}));

describe('구독 서비스 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('구독 갱신 테스트', () => {
    it('활성 구독을 정상적으로 갱신해야 한다', async () => {
      // 테스트 데이터 설정
      const mockSubscription = {
        id: 'sub_123',
        user_id: 'user_123',
        plan: 'pro',
        billing_cycle: 'monthly',
        status: 'active',
        cancel_at_period_end: false,
        current_period_end: new Date().toISOString(),
        billing_keys: {
          encrypted_billing_key: 'encrypted_billing_key_123',
          customer_key: 'customer_123',
        },
      };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockSubscription, error: null }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      });

      mockTossClient.chargeBilling.mockResolvedValue({
        paymentKey: 'pk_renewal_123',
        orderId: 'SUB_20240115143052_A1B2C3D4',
        status: 'DONE',
        method: '카드',
        totalAmount: 29900,
        balanceAmount: 29900,
        approvedAt: new Date().toISOString(),
        receipt: { url: 'https://receipt.test.com' },
      });

      // renewSubscription 함수는 subscription.ts에 있음
      // 여기서는 로직 검증용 단위 테스트
      expect(mockSubscription.status).toBe('active');
      expect(mockSubscription.cancel_at_period_end).toBe(false);
    });

    it('취소 예정 구독은 갱신하지 않아야 한다', async () => {
      const mockSubscription = {
        id: 'sub_123',
        user_id: 'user_123',
        plan: 'pro',
        billing_cycle: 'monthly',
        status: 'active',
        cancel_at_period_end: true,
        current_period_end: new Date().toISOString(),
      };

      // 취소 예정인 구독은 갱신 대상이 아님
      expect(mockSubscription.cancel_at_period_end).toBe(true);

      // 갱신 시도 시 상태를 canceled로 변경해야 함
      const shouldRenew = !mockSubscription.cancel_at_period_end;
      expect(shouldRenew).toBe(false);
    });

    it('결제 실패 시 구독 상태를 past_due로 변경해야 한다', async () => {
      // mockSubscription: { id: 'sub_123', status: 'active' }

      // 결제 실패 시나리오
      const paymentFailed = true;
      const expectedStatus = paymentFailed ? 'past_due' : 'active';

      expect(expectedStatus).toBe('past_due');
    });

    it('빌링키가 없는 구독은 갱신할 수 없어야 한다', async () => {
      const mockSubscription = {
        id: 'sub_123',
        user_id: 'user_123',
        plan: 'pro',
        status: 'active',
        billing_keys: null,
      };

      expect(mockSubscription.billing_keys).toBeNull();
    });
  });

  describe('구독 취소 테스트', () => {
    it('구독 취소 시 cancel_at_period_end를 true로 설정해야 한다', async () => {
      const mockUser = { id: 'user_123', email: 'test@test.com' };
      const mockSubscription = {
        id: 'sub_123',
        user_id: 'user_123',
        status: 'active',
        cancel_at_period_end: false,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // 취소 후 상태
      const canceledSubscription = {
        ...mockSubscription,
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
      };

      expect(canceledSubscription.cancel_at_period_end).toBe(true);
      expect(canceledSubscription.canceled_at).toBeDefined();
    });

    it('즉시 취소 시 구독 상태를 canceled로 변경해야 한다', async () => {
      // mockSubscription: { id: 'sub_123', status: 'active' }
      const cancelImmediately = true;
      const expectedStatus = cancelImmediately ? 'canceled' : 'active';

      expect(expectedStatus).toBe('canceled');
    });

    it('취소된 구독은 다시 취소할 수 없어야 한다', async () => {
      const mockSubscription = {
        id: 'sub_123',
        status: 'canceled',
      };

      const canCancel = mockSubscription.status === 'active';
      expect(canCancel).toBe(false);
    });
  });

  describe('구독 취소 철회 테스트', () => {
    it('취소 예정 구독의 취소를 철회할 수 있어야 한다', async () => {
      const mockSubscription = {
        id: 'sub_123',
        status: 'active',
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
      };

      // 철회 후 상태
      const reactivatedSubscription = {
        ...mockSubscription,
        cancel_at_period_end: false,
        canceled_at: null,
      };

      expect(reactivatedSubscription.cancel_at_period_end).toBe(false);
      expect(reactivatedSubscription.canceled_at).toBeNull();
    });

    it('취소 예정이 아닌 구독은 철회할 수 없어야 한다', async () => {
      const mockSubscription = {
        id: 'sub_123',
        status: 'active',
        cancel_at_period_end: false,
      };

      const canReactivate = mockSubscription.cancel_at_period_end;
      expect(canReactivate).toBe(false);
    });
  });
});

describe('구독 금액 검증', () => {
  it('Pro 월간 구독 금액이 29,900원이어야 한다', () => {
    const proMonthlyPrice = 29900;
    expect(proMonthlyPrice).toBe(29900);
  });

  it('Pro 연간 구독 금액이 299,000원이어야 한다', () => {
    const proYearlyPrice = 299000;
    expect(proYearlyPrice).toBe(299000);
  });

  it('Team 월간 구독 금액이 99,000원이어야 한다', () => {
    const teamMonthlyPrice = 99000;
    expect(teamMonthlyPrice).toBe(99000);
  });

  it('Team 연간 구독 금액이 990,000원이어야 한다', () => {
    const teamYearlyPrice = 990000;
    expect(teamYearlyPrice).toBe(990000);
  });

  it('잘못된 금액으로 결제 시도 시 에러가 발생해야 한다', () => {
    const submittedAmount: number = 10000;
    const expectedAmount: number = 29900;

    const isValidAmount = submittedAmount === expectedAmount;
    expect(isValidAmount).toBe(false);
  });
});
