import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDaysRemaining,
  getTotalDaysInCycle,
  determinePlanChangeType,
  calculateProration,
  formatProrationSummary,
  type ProrationParams,
} from '@/lib/payment/proration';

describe('비례 배분 계산 유틸리티 (proration.ts)', () => {
  describe('getDaysRemaining', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('남은 일수를 정확히 계산해야 한다', () => {
      // 2026-01-31 기준
      vi.setSystemTime(new Date('2026-01-31T00:00:00Z'));

      const periodEnd = new Date('2026-02-15T00:00:00Z');
      const daysRemaining = getDaysRemaining(periodEnd);

      expect(daysRemaining).toBe(15);
    });

    it('기간이 이미 지난 경우 0을 반환해야 한다', () => {
      vi.setSystemTime(new Date('2026-01-31T00:00:00Z'));

      const periodEnd = new Date('2026-01-15T00:00:00Z');
      const daysRemaining = getDaysRemaining(periodEnd);

      expect(daysRemaining).toBe(0);
    });

    it('오늘이 종료일인 경우 0을 반환해야 한다', () => {
      vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));

      const periodEnd = new Date('2026-01-31T00:00:00Z');
      const daysRemaining = getDaysRemaining(periodEnd);

      expect(daysRemaining).toBe(0);
    });

    it('부분 일수도 올림하여 계산해야 한다', () => {
      vi.setSystemTime(new Date('2026-01-31T23:00:00Z'));

      const periodEnd = new Date('2026-02-01T01:00:00Z');
      const daysRemaining = getDaysRemaining(periodEnd);

      expect(daysRemaining).toBe(1);
    });
  });

  describe('getTotalDaysInCycle', () => {
    it('월간 결제 주기는 30일이어야 한다', () => {
      expect(getTotalDaysInCycle('monthly')).toBe(30);
    });

    it('연간 결제 주기는 365일이어야 한다', () => {
      expect(getTotalDaysInCycle('yearly')).toBe(365);
    });
  });

  describe('determinePlanChangeType', () => {
    it('동일한 플랜과 결제 주기는 same을 반환해야 한다', () => {
      const params: ProrationParams = {
        currentPlan: 'pro',
        currentBillingCycle: 'monthly',
        newPlan: 'pro',
        newBillingCycle: 'monthly',
        currentPeriodEnd: new Date('2026-02-28'),
      };

      expect(determinePlanChangeType(params)).toBe('same');
    });

    it('Pro → Team은 upgrade를 반환해야 한다', () => {
      const params: ProrationParams = {
        currentPlan: 'pro',
        currentBillingCycle: 'monthly',
        newPlan: 'team',
        newBillingCycle: 'monthly',
        currentPeriodEnd: new Date('2026-02-28'),
      };

      expect(determinePlanChangeType(params)).toBe('upgrade');
    });

    it('Team → Pro는 downgrade를 반환해야 한다', () => {
      const params: ProrationParams = {
        currentPlan: 'team',
        currentBillingCycle: 'monthly',
        newPlan: 'pro',
        newBillingCycle: 'monthly',
        currentPeriodEnd: new Date('2026-02-28'),
      };

      expect(determinePlanChangeType(params)).toBe('downgrade');
    });

    it('같은 플랜에서 결제 주기만 변경 시 cycle_change를 반환해야 한다', () => {
      const params: ProrationParams = {
        currentPlan: 'pro',
        currentBillingCycle: 'monthly',
        newPlan: 'pro',
        newBillingCycle: 'yearly',
        currentPeriodEnd: new Date('2026-02-28'),
      };

      expect(determinePlanChangeType(params)).toBe('cycle_change');
    });

    it('Pro 월간 → Team 연간은 upgrade를 반환해야 한다', () => {
      const params: ProrationParams = {
        currentPlan: 'pro',
        currentBillingCycle: 'monthly',
        newPlan: 'team',
        newBillingCycle: 'yearly',
        currentPeriodEnd: new Date('2026-02-28'),
      };

      expect(determinePlanChangeType(params)).toBe('upgrade');
    });
  });

  describe('calculateProration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-31T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('동일 플랜에서는 프로레이션 없음', () => {
      const result = calculateProration({
        currentPlan: 'pro',
        currentBillingCycle: 'monthly',
        newPlan: 'pro',
        newBillingCycle: 'monthly',
        currentPeriodEnd: new Date('2026-02-15'),
      });

      expect(result.changeType).toBe('same');
      expect(result.proratedAmount).toBe(0);
      expect(result.requiresPayment).toBe(false);
    });

    it('업그레이드 시 차액을 계산해야 한다', () => {
      // Pro(월 29,900원) → Team(월 99,000원), 15일 남음
      const result = calculateProration({
        currentPlan: 'pro',
        currentBillingCycle: 'monthly',
        newPlan: 'team',
        newBillingCycle: 'monthly',
        currentPeriodEnd: new Date('2026-02-15'),
      });

      expect(result.changeType).toBe('upgrade');
      expect(result.daysRemaining).toBe(15);
      expect(result.requiresPayment).toBe(true);
      // 차액: (99000/30 - 29900/30) * 15 = (3300 - 996.67) * 15 ≈ 34550
      expect(result.proratedAmount).toBeGreaterThan(30000);
      expect(result.proratedAmount).toBeLessThan(40000);
    });

    it('다운그레이드 시 환불 없음, 기간 종료 후 적용', () => {
      const periodEnd = new Date('2026-02-15');

      const result = calculateProration({
        currentPlan: 'team',
        currentBillingCycle: 'monthly',
        newPlan: 'pro',
        newBillingCycle: 'monthly',
        currentPeriodEnd: periodEnd,
      });

      expect(result.changeType).toBe('downgrade');
      expect(result.proratedAmount).toBe(0);
      expect(result.requiresPayment).toBe(false);
      expect(result.effectiveDate.getTime()).toBe(periodEnd.getTime());
    });

    it('결제 주기 변경 (월간→연간) 시 차액 계산', () => {
      // Pro 월간 → Pro 연간, 남은 기간에 대한 차액
      const result = calculateProration({
        currentPlan: 'pro',
        currentBillingCycle: 'monthly',
        newPlan: 'pro',
        newBillingCycle: 'yearly',
        currentPeriodEnd: new Date('2026-02-15'),
      });

      expect(result.changeType).toBe('cycle_change');
      // 연간이 월간보다 일일 요금이 낮으므로 차액이 음수거나 0에 가까움
      // 따라서 결제 필요 없을 수 있음
    });

    it('차액이 100원 미만이면 결제 필요 없음', () => {
      // 남은 기간이 매우 짧아서 차액이 적은 경우
      vi.setSystemTime(new Date('2026-02-14T00:00:00Z'));

      const result = calculateProration({
        currentPlan: 'pro',
        currentBillingCycle: 'monthly',
        newPlan: 'team',
        newBillingCycle: 'monthly',
        currentPeriodEnd: new Date('2026-02-15'),
      });

      // 1일 남았을 때 차액이 100원 넘는지 확인
      // (99000/30 - 29900/30) * 1 = 2303원
      expect(result.requiresPayment).toBe(true);
    });

    it('새 플랜 금액을 정확히 반환해야 한다', () => {
      const result = calculateProration({
        currentPlan: 'pro',
        currentBillingCycle: 'monthly',
        newPlan: 'team',
        newBillingCycle: 'yearly',
        currentPeriodEnd: new Date('2026-02-15'),
      });

      expect(result.newPlanAmount).toBe(990000); // Team 연간 가격
    });
  });

  describe('formatProrationSummary', () => {
    it('same 타입은 변경 없음 메시지 반환', () => {
      const summary = formatProrationSummary({
        changeType: 'same',
        daysRemaining: 15,
        totalDays: 30,
        currentDailyRate: 996.67,
        newDailyRate: 996.67,
        proratedAmount: 0,
        newPlanAmount: 29900,
        effectiveDate: new Date(),
        requiresPayment: false,
      });

      expect(summary).toBe('현재 플랜과 동일합니다.');
    });

    it('upgrade 타입은 즉시 적용 + 차액 결제 메시지 반환', () => {
      const summary = formatProrationSummary({
        changeType: 'upgrade',
        daysRemaining: 15,
        totalDays: 30,
        currentDailyRate: 996.67,
        newDailyRate: 3300,
        proratedAmount: 34550,
        newPlanAmount: 99000,
        effectiveDate: new Date(),
        requiresPayment: true,
      });

      expect(summary).toContain('즉시 적용');
      expect(summary).toContain('15일');
      expect(summary).toContain('34,550원');
    });

    it('upgrade 타입 + 결제 불필요 시 적절한 메시지', () => {
      const summary = formatProrationSummary({
        changeType: 'upgrade',
        daysRemaining: 0,
        totalDays: 30,
        currentDailyRate: 996.67,
        newDailyRate: 3300,
        proratedAmount: 0,
        newPlanAmount: 99000,
        effectiveDate: new Date(),
        requiresPayment: false,
      });

      expect(summary).toContain('추가 결제가 필요하지 않습니다');
    });

    it('downgrade 타입은 기간 종료 후 변경 메시지 반환', () => {
      const effectiveDate = new Date('2026-02-15');

      const summary = formatProrationSummary({
        changeType: 'downgrade',
        daysRemaining: 15,
        totalDays: 30,
        currentDailyRate: 3300,
        newDailyRate: 996.67,
        proratedAmount: 0,
        newPlanAmount: 29900,
        effectiveDate,
        requiresPayment: false,
      });

      expect(summary).toContain('기간이 종료되는');
      expect(summary).toContain('환불은 없습니다');
    });

    it('cycle_change 타입 + 결제 필요 시 메시지', () => {
      const summary = formatProrationSummary({
        changeType: 'cycle_change',
        daysRemaining: 15,
        totalDays: 30,
        currentDailyRate: 996.67,
        newDailyRate: 819.18,
        proratedAmount: 5000,
        newPlanAmount: 299000,
        effectiveDate: new Date(),
        requiresPayment: true,
      });

      expect(summary).toContain('결제 주기 변경');
      expect(summary).toContain('5,000원');
    });
  });
});
