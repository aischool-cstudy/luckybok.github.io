/**
 * 결제 시스템 타입 정의
 */

// ────────────────────────────────────────────────────────────
// 구독 관련 타입
// ────────────────────────────────────────────────────────────

export type PlanType = 'starter' | 'pro' | 'team' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly';
export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'trialing'
  | 'paused';

export interface Subscription {
  id: string;
  userId: string;
  plan: PlanType;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionInput {
  plan: Exclude<PlanType, 'starter'>;
  billingCycle: BillingCycle;
  billingKeyId: string;
}

// ────────────────────────────────────────────────────────────
// 결제 관련 타입
// ────────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'partial_refunded';

export type PaymentType = 'subscription' | 'credit_purchase';

export interface Payment {
  id: string;
  userId: string;
  orderId: string;
  paymentKey: string | null;
  type: PaymentType;
  status: PaymentStatus;
  amount: number;
  method: string | null;
  receiptUrl: string | null;
  metadata: PaymentMetadata;
  failureReason: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMetadata {
  planId?: PlanType;
  billingCycle?: BillingCycle;
  creditPackageId?: string;
  credits?: number;
  subscriptionId?: string;
  [key: string]: unknown;
}

// ────────────────────────────────────────────────────────────
// 빌링키 관련 타입
// ────────────────────────────────────────────────────────────

export interface BillingKey {
  id: string;
  userId: string;
  customerKey: string;
  encryptedBillingKey: string;
  cardCompany: string;
  cardNumber: string;
  cardType: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ────────────────────────────────────────────────────────────
// 크레딧 관련 타입
// ────────────────────────────────────────────────────────────

export type CreditTransactionType =
  | 'purchase'
  | 'subscription_grant'
  | 'usage'
  | 'refund'
  | 'expiry'
  | 'admin_adjustment';

export interface CreditTransaction {
  id: string;
  userId: string;
  type: CreditTransactionType;
  amount: number;
  balance: number;
  description: string;
  paymentId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

// ────────────────────────────────────────────────────────────
// 웹훅 관련 타입
// ────────────────────────────────────────────────────────────

export type WebhookEventType =
  | 'PAYMENT_STATUS_CHANGED'
  | 'BILLING_STATUS_CHANGED'
  | 'VIRTUAL_ACCOUNT_DEPOSITED'
  | 'DEPOSIT_CALLBACK';

export interface WebhookLog {
  id: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  processedAt: Date | null;
  error: string | null;
  createdAt: Date;
}

// ────────────────────────────────────────────────────────────
// Server Action 응답 타입
// ────────────────────────────────────────────────────────────

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PreparePaymentResponse {
  orderId: string;
  amount: number;
  orderName: string;
  customerKey: string;
}

export interface ConfirmPaymentInput {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface PrepareSubscriptionResponse extends PreparePaymentResponse {
  plan: PlanType;
  billingCycle: BillingCycle;
}

// ────────────────────────────────────────────────────────────
// 결제 위젯 관련 타입
// ────────────────────────────────────────────────────────────

export interface PaymentWidgetConfig {
  clientKey: string;
  customerKey: string;
  orderId: string;
  orderName: string;
  amount: number;
  successUrl: string;
  failUrl: string;
}

export interface SubscriptionWidgetConfig {
  clientKey: string;
  customerKey: string;
  successUrl: string;
  failUrl: string;
}

// ────────────────────────────────────────────────────────────
// 토스 API 응답 타입 (확장)
// ────────────────────────────────────────────────────────────

export interface TossWebhookPayload {
  eventType: WebhookEventType;
  createdAt: string;
  data: {
    paymentKey?: string;
    orderId?: string;
    status?: string;
    transactionKey?: string;
    secret?: string;
    [key: string]: unknown;
  };
}

// ────────────────────────────────────────────────────────────
// 프론트엔드용 타입
// ────────────────────────────────────────────────────────────

export interface PricingPlan {
  id: PlanType;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: string[];
  isPopular?: boolean;
  isCurrent?: boolean;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  validityDays: number;
  isPopular?: boolean;
}

export interface PaymentHistoryItem {
  id: string;
  date: Date;
  type: PaymentType;
  description: string;
  amount: number;
  status: PaymentStatus;
  receiptUrl: string | null;
}

export interface SubscriptionSummary {
  plan: PlanType;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  cardInfo: {
    company: string;
    lastFourDigits: string;
  } | null;
}

export interface CreditSummary {
  balance: number;
  expiringCredits: number;
  expiringDate: Date | null;
}

// ────────────────────────────────────────────────────────────
// 토스페이먼츠 SDK 타입
// ────────────────────────────────────────────────────────────

/**
 * 토스페이먼츠 단건 결제 요청 옵션
 */
export interface TossPaymentRequestOptions {
  amount: number;
  orderId: string;
  orderName: string;
  customerKey: string;
  successUrl: string;
  failUrl: string;
}

/**
 * 토스페이먼츠 빌링 인증 요청 옵션
 */
export interface TossBillingAuthOptions {
  customerKey: string;
  successUrl: string;
  failUrl: string;
}

/**
 * 토스페이먼츠 SDK 인스턴스
 */
export interface TossPaymentsInstance {
  /** 단건 결제 요청 */
  requestPayment(method: string, options: TossPaymentRequestOptions): Promise<void>;
  /** 빌링키 발급 인증 요청 */
  requestBillingAuth(method: string, options: TossBillingAuthOptions): Promise<void>;
}

/**
 * 전역 Window에 주입되는 TossPayments 생성자
 */
export interface TossPaymentsConstructor {
  (clientKey: string): TossPaymentsInstance;
}

// Window 인터페이스 확장을 위한 모듈 선언
declare global {
  interface Window {
    TossPayments?: TossPaymentsConstructor;
  }
}
