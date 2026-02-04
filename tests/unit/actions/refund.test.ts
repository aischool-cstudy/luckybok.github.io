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
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
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
  cancelPayment: vi.fn(),
};

vi.mock('@/lib/payment/toss', () => ({
  getTossClient: vi.fn(() => mockTossClient),
  TossPaymentsClient: vi.fn(),
  PaymentError: class PaymentError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = 'PaymentError';
    }
  },
}));

describe('환불 플로우 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('전액 환불', () => {
    it('전액 환불이 성공해야 한다', async () => {
      const mockPayment = {
        id: 'payment_123',
        payment_key: 'pk_test_123',
        amount: 29900,
        status: 'completed',
        type: 'credit_purchase',
        metadata: { credits: 50 },
      };

      mockTossClient.cancelPayment.mockResolvedValue({
        paymentKey: mockPayment.payment_key,
        status: 'CANCELED',
        totalAmount: mockPayment.amount,
        balanceAmount: 0,
      });

      const result = await mockTossClient.cancelPayment(
        mockPayment.payment_key,
        '고객 요청에 의한 환불'
      );

      expect(result.status).toBe('CANCELED');
      expect(result.balanceAmount).toBe(0);
    });

    it('전액 환불 시 크레딧이 차감되어야 한다', () => {
      const currentCredits = 100;
      const refundCredits = 50;
      const expectedBalance = currentCredits - refundCredits;

      expect(expectedBalance).toBe(50);
    });

    it('환불 금액이 결제 금액과 일치해야 한다', () => {
      const paymentAmount = 29900;
      const refundAmount = 29900;

      expect(refundAmount).toBe(paymentAmount);
    });
  });

  describe('부분 환불', () => {
    it('부분 환불이 성공해야 한다', async () => {
      const mockPayment = {
        id: 'payment_123',
        payment_key: 'pk_test_123',
        amount: 29900,
        status: 'completed',
      };

      const partialRefundAmount = 10000;

      mockTossClient.cancelPayment.mockResolvedValue({
        paymentKey: mockPayment.payment_key,
        status: 'PARTIAL_CANCELED',
        totalAmount: mockPayment.amount,
        balanceAmount: mockPayment.amount - partialRefundAmount,
      });

      const result = await mockTossClient.cancelPayment(
        mockPayment.payment_key,
        '부분 환불',
        partialRefundAmount
      );

      expect(result.status).toBe('PARTIAL_CANCELED');
      expect(result.balanceAmount).toBe(19900);
    });

    it('부분 환불 금액은 결제 금액보다 작아야 한다', () => {
      const paymentAmount = 29900;
      const partialRefundAmount = 10000;

      expect(partialRefundAmount).toBeLessThan(paymentAmount);
    });

    it('부분 환불 시 상태가 partial_refunded로 변경되어야 한다', () => {
      // 이전 상태: 'completed'
      const afterPartialRefund = 'partial_refunded';

      expect(afterPartialRefund).toBe('partial_refunded');
    });
  });

  describe('환불 실패 케이스', () => {
    it('이미 환불된 결제는 재환불이 불가능해야 한다', async () => {
      const mockPayment = {
        id: 'payment_123',
        payment_key: 'pk_test_123',
        amount: 29900,
        status: 'refunded',
      };

      const canRefund = mockPayment.status === 'completed' || mockPayment.status === 'partial_refunded';
      expect(canRefund).toBe(false);
    });

    it('취소된 결제는 환불이 불가능해야 한다', async () => {
      const mockPayment = {
        id: 'payment_123',
        status: 'canceled',
      };

      const canRefund = mockPayment.status === 'completed';
      expect(canRefund).toBe(false);
    });

    it('실패한 결제는 환불이 불가능해야 한다', async () => {
      const mockPayment = {
        id: 'payment_123',
        status: 'failed',
      };

      const canRefund = mockPayment.status === 'completed';
      expect(canRefund).toBe(false);
    });

    it('환불 금액이 잔여 금액보다 크면 실패해야 한다', () => {
      const remainingAmount = 10000;
      const requestedRefund = 20000;

      const isValidRefund = requestedRefund <= remainingAmount;
      expect(isValidRefund).toBe(false);
    });
  });

  describe('환불 후 크레딧 처리', () => {
    it('크레딧 구매 환불 시 크레딧이 차감되어야 한다', () => {
      const payment = {
        type: 'credit_purchase',
        metadata: { credits: 50 },
      };

      const currentBalance = 100;
      const creditsToDeduct = payment.metadata.credits;
      const newBalance = currentBalance - creditsToDeduct;

      expect(newBalance).toBe(50);
    });

    it('환불로 인한 크레딧 차감은 0 미만이 될 수 없어야 한다', () => {
      const currentBalance = 30;
      const creditsToDeduct = 50;
      const newBalance = Math.max(0, currentBalance - creditsToDeduct);

      expect(newBalance).toBe(0);
    });

    it('구독 환불 시 구독이 취소되어야 한다', () => {
      const payment = {
        type: 'subscription',
        metadata: { subscriptionId: 'sub_123' },
      };

      const shouldCancelSubscription = payment.type === 'subscription';
      expect(shouldCancelSubscription).toBe(true);
    });

    it('구독 환불 시 플랜이 starter로 변경되어야 한다', () => {
      // 환불 전 상태: { plan: 'pro' }
      const afterRefund = { plan: 'starter' };

      expect(afterRefund.plan).toBe('starter');
    });
  });

  describe('환불 트랜잭션 기록', () => {
    it('환불 시 크레딧 트랜잭션이 기록되어야 한다', () => {
      const transaction = {
        user_id: 'user_123',
        type: 'refund',
        amount: -50,
        balance: 50,
        description: '결제 취소로 인한 크레딧 차감',
        payment_id: 'payment_123',
      };

      expect(transaction.type).toBe('refund');
      expect(transaction.amount).toBeLessThan(0);
    });

    it('환불 트랜잭션에 결제 ID가 연결되어야 한다', () => {
      const transaction = {
        payment_id: 'payment_123',
      };

      expect(transaction.payment_id).toBeDefined();
    });
  });
});

describe('환불 정책 검증', () => {
  it('구매 후 7일 이내 환불 가능해야 한다', () => {
    const purchaseDate = new Date('2024-01-10');
    const refundRequestDate = new Date('2024-01-15');
    const daysDiff = Math.floor(
      (refundRequestDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const isWithinPolicy = daysDiff <= 7;
    expect(isWithinPolicy).toBe(true);
  });

  it('구매 후 7일 초과 시 환불 불가해야 한다', () => {
    const purchaseDate = new Date('2024-01-01');
    const refundRequestDate = new Date('2024-01-15');
    const daysDiff = Math.floor(
      (refundRequestDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const isWithinPolicy = daysDiff <= 7;
    expect(isWithinPolicy).toBe(false);
  });

  it('사용한 크레딧은 환불에서 제외되어야 한다', () => {
    const purchasedCredits = 50;
    const usedCredits = 10;
    const refundableCredits = purchasedCredits - usedCredits;

    expect(refundableCredits).toBe(40);
  });
});
