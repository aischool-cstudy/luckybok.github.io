import { describe, it, expect } from 'vitest';
import {
  plans,
  creditPackages,
  getPlanById,
  formatPrice,
  getDailyLimitByPlan,
} from '@/config/pricing';

describe('pricing', () => {
  describe('plans', () => {
    it('모든 필수 플랜이 정의되어 있어야 한다', () => {
      expect(plans.starter).toBeDefined();
      expect(plans.pro).toBeDefined();
      expect(plans.team).toBeDefined();
      expect(plans.enterprise).toBeDefined();
    });

    it('starter 플랜은 무료여야 한다', () => {
      expect(plans.starter.price.monthly).toBe(0);
      expect(plans.starter.price.yearly).toBe(0);
    });

    it('pro 플랜 가격이 올바르게 설정되어야 한다', () => {
      expect(plans.pro.price.monthly).toBe(29900);
      expect(plans.pro.price.yearly).toBe(299000);
    });

    it('team 플랜 가격이 올바르게 설정되어야 한다', () => {
      expect(plans.team.price.monthly).toBe(99000);
      expect(plans.team.price.yearly).toBe(990000);
    });

    it('starter 플랜은 Python만 지원해야 한다', () => {
      expect(plans.starter.limits.languages).toContain('python');
      expect(plans.starter.limits.languages.length).toBe(1);
    });

    it('pro 이상 플랜은 모든 언어를 지원해야 한다', () => {
      expect(plans.pro.limits.languages).toBe('all');
      expect(plans.team.limits.languages).toBe('all');
      expect(plans.enterprise.limits.languages).toBe('all');
    });

    it('일일 생성 제한이 올바르게 설정되어야 한다', () => {
      expect(plans.starter.limits.dailyGenerations).toBe(10);
      expect(plans.pro.limits.dailyGenerations).toBe(100);
      expect(plans.team.limits.dailyGenerations).toBe(500);
      expect(plans.enterprise.limits.dailyGenerations).toBe(-1); // 무제한
    });
  });

  describe('creditPackages', () => {
    it('모든 크레딧 패키지가 정의되어 있어야 한다', () => {
      expect(creditPackages.length).toBe(3);
    });

    it('basic 패키지가 올바르게 설정되어야 한다', () => {
      const basic = creditPackages.find((p) => p.id === 'basic');
      expect(basic).toBeDefined();
      expect(basic?.credits).toBe(50);
      expect(basic?.price).toBe(9900);
    });

    it('standard 패키지가 올바르게 설정되어야 한다', () => {
      const standard = creditPackages.find((p) => p.id === 'standard');
      expect(standard).toBeDefined();
      expect(standard?.credits).toBe(150);
      expect(standard?.price).toBe(24900);
    });

    it('premium 패키지가 올바르게 설정되어야 한다', () => {
      const premium = creditPackages.find((p) => p.id === 'premium');
      expect(premium).toBeDefined();
      expect(premium?.credits).toBe(350);
      expect(premium?.price).toBe(49900);
    });

    it('크레딧당 가격이 더 많이 구매할수록 저렴해야 한다', () => {
      const basic = creditPackages.find((p) => p.id === 'basic');
      const standard = creditPackages.find((p) => p.id === 'standard');
      const premium = creditPackages.find((p) => p.id === 'premium');

      expect(basic!.pricePerCredit).toBeGreaterThan(standard!.pricePerCredit);
      expect(standard!.pricePerCredit).toBeGreaterThan(premium!.pricePerCredit);
    });
  });

  describe('getPlanById', () => {
    it('존재하는 플랜 ID로 플랜을 조회할 수 있어야 한다', () => {
      expect(getPlanById('starter')).toBe(plans.starter);
      expect(getPlanById('pro')).toBe(plans.pro);
      expect(getPlanById('team')).toBe(plans.team);
      expect(getPlanById('enterprise')).toBe(plans.enterprise);
    });
  });

  describe('formatPrice', () => {
    it('가격을 한국 원화 형식으로 포맷해야 한다', () => {
      expect(formatPrice(0)).toBe('₩0');
      expect(formatPrice(29900)).toBe('₩29,900');
      expect(formatPrice(299000)).toBe('₩299,000');
    });
  });

  describe('getDailyLimitByPlan', () => {
    it('플랜별 일일 생성 제한을 반환해야 한다', () => {
      expect(getDailyLimitByPlan('starter')).toBe(10);
      expect(getDailyLimitByPlan('pro')).toBe(100);
      expect(getDailyLimitByPlan('team')).toBe(500);
      expect(getDailyLimitByPlan('enterprise')).toBe(-1);
    });

    it('알 수 없는 플랜은 starter 제한을 반환해야 한다', () => {
      expect(getDailyLimitByPlan('unknown' as never)).toBe(10);
    });
  });
});
