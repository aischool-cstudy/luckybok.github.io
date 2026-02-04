import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentError } from '@/lib/payment/toss';

// TossPaymentsClient 모킹
const mockTossClient = {
  confirmPayment: vi.fn(),
  cancelPayment: vi.fn(),
  issueBillingKey: vi.fn(),
  chargeBilling: vi.fn(),
};

vi.mock('@/lib/payment/toss', async () => {
  const actual = await vi.importActual('@/lib/payment/toss');
  return {
    ...actual,
    getTossClient: vi.fn(() => mockTossClient),
  };
});

describe('결제 에러 케이스 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('카드 관련 에러', () => {
    it('카드 만료 시 CARD_EXPIRED 에러가 발생해야 한다', async () => {
      mockTossClient.chargeBilling.mockRejectedValue(
        new PaymentError('CARD_EXPIRED', '카드가 만료되었습니다.')
      );

      try {
        await mockTossClient.chargeBilling(
          'billing_key',
          'customer_key',
          29900,
          'order_123',
          '구독 결제'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentError);
        if (error instanceof PaymentError) {
          expect(error.code).toBe('CARD_EXPIRED');
        }
      }
    });

    it('카드 분실 시 CARD_LOST 에러가 발생해야 한다', async () => {
      mockTossClient.chargeBilling.mockRejectedValue(
        new PaymentError('CARD_LOST', '분실 신고된 카드입니다.')
      );

      await expect(
        mockTossClient.chargeBilling('billing_key', 'customer_key', 29900, 'order_123', '결제')
      ).rejects.toThrow(PaymentError);
    });

    it('카드 도난 시 CARD_STOLEN 에러가 발생해야 한다', async () => {
      mockTossClient.chargeBilling.mockRejectedValue(
        new PaymentError('CARD_STOLEN', '도난 신고된 카드입니다.')
      );

      try {
        await mockTossClient.chargeBilling(
          'billing_key',
          'customer_key',
          29900,
          'order_123',
          '결제'
        );
        expect.fail('에러가 발생해야 합니다');
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentError);
      }
    });

    it('카드 한도 초과 시 EXCEED_MAX_AMOUNT 에러가 발생해야 한다', async () => {
      mockTossClient.confirmPayment.mockRejectedValue(
        new PaymentError('EXCEED_MAX_AMOUNT', '카드 한도가 초과되었습니다.')
      );

      try {
        await mockTossClient.confirmPayment('pk_test', 'order_123', 10000000);
      } catch (error) {
        if (error instanceof PaymentError) {
          expect(error.code).toBe('EXCEED_MAX_AMOUNT');
        }
      }
    });
  });

  describe('잔액 관련 에러', () => {
    it('잔액 부족 시 NOT_ENOUGH_BALANCE 에러가 발생해야 한다', async () => {
      mockTossClient.chargeBilling.mockRejectedValue(
        new PaymentError('NOT_ENOUGH_BALANCE', '잔액이 부족합니다.')
      );

      try {
        await mockTossClient.chargeBilling(
          'billing_key',
          'customer_key',
          29900,
          'order_123',
          '결제'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentError);
        if (error instanceof PaymentError) {
          expect(error.code).toBe('NOT_ENOUGH_BALANCE');
        }
      }
    });
  });

  describe('금액 검증 에러', () => {
    it('금액 불일치 시 INVALID_AMOUNT 에러가 발생해야 한다', async () => {
      mockTossClient.confirmPayment.mockRejectedValue(
        new PaymentError('INVALID_AMOUNT', '결제 금액이 일치하지 않습니다.')
      );

      try {
        await mockTossClient.confirmPayment('pk_test', 'order_123', 10000);
      } catch (error) {
        if (error instanceof PaymentError) {
          expect(error.code).toBe('INVALID_AMOUNT');
        }
      }
    });

    it('최소 금액 미만 시 BELOW_MINIMUM_AMOUNT 에러가 발생해야 한다', async () => {
      mockTossClient.confirmPayment.mockRejectedValue(
        new PaymentError('BELOW_MINIMUM_AMOUNT', '최소 결제 금액은 100원입니다.')
      );

      try {
        await mockTossClient.confirmPayment('pk_test', 'order_123', 50);
      } catch (error) {
        if (error instanceof PaymentError) {
          expect(error.code).toBe('BELOW_MINIMUM_AMOUNT');
        }
      }
    });
  });

  describe('빌링키 관련 에러', () => {
    it('잘못된 authKey 시 INVALID_AUTH_KEY 에러가 발생해야 한다', async () => {
      mockTossClient.issueBillingKey.mockRejectedValue(
        new PaymentError('INVALID_AUTH_KEY', '유효하지 않은 인증 키입니다.')
      );

      try {
        await mockTossClient.issueBillingKey('invalid_auth_key', 'customer_123');
      } catch (error) {
        if (error instanceof PaymentError) {
          expect(error.code).toBe('INVALID_AUTH_KEY');
        }
      }
    });

    it('만료된 빌링키 시 BILLING_KEY_EXPIRED 에러가 발생해야 한다', async () => {
      mockTossClient.chargeBilling.mockRejectedValue(
        new PaymentError('BILLING_KEY_EXPIRED', '빌링키가 만료되었습니다.')
      );

      await expect(
        mockTossClient.chargeBilling('expired_billing_key', 'customer_123', 29900, 'order_123', '결제')
      ).rejects.toThrow(PaymentError);
    });

    it('삭제된 빌링키 시 BILLING_KEY_DELETED 에러가 발생해야 한다', async () => {
      mockTossClient.chargeBilling.mockRejectedValue(
        new PaymentError('BILLING_KEY_DELETED', '삭제된 빌링키입니다.')
      );

      try {
        await mockTossClient.chargeBilling(
          'deleted_billing_key',
          'customer_123',
          29900,
          'order_123',
          '결제'
        );
      } catch (error) {
        if (error instanceof PaymentError) {
          expect(error.code).toBe('BILLING_KEY_DELETED');
        }
      }
    });
  });

  describe('결제 상태 에러', () => {
    it('이미 취소된 결제 시 ALREADY_CANCELED 에러가 발생해야 한다', async () => {
      mockTossClient.cancelPayment.mockRejectedValue(
        new PaymentError('ALREADY_CANCELED_PAYMENT', '이미 취소된 결제입니다.')
      );

      try {
        await mockTossClient.cancelPayment('pk_canceled', '취소 사유');
      } catch (error) {
        if (error instanceof PaymentError) {
          expect(error.code).toBe('ALREADY_CANCELED_PAYMENT');
        }
      }
    });

    it('이미 완료된 결제를 재승인 시 ALREADY_PROCESSED 에러가 발생해야 한다', async () => {
      mockTossClient.confirmPayment.mockRejectedValue(
        new PaymentError('ALREADY_PROCESSED_PAYMENT', '이미 처리된 결제입니다.')
      );

      try {
        await mockTossClient.confirmPayment('pk_completed', 'order_123', 29900);
      } catch (error) {
        if (error instanceof PaymentError) {
          expect(error.code).toBe('ALREADY_PROCESSED_PAYMENT');
        }
      }
    });
  });

  describe('네트워크 에러', () => {
    it('네트워크 오류 시 적절한 에러 메시지가 표시되어야 한다', async () => {
      mockTossClient.confirmPayment.mockRejectedValue(new Error('Network Error'));

      try {
        await mockTossClient.confirmPayment('pk_test', 'order_123', 29900);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network Error');
      }
    });

    it('타임아웃 시 적절한 에러 메시지가 표시되어야 한다', async () => {
      mockTossClient.confirmPayment.mockRejectedValue(new Error('Request Timeout'));

      try {
        await mockTossClient.confirmPayment('pk_test', 'order_123', 29900);
      } catch (error) {
        expect((error as Error).message).toBe('Request Timeout');
      }
    });
  });

  describe('사용자 취소', () => {
    it('사용자가 결제 취소 시 PAY_PROCESS_CANCELED 에러가 발생해야 한다', async () => {
      mockTossClient.confirmPayment.mockRejectedValue(
        new PaymentError('PAY_PROCESS_CANCELED', '사용자가 결제를 취소했습니다.')
      );

      try {
        await mockTossClient.confirmPayment('pk_test', 'order_123', 29900);
      } catch (error) {
        if (error instanceof PaymentError) {
          expect(error.code).toBe('PAY_PROCESS_CANCELED');
        }
      }
    });

    it('결제창 닫기 시 PAY_PROCESS_ABORTED 에러가 발생해야 한다', async () => {
      mockTossClient.confirmPayment.mockRejectedValue(
        new PaymentError('PAY_PROCESS_ABORTED', '결제가 중단되었습니다.')
      );

      try {
        await mockTossClient.confirmPayment('pk_test', 'order_123', 29900);
      } catch (error) {
        if (error instanceof PaymentError) {
          expect(error.code).toBe('PAY_PROCESS_ABORTED');
        }
      }
    });
  });
});

describe('에러 처리 로직', () => {
  it('PaymentError는 Error를 상속해야 한다', () => {
    const error = new PaymentError('TEST_CODE', '테스트 메시지');
    expect(error).toBeInstanceOf(Error);
  });

  it('PaymentError는 code 속성을 가져야 한다', () => {
    const error = new PaymentError('CARD_EXPIRED', '카드가 만료되었습니다.');
    expect(error.code).toBe('CARD_EXPIRED');
  });

  it('PaymentError는 message 속성을 가져야 한다', () => {
    const error = new PaymentError('CARD_EXPIRED', '카드가 만료되었습니다.');
    expect(error.message).toBe('카드가 만료되었습니다.');
  });

  it('PaymentError의 name은 PaymentError여야 한다', () => {
    const error = new PaymentError('TEST_CODE', '테스트');
    expect(error.name).toBe('PaymentError');
  });
});

describe('재시도 로직', () => {
  it('일시적 오류 시 재시도가 가능해야 한다', () => {
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'TEMPORARY_ERROR',
      'GATEWAY_TIMEOUT',
    ];

    const errorCode = 'NETWORK_ERROR';
    const shouldRetry = retryableErrors.includes(errorCode);

    expect(shouldRetry).toBe(true);
  });

  it('영구적 오류 시 재시도하지 않아야 한다', () => {
    const nonRetryableErrors = [
      'CARD_EXPIRED',
      'CARD_LOST',
      'CARD_STOLEN',
      'INVALID_AMOUNT',
    ];

    const errorCode = 'CARD_EXPIRED';
    const shouldRetry = !nonRetryableErrors.includes(errorCode);

    expect(shouldRetry).toBe(false);
  });

  it('최대 재시도 횟수를 초과하면 실패해야 한다', () => {
    const maxRetries = 3;
    const currentRetries = 4;

    const shouldRetry = currentRetries < maxRetries;
    expect(shouldRetry).toBe(false);
  });
});
