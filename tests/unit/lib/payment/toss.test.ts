import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TossPaymentsClient, PaymentError } from '@/lib/payment/toss';

// fetch 모킹
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('TossPaymentsClient', () => {
  const TEST_SECRET_KEY = 'test_sk_1234567890abcdef';
  let client: TossPaymentsClient;

  beforeEach(() => {
    client = new TossPaymentsClient(TEST_SECRET_KEY);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('시크릿 키가 Base64로 인코딩되어야 한다', () => {
      // Base64 인코딩 확인: "test_sk_1234567890abcdef:"
      const expectedAuth = Buffer.from(`${TEST_SECRET_KEY}:`).toString('base64');

      // 내부 authHeader 검증을 위해 confirmPayment 호출 시 헤더 확인
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ paymentKey: 'pk_test' }),
      });

      client.confirmPayment('pk_test', 'order_123', 10000);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Basic ${expectedAuth}`,
          }),
        })
      );
    });
  });

  describe('confirmPayment', () => {
    const mockPaymentResponse = {
      paymentKey: 'pk_test_abc123',
      orderId: 'ORD_20240115_ABC123',
      status: 'DONE',
      method: '카드',
      totalAmount: 29900,
      balanceAmount: 29900,
      approvedAt: '2024-01-15T10:30:00+09:00',
      receipt: { url: 'https://receipt.tosspayments.com/abc' },
      card: {
        company: '삼성카드',
        number: '4330123412341234',
        cardType: '신용',
      },
    };

    it('결제 승인 성공 시 결제 정보를 반환해야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPaymentResponse),
      });

      const result = await client.confirmPayment(
        'pk_test_abc123',
        'ORD_20240115_ABC123',
        29900
      );

      expect(result).toEqual(mockPaymentResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.tosspayments.com/v1/payments/confirm',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            paymentKey: 'pk_test_abc123',
            orderId: 'ORD_20240115_ABC123',
            amount: 29900,
          }),
        })
      );
    });

    it('금액 불일치 시 PaymentError를 던져야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            code: 'INVALID_AMOUNT',
            message: '결제 금액이 일치하지 않습니다.',
          }),
      });

      await expect(
        client.confirmPayment('pk_test', 'order_123', 10000)
      ).rejects.toThrow(PaymentError);

      try {
        await client.confirmPayment('pk_test', 'order_123', 10000);
      } catch (error) {
        if (error instanceof PaymentError) {
          expect(error.code).toBe('INVALID_AMOUNT');
          expect(error.message).toBe('결제 금액이 일치하지 않습니다.');
        }
      }
    });

    it('네트워크 오류 시 에러를 전파해야 한다', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network Error'));

      await expect(
        client.confirmPayment('pk_test', 'order_123', 10000)
      ).rejects.toThrow('Network Error');
    });
  });

  describe('cancelPayment', () => {
    const mockCancelResponse = {
      paymentKey: 'pk_test_abc123',
      orderId: 'ORD_20240115_ABC123',
      status: 'CANCELED',
      method: '카드',
      totalAmount: 29900,
      balanceAmount: 0,
      approvedAt: '2024-01-15T10:30:00+09:00',
      receipt: { url: 'https://receipt.tosspayments.com/abc' },
    };

    it('전액 취소가 성공해야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCancelResponse),
      });

      const result = await client.cancelPayment(
        'pk_test_abc123',
        '고객 요청에 의한 취소'
      );

      expect(result).toEqual(mockCancelResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.tosspayments.com/v1/payments/pk_test_abc123/cancel',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ cancelReason: '고객 요청에 의한 취소' }),
        })
      );
    });

    it('부분 취소가 성공해야 한다', async () => {
      const partialCancelResponse = {
        ...mockCancelResponse,
        status: 'PARTIAL_CANCELED',
        balanceAmount: 19900,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(partialCancelResponse),
      });

      const result = await client.cancelPayment(
        'pk_test_abc123',
        '부분 환불',
        10000
      );

      expect(result.balanceAmount).toBe(19900);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            cancelReason: '부분 환불',
            cancelAmount: 10000,
          }),
        })
      );
    });

    it('이미 취소된 결제 취소 시 에러를 던져야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            code: 'ALREADY_CANCELED_PAYMENT',
            message: '이미 취소된 결제입니다.',
          }),
      });

      await expect(
        client.cancelPayment('pk_test', '취소 사유')
      ).rejects.toThrow(PaymentError);
    });
  });

  describe('issueBillingKey', () => {
    const mockBillingKeyResponse = {
      billingKey: 'billing_key_abc123',
      customerKey: 'customer_key_xyz789',
      card: {
        company: '현대카드',
        number: '4111111111111111',
        cardType: '신용',
      },
    };

    it('빌링키 발급이 성공해야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBillingKeyResponse),
      });

      const result = await client.issueBillingKey(
        'auth_key_test',
        'customer_key_xyz789'
      );

      expect(result).toEqual(mockBillingKeyResponse);
      expect(result.billingKey).toBe('billing_key_abc123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.tosspayments.com/v1/billing/authorizations/issue',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            authKey: 'auth_key_test',
            customerKey: 'customer_key_xyz789',
          }),
        })
      );
    });

    it('잘못된 authKey 시 에러를 던져야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            code: 'INVALID_AUTH_KEY',
            message: '유효하지 않은 인증 키입니다.',
          }),
      });

      await expect(
        client.issueBillingKey('invalid_auth_key', 'customer_123')
      ).rejects.toThrow(PaymentError);
    });
  });

  describe('chargeBilling', () => {
    const mockChargeResponse = {
      paymentKey: 'pk_billing_charge_123',
      orderId: 'SUB_20240115_MONTHLY',
      status: 'DONE',
      method: '카드',
      totalAmount: 29900,
      balanceAmount: 29900,
      approvedAt: '2024-01-15T00:00:00+09:00',
      receipt: { url: 'https://receipt.tosspayments.com/billing' },
      card: {
        company: '국민카드',
        number: '5111111111111111',
        cardType: '신용',
      },
    };

    it('빌링키로 자동 결제가 성공해야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChargeResponse),
      });

      const result = await client.chargeBilling(
        'billing_key_abc123',
        'customer_key_xyz789',
        29900,
        'SUB_20240115_MONTHLY',
        'Pro 월간 구독'
      );

      expect(result).toEqual(mockChargeResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.tosspayments.com/v1/billing/billing_key_abc123',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            customerKey: 'customer_key_xyz789',
            amount: 29900,
            orderId: 'SUB_20240115_MONTHLY',
            orderName: 'Pro 월간 구독',
          }),
        })
      );
    });

    it('카드 만료 시 에러를 던져야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            code: 'CARD_EXPIRED',
            message: '카드가 만료되었습니다.',
          }),
      });

      await expect(
        client.chargeBilling(
          'billing_key_expired',
          'customer_123',
          29900,
          'order_123',
          '구독 결제'
        )
      ).rejects.toThrow(PaymentError);
    });

    it('잔액 부족 시 에러를 던져야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            code: 'NOT_ENOUGH_BALANCE',
            message: '잔액이 부족합니다.',
          }),
      });

      try {
        await client.chargeBilling(
          'billing_key',
          'customer_123',
          29900,
          'order_123',
          '구독 결제'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentError);
        if (error instanceof PaymentError) {
          expect(error.code).toBe('NOT_ENOUGH_BALANCE');
        }
      }
    });
  });
});

describe('PaymentError', () => {
  it('에러 코드와 메시지를 포함해야 한다', () => {
    const error = new PaymentError('TEST_ERROR', '테스트 에러 메시지');

    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('테스트 에러 메시지');
    expect(error.name).toBe('PaymentError');
    expect(error).toBeInstanceOf(Error);
  });
});
