/**
 * 요금제 설정
 */
export const plans = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: '무료로 시작하기',
    price: {
      monthly: 0,
      yearly: 0,
    },
    features: ['하루 10회 생성', 'Python만 지원', '기본 기능'],
    limits: {
      dailyGenerations: 10,
      languages: ['python'] as const,
      historyDays: 7,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: '개인 강사를 위한 플랜',
    price: {
      monthly: 29900,
      yearly: 299000, // 17% 할인
    },
    features: [
      '하루 100회 생성',
      '전체 언어 지원',
      '전체 기능',
      'PDF 내보내기',
      '히스토리 30일',
    ],
    limits: {
      dailyGenerations: 100,
      languages: 'all' as const,
      historyDays: 30,
    },
  },
  team: {
    id: 'team',
    name: 'Team',
    description: '기업 교육팀을 위한 플랜',
    price: {
      monthly: 99000,
      yearly: 990000, // 17% 할인
    },
    features: [
      '하루 500회 생성',
      '전체 언어 지원',
      '전체 기능',
      'API 제공',
      '히스토리 무제한',
      '5명 계정',
    ],
    limits: {
      dailyGenerations: 500,
      languages: 'all' as const,
      historyDays: -1, // 무제한
      seats: 5,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: '대규모 조직을 위한 맞춤 솔루션',
    price: {
      monthly: 0, // 문의
      yearly: 0, // 문의
    },
    features: [
      '무제한 생성',
      '전체 언어 지원',
      '온프레미스 배포',
      '전용 API',
      '전담 지원',
      '무제한 계정',
    ],
    limits: {
      dailyGenerations: -1, // 무제한
      languages: 'all' as const,
      historyDays: -1, // 무제한
      seats: -1, // 무제한
    },
  },
} as const;

export const creditPackages = [
  {
    id: 'basic',
    name: 'Basic',
    credits: 50,
    price: 9900,
    pricePerCredit: 198,
    validityDays: 90,
  },
  {
    id: 'standard',
    name: 'Standard',
    credits: 150,
    price: 24900,
    pricePerCredit: 166,
    validityDays: 90,
  },
  {
    id: 'premium',
    name: 'Premium',
    credits: 350,
    price: 49900,
    pricePerCredit: 143,
    validityDays: 180,
  },
] as const;

export type PlanId = keyof typeof plans;
export type CreditPackageId = (typeof creditPackages)[number]['id'];

export function getPlanById(id: PlanId) {
  return plans[id];
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(amount);
}

/**
 * 플랜별 일일 생성 제한 조회
 * @param plan - 플랜 ID
 * @returns 일일 생성 제한 (무제한인 경우 -1)
 */
export function getDailyLimitByPlan(plan: PlanId | string): number {
  const planConfig = plans[plan as PlanId];
  if (!planConfig) {
    return plans.starter.limits.dailyGenerations;
  }
  return planConfig.limits.dailyGenerations;
}
