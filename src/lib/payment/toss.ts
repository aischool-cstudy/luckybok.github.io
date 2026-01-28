/**
 * 토스페이먼츠 API 클라이언트
 */

const TOSS_API_URL = 'https://api.tosspayments.com/v1';

export class TossPaymentsClient {
  private authHeader: string;

  constructor(secretKey: string) {
    // Base64 인코딩된 시크릿 키 (시크릿키:)
    this.authHeader = Buffer.from(`${secretKey}:`).toString('base64');
  }

  private get headers() {
    return {
      Authorization: `Basic ${this.authHeader}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * 결제 승인
   */
  async confirmPayment(
    paymentKey: string,
    orderId: string,
    amount: number
  ): Promise<TossPaymentResponse> {
    const response = await fetch(`${TOSS_API_URL}/payments/confirm`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new PaymentError(error.code, error.message);
    }

    return response.json();
  }

  /**
   * 결제 취소/환불
   */
  async cancelPayment(
    paymentKey: string,
    cancelReason: string,
    cancelAmount?: number
  ): Promise<TossPaymentResponse> {
    const payload: Record<string, unknown> = { cancelReason };
    if (cancelAmount) {
      payload['cancelAmount'] = cancelAmount;
    }

    const response = await fetch(
      `${TOSS_API_URL}/payments/${paymentKey}/cancel`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new PaymentError(error.code, error.message);
    }

    return response.json();
  }

  /**
   * 빌링키 발급
   */
  async issueBillingKey(
    authKey: string,
    customerKey: string
  ): Promise<TossBillingKeyResponse> {
    const response = await fetch(
      `${TOSS_API_URL}/billing/authorizations/issue`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ authKey, customerKey }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new PaymentError(error.code, error.message);
    }

    return response.json();
  }

  /**
   * 빌링키로 자동 결제
   */
  async chargeBilling(
    billingKey: string,
    customerKey: string,
    amount: number,
    orderId: string,
    orderName: string
  ): Promise<TossPaymentResponse> {
    const response = await fetch(`${TOSS_API_URL}/billing/${billingKey}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        customerKey,
        amount,
        orderId,
        orderName,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new PaymentError(error.code, error.message);
    }

    return response.json();
  }
}

export class PaymentError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

// 타입 정의
export interface TossPaymentResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  method: string;
  totalAmount: number;
  balanceAmount: number;
  approvedAt: string;
  receipt: {
    url: string;
  };
  card?: {
    company: string;
    number: string;
    cardType: string;
  };
}

export interface TossBillingKeyResponse {
  billingKey: string;
  customerKey: string;
  card: {
    company: string;
    number: string;
    cardType: string;
  };
}

// 싱글톤 인스턴스
let tossClient: TossPaymentsClient | null = null;

export function getTossClient(): TossPaymentsClient {
  if (!tossClient) {
    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      throw new Error('TOSS_SECRET_KEY 환경 변수가 설정되지 않았습니다.');
    }
    tossClient = new TossPaymentsClient(secretKey);
  }
  return tossClient;
}
