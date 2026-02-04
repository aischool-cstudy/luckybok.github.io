/**
 * 플랜 변경 시 비례 배분(Proration) 계산 유틸리티
 *
 * 업그레이드: 즉시 적용, 남은 기간에 대한 차액 결제
 * 다운그레이드: 기간 종료 후 적용, 환불 없음
 */

import { plans, type PlanId } from '@/config/pricing';
import type { BillingCycle } from '@/types/payment.types';

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────

export type PlanChangeType = 'upgrade' | 'downgrade' | 'same' | 'cycle_change';

export interface ProrationParams {
  currentPlan: Exclude<PlanId, 'starter'>;
  currentBillingCycle: BillingCycle;
  newPlan: Exclude<PlanId, 'starter'>;
  newBillingCycle: BillingCycle;
  currentPeriodEnd: Date;
}

export interface ProrationResult {
  /** 변경 유형 */
  changeType: PlanChangeType;
  /** 남은 일수 */
  daysRemaining: number;
  /** 전체 결제 주기 일수 */
  totalDays: number;
  /** 현재 플랜 일일 요금 */
  currentDailyRate: number;
  /** 새 플랜 일일 요금 */
  newDailyRate: number;
  /** 비례 배분 금액 (업그레이드 시 추가 결제 금액) */
  proratedAmount: number;
  /** 새 플랜 전체 금액 */
  newPlanAmount: number;
  /** 적용 일자 */
  effectiveDate: Date;
  /** 결제 필요 여부 */
  requiresPayment: boolean;
}

// ────────────────────────────────────────────────────────────
// 상수
// ────────────────────────────────────────────────────────────

/** 월간 결제 주기 일수 (평균) */
const DAYS_IN_MONTH = 30;
/** 연간 결제 주기 일수 */
const DAYS_IN_YEAR = 365;

// ────────────────────────────────────────────────────────────
// 유틸리티 함수
// ────────────────────────────────────────────────────────────

/**
 * 남은 일수 계산
 */
export function getDaysRemaining(periodEnd: Date): number {
  const now = new Date();
  const diffTime = periodEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * 결제 주기의 전체 일수 반환
 */
export function getTotalDaysInCycle(billingCycle: BillingCycle): number {
  return billingCycle === 'monthly' ? DAYS_IN_MONTH : DAYS_IN_YEAR;
}

/**
 * 플랜 가격 조회 (enterprise는 0으로 처리)
 */
function getPlanPrice(plan: Exclude<PlanId, 'starter'>, billingCycle: BillingCycle): number {
  const planConfig = plans[plan];
  if (!planConfig) return 0;
  return planConfig.price[billingCycle];
}

/**
 * 일일 요금 계산
 */
function getDailyRate(plan: Exclude<PlanId, 'starter'>, billingCycle: BillingCycle): number {
  const totalPrice = getPlanPrice(plan, billingCycle);
  const totalDays = getTotalDaysInCycle(billingCycle);
  return totalPrice / totalDays;
}

/**
 * 플랜 변경 유형 판단
 */
export function determinePlanChangeType(params: ProrationParams): PlanChangeType {
  const { currentPlan, currentBillingCycle, newPlan, newBillingCycle } = params;

  // 같은 플랜
  if (currentPlan === newPlan && currentBillingCycle === newBillingCycle) {
    return 'same';
  }

  // 일일 요금 기준으로 비교 (결제 주기가 다를 수 있으므로)
  const currentDailyRate = getDailyRate(currentPlan, currentBillingCycle);
  const newDailyRate = getDailyRate(newPlan, newBillingCycle);

  // 같은 플랜에서 결제 주기만 변경
  if (currentPlan === newPlan) {
    return 'cycle_change';
  }

  // 일일 요금 기준으로 업그레이드/다운그레이드 판단
  // 연간 결제가 월간보다 저렴하므로 일일 요금으로 비교해야 정확
  if (newDailyRate > currentDailyRate) {
    return 'upgrade';
  } else if (newDailyRate < currentDailyRate) {
    return 'downgrade';
  }

  // 일일 요금이 같은 경우 (거의 없지만)
  // 월간 → 연간은 업그레이드, 연간 → 월간은 다운그레이드로 처리
  if (currentBillingCycle === 'monthly' && newBillingCycle === 'yearly') {
    return 'upgrade';
  }
  return 'downgrade';
}

// ────────────────────────────────────────────────────────────
// 메인 계산 함수
// ────────────────────────────────────────────────────────────

/**
 * 비례 배분 금액 계산
 *
 * @example
 * // Pro(월 29,900원) → Team(월 99,000원), 15일 남음
 * const result = calculateProration({
 *   currentPlan: 'pro',
 *   currentBillingCycle: 'monthly',
 *   newPlan: 'team',
 *   newBillingCycle: 'monthly',
 *   currentPeriodEnd: new Date('2026-02-15'),
 * });
 * // result.proratedAmount = 약 34,550원 (차액의 15/30)
 */
export function calculateProration(params: ProrationParams): ProrationResult {
  const { currentPlan, currentBillingCycle, newPlan, newBillingCycle, currentPeriodEnd } = params;

  const changeType = determinePlanChangeType(params);
  const daysRemaining = getDaysRemaining(currentPeriodEnd);
  const currentTotalDays = getTotalDaysInCycle(currentBillingCycle);

  const currentDailyRate = getDailyRate(currentPlan, currentBillingCycle);
  const newDailyRate = getDailyRate(newPlan, newBillingCycle);
  const newPlanAmount = getPlanPrice(newPlan, newBillingCycle);

  let proratedAmount = 0;
  let effectiveDate = new Date();
  let requiresPayment = false;

  switch (changeType) {
    case 'same':
      // 변경 없음
      break;

    case 'upgrade':
    case 'cycle_change': {
      // 업그레이드 또는 결제 주기 변경 (월간→연간)
      // 남은 기간에 대한 차액만 결제
      if (changeType === 'upgrade' || newBillingCycle === 'yearly') {
        // 현재 플랜에서 남은 기간의 가치
        const currentRemainingValue = currentDailyRate * daysRemaining;
        // 새 플랜에서 남은 기간의 가치
        const newRemainingValue = newDailyRate * daysRemaining;
        // 차액 (새 플랜이 더 비싸면 양수)
        const difference = newRemainingValue - currentRemainingValue;

        // 최소 결제 금액 (100원 미만은 결제하지 않음)
        if (difference > 100) {
          proratedAmount = Math.round(difference);
          requiresPayment = true;
        }

        // 즉시 적용
        effectiveDate = new Date();
      } else {
        // 연간 → 월간은 다운그레이드로 처리 (기간 종료 후 적용)
        effectiveDate = new Date(currentPeriodEnd);
      }
      break;
    }

    case 'downgrade':
      // 다운그레이드: 기간 종료 후 적용, 환불 없음
      effectiveDate = new Date(currentPeriodEnd);
      break;
  }

  return {
    changeType,
    daysRemaining,
    totalDays: currentTotalDays,
    currentDailyRate: Math.round(currentDailyRate * 100) / 100,
    newDailyRate: Math.round(newDailyRate * 100) / 100,
    proratedAmount,
    newPlanAmount,
    effectiveDate,
    requiresPayment,
  };
}

/**
 * 비례 배분 금액을 사람이 읽기 쉬운 형식으로 포맷
 */
export function formatProrationSummary(result: ProrationResult): string {
  const { changeType, proratedAmount, effectiveDate, daysRemaining } = result;

  switch (changeType) {
    case 'same':
      return '현재 플랜과 동일합니다.';

    case 'upgrade':
      if (result.requiresPayment) {
        return `즉시 적용됩니다. 남은 ${daysRemaining}일에 대한 차액 ${proratedAmount.toLocaleString()}원이 결제됩니다.`;
      }
      return '즉시 적용됩니다. 추가 결제가 필요하지 않습니다.';

    case 'cycle_change':
      if (result.requiresPayment) {
        return `결제 주기 변경이 즉시 적용됩니다. ${proratedAmount.toLocaleString()}원이 결제됩니다.`;
      }
      return `결제 주기 변경이 ${effectiveDate.toLocaleDateString('ko-KR')}에 적용됩니다.`;

    case 'downgrade':
      return `현재 기간이 종료되는 ${effectiveDate.toLocaleDateString('ko-KR')}에 변경됩니다. 환불은 없습니다.`;

    default:
      return '';
  }
}
