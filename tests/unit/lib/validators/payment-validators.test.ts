import { describe, it, expect } from 'vitest';
import {
  planSchema,
  paidPlanSchema,
  billingCycleSchema,
  paymentStatusSchema,
  subscriptionStatusSchema,
  prepareCreditPurchaseSchema,
  confirmCreditPaymentSchema,
  prepareSubscriptionSchema,
  confirmSubscriptionSchema,
  cancelSubscriptionSchema,
  changePlanSchema,
  confirmPlanChangeSchema,
  webhookEventTypeSchema,
  webhookPayloadSchema,
  paymentSuccessCallbackSchema,
  paymentFailCallbackSchema,
  billingSuccessCallbackSchema,
  refundRequestSchema,
  validateCreditPackageAmount,
  validateSubscriptionAmount,
  validateOrderIdFormat,
} from '@/lib/validators/payment';

describe('Payment Validators', () => {
  describe('기본 타입 스키마', () => {
    describe('planSchema', () => {
      it('모든 플랜 타입을 허용해야 한다', () => {
        expect(planSchema.safeParse('starter').success).toBe(true);
        expect(planSchema.safeParse('pro').success).toBe(true);
        expect(planSchema.safeParse('team').success).toBe(true);
        expect(planSchema.safeParse('enterprise').success).toBe(true);
      });

      it('잘못된 플랜 타입을 거부해야 한다', () => {
        expect(planSchema.safeParse('basic').success).toBe(false);
        expect(planSchema.safeParse('premium').success).toBe(false);
      });
    });

    describe('paidPlanSchema', () => {
      it('유료 플랜만 허용해야 한다', () => {
        expect(paidPlanSchema.safeParse('pro').success).toBe(true);
        expect(paidPlanSchema.safeParse('team').success).toBe(true);
        expect(paidPlanSchema.safeParse('enterprise').success).toBe(true);
      });

      it('starter 플랜을 거부해야 한다', () => {
        expect(paidPlanSchema.safeParse('starter').success).toBe(false);
      });
    });

    describe('billingCycleSchema', () => {
      it('월간/연간 결제 주기를 허용해야 한다', () => {
        expect(billingCycleSchema.safeParse('monthly').success).toBe(true);
        expect(billingCycleSchema.safeParse('yearly').success).toBe(true);
      });

      it('잘못된 결제 주기를 거부해야 한다', () => {
        expect(billingCycleSchema.safeParse('weekly').success).toBe(false);
      });
    });

    describe('paymentStatusSchema', () => {
      it('모든 결제 상태를 허용해야 한다', () => {
        const statuses = ['pending', 'completed', 'failed', 'canceled', 'refunded', 'partial_refunded'];
        statuses.forEach((status) => {
          expect(paymentStatusSchema.safeParse(status).success).toBe(true);
        });
      });
    });

    describe('subscriptionStatusSchema', () => {
      it('모든 구독 상태를 허용해야 한다', () => {
        const statuses = ['active', 'canceled', 'past_due', 'trialing', 'paused'];
        statuses.forEach((status) => {
          expect(subscriptionStatusSchema.safeParse(status).success).toBe(true);
        });
      });
    });
  });

  describe('크레딧 구매 스키마', () => {
    describe('prepareCreditPurchaseSchema', () => {
      it('유효한 패키지 ID를 허용해야 한다', () => {
        expect(prepareCreditPurchaseSchema.safeParse({ packageId: 'basic' }).success).toBe(true);
        expect(prepareCreditPurchaseSchema.safeParse({ packageId: 'standard' }).success).toBe(true);
        expect(prepareCreditPurchaseSchema.safeParse({ packageId: 'premium' }).success).toBe(true);
      });

      it('잘못된 패키지 ID를 거부해야 한다', () => {
        expect(prepareCreditPurchaseSchema.safeParse({ packageId: 'invalid' }).success).toBe(false);
      });
    });

    describe('confirmCreditPaymentSchema', () => {
      it('유효한 결제 확인 데이터를 허용해야 한다', () => {
        const validData = {
          paymentKey: 'toss_payment_key_123',
          orderId: 'CRD_20260203120000_ABCD1234',
          amount: 9900,
        };

        expect(confirmCreditPaymentSchema.safeParse(validData).success).toBe(true);
      });

      it('잘못된 주문 ID 형식을 거부해야 한다', () => {
        const invalidData = {
          paymentKey: 'key',
          orderId: 'INVALID_ORDER_ID',
          amount: 9900,
        };

        const result = confirmCreditPaymentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('음수 금액을 거부해야 한다', () => {
        const invalidData = {
          paymentKey: 'key',
          orderId: 'CRD_20260203120000_ABCD1234',
          amount: -1000,
        };

        expect(confirmCreditPaymentSchema.safeParse(invalidData).success).toBe(false);
      });

      it('빈 paymentKey를 거부해야 한다', () => {
        const invalidData = {
          paymentKey: '',
          orderId: 'CRD_20260203120000_ABCD1234',
          amount: 9900,
        };

        expect(confirmCreditPaymentSchema.safeParse(invalidData).success).toBe(false);
      });
    });
  });

  describe('구독 스키마', () => {
    describe('prepareSubscriptionSchema', () => {
      it('유효한 구독 준비 데이터를 허용해야 한다', () => {
        const validData = {
          plan: 'pro',
          billingCycle: 'monthly',
        };

        expect(prepareSubscriptionSchema.safeParse(validData).success).toBe(true);
      });

      it('starter 플랜을 거부해야 한다', () => {
        const invalidData = {
          plan: 'starter',
          billingCycle: 'monthly',
        };

        expect(prepareSubscriptionSchema.safeParse(invalidData).success).toBe(false);
      });
    });

    describe('confirmSubscriptionSchema', () => {
      it('유효한 구독 확인 데이터를 허용해야 한다', () => {
        const validData = {
          authKey: 'auth_key_123',
          customerKey: '550e8400-e29b-41d4-a716-446655440000',
          orderId: 'SUB_20260203120000_ABCD1234',
          plan: 'pro',
          billingCycle: 'yearly',
        };

        expect(confirmSubscriptionSchema.safeParse(validData).success).toBe(true);
      });

      it('잘못된 customerKey 형식을 거부해야 한다', () => {
        const invalidData = {
          authKey: 'auth_key',
          customerKey: 'not-a-uuid',
          orderId: 'SUB_20260203120000_ABCD1234',
          plan: 'pro',
          billingCycle: 'monthly',
        };

        expect(confirmSubscriptionSchema.safeParse(invalidData).success).toBe(false);
      });

      it('잘못된 주문 ID 형식을 거부해야 한다', () => {
        const invalidData = {
          authKey: 'auth_key',
          customerKey: '550e8400-e29b-41d4-a716-446655440000',
          orderId: 'CRD_20260203120000_ABCD1234', // CRD 대신 SUB여야 함
          plan: 'pro',
          billingCycle: 'monthly',
        };

        expect(confirmSubscriptionSchema.safeParse(invalidData).success).toBe(false);
      });
    });

    describe('cancelSubscriptionSchema', () => {
      it('유효한 취소 데이터를 허용해야 한다', () => {
        const validData = {
          reason: '다른 서비스로 이전',
          cancelImmediately: false,
        };

        expect(cancelSubscriptionSchema.safeParse(validData).success).toBe(true);
      });

      it('reason이 선택적이어야 한다', () => {
        const withoutReason = { cancelImmediately: true };

        expect(cancelSubscriptionSchema.safeParse(withoutReason).success).toBe(true);
      });

      it('cancelImmediately 기본값이 false여야 한다', () => {
        const result = cancelSubscriptionSchema.safeParse({});

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.cancelImmediately).toBe(false);
        }
      });

      it('500자 초과 reason을 거부해야 한다', () => {
        const invalidData = {
          reason: 'a'.repeat(501),
        };

        expect(cancelSubscriptionSchema.safeParse(invalidData).success).toBe(false);
      });
    });
  });

  describe('플랜 변경 스키마', () => {
    describe('changePlanSchema', () => {
      it('유효한 플랜 변경 데이터를 허용해야 한다', () => {
        const validData = {
          newPlan: 'team',
          newBillingCycle: 'yearly',
        };

        expect(changePlanSchema.safeParse(validData).success).toBe(true);
      });
    });

    describe('confirmPlanChangeSchema', () => {
      it('유효한 플랜 변경 확인 데이터를 허용해야 한다', () => {
        const validData = {
          newPlan: 'team',
          newBillingCycle: 'monthly',
          orderId: 'CHG_20260203120000_ABCD1234',
        };

        expect(confirmPlanChangeSchema.safeParse(validData).success).toBe(true);
      });

      it('orderId가 선택적이어야 한다', () => {
        const withoutOrderId = {
          newPlan: 'pro',
          newBillingCycle: 'yearly',
        };

        expect(confirmPlanChangeSchema.safeParse(withoutOrderId).success).toBe(true);
      });
    });
  });

  describe('웹훅 스키마', () => {
    describe('webhookEventTypeSchema', () => {
      it('모든 웹훅 이벤트 타입을 허용해야 한다', () => {
        const eventTypes = [
          'PAYMENT_STATUS_CHANGED',
          'BILLING_STATUS_CHANGED',
          'VIRTUAL_ACCOUNT_DEPOSITED',
          'DEPOSIT_CALLBACK',
        ];

        eventTypes.forEach((type) => {
          expect(webhookEventTypeSchema.safeParse(type).success).toBe(true);
        });
      });
    });

    describe('webhookPayloadSchema', () => {
      it('유효한 웹훅 페이로드를 허용해야 한다', () => {
        const validPayload = {
          eventType: 'PAYMENT_STATUS_CHANGED',
          createdAt: '2026-02-03T12:00:00Z',
          data: {
            paymentKey: 'payment_key_123',
            orderId: 'CRD_20260203120000_ABCD1234',
            status: 'DONE',
          },
        };

        expect(webhookPayloadSchema.safeParse(validPayload).success).toBe(true);
      });

      it('잘못된 이벤트 타입을 거부해야 한다', () => {
        const invalidPayload = {
          eventType: 'UNKNOWN_EVENT',
          createdAt: '2026-02-03T12:00:00Z',
          data: {},
        };

        expect(webhookPayloadSchema.safeParse(invalidPayload).success).toBe(false);
      });
    });
  });

  describe('결제 콜백 스키마', () => {
    describe('paymentSuccessCallbackSchema', () => {
      it('유효한 성공 콜백 데이터를 허용해야 한다', () => {
        const validData = {
          paymentKey: 'payment_key_123',
          orderId: 'CRD_20260203120000_ABCD1234',
          amount: '9900', // 문자열도 coerce로 변환
        };

        const result = paymentSuccessCallbackSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.amount).toBe(9900); // 숫자로 변환됨
        }
      });
    });

    describe('paymentFailCallbackSchema', () => {
      it('유효한 실패 콜백 데이터를 허용해야 한다', () => {
        const validData = {
          code: 'USER_CANCEL',
          message: '사용자가 결제를 취소했습니다',
        };

        expect(paymentFailCallbackSchema.safeParse(validData).success).toBe(true);
      });

      it('orderId가 선택적이어야 한다', () => {
        const withOrderId = {
          code: 'PAY_PROCESS_ABORTED',
          message: '결제 처리 중단',
          orderId: 'CRD_123',
        };

        const withoutOrderId = {
          code: 'PAY_PROCESS_ABORTED',
          message: '결제 처리 중단',
        };

        expect(paymentFailCallbackSchema.safeParse(withOrderId).success).toBe(true);
        expect(paymentFailCallbackSchema.safeParse(withoutOrderId).success).toBe(true);
      });
    });

    describe('billingSuccessCallbackSchema', () => {
      it('유효한 빌링 성공 콜백 데이터를 허용해야 한다', () => {
        const validData = {
          authKey: 'auth_key_123',
          customerKey: 'customer_key_456',
        };

        expect(billingSuccessCallbackSchema.safeParse(validData).success).toBe(true);
      });
    });
  });

  describe('환불 스키마', () => {
    describe('refundRequestSchema', () => {
      it('유효한 환불 요청 데이터를 허용해야 한다', () => {
        const validData = {
          paymentId: '550e8400-e29b-41d4-a716-446655440000',
          reason: '서비스 불만족',
          refundAmount: 5000,
        };

        expect(refundRequestSchema.safeParse(validData).success).toBe(true);
      });

      it('reason과 refundAmount가 선택적이어야 한다', () => {
        const onlyPaymentId = {
          paymentId: '550e8400-e29b-41d4-a716-446655440000',
        };

        expect(refundRequestSchema.safeParse(onlyPaymentId).success).toBe(true);
      });

      it('잘못된 paymentId 형식을 거부해야 한다', () => {
        const invalidData = {
          paymentId: 'not-a-uuid',
        };

        expect(refundRequestSchema.safeParse(invalidData).success).toBe(false);
      });

      it('500자 초과 reason을 거부해야 한다', () => {
        const invalidData = {
          paymentId: '550e8400-e29b-41d4-a716-446655440000',
          reason: 'a'.repeat(501),
        };

        expect(refundRequestSchema.safeParse(invalidData).success).toBe(false);
      });

      it('음수 refundAmount를 거부해야 한다', () => {
        const invalidData = {
          paymentId: '550e8400-e29b-41d4-a716-446655440000',
          refundAmount: -1000,
        };

        expect(refundRequestSchema.safeParse(invalidData).success).toBe(false);
      });

      it('소수점 refundAmount를 거부해야 한다', () => {
        const invalidData = {
          paymentId: '550e8400-e29b-41d4-a716-446655440000',
          refundAmount: 1000.5,
        };

        expect(refundRequestSchema.safeParse(invalidData).success).toBe(false);
      });
    });
  });

  describe('금액 검증 유틸리티', () => {
    describe('validateCreditPackageAmount', () => {
      it('유효한 패키지 금액을 검증해야 한다', () => {
        const result = validateCreditPackageAmount('basic', 9900);
        expect(result.valid).toBe(true);
      });

      it('금액이 일치하지 않으면 실패해야 한다', () => {
        const result = validateCreditPackageAmount('basic', 10000);
        expect(result.valid).toBe(false);
        expect(result.expectedAmount).toBe(9900);
        expect(result.error).toContain('금액이 일치하지 않습니다');
      });

      it('존재하지 않는 패키지는 실패해야 한다', () => {
        const result = validateCreditPackageAmount('invalid', 9900);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('존재하지 않는 패키지입니다');
      });
    });

    describe('validateSubscriptionAmount', () => {
      it('유효한 구독 금액을 검증해야 한다', () => {
        const result = validateSubscriptionAmount('pro', 'monthly', 29900);
        expect(result.valid).toBe(true);
      });

      it('금액이 일치하지 않으면 실패해야 한다', () => {
        const result = validateSubscriptionAmount('pro', 'monthly', 30000);
        expect(result.valid).toBe(false);
        expect(result.expectedAmount).toBe(29900);
      });

      it('존재하지 않는 플랜은 실패해야 한다', () => {
        // @ts-expect-error 테스트를 위한 잘못된 타입
        const result = validateSubscriptionAmount('invalid', 'monthly', 29900);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('존재하지 않는 플랜입니다');
      });
    });

    describe('validateOrderIdFormat', () => {
      it('유효한 주문 ID 형식을 검증해야 한다', () => {
        expect(validateOrderIdFormat('ORD_20260203120000_ABCD1234')).toBe(true);
        expect(validateOrderIdFormat('SUB_20260203120000_ABCD1234')).toBe(true);
        expect(validateOrderIdFormat('CRD_20260203120000_ABCD1234')).toBe(true);
        expect(validateOrderIdFormat('CHG_20260203120000_ABCD1234')).toBe(true);
      });

      it('특정 타입으로 검증할 수 있어야 한다', () => {
        expect(validateOrderIdFormat('CRD_20260203120000_ABCD1234', 'CRD')).toBe(true);
        expect(validateOrderIdFormat('CRD_20260203120000_ABCD1234', 'SUB')).toBe(false);
      });

      it('잘못된 형식을 거부해야 한다', () => {
        expect(validateOrderIdFormat('INVALID_ORDER_ID')).toBe(false);
        expect(validateOrderIdFormat('ORD_123_ABC')).toBe(false);
        expect(validateOrderIdFormat('ORD_20260203120000_abc12345')).toBe(false); // 소문자
      });
    });
  });
});
