/**
 * 요금제 및 크레딧 패키지 상수 정의
 */

import type { PlanType, BillingCycle } from '@/types/payment.types';

// ────────────────────────────────────────────────────────────
// 요금제 정의
// ────────────────────────────────────────────────────────────

export const PLANS = {
  starter: {
    id: 'starter' as const,
    name: 'Starter',
    description: '개인 학습 및 테스트용',
    price: {
      monthly: 0,
      yearly: 0,
    },
    features: [
      '일일 10회 생성',
      'Python만 지원',
      '기본 기능',
      '7일 히스토리',
    ],
    limits: {
      dailyGenerations: 10,
      historyDays: 7,
      supportedLanguages: ['python'],
    },
  },
  pro: {
    id: 'pro' as const,
    name: 'Pro',
    description: '전문 강사 및 개인 사용자용',
    price: {
      monthly: 29900,
      yearly: 299000,
    },
    features: [
      '일일 100회 생성',
      '모든 언어 지원',
      'PDF 내보내기',
      '30일 히스토리',
      '우선 지원',
    ],
    limits: {
      dailyGenerations: 100,
      historyDays: 30,
      supportedLanguages: ['python', 'javascript', 'typescript', 'java', 'sql', 'go'],
    },
    isPopular: true,
  },
  team: {
    id: 'team' as const,
    name: 'Team',
    description: '팀 및 기업 교육용',
    price: {
      monthly: 99000,
      yearly: 990000,
    },
    features: [
      '일일 500회 생성',
      '모든 언어 지원',
      'PDF 내보내기',
      '무제한 히스토리',
      'API 제공',
      '최대 5명 계정',
      '전용 지원',
    ],
    limits: {
      dailyGenerations: 500,
      historyDays: -1, // 무제한
      supportedLanguages: ['python', 'javascript', 'typescript', 'java', 'sql', 'go'],
      maxMembers: 5,
    },
  },
  enterprise: {
    id: 'enterprise' as const,
    name: 'Enterprise',
    description: '대기업 및 맞춤형 솔루션',
    price: {
      monthly: -1, // 문의
      yearly: -1,
    },
    features: [
      '무제한 생성',
      '모든 언어 지원',
      'PDF 내보내기',
      '무제한 히스토리',
      'API 제공',
      '무제한 계정',
      '전용 지원',
      '온프레미스 배포',
      'SLA 보장',
    ],
    limits: {
      dailyGenerations: 10000, // 사실상 무제한
      historyDays: -1,
      supportedLanguages: ['python', 'javascript', 'typescript', 'java', 'sql', 'go'],
      maxMembers: -1,
    },
  },
} as const;

// ────────────────────────────────────────────────────────────
// 크레딧 패키지 정의
// ────────────────────────────────────────────────────────────

export const CREDIT_PACKAGES = {
  basic: {
    id: 'basic',
    name: '기본 패키지',
    credits: 50,
    price: 9900,
    pricePerCredit: 198,
    validityDays: 90,
  },
  standard: {
    id: 'standard',
    name: '표준 패키지',
    credits: 150,
    price: 24900,
    pricePerCredit: 166,
    validityDays: 90,
    isPopular: true,
  },
  premium: {
    id: 'premium',
    name: '프리미엄 패키지',
    credits: 350,
    price: 49900,
    pricePerCredit: 143,
    validityDays: 180,
  },
} as const;

export type CreditPackageId = keyof typeof CREDIT_PACKAGES;

// ────────────────────────────────────────────────────────────
// 헬퍼 함수
// ────────────────────────────────────────────────────────────

/**
 * 플랜별 일일 생성 제한 조회
 */
export function getDailyLimitByPlan(plan: PlanType): number {
  return PLANS[plan]?.limits.dailyGenerations ?? 10;
}

/**
 * 플랜별 가격 조회
 */
export function getPlanPrice(plan: PlanType, billingCycle: BillingCycle): number {
  if (plan === 'starter') return 0;
  return PLANS[plan]?.price[billingCycle] ?? 0;
}

/**
 * 플랜별 히스토리 보관 일수 조회
 */
export function getHistoryDaysByPlan(plan: PlanType): number {
  return PLANS[plan]?.limits.historyDays ?? 7;
}

/**
 * 플랜에서 해당 언어 지원 여부 확인
 */
export function isPlanLanguageSupported(plan: PlanType, language: string): boolean {
  const supportedLanguages: readonly string[] =
    PLANS[plan]?.limits.supportedLanguages ?? ['python'];
  return supportedLanguages.includes(language);
}

/**
 * 연간 요금제 할인율 계산
 */
export function getYearlyDiscount(plan: PlanType): number {
  if (plan === 'starter' || plan === 'enterprise') return 0;
  const monthly = PLANS[plan].price.monthly * 12;
  const yearly = PLANS[plan].price.yearly;
  return Math.round(((monthly - yearly) / monthly) * 100);
}

/**
 * 크레딧 패키지 조회
 */
export function getCreditPackage(packageId: CreditPackageId) {
  return CREDIT_PACKAGES[packageId];
}

/**
 * 모든 크레딧 패키지 목록
 */
export function getAllCreditPackages() {
  return Object.values(CREDIT_PACKAGES);
}

/**
 * PDF 내보내기 가능 여부 확인
 */
export function canExportPdf(plan: PlanType): boolean {
  return plan !== 'starter';
}
