/**
 * 결제 관련 전역 상태 관리 (Zustand)
 * - 결제 주기 (월간/연간)
 * - TossPayments SDK 준비 상태
 * - 결제 진행 상태
 * - 선택된 플랜
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type BillingCycle = 'monthly' | 'yearly';

export interface PaymentState {
  // 결제 주기
  billingCycle: BillingCycle;
  // TossPayments SDK 로드 완료 여부
  isSdkReady: boolean;
  // 결제 진행 중 여부
  isProcessing: boolean;
  // 선택된 플랜 ID
  selectedPlan: string | null;
  // 에러 메시지
  error: string | null;
}

export interface PaymentActions {
  // 결제 주기 변경
  setBillingCycle: (cycle: BillingCycle) => void;
  // SDK 준비 상태 설정
  setSdkReady: (ready: boolean) => void;
  // 결제 진행 상태 설정
  setProcessing: (processing: boolean) => void;
  // 플랜 선택
  selectPlan: (planId: string | null) => void;
  // 에러 설정
  setError: (error: string | null) => void;
  // 상태 초기화
  reset: () => void;
}

const initialState: PaymentState = {
  billingCycle: 'yearly',
  isSdkReady: false,
  isProcessing: false,
  selectedPlan: null,
  error: null,
};

export const usePaymentStore = create<PaymentState & PaymentActions>()(
  devtools(
    (set) => ({
      ...initialState,

      setBillingCycle: (billingCycle) => set({ billingCycle }, false, 'setBillingCycle'),

      setSdkReady: (isSdkReady) => set({ isSdkReady }, false, 'setSdkReady'),

      setProcessing: (isProcessing) => set({ isProcessing }, false, 'setProcessing'),

      selectPlan: (selectedPlan) => set({ selectedPlan }, false, 'selectPlan'),

      setError: (error) => set({ error }, false, 'setError'),

      reset: () => set(initialState, false, 'reset'),
    }),
    { name: 'payment-store' }
  )
);

/**
 * 연간 할인율 계산 헬퍼
 */
export function calculateYearlyDiscount(monthlyPrice: number, yearlyPrice: number): number {
  const yearlyFromMonthly = monthlyPrice * 12;
  return Math.round(((yearlyFromMonthly - yearlyPrice) / yearlyFromMonthly) * 100);
}

/**
 * 결제 주기에 따른 가격 표시 헬퍼
 */
export function formatPriceByBillingCycle(
  monthlyPrice: number,
  yearlyPrice: number,
  billingCycle: BillingCycle
): { price: number; perMonth: number; label: string } {
  if (billingCycle === 'yearly') {
    return {
      price: yearlyPrice,
      perMonth: Math.round(yearlyPrice / 12),
      label: '연간',
    };
  }
  return {
    price: monthlyPrice,
    perMonth: monthlyPrice,
    label: '월간',
  };
}
