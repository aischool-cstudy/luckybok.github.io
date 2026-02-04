/**
 * 환불 계산 유틸리티
 * - 사용량 기반 환불 금액 계산
 * - 환불 정책 검증
 * - 프로레이션 계산
 */

import { REFUND_ELIGIBLE_DAYS } from '@/config/constants';
import { CREDIT_PACKAGES } from '@/lib/payment/plans';

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────

export interface RefundEligibility {
  eligible: boolean;
  reason?: string;
  maxRefundAmount: number;
  refundType: 'full' | 'partial' | 'prorated';
  daysSincePurchase: number;
  isWithinRefundPeriod: boolean;
}

export interface ProratedRefundResult {
  originalAmount: number;
  refundableAmount: number;
  originalCredits: number;
  usedCredits: number;
  refundableCredits: number;
  refundPercentage: number;
  breakdown: {
    label: string;
    value: number | string;
  }[];
}

export interface RefundPolicyCheck {
  allowed: boolean;
  reason?: string;
  restrictions: string[];
}

// ────────────────────────────────────────────────────────────
// 환불 정책 상수
// ────────────────────────────────────────────────────────────

export const REFUND_POLICY = {
  /** 환불 가능 기간 (일) */
  REFUND_PERIOD_DAYS: REFUND_ELIGIBLE_DAYS,

  /** 최소 환불 금액 (원) */
  MIN_REFUND_AMOUNT: 1000,

  /** 부분 환불 최소 비율 (%) */
  MIN_PARTIAL_REFUND_PERCENTAGE: 10,

  /** 크레딧 사용량에 따른 환불 제한 비율 (%) */
  MAX_USAGE_FOR_FULL_REFUND: 20,

  /** 구독 프로레이션 적용 여부 */
  ALLOW_SUBSCRIPTION_PRORATION: true,
} as const;

// ────────────────────────────────────────────────────────────
// 환불 금액 계산
// ────────────────────────────────────────────────────────────

/**
 * 사용량 기반 환불 금액 계산
 */
export function calculateProratedRefund(params: {
  originalAmount: number;
  originalCredits: number;
  usedCredits: number;
  alreadyRefunded?: number;
}): ProratedRefundResult {
  const { originalAmount, originalCredits, usedCredits, alreadyRefunded = 0 } = params;

  // 환불 가능한 크레딧 계산
  const refundableCredits = Math.max(0, originalCredits - usedCredits);

  // 환불 가능 금액 계산 (비례 배분)
  let refundableAmount = 0;
  if (originalCredits > 0) {
    refundableAmount = Math.floor(
      (originalAmount * refundableCredits) / originalCredits
    );
  }

  // 이미 환불된 금액 차감
  refundableAmount = Math.max(0, refundableAmount - alreadyRefunded);

  // 환불 비율 계산
  const refundPercentage =
    originalAmount > 0 ? Math.round((refundableAmount / originalAmount) * 100) : 0;

  return {
    originalAmount,
    refundableAmount,
    originalCredits,
    usedCredits,
    refundableCredits,
    refundPercentage,
    breakdown: [
      { label: '원래 결제 금액', value: `₩${originalAmount.toLocaleString()}` },
      { label: '충전된 크레딧', value: `${originalCredits}개` },
      { label: '사용한 크레딧', value: `${usedCredits}개` },
      { label: '환불 가능 크레딧', value: `${refundableCredits}개` },
      { label: '환불 가능 금액', value: `₩${refundableAmount.toLocaleString()}` },
      { label: '환불 비율', value: `${refundPercentage}%` },
    ],
  };
}

/**
 * 구독 환불 금액 계산 (기간 비례)
 */
export function calculateSubscriptionRefund(params: {
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  refundDate?: Date;
}): {
  refundableAmount: number;
  usedDays: number;
  remainingDays: number;
  totalDays: number;
  usagePercentage: number;
} {
  const { amount, periodStart, periodEnd, refundDate = new Date() } = params;

  const totalDays = Math.ceil(
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const usedDays = Math.ceil(
    (refundDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const remainingDays = Math.max(0, totalDays - usedDays);

  const usagePercentage = totalDays > 0 ? Math.round((usedDays / totalDays) * 100) : 0;

  // 프로레이션이 허용되지 않으면 전액 또는 0
  if (!REFUND_POLICY.ALLOW_SUBSCRIPTION_PRORATION) {
    // 7일 이내면 전액 환불, 아니면 환불 불가
    const daysSincePurchase = usedDays;
    if (daysSincePurchase <= REFUND_POLICY.REFUND_PERIOD_DAYS) {
      return {
        refundableAmount: amount,
        usedDays,
        remainingDays,
        totalDays,
        usagePercentage,
      };
    }
    return {
      refundableAmount: 0,
      usedDays,
      remainingDays,
      totalDays,
      usagePercentage,
    };
  }

  // 비례 환불 금액 계산
  const refundableAmount =
    remainingDays > 0 ? Math.floor((amount * remainingDays) / totalDays) : 0;

  return {
    refundableAmount,
    usedDays,
    remainingDays,
    totalDays,
    usagePercentage,
  };
}

// ────────────────────────────────────────────────────────────
// 환불 정책 검증
// ────────────────────────────────────────────────────────────

/**
 * 환불 정책 검증
 */
export function checkRefundPolicy(params: {
  paymentDate: Date;
  paymentStatus: string;
  paymentType: string;
  requestedAmount: number;
  maxRefundableAmount: number;
  usagePercentage?: number;
}): RefundPolicyCheck {
  const {
    paymentDate,
    paymentStatus,
    paymentType,
    requestedAmount,
    maxRefundableAmount,
    usagePercentage = 0,
  } = params;

  const restrictions: string[] = [];

  // 1. 결제 상태 확인
  if (paymentStatus === 'refunded') {
    return {
      allowed: false,
      reason: '이미 환불된 결제입니다',
      restrictions: ['already_refunded'],
    };
  }

  if (paymentStatus !== 'completed' && paymentStatus !== 'partial_refunded') {
    return {
      allowed: false,
      reason: '환불 가능한 상태가 아닙니다',
      restrictions: ['invalid_status'],
    };
  }

  // 2. 환불 기간 확인
  const daysSincePurchase = Math.floor(
    (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSincePurchase > REFUND_POLICY.REFUND_PERIOD_DAYS) {
    restrictions.push('outside_refund_period');
    return {
      allowed: false,
      reason: `환불 가능 기간(${REFUND_POLICY.REFUND_PERIOD_DAYS}일)이 지났습니다`,
      restrictions,
    };
  }

  // 3. 최소 환불 금액 확인
  if (requestedAmount < REFUND_POLICY.MIN_REFUND_AMOUNT) {
    restrictions.push('below_minimum_amount');
    return {
      allowed: false,
      reason: `최소 환불 금액은 ₩${REFUND_POLICY.MIN_REFUND_AMOUNT.toLocaleString()}입니다`,
      restrictions,
    };
  }

  // 4. 요청 금액이 환불 가능 금액 초과 확인
  if (requestedAmount > maxRefundableAmount) {
    restrictions.push('exceeds_refundable_amount');
    return {
      allowed: false,
      reason: `환불 가능 금액(₩${maxRefundableAmount.toLocaleString()})을 초과했습니다`,
      restrictions,
    };
  }

  // 5. 크레딧 사용량에 따른 제한 (크레딧 구매의 경우)
  if (
    paymentType === 'credit_purchase' &&
    usagePercentage > (100 - REFUND_POLICY.MIN_PARTIAL_REFUND_PERCENTAGE)
  ) {
    restrictions.push('high_usage');
    // 경고만 추가, 환불은 허용
  }

  // 모든 검증 통과
  if (restrictions.length > 0) {
    return {
      allowed: true,
      restrictions,
    };
  }

  return {
    allowed: true,
    restrictions: [],
  };
}

// ────────────────────────────────────────────────────────────
// 환불 유형 결정
// ────────────────────────────────────────────────────────────

/**
 * 환불 유형 결정
 */
export function determineRefundType(params: {
  requestedAmount: number;
  originalAmount: number;
  usedCredits?: number;
  originalCredits?: number;
}): 'full' | 'partial' | 'prorated' {
  const { requestedAmount, originalAmount, usedCredits = 0, originalCredits = 0 } = params;

  // 크레딧 사용이 있는 경우 프로레이션
  if (originalCredits > 0 && usedCredits > 0) {
    return 'prorated';
  }

  // 전액 환불인지 부분 환불인지 판단
  if (requestedAmount >= originalAmount) {
    return 'full';
  }

  return 'partial';
}

// ────────────────────────────────────────────────────────────
// 크레딧 패키지 정보 조회
// ────────────────────────────────────────────────────────────

/**
 * 결제 금액으로 크레딧 패키지 정보 조회
 */
export function getCreditPackageByAmount(amount: number): {
  packageId: string;
  credits: number;
} | null {
  const packages = Object.entries(CREDIT_PACKAGES);

  for (const [packageId, pkg] of packages) {
    if (pkg.price === amount) {
      return {
        packageId,
        credits: pkg.credits,
      };
    }
  }

  return null;
}

// ────────────────────────────────────────────────────────────
// 환불 요약 포맷팅
// ────────────────────────────────────────────────────────────

/**
 * 환불 정보 요약 문자열 생성
 */
export function formatRefundSummary(params: {
  refundType: 'full' | 'partial' | 'prorated';
  originalAmount: number;
  refundAmount: number;
  originalCredits?: number;
  usedCredits?: number;
  refundableCredits?: number;
}): string {
  const {
    refundType,
    originalAmount,
    refundAmount,
    originalCredits,
    usedCredits,
    refundableCredits,
  } = params;

  const lines: string[] = [];

  lines.push(`환불 유형: ${getRefundTypeLabel(refundType)}`);
  lines.push(`원래 결제 금액: ₩${originalAmount.toLocaleString()}`);
  lines.push(`환불 금액: ₩${refundAmount.toLocaleString()}`);

  if (refundType === 'prorated' && originalCredits !== undefined) {
    lines.push(`충전 크레딧: ${originalCredits}개`);
    lines.push(`사용 크레딧: ${usedCredits ?? 0}개`);
    lines.push(`환불 크레딧: ${refundableCredits ?? 0}개`);
  }

  return lines.join('\n');
}

/**
 * 환불 유형 라벨
 */
export function getRefundTypeLabel(type: 'full' | 'partial' | 'prorated'): string {
  switch (type) {
    case 'full':
      return '전액 환불';
    case 'partial':
      return '부분 환불';
    case 'prorated':
      return '사용량 비례 환불';
  }
}
