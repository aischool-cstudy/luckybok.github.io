import { describe, it, expect } from 'vitest';
import {
  PLANS,
  CREDIT_PACKAGES,
  getDailyLimitByPlan,
  getPlanPrice,
  getHistoryDaysByPlan,
  isPlanLanguageSupported,
  getYearlyDiscount,
  getCreditPackage,
  getAllCreditPackages,
  canExportPdf,
} from '@/lib/payment/plans';

describe('payment/plans', () => {
  describe('PLANS', () => {
    it('모든 필수 플랜이 정의되어 있어야 한다', () => {
      expect(PLANS.starter).toBeDefined();
      expect(PLANS.pro).toBeDefined();
      expect(PLANS.team).toBeDefined();
      expect(PLANS.enterprise).toBeDefined();
    });

    it('각 플랜에 필수 속성이 있어야 한다', () => {
      Object.values(PLANS).forEach((plan) => {
        expect(plan.id).toBeDefined();
        expect(plan.name).toBeDefined();
        expect(plan.description).toBeDefined();
        expect(plan.price).toBeDefined();
        expect(plan.features).toBeDefined();
        expect(plan.limits).toBeDefined();
      });
    });
  });

  describe('CREDIT_PACKAGES', () => {
    it('모든 크레딧 패키지가 정의되어 있어야 한다', () => {
      expect(CREDIT_PACKAGES.basic).toBeDefined();
      expect(CREDIT_PACKAGES.standard).toBeDefined();
      expect(CREDIT_PACKAGES.premium).toBeDefined();
    });

    it('각 패키지에 필수 속성이 있어야 한다', () => {
      Object.values(CREDIT_PACKAGES).forEach((pkg) => {
        expect(pkg.id).toBeDefined();
        expect(pkg.name).toBeDefined();
        expect(pkg.credits).toBeGreaterThan(0);
        expect(pkg.price).toBeGreaterThan(0);
        expect(pkg.pricePerCredit).toBeGreaterThan(0);
        expect(pkg.validityDays).toBeGreaterThan(0);
      });
    });
  });

  describe('getDailyLimitByPlan', () => {
    it('각 플랜별 일일 생성 제한을 반환해야 한다', () => {
      expect(getDailyLimitByPlan('starter')).toBe(10);
      expect(getDailyLimitByPlan('pro')).toBe(100);
      expect(getDailyLimitByPlan('team')).toBe(500);
      expect(getDailyLimitByPlan('enterprise')).toBe(10000);
    });
  });

  describe('getPlanPrice', () => {
    it('starter 플랜은 무료여야 한다', () => {
      expect(getPlanPrice('starter', 'monthly')).toBe(0);
      expect(getPlanPrice('starter', 'yearly')).toBe(0);
    });

    it('pro 플랜 가격이 올바르게 반환되어야 한다', () => {
      expect(getPlanPrice('pro', 'monthly')).toBe(29900);
      expect(getPlanPrice('pro', 'yearly')).toBe(299000);
    });

    it('team 플랜 가격이 올바르게 반환되어야 한다', () => {
      expect(getPlanPrice('team', 'monthly')).toBe(99000);
      expect(getPlanPrice('team', 'yearly')).toBe(990000);
    });
  });

  describe('getHistoryDaysByPlan', () => {
    it('starter 플랜은 7일 히스토리여야 한다', () => {
      expect(getHistoryDaysByPlan('starter')).toBe(7);
    });

    it('pro 플랜은 30일 히스토리여야 한다', () => {
      expect(getHistoryDaysByPlan('pro')).toBe(30);
    });

    it('team 이상 플랜은 무제한(-1) 히스토리여야 한다', () => {
      expect(getHistoryDaysByPlan('team')).toBe(-1);
      expect(getHistoryDaysByPlan('enterprise')).toBe(-1);
    });
  });

  describe('isPlanLanguageSupported', () => {
    it('starter 플랜은 Python만 지원해야 한다', () => {
      expect(isPlanLanguageSupported('starter', 'python')).toBe(true);
      expect(isPlanLanguageSupported('starter', 'javascript')).toBe(false);
      expect(isPlanLanguageSupported('starter', 'typescript')).toBe(false);
    });

    it('pro 이상 플랜은 모든 언어를 지원해야 한다', () => {
      const languages = ['python', 'javascript', 'typescript', 'java', 'sql', 'go'];
      languages.forEach((lang) => {
        expect(isPlanLanguageSupported('pro', lang)).toBe(true);
        expect(isPlanLanguageSupported('team', lang)).toBe(true);
        expect(isPlanLanguageSupported('enterprise', lang)).toBe(true);
      });
    });
  });

  describe('getYearlyDiscount', () => {
    it('starter 플랜은 할인이 없어야 한다', () => {
      expect(getYearlyDiscount('starter')).toBe(0);
    });

    it('enterprise 플랜은 할인이 없어야 한다', () => {
      expect(getYearlyDiscount('enterprise')).toBe(0);
    });

    it('pro 플랜은 17% 할인이어야 한다', () => {
      // 월 29,900 * 12 = 358,800
      // 연 299,000
      // 할인율 = (358800 - 299000) / 358800 * 100 ≈ 17%
      expect(getYearlyDiscount('pro')).toBeGreaterThanOrEqual(16);
      expect(getYearlyDiscount('pro')).toBeLessThanOrEqual(18);
    });

    it('team 플랜은 17% 할인이어야 한다', () => {
      expect(getYearlyDiscount('team')).toBeGreaterThanOrEqual(16);
      expect(getYearlyDiscount('team')).toBeLessThanOrEqual(18);
    });
  });

  describe('getCreditPackage', () => {
    it('패키지 ID로 크레딧 패키지를 조회할 수 있어야 한다', () => {
      expect(getCreditPackage('basic')).toBe(CREDIT_PACKAGES.basic);
      expect(getCreditPackage('standard')).toBe(CREDIT_PACKAGES.standard);
      expect(getCreditPackage('premium')).toBe(CREDIT_PACKAGES.premium);
    });
  });

  describe('getAllCreditPackages', () => {
    it('모든 크레딧 패키지 배열을 반환해야 한다', () => {
      const packages = getAllCreditPackages();
      expect(packages.length).toBe(3);
      expect(packages).toContain(CREDIT_PACKAGES.basic);
      expect(packages).toContain(CREDIT_PACKAGES.standard);
      expect(packages).toContain(CREDIT_PACKAGES.premium);
    });
  });

  describe('canExportPdf', () => {
    it('starter 플랜은 PDF 내보내기가 불가능해야 한다', () => {
      expect(canExportPdf('starter')).toBe(false);
    });

    it('pro 이상 플랜은 PDF 내보내기가 가능해야 한다', () => {
      expect(canExportPdf('pro')).toBe(true);
      expect(canExportPdf('team')).toBe(true);
      expect(canExportPdf('enterprise')).toBe(true);
    });
  });
});
