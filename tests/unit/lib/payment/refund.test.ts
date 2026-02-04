import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateProratedRefund,
  calculateSubscriptionRefund,
  checkRefundPolicy,
  determineRefundType,
  getCreditPackageByAmount,
  formatRefundSummary,
  getRefundTypeLabel,
  REFUND_POLICY,
} from '@/lib/payment/refund';

describe('환불 계산 유틸리티 (refund.ts)', () => {
  describe('calculateProratedRefund', () => {
    it('사용량이 없을 때 전액 환불 가능', () => {
      const result = calculateProratedRefund({
        originalAmount: 24900,
        originalCredits: 150,
        usedCredits: 0,
      });

      expect(result.refundableAmount).toBe(24900);
      expect(result.refundableCredits).toBe(150);
      expect(result.refundPercentage).toBe(100);
    });

    it('50% 사용 시 50% 환불', () => {
      const result = calculateProratedRefund({
        originalAmount: 24900,
        originalCredits: 150,
        usedCredits: 75,
      });

      expect(result.refundableCredits).toBe(75);
      // 24900 * 75 / 150 = 12450
      expect(result.refundableAmount).toBe(12450);
      expect(result.refundPercentage).toBe(50);
    });

    it('모두 사용 시 환불 불가', () => {
      const result = calculateProratedRefund({
        originalAmount: 24900,
        originalCredits: 150,
        usedCredits: 150,
      });

      expect(result.refundableAmount).toBe(0);
      expect(result.refundableCredits).toBe(0);
      expect(result.refundPercentage).toBe(0);
    });

    it('이미 환불된 금액 차감', () => {
      const result = calculateProratedRefund({
        originalAmount: 24900,
        originalCredits: 150,
        usedCredits: 0,
        alreadyRefunded: 10000,
      });

      // 24900 - 10000 = 14900
      expect(result.refundableAmount).toBe(14900);
    });

    it('이미 환불된 금액이 환불 가능 금액보다 많으면 0 반환', () => {
      const result = calculateProratedRefund({
        originalAmount: 24900,
        originalCredits: 150,
        usedCredits: 100, // 50개 남음 = 24900 * 50/150 = 8300
        alreadyRefunded: 10000,
      });

      expect(result.refundableAmount).toBe(0);
    });

    it('breakdown 정보가 올바른지 확인', () => {
      const result = calculateProratedRefund({
        originalAmount: 24900,
        originalCredits: 150,
        usedCredits: 30,
      });

      expect(result.breakdown).toHaveLength(6);
      expect(result.breakdown[0]).toEqual({
        label: '원래 결제 금액',
        value: '₩24,900',
      });
      expect(result.breakdown[1]).toEqual({
        label: '충전된 크레딧',
        value: '150개',
      });
      expect(result.breakdown[2]).toEqual({
        label: '사용한 크레딧',
        value: '30개',
      });
    });

    it('원래 크레딧이 0일 때 환불 금액 0', () => {
      const result = calculateProratedRefund({
        originalAmount: 10000,
        originalCredits: 0,
        usedCredits: 0,
      });

      expect(result.refundableAmount).toBe(0);
    });
  });

  describe('calculateSubscriptionRefund', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('기간의 절반 사용 시 절반 환불', () => {
      vi.setSystemTime(new Date('2026-01-16T00:00:00Z'));

      const result = calculateSubscriptionRefund({
        amount: 29900,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
      });

      expect(result.usedDays).toBe(15);
      expect(result.remainingDays).toBe(15);
      expect(result.totalDays).toBe(30);
      expect(result.usagePercentage).toBe(50);
      // 29900 * 15 / 30 = 14950
      expect(result.refundableAmount).toBe(14950);
    });

    it('기간 시작일에 환불 시 전액 환불', () => {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

      const result = calculateSubscriptionRefund({
        amount: 29900,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
      });

      expect(result.usedDays).toBe(0);
      expect(result.remainingDays).toBe(30);
      expect(result.refundableAmount).toBe(29900);
    });

    it('기간 종료일에 환불 시 환불 불가', () => {
      vi.setSystemTime(new Date('2026-01-31T00:00:00Z'));

      const result = calculateSubscriptionRefund({
        amount: 29900,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
      });

      expect(result.remainingDays).toBe(0);
      expect(result.refundableAmount).toBe(0);
    });

    it('연간 구독 프로레이션 계산', () => {
      vi.setSystemTime(new Date('2026-02-01T00:00:00Z')); // 31일 사용

      const result = calculateSubscriptionRefund({
        amount: 299000,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2027-01-01'),
      });

      expect(result.totalDays).toBe(365);
      expect(result.usedDays).toBe(31);
      expect(result.remainingDays).toBe(334);
      // 299000 * 334 / 365 = 273,610
      expect(result.refundableAmount).toBeGreaterThan(270000);
      expect(result.refundableAmount).toBeLessThan(280000);
    });

    it('특정 환불 날짜 지정 가능', () => {
      vi.setSystemTime(new Date('2026-01-31T00:00:00Z'));

      const result = calculateSubscriptionRefund({
        amount: 29900,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        refundDate: new Date('2026-01-10'), // 환불 날짜 지정
      });

      expect(result.usedDays).toBe(9);
      expect(result.remainingDays).toBe(21);
    });
  });

  describe('checkRefundPolicy', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-31T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('이미 환불된 결제는 거부', () => {
      const result = checkRefundPolicy({
        paymentDate: new Date('2026-01-25'),
        paymentStatus: 'refunded',
        paymentType: 'credit_purchase',
        requestedAmount: 10000,
        maxRefundableAmount: 10000,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('이미 환불된 결제입니다');
      expect(result.restrictions).toContain('already_refunded');
    });

    it('완료되지 않은 결제는 환불 불가', () => {
      const result = checkRefundPolicy({
        paymentDate: new Date('2026-01-25'),
        paymentStatus: 'pending',
        paymentType: 'credit_purchase',
        requestedAmount: 10000,
        maxRefundableAmount: 10000,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('환불 가능한 상태가 아닙니다');
    });

    it('환불 기간 초과 시 거부', () => {
      const result = checkRefundPolicy({
        paymentDate: new Date('2026-01-01'), // 30일 전
        paymentStatus: 'completed',
        paymentType: 'credit_purchase',
        requestedAmount: 10000,
        maxRefundableAmount: 10000,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('환불 가능 기간');
      expect(result.restrictions).toContain('outside_refund_period');
    });

    it('최소 환불 금액 미달 시 거부', () => {
      const result = checkRefundPolicy({
        paymentDate: new Date('2026-01-30'),
        paymentStatus: 'completed',
        paymentType: 'credit_purchase',
        requestedAmount: 500, // 최소 1000원 미만
        maxRefundableAmount: 10000,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('최소 환불 금액');
      expect(result.restrictions).toContain('below_minimum_amount');
    });

    it('환불 가능 금액 초과 시 거부', () => {
      const result = checkRefundPolicy({
        paymentDate: new Date('2026-01-30'),
        paymentStatus: 'completed',
        paymentType: 'credit_purchase',
        requestedAmount: 20000,
        maxRefundableAmount: 10000,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('환불 가능 금액');
      expect(result.restrictions).toContain('exceeds_refundable_amount');
    });

    it('높은 사용량 시 경고 추가 (환불은 허용)', () => {
      const result = checkRefundPolicy({
        paymentDate: new Date('2026-01-30'),
        paymentStatus: 'completed',
        paymentType: 'credit_purchase',
        requestedAmount: 5000,
        maxRefundableAmount: 10000,
        usagePercentage: 95, // 95% 사용
      });

      expect(result.allowed).toBe(true);
      expect(result.restrictions).toContain('high_usage');
    });

    it('모든 조건 통과 시 허용', () => {
      const result = checkRefundPolicy({
        paymentDate: new Date('2026-01-30'),
        paymentStatus: 'completed',
        paymentType: 'credit_purchase',
        requestedAmount: 5000,
        maxRefundableAmount: 10000,
        usagePercentage: 20,
      });

      expect(result.allowed).toBe(true);
      expect(result.restrictions).toHaveLength(0);
    });

    it('부분 환불된 결제도 환불 가능', () => {
      const result = checkRefundPolicy({
        paymentDate: new Date('2026-01-30'),
        paymentStatus: 'partial_refunded',
        paymentType: 'credit_purchase',
        requestedAmount: 5000,
        maxRefundableAmount: 10000,
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('determineRefundType', () => {
    it('크레딧 사용이 있으면 prorated 반환', () => {
      const type = determineRefundType({
        requestedAmount: 10000,
        originalAmount: 24900,
        usedCredits: 50,
        originalCredits: 150,
      });

      expect(type).toBe('prorated');
    });

    it('크레딧 사용 없고 전액이면 full 반환', () => {
      const type = determineRefundType({
        requestedAmount: 24900,
        originalAmount: 24900,
        usedCredits: 0,
        originalCredits: 150,
      });

      expect(type).toBe('full');
    });

    it('크레딧 사용 없고 부분 금액이면 partial 반환', () => {
      const type = determineRefundType({
        requestedAmount: 10000,
        originalAmount: 24900,
        usedCredits: 0,
        originalCredits: 150,
      });

      expect(type).toBe('partial');
    });

    it('크레딧 정보 없고 전액이면 full 반환', () => {
      const type = determineRefundType({
        requestedAmount: 29900,
        originalAmount: 29900,
      });

      expect(type).toBe('full');
    });

    it('요청 금액이 원래 금액보다 크면 full 반환', () => {
      const type = determineRefundType({
        requestedAmount: 30000,
        originalAmount: 24900,
      });

      expect(type).toBe('full');
    });
  });

  describe('getCreditPackageByAmount', () => {
    it('Basic 패키지 금액으로 조회', () => {
      const result = getCreditPackageByAmount(9900);

      expect(result).not.toBeNull();
      expect(result?.packageId).toBe('basic');
      expect(result?.credits).toBe(50);
    });

    it('Standard 패키지 금액으로 조회', () => {
      const result = getCreditPackageByAmount(24900);

      expect(result).not.toBeNull();
      expect(result?.packageId).toBe('standard');
      expect(result?.credits).toBe(150);
    });

    it('Premium 패키지 금액으로 조회', () => {
      const result = getCreditPackageByAmount(49900);

      expect(result).not.toBeNull();
      expect(result?.packageId).toBe('premium');
      expect(result?.credits).toBe(350);
    });

    it('존재하지 않는 금액은 null 반환', () => {
      const result = getCreditPackageByAmount(12345);

      expect(result).toBeNull();
    });
  });

  describe('getRefundTypeLabel', () => {
    it('full은 전액 환불 반환', () => {
      expect(getRefundTypeLabel('full')).toBe('전액 환불');
    });

    it('partial은 부분 환불 반환', () => {
      expect(getRefundTypeLabel('partial')).toBe('부분 환불');
    });

    it('prorated는 사용량 비례 환불 반환', () => {
      expect(getRefundTypeLabel('prorated')).toBe('사용량 비례 환불');
    });
  });

  describe('formatRefundSummary', () => {
    it('전액 환불 요약 포맷', () => {
      const summary = formatRefundSummary({
        refundType: 'full',
        originalAmount: 24900,
        refundAmount: 24900,
      });

      expect(summary).toContain('전액 환불');
      expect(summary).toContain('₩24,900');
    });

    it('프로레이션 환불 요약 포맷 (크레딧 정보 포함)', () => {
      const summary = formatRefundSummary({
        refundType: 'prorated',
        originalAmount: 24900,
        refundAmount: 12450,
        originalCredits: 150,
        usedCredits: 75,
        refundableCredits: 75,
      });

      expect(summary).toContain('사용량 비례 환불');
      expect(summary).toContain('충전 크레딧: 150개');
      expect(summary).toContain('사용 크레딧: 75개');
      expect(summary).toContain('환불 크레딧: 75개');
    });

    it('부분 환불 요약 포맷', () => {
      const summary = formatRefundSummary({
        refundType: 'partial',
        originalAmount: 24900,
        refundAmount: 10000,
      });

      expect(summary).toContain('부분 환불');
      expect(summary).toContain('₩24,900');
      expect(summary).toContain('₩10,000');
    });
  });

  describe('REFUND_POLICY 상수', () => {
    it('환불 정책 상수가 올바른 값을 가져야 한다', () => {
      expect(REFUND_POLICY.REFUND_PERIOD_DAYS).toBe(7);
      expect(REFUND_POLICY.MIN_REFUND_AMOUNT).toBe(1000);
      expect(REFUND_POLICY.MIN_PARTIAL_REFUND_PERCENTAGE).toBe(10);
      expect(REFUND_POLICY.MAX_USAGE_FOR_FULL_REFUND).toBe(20);
      expect(REFUND_POLICY.ALLOW_SUBSCRIPTION_PRORATION).toBe(true);
    });
  });
});
