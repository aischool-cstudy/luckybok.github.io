import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Next.js 모듈 모킹
vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Map([['x-forwarded-for', '127.0.0.1']]))),
}));

// Logger 모킹
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

// Rate Limit 모킹 - 호이스팅 안전하게 처리
vi.mock('@/lib/rate-limit', () => {
  const mockCheckRateLimit = vi.fn();
  const mockGetClientIP = vi.fn();
  const mockGetRateLimitErrorMessage = vi.fn();
  return {
    checkRateLimit: mockCheckRateLimit,
    getClientIP: mockGetClientIP,
    getRateLimitErrorMessage: mockGetRateLimitErrorMessage,
    RATE_LIMIT_PRESETS: {
      PAYMENT_PREPARE: { maxRequests: 10, windowSeconds: 60 },
      PAYMENT_CONFIRM: { maxRequests: 5, windowSeconds: 60 },
    },
    __mocks: { mockCheckRateLimit, mockGetClientIP, mockGetRateLimitErrorMessage },
  };
});

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

// Supabase Admin 모킹
vi.mock('@/lib/supabase/admin', () => {
  const mockAdminClient = {
    from: vi.fn(),
    rpc: vi.fn(),
  };
  return {
    createAdminClient: vi.fn(() => mockAdminClient),
    __mockClient: mockAdminClient,
  };
});

// Toss Client 모킹
vi.mock('@/lib/payment/toss', () => {
  class PaymentError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'PaymentError';
      this.code = code;
    }
  }
  const mockTossClient = {
    confirmPayment: vi.fn(),
  };
  return {
    getTossClient: vi.fn(() => mockTossClient),
    PaymentError,
    __mockClient: mockTossClient,
  };
});

// Crypto 모킹
vi.mock('@/lib/payment/crypto', () => ({
  generateOrderId: vi.fn(() => 'CRD_20260203120000_AB12CD34'),
}));

// RPC 결과 파싱 모킹
vi.mock('@/lib/supabase/helpers', () => ({
  parseRpcResult: vi.fn((result) => {
    if (result?.success === false) {
      return { success: false, error: result.error || 'Unknown error' };
    }
    return { success: true, data: result };
  }),
}));

// 테스트 대상 함수들 import
import { prepareCreditPurchase, confirmCreditPayment } from '@/actions/payment';
import { requireAuth, AuthError } from '@/lib/auth';
import { checkRateLimit, getClientIP, getRateLimitErrorMessage } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTossClient, PaymentError } from '@/lib/payment/toss';

// 모킹된 함수 타입 캐스팅
const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;
const mockGetClientIP = getClientIP as ReturnType<typeof vi.fn>;
const mockGetRateLimitErrorMessage = getRateLimitErrorMessage as ReturnType<typeof vi.fn>;

describe('Payment Server Actions', () => {
  // 모킹된 클라이언트 참조
  let mockSupabaseClient: { from: ReturnType<typeof vi.fn> };
  let mockAdminClient: { from: ReturnType<typeof vi.fn>; rpc: ReturnType<typeof vi.fn> };
  let mockTossClient: { confirmPayment: ReturnType<typeof vi.fn> };

  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();

    // Supabase 클라이언트 모킹
    mockSupabaseClient = { from: vi.fn() };
    mockAdminClient = createAdminClient() as typeof mockAdminClient;
    mockTossClient = getTossClient() as typeof mockTossClient;

    // 기본 설정
    mockGetClientIP.mockReturnValue('127.0.0.1');
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });

    // requireAuth 기본 설정
    mockRequireAuth.mockResolvedValue({
      user: mockUser,
      supabase: mockSupabaseClient,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('prepareCreditPurchase', () => {
    beforeEach(() => {
      // 프로필 조회 모킹
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { customer_key: 'cust-123' },
              error: null,
            }),
          }),
        }),
      });

      // Admin 클라이언트 insert 모킹
      mockAdminClient.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });
    });

    it('유효한 패키지로 결제 준비 성공해야 한다', async () => {
      const result = await prepareCreditPurchase({ packageId: 'basic' });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.orderId).toBe('CRD_20260203120000_AB12CD34');
      expect(result.data?.amount).toBe(9900);
      expect(result.data?.customerKey).toBe('cust-123');
    });

    it('standard 패키지로 결제 준비 성공해야 한다', async () => {
      const result = await prepareCreditPurchase({ packageId: 'standard' });

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(24900);
    });

    it('premium 패키지로 결제 준비 성공해야 한다', async () => {
      const result = await prepareCreditPurchase({ packageId: 'premium' });

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(49900);
    });

    it('Rate Limit 초과 시 에러 반환해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
      mockGetRateLimitErrorMessage.mockReturnValue('요청이 너무 많습니다.');

      const result = await prepareCreditPurchase({ packageId: 'basic' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('요청이 너무 많습니다.');
    });

    it('존재하지 않는 패키지로 에러 반환해야 한다', async () => {
      const result = await prepareCreditPurchase({ packageId: 'invalid' as 'basic' });

      expect(result.success).toBe(false);
      // Zod enum 검증이 먼저 실패하므로 Zod 에러 메시지 확인
      expect(result.error).toContain('Invalid enum value');
    });

    it('프로필 조회 실패 시 에러 반환해야 한다', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      const result = await prepareCreditPurchase({ packageId: 'basic' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('사용자 정보를 찾을 수 없습니다');
    });

    it('결제 레코드 생성 실패 시 에러 반환해야 한다', async () => {
      mockAdminClient.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: { message: 'Insert failed' } }),
      });

      const result = await prepareCreditPurchase({ packageId: 'basic' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('결제 준비에 실패했습니다');
    });

    it('인증 에러 시 적절한 메시지 반환해야 한다', async () => {
      mockRequireAuth.mockRejectedValue(new AuthError('로그인이 필요합니다'));

      const result = await prepareCreditPurchase({ packageId: 'basic' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('로그인이 필요합니다');
    });

    it('예상치 못한 에러 시 일반 에러 메시지 반환해야 한다', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Unexpected error'));

      const result = await prepareCreditPurchase({ packageId: 'basic' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('크레딧 구매 준비에 실패했습니다');
    });
  });

  describe('confirmCreditPayment', () => {
    // orderId 형식: CRD_YYYYMMDDHHMMSS_XXXXXXXX (14자리 타임스탬프 + 8자리 랜덤)
    const validInput = {
      paymentKey: 'toss-payment-key-123',
      orderId: 'CRD_20260203120000_AB12CD34',
      amount: 9900,
    };

    beforeEach(() => {
      // Admin 클라이언트 select 모킹 (결제 조회)
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'payments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'payment-123',
                      order_id: 'CRD_20260203120000_AB12CD34',
                      user_id: 'user-123',
                      status: 'pending',
                      amount: 9900,
                      metadata: { creditPackageId: 'basic', credits: 50 },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return { select: vi.fn(), update: vi.fn(), insert: vi.fn() };
      });

      // Toss 결제 승인 모킹
      mockTossClient.confirmPayment.mockResolvedValue({
        paymentKey: 'toss-payment-key-123',
        orderId: 'CRD_20260203120000_AB12CD34',
        totalAmount: 9900,
        method: 'CARD',
        approvedAt: new Date().toISOString(),
        receipt: { url: 'https://receipt.url' },
      });

      // RPC 모킹
      mockAdminClient.rpc.mockResolvedValue({
        data: { success: true, new_balance: 50 },
        error: null,
      });
    });

    it('유효한 결제 정보로 승인 성공해야 한다', async () => {
      const result = await confirmCreditPayment(validInput);

      expect(result.success).toBe(true);
      expect(result.data?.credits).toBe(50);
      expect(result.data?.balance).toBe(50);
    });

    it('Rate Limit 초과 시 에러 반환해야 한다', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
      mockGetRateLimitErrorMessage.mockReturnValue('결제 요청이 너무 많습니다.');

      const result = await confirmCreditPayment(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('결제 요청이 너무 많습니다.');
    });

    it('결제 정보를 찾을 수 없을 때 에러 반환해야 한다', async () => {
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'payments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Not found' },
                  }),
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const result = await confirmCreditPayment(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('결제 정보를 찾을 수 없습니다');
    });

    it('이미 처리된 결제에 대해 에러 반환해야 한다', async () => {
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'payments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'payment-123',
                      status: 'completed', // 이미 완료됨
                      metadata: { creditPackageId: 'basic', credits: 50 },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const result = await confirmCreditPayment(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('이미 처리된 결제입니다');
    });

    it('토스 결제 승인 실패 시 에러 반환해야 한다', async () => {
      mockTossClient.confirmPayment.mockRejectedValue(
        new PaymentError('INVALID_CARD', '카드 정보가 유효하지 않습니다')
      );

      // update 모킹 추가
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'payments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'payment-123',
                      status: 'pending',
                      metadata: { creditPackageId: 'basic', credits: 50 },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return { select: vi.fn(), update: vi.fn() };
      });

      const result = await confirmCreditPayment(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('카드 정보가 유효하지 않습니다');
    });

    it('금액 불일치 시 에러 반환해야 한다', async () => {
      mockTossClient.confirmPayment.mockResolvedValue({
        paymentKey: 'toss-payment-key-123',
        orderId: 'CRD_20260203120000_AB12CD34',
        totalAmount: 19900, // 다른 금액
        method: 'CARD',
        approvedAt: new Date().toISOString(),
      });

      // update 모킹 추가
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'payments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'payment-123',
                      status: 'pending',
                      metadata: { creditPackageId: 'basic', credits: 50 },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return { select: vi.fn(), update: vi.fn() };
      });

      const result = await confirmCreditPayment(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('결제 금액 검증에 실패했습니다');
    });

    it('RPC 오류 시 에러 반환해야 한다', async () => {
      mockAdminClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

      const result = await confirmCreditPayment(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('결제 처리 중 오류가 발생했습니다');
    });

    it('RPC 결과 실패 시 에러 반환해야 한다', async () => {
      mockAdminClient.rpc.mockResolvedValue({
        data: { success: false, error: '크레딧 추가 실패' },
        error: null,
      });

      const result = await confirmCreditPayment(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('크레딧 추가 실패');
    });

    it('인증 에러 시 적절한 메시지 반환해야 한다', async () => {
      mockRequireAuth.mockRejectedValue(new AuthError('세션이 만료되었습니다'));

      const result = await confirmCreditPayment(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('세션이 만료되었습니다');
    });

    it('잘못된 metadata 시 에러 반환해야 한다', async () => {
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'payments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'payment-123',
                      status: 'pending',
                      metadata: {}, // creditPackageId 없음
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const result = await confirmCreditPayment(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('잘못된 결제 정보입니다');
    });
  });
});

describe('Payment Input Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getClientIP as ReturnType<typeof vi.fn>).mockReturnValue('127.0.0.1');
    (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true, remaining: 9 });
  });

  it('빈 packageId로 prepareCreditPurchase 실패해야 한다', async () => {
    const result = await prepareCreditPurchase({ packageId: '' as 'basic' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('빈 paymentKey로 confirmCreditPayment 실패해야 한다', async () => {
    const result = await confirmCreditPayment({
      paymentKey: '',
      orderId: 'CRD-123',
      amount: 9900,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('음수 금액으로 confirmCreditPayment 실패해야 한다', async () => {
    const result = await confirmCreditPayment({
      paymentKey: 'key-123',
      orderId: 'CRD-123',
      amount: -1000,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('0 금액으로 confirmCreditPayment 실패해야 한다', async () => {
    const result = await confirmCreditPayment({
      paymentKey: 'key-123',
      orderId: 'CRD-123',
      amount: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
