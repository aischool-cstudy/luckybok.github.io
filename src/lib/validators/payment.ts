/**
 * 결제 관련 Zod 검증 스키마
 */

import { z } from 'zod';
import { plans, creditPackages } from '@/config/pricing';

// ────────────────────────────────────────────────────────────
// 기본 타입 스키마
// ────────────────────────────────────────────────────────────

export const planSchema = z.enum(['starter', 'pro', 'team', 'enterprise']);
export const paidPlanSchema = z.enum(['pro', 'team', 'enterprise']);
export const billingCycleSchema = z.enum(['monthly', 'yearly']);

export const paymentStatusSchema = z.enum([
  'pending',
  'completed',
  'failed',
  'canceled',
  'refunded',
  'partial_refunded',
]);

export const subscriptionStatusSchema = z.enum([
  'active',
  'canceled',
  'past_due',
  'trialing',
  'paused',
]);

// ────────────────────────────────────────────────────────────
// 크레딧 구매 스키마
// ────────────────────────────────────────────────────────────

const validCreditPackageIds = creditPackages.map((pkg) => pkg.id) as [string, ...string[]];

export const creditPackageIdSchema = z.enum(validCreditPackageIds);

export const prepareCreditPurchaseSchema = z.object({
  packageId: creditPackageIdSchema,
});

export const confirmCreditPaymentSchema = z.object({
  paymentKey: z.string().min(1, '결제 키가 필요합니다'),
  orderId: z
    .string()
    .min(1, '주문 ID가 필요합니다')
    .regex(/^CRD_\d{14}_[A-Z0-9]{8}$/, '잘못된 주문 ID 형식입니다'),
  amount: z.number().int().positive('금액은 양수여야 합니다'),
});

// ────────────────────────────────────────────────────────────
// 구독 스키마
// ────────────────────────────────────────────────────────────

export const prepareSubscriptionSchema = z.object({
  plan: paidPlanSchema,
  billingCycle: billingCycleSchema,
});

export const confirmSubscriptionSchema = z.object({
  authKey: z.string().min(1, '인증 키가 필요합니다'),
  customerKey: z.string().uuid('잘못된 고객 키 형식입니다'),
  orderId: z
    .string()
    .min(1, '주문 ID가 필요합니다')
    .regex(/^SUB_\d{14}_[A-Z0-9]{8}$/, '잘못된 주문 ID 형식입니다'),
  plan: paidPlanSchema,
  billingCycle: billingCycleSchema,
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().max(500).optional(),
  cancelImmediately: z.boolean().default(false),
});

// ────────────────────────────────────────────────────────────
// 웹훅 스키마
// ────────────────────────────────────────────────────────────

export const webhookEventTypeSchema = z.enum([
  'PAYMENT_STATUS_CHANGED',
  'BILLING_STATUS_CHANGED',
  'VIRTUAL_ACCOUNT_DEPOSITED',
  'DEPOSIT_CALLBACK',
]);

export const webhookPayloadSchema = z.object({
  eventType: webhookEventTypeSchema,
  createdAt: z.string(),
  data: z.object({
    paymentKey: z.string().optional(),
    orderId: z.string().optional(),
    status: z.string().optional(),
    transactionKey: z.string().optional(),
    secret: z.string().optional(),
  }).passthrough(),
});

// ────────────────────────────────────────────────────────────
// 결제 콜백 스키마 (토스 리디렉션)
// ────────────────────────────────────────────────────────────

export const paymentSuccessCallbackSchema = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.coerce.number().int().positive(),
});

export const paymentFailCallbackSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  orderId: z.string().optional(),
});

export const billingSuccessCallbackSchema = z.object({
  authKey: z.string().min(1),
  customerKey: z.string().min(1),
});

// ────────────────────────────────────────────────────────────
// 금액 검증 유틸리티
// ────────────────────────────────────────────────────────────

/**
 * 크레딧 패키지 금액 검증
 */
export function validateCreditPackageAmount(
  packageId: string,
  amount: number
): { valid: boolean; expectedAmount?: number; error?: string } {
  const pkg = creditPackages.find((p) => p.id === packageId);

  if (!pkg) {
    return { valid: false, error: '존재하지 않는 패키지입니다' };
  }

  if (pkg.price !== amount) {
    return {
      valid: false,
      expectedAmount: pkg.price,
      error: `금액이 일치하지 않습니다. 예상: ${pkg.price}원, 실제: ${amount}원`,
    };
  }

  return { valid: true };
}

/**
 * 구독 플랜 금액 검증
 */
export function validateSubscriptionAmount(
  plan: 'pro' | 'team' | 'enterprise',
  billingCycle: 'monthly' | 'yearly',
  amount: number
): { valid: boolean; expectedAmount?: number; error?: string } {
  const planConfig = plans[plan];

  if (!planConfig) {
    return { valid: false, error: '존재하지 않는 플랜입니다' };
  }

  const expectedAmount = planConfig.price[billingCycle];

  if (expectedAmount !== amount) {
    return {
      valid: false,
      expectedAmount,
      error: `금액이 일치하지 않습니다. 예상: ${expectedAmount}원, 실제: ${amount}원`,
    };
  }

  return { valid: true };
}

/**
 * 주문 ID 형식 검증
 */
export function validateOrderIdFormat(
  orderId: string,
  expectedType?: 'ORD' | 'SUB' | 'CRD'
): boolean {
  const pattern = expectedType
    ? new RegExp(`^${expectedType}_\\d{14}_[A-Z0-9]{8}$`)
    : /^(ORD|SUB|CRD)_\d{14}_[A-Z0-9]{8}$/;

  return pattern.test(orderId);
}

// ────────────────────────────────────────────────────────────
// 타입 추론
// ────────────────────────────────────────────────────────────

export type PrepareCreditPurchaseInput = z.infer<typeof prepareCreditPurchaseSchema>;
export type ConfirmCreditPaymentInput = z.infer<typeof confirmCreditPaymentSchema>;
export type PrepareSubscriptionInput = z.infer<typeof prepareSubscriptionSchema>;
export type ConfirmSubscriptionInput = z.infer<typeof confirmSubscriptionSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
export type PaymentSuccessCallback = z.infer<typeof paymentSuccessCallbackSchema>;
export type PaymentFailCallback = z.infer<typeof paymentFailCallbackSchema>;
export type BillingSuccessCallback = z.infer<typeof billingSuccessCallbackSchema>;
