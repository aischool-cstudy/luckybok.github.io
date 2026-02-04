import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleWebhookReprocess } from '@/lib/payment/webhook-handler';

// Supabase admin client 모킹
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

describe('웹훅 재처리 핸들러 (webhook-handler.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 체이닝 모킹 설정
    mockFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
      insert: mockInsert,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      eq: mockEq,
      single: mockSingle,
    });
    mockUpdate.mockReturnValue({
      eq: mockEq,
    });
  });

  describe('handleWebhookReprocess', () => {
    it('페이로드에 data가 없으면 에러 반환', async () => {
      const result = await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('페이로드에 data가 없습니다');
    });

    it('알 수 없는 이벤트 타입은 성공 처리', async () => {
      const result = await handleWebhookReprocess('UNKNOWN_EVENT', {
        data: { some: 'data' },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('PAYMENT_STATUS_CHANGED 재처리', () => {
    it('paymentKey 또는 status 누락 시 에러', async () => {
      const result = await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {
        data: { paymentKey: 'pk_test_123' }, // status 누락
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('paymentKey 또는 status 누락');
    });

    it('결제 레코드를 찾지 못하면 에러', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      const result = await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {
        data: { paymentKey: 'pk_test_123', status: 'DONE' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('결제 레코드를 찾을 수 없음');
    });

    it('DONE 상태는 completed로 업데이트', async () => {
      const mockPayment = {
        id: 'payment_123',
        user_id: 'user_123',
        type: 'credit_purchase',
        status: 'pending',
        metadata: {},
      };

      mockSingle.mockResolvedValueOnce({ data: mockPayment, error: null });
      mockEq.mockReturnValue({
        eq: mockEq,
        single: mockSingle,
      });

      // update 체이닝
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {
        data: { paymentKey: 'pk_test_123', status: 'DONE' },
      });

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('CANCELED 상태는 canceled로 업데이트', async () => {
      const mockPayment = {
        id: 'payment_123',
        user_id: 'user_123',
        type: 'subscription',
        status: 'completed',
        metadata: { subscriptionId: 'sub_123' },
      };

      mockSingle.mockResolvedValueOnce({ data: mockPayment, error: null });

      // update 체이닝
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {
        data: { paymentKey: 'pk_test_123', status: 'CANCELED' },
      });

      expect(result.success).toBe(true);
    });

    it('업데이트 실패 시 에러 반환', async () => {
      const mockPayment = {
        id: 'payment_123',
        user_id: 'user_123',
        type: 'credit_purchase',
        status: 'pending',
        metadata: {},
      };

      mockSingle.mockResolvedValueOnce({ data: mockPayment, error: null });

      // update 실패
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'DB Error' } }),
      });

      const result = await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {
        data: { paymentKey: 'pk_test_123', status: 'DONE' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('결제 상태 업데이트 실패');
    });
  });

  describe('BILLING_STATUS_CHANGED 재처리', () => {
    it('customerKey 또는 status 누락 시 에러', async () => {
      const result = await handleWebhookReprocess('BILLING_STATUS_CHANGED', {
        data: { customerKey: 'cust_123' }, // status 누락
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('customerKey 또는 status 누락');
    });

    it('EXPIRED 상태는 구독을 past_due로 변경', async () => {
      const mockProfile = { id: 'user_123' };

      mockSingle.mockResolvedValueOnce({ data: mockProfile, error: null });

      // update 체이닝
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await handleWebhookReprocess('BILLING_STATUS_CHANGED', {
        data: { customerKey: 'cust_123', status: 'EXPIRED' },
      });

      expect(result.success).toBe(true);
    });

    it('STOPPED 상태도 구독을 past_due로 변경', async () => {
      const mockProfile = { id: 'user_123' };

      mockSingle.mockResolvedValueOnce({ data: mockProfile, error: null });

      mockUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await handleWebhookReprocess('BILLING_STATUS_CHANGED', {
        data: { customerKey: 'cust_123', status: 'STOPPED' },
      });

      expect(result.success).toBe(true);
    });

    it('프로필을 찾지 못해도 성공 처리', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const result = await handleWebhookReprocess('BILLING_STATUS_CHANGED', {
        data: { customerKey: 'cust_123', status: 'EXPIRED' },
      });

      expect(result.success).toBe(true);
    });

    it('ACTIVE 등 다른 상태는 무시', async () => {
      const result = await handleWebhookReprocess('BILLING_STATUS_CHANGED', {
        data: { customerKey: 'cust_123', status: 'ACTIVE' },
      });

      expect(result.success).toBe(true);
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('VIRTUAL_ACCOUNT_DEPOSITED 재처리', () => {
    it('orderId 누락 시 에러', async () => {
      const result = await handleWebhookReprocess('VIRTUAL_ACCOUNT_DEPOSITED', {
        data: {}, // orderId 누락
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('orderId 누락');
    });

    it('결제 레코드를 찾지 못하면 에러', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      const result = await handleWebhookReprocess('VIRTUAL_ACCOUNT_DEPOSITED', {
        data: { orderId: 'ORD_123' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('결제 레코드를 찾을 수 없음');
    });

    it('이미 완료된 결제는 성공 처리 (중복 방지)', async () => {
      const mockPayment = {
        id: 'payment_123',
        status: 'completed',
        type: 'credit_purchase',
        user_id: 'user_123',
        metadata: {},
      };

      mockSingle.mockResolvedValueOnce({ data: mockPayment, error: null });

      const result = await handleWebhookReprocess('VIRTUAL_ACCOUNT_DEPOSITED', {
        data: { orderId: 'ORD_123' },
      });

      expect(result.success).toBe(true);
      // update가 호출되지 않아야 함
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('가상계좌 입금 시 결제 완료 + 크레딧 지급', async () => {
      const mockPayment = {
        id: 'payment_123',
        status: 'pending',
        type: 'credit_purchase',
        user_id: 'user_123',
        metadata: { credits: 150, validityDays: 90 },
      };

      const mockProfile = { credits_balance: 50 };

      // 첫 번째 쿼리: 결제 레코드 조회
      mockSingle.mockResolvedValueOnce({ data: mockPayment, error: null });

      // update 체이닝
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      // 두 번째 쿼리: 프로필 조회
      mockSingle.mockResolvedValueOnce({ data: mockProfile, error: null });

      // insert 체이닝 (credit_transactions)
      mockInsert.mockResolvedValue({ error: null });

      const result = await handleWebhookReprocess('VIRTUAL_ACCOUNT_DEPOSITED', {
        data: { orderId: 'ORD_123' },
      });

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('구독 결제도 완료 처리 (크레딧 지급 없음)', async () => {
      const mockPayment = {
        id: 'payment_123',
        status: 'pending',
        type: 'subscription',
        user_id: 'user_123',
        metadata: {},
      };

      mockSingle.mockResolvedValueOnce({ data: mockPayment, error: null });

      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await handleWebhookReprocess('VIRTUAL_ACCOUNT_DEPOSITED', {
        data: { orderId: 'ORD_123' },
      });

      expect(result.success).toBe(true);
      // credit_transactions insert가 호출되지 않아야 함
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('에러 처리', () => {
    it('예외 발생 시 에러 반환', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {
        data: { paymentKey: 'pk_test_123', status: 'DONE' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    it('알 수 없는 에러도 처리', async () => {
      mockFrom.mockImplementation(() => {
        throw 'Unknown error type';
      });

      const result = await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {
        data: { paymentKey: 'pk_test_123', status: 'DONE' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('알 수 없는 오류');
    });

    it('네트워크 타임아웃 에러 처리', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('network timeout');
      });

      const result = await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {
        data: { paymentKey: 'pk_test_123', status: 'DONE' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('network timeout');
    });

    it('Supabase 에러 객체 처리', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      const result = await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {
        data: { paymentKey: 'pk_test_123', status: 'DONE' },
      });

      expect(result.success).toBe(false);
    });

    it('빈 data 객체 처리', async () => {
      const result = await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {
        data: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('paymentKey 또는 status 누락');
    });

    it('null 값이 포함된 data 처리', async () => {
      const result = await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {
        data: { paymentKey: null, status: null },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('paymentKey 또는 status 누락');
    });
  });

  describe('엣지 케이스', () => {
    it('metadata가 null인 결제 처리', async () => {
      const mockPayment = {
        id: 'payment_123',
        user_id: 'user_123',
        type: 'credit_purchase',
        status: 'pending',
        metadata: null,
      };

      mockSingle.mockResolvedValueOnce({ data: mockPayment, error: null });
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {
        data: { paymentKey: 'pk_test_123', status: 'DONE' },
      });

      expect(result.success).toBe(true);
    });

    it('빈 문자열 paymentKey 처리', async () => {
      const result = await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {
        data: { paymentKey: '', status: 'DONE' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('paymentKey 또는 status 누락');
    });

    it('알 수 없는 상태값 처리', async () => {
      const mockPayment = {
        id: 'payment_123',
        user_id: 'user_123',
        type: 'credit_purchase',
        status: 'pending',
        metadata: {},
      };

      mockSingle.mockResolvedValueOnce({ data: mockPayment, error: null });
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {
        data: { paymentKey: 'pk_test_123', status: 'UNKNOWN_STATUS' },
      });

      // 알 수 없는 상태는 기존 상태 유지
      expect(result.success).toBe(true);
    });

    it('customerKey가 빈 문자열일 때 처리', async () => {
      const result = await handleWebhookReprocess('BILLING_STATUS_CHANGED', {
        data: { customerKey: '', status: 'EXPIRED' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('customerKey 또는 status 누락');
    });

    it('프로필 조회 에러 시에도 성공 반환', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Profile not found' },
      });

      const result = await handleWebhookReprocess('BILLING_STATUS_CHANGED', {
        data: { customerKey: 'cust_123', status: 'EXPIRED' },
      });

      // 프로필을 찾지 못해도 성공 처리 (비활성화된 고객일 수 있음)
      expect(result.success).toBe(true);
    });
  });

  describe('상태 매핑', () => {
    const statusTestCases = [
      { input: 'DONE', expected: 'completed' },
      { input: 'CANCELED', expected: 'canceled' },
      { input: 'PARTIAL_CANCELED', expected: 'partial_refunded' },
      { input: 'WAITING_FOR_DEPOSIT', expected: 'pending' },
      { input: 'ABORTED', expected: 'failed' },
      { input: 'EXPIRED', expected: 'failed' },
    ];

    for (const { input, expected } of statusTestCases) {
      it(`토스 상태 ${input}는 ${expected}로 매핑`, async () => {
        const mockPayment = {
          id: 'payment_123',
          user_id: 'user_123',
          type: 'credit_purchase',
          status: 'pending',
          metadata: {},
        };

        mockSingle.mockResolvedValueOnce({ data: mockPayment, error: null });

        let updatedStatus: string | undefined;
        mockUpdate.mockImplementation(() => ({
          eq: vi.fn().mockImplementation(() => {
            return Promise.resolve({ error: null });
          }),
        }));

        // update 호출 시 status 캡처
        mockFrom.mockImplementation((table: string) => {
          if (table === 'payments') {
            return {
              select: mockSelect,
              update: (data: { status: string }) => {
                updatedStatus = data.status;
                return {
                  eq: vi.fn().mockResolvedValue({ error: null }),
                };
              },
            };
          }
          return { select: mockSelect, update: mockUpdate };
        });

        await handleWebhookReprocess('PAYMENT_STATUS_CHANGED', {
          data: { paymentKey: 'pk_test_123', status: input },
        });

        expect(updatedStatus).toBe(expected);
      });
    }
  });
});
