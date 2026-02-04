/**
 * 토스페이먼츠 API 클라이언트
 * - 지수 백오프 재시도 로직 포함
 * - 네트워크 에러 및 일시적 오류 처리
 */

import { PAYMENT_TIMEOUT_MS, RETRY_CONFIG as GLOBAL_RETRY_CONFIG } from '@/config/constants';
import { logWarn } from '@/lib/logger';

const TOSS_API_URL = 'https://api.tosspayments.com/v1';

// 재시도 설정 (글로벌 설정 기반)
const RETRY_CONFIG = {
  ...GLOBAL_RETRY_CONFIG,
  timeoutMs: PAYMENT_TIMEOUT_MS,
};

/**
 * 지수 백오프 재시도 fetch
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = RETRY_CONFIG.maxRetries
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RETRY_CONFIG.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 성공 또는 재시도 불가능한 에러
      const retryableCodes: number[] = [...RETRY_CONFIG.retryableStatusCodes];
      if (response.ok || !retryableCodes.includes(response.status)) {
        return response;
      }

      // 재시도 가능한 에러 - 마지막 시도가 아니면 재시도
      if (attempt < maxRetries) {
        const delay = calculateBackoffDelay(attempt);
        logWarn('토스 API 요청 실패, 재시도 예정', {
          action: 'fetchWithRetry',
          statusCode: response.status,
          delayMs: delay,
          attempt: attempt + 1,
          maxRetries,
        });
        await sleep(delay);
        continue;
      }

      // 마지막 시도도 실패
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? error : new Error(String(error));

      // AbortError (타임아웃) 또는 네트워크 에러
      const isRetryable =
        lastError.name === 'AbortError' ||
        lastError.message.includes('fetch failed') ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('ETIMEDOUT');

      if (isRetryable && attempt < maxRetries) {
        const delay = calculateBackoffDelay(attempt);
        logWarn('토스 API 네트워크 오류, 재시도 예정', {
          action: 'fetchWithRetry',
          errorMessage: lastError.message,
          errorName: lastError.name,
          delayMs: delay,
          attempt: attempt + 1,
          maxRetries,
        });
        await sleep(delay);
        continue;
      }

      // 재시도 불가능한 에러 또는 마지막 시도 실패
      throw new NetworkError(
        lastError.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
        lastError.message
      );
    }
  }

  // 모든 재시도 실패
  throw new NetworkError('MAX_RETRIES_EXCEEDED', lastError?.message || '최대 재시도 횟수 초과');
}

/**
 * 지수 백오프 딜레이 계산 (지터 포함)
 */
function calculateBackoffDelay(attempt: number): number {
  const baseDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * baseDelay; // 최대 30% 지터
  return Math.min(baseDelay + jitter, RETRY_CONFIG.maxDelayMs);
}

/**
 * sleep 유틸리티
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    const response = await fetchWithRetry(`${TOSS_API_URL}/payments/confirm`, {
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

    const response = await fetchWithRetry(
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
    const response = await fetchWithRetry(
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
    const response = await fetchWithRetry(`${TOSS_API_URL}/billing/${billingKey}`, {
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

  /**
   * 결제 조회 (결제 상태 확인용)
   */
  async getPayment(paymentKey: string): Promise<TossPaymentResponse> {
    const response = await fetchWithRetry(
      `${TOSS_API_URL}/payments/${paymentKey}`,
      {
        method: 'GET',
        headers: this.headers,
      }
    );

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

/**
 * 토스 에러 코드를 사용자 친화적 메시지로 변환
 * - 민감한 내부 정보 노출 방지
 * - 일관된 한국어 에러 메시지 제공
 */
export function mapTossErrorToUserMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    // 카드 관련
    INVALID_CARD_NUMBER: '카드 번호가 올바르지 않습니다.',
    INVALID_CARD_EXPIRATION: '카드 유효기간이 올바르지 않습니다.',
    INVALID_CARD_CVC: '카드 보안번호(CVC)가 올바르지 않습니다.',
    EXCEED_MAX_CARD_INSTALLMENT_PLAN: '할부 개월 수가 초과되었습니다.',
    NOT_ALLOWED_CARD_COMPANY: '사용할 수 없는 카드사입니다.',
    CARD_LIMIT_EXCEEDED: '카드 한도가 초과되었습니다.',
    CARD_LOST_OR_STOLEN: '분실 또는 도난 신고된 카드입니다.',
    CARD_RESTRICTED: '사용이 제한된 카드입니다.',

    // 결제 관련
    INVALID_PAYMENT_KEY: '결제 정보를 찾을 수 없습니다.',
    ALREADY_PROCESSED_PAYMENT: '이미 처리된 결제입니다.',
    PAYMENT_NOT_FOUND: '결제 내역을 찾을 수 없습니다.',
    INVALID_AMOUNT: '결제 금액이 올바르지 않습니다.',
    EXCEED_MAX_AMOUNT: '최대 결제 금액을 초과했습니다.',

    // 빌링키 관련
    INVALID_BILLING_KEY: '결제 수단 정보가 올바르지 않습니다.',
    BILLING_KEY_DELETED: '삭제된 결제 수단입니다.',
    NOT_REGISTERED_CUSTOMER_KEY: '등록되지 않은 고객입니다.',

    // 환불 관련
    ALREADY_REFUND_PAYMENT: '이미 환불 처리된 결제입니다.',
    EXCEED_REFUND_AMOUNT: '환불 가능 금액을 초과했습니다.',
    NOT_ALLOWED_PARTIAL_REFUND: '부분 환불이 허용되지 않는 결제입니다.',

    // 일반 오류
    FORBIDDEN_REQUEST: '요청 권한이 없습니다.',
    UNAUTHORIZED_KEY: '인증에 실패했습니다.',
    FAILED_INTERNAL_SYSTEM_PROCESSING: '결제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    SERVICE_UNAVAILABLE: '결제 서비스가 일시적으로 중단되었습니다. 잠시 후 다시 시도해주세요.',
  };

  return errorMessages[errorCode] || '결제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

export class NetworkError extends Error {
  constructor(
    public code: 'TIMEOUT' | 'NETWORK_ERROR' | 'MAX_RETRIES_EXCEEDED',
    message: string
  ) {
    super(message);
    this.name = 'NetworkError';
  }

  /**
   * 재시도 가능 여부 판단
   */
  get isRetryable(): boolean {
    return this.code !== 'MAX_RETRIES_EXCEEDED';
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
  /** 취소 내역 (환불 포함) */
  cancels?: Array<{
    cancelAmount: number;
    canceledAt: string;
    cancelReason: string;
    transactionKey: string;
    refundableAmount: number;
  }>;
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

import { serverEnv } from '@/lib/env';

// 싱글톤 인스턴스
let tossClient: TossPaymentsClient | null = null;

export function getTossClient(): TossPaymentsClient {
  if (!tossClient) {
    tossClient = new TossPaymentsClient(serverEnv.TOSS_SECRET_KEY);
  }
  return tossClient;
}
