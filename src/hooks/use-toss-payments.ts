/**
 * 토스페이먼츠 SDK 커스텀 훅
 *
 * SDK 로드 및 결제/빌링 인증 기능 제공
 * Zustand 스토어와 연동하여 SDK 상태를 전역 동기화
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  TossPaymentsInstance,
  TossPaymentRequestOptions,
  TossBillingAuthOptions,
  TossPaymentsConstructor,
} from '@/types/payment.types';
import { clientEnv } from '@/lib/env';
import { usePaymentStore } from '@/stores';

const TOSS_SDK_URL = 'https://js.tosspayments.com/v1/payment';

interface UseTossPaymentsOptions {
  /** SDK 자동 로드 여부 (기본값: true) */
  autoLoad?: boolean;
}

interface UseTossPaymentsReturn {
  /** SDK 로드 완료 여부 */
  isReady: boolean;
  /** SDK 로드 중 여부 */
  isLoading: boolean;
  /** SDK 로드 에러 */
  error: Error | null;
  /** 단건 결제 요청 */
  requestPayment: (options: TossPaymentRequestOptions) => Promise<void>;
  /** 빌링키 발급 인증 요청 */
  requestBillingAuth: (options: TossBillingAuthOptions) => Promise<void>;
  /** SDK 수동 로드 */
  loadSDK: () => Promise<void>;
}

/**
 * 토스페이먼츠 SDK를 관리하는 커스텀 훅
 *
 * @example
 * ```tsx
 * const { isReady, requestPayment, requestBillingAuth, error } = useTossPayments();
 *
 * // 단건 결제
 * await requestPayment({
 *   amount: 29900,
 *   orderId: 'order_123',
 *   orderName: 'Pro 플랜',
 *   customerKey: 'customer_123',
 *   successUrl: '/payment/success',
 *   failUrl: '/payment/fail',
 * });
 *
 * // 빌링키 발급
 * await requestBillingAuth({
 *   customerKey: 'customer_123',
 *   successUrl: '/payment/success',
 *   failUrl: '/payment/fail',
 * });
 * ```
 */
export function useTossPayments(
  options: UseTossPaymentsOptions = {}
): UseTossPaymentsReturn {
  const { autoLoad = true } = options;

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tossInstance, setTossInstance] = useState<TossPaymentsInstance | null>(null);

  // Zustand 스토어와 SDK 준비 상태 동기화
  const { setSdkReady } = usePaymentStore();

  const clientKey = clientEnv.TOSS_CLIENT_KEY;

  const loadSDK = useCallback(async () => {
    // 이미 로드되었거나 로드 중인 경우 스킵
    if (isReady || isLoading) return;

    // 클라이언트 키 확인
    if (!clientKey) {
      setError(new Error('토스페이먼츠 클라이언트 키가 설정되지 않았습니다'));
      return;
    }

    // 이미 SDK가 로드되어 있는지 확인
    const TossPayments = (window as { TossPayments?: TossPaymentsConstructor }).TossPayments;
    if (TossPayments) {
      try {
        const instance = TossPayments(clientKey);
        setTossInstance(instance);
        setIsReady(true);
        return;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('SDK 초기화 실패'));
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      // 이미 스크립트 태그가 존재하는지 확인
      const existingScript = document.querySelector(
        `script[src="${TOSS_SDK_URL}"]`
      );

      if (existingScript) {
        // 스크립트가 이미 존재하면 로드 완료까지 대기
        await new Promise<void>((resolve, reject) => {
          const checkLoaded = setInterval(() => {
            if ((window as { TossPayments?: TossPaymentsConstructor }).TossPayments) {
              clearInterval(checkLoaded);
              resolve();
            }
          }, 100);

          // 5초 타임아웃
          setTimeout(() => {
            clearInterval(checkLoaded);
            reject(new Error('SDK 로드 타임아웃'));
          }, 5000);
        });
      } else {
        // 새 스크립트 태그 생성
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = TOSS_SDK_URL;
          script.async = true;

          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error('토스페이먼츠 SDK 로드에 실패했습니다'));

          document.body.appendChild(script);
        });
      }

      // SDK 초기화
      const LoadedTossPayments = (window as { TossPayments?: TossPaymentsConstructor }).TossPayments;
      if (LoadedTossPayments) {
        const instance = LoadedTossPayments(clientKey);
        setTossInstance(instance);
        setIsReady(true);
      } else {
        throw new Error('SDK 로드 후 TossPayments를 찾을 수 없습니다');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('SDK 로드 실패'));
    } finally {
      setIsLoading(false);
    }
  }, [clientKey, isReady, isLoading]);

  // 자동 로드
  useEffect(() => {
    if (autoLoad && !isReady && !isLoading) {
      loadSDK();
    }
  }, [autoLoad, isReady, isLoading, loadSDK]);

  // Zustand 스토어와 SDK 상태 동기화
  useEffect(() => {
    setSdkReady(isReady);
  }, [isReady, setSdkReady]);

  const requestPayment = useCallback(
    async (paymentOptions: TossPaymentRequestOptions) => {
      if (!tossInstance) {
        throw new Error('토스페이먼츠 SDK가 준비되지 않았습니다');
      }

      await tossInstance.requestPayment('카드', paymentOptions);
    },
    [tossInstance]
  );

  const requestBillingAuth = useCallback(
    async (billingOptions: TossBillingAuthOptions) => {
      if (!tossInstance) {
        throw new Error('토스페이먼츠 SDK가 준비되지 않았습니다');
      }

      await tossInstance.requestBillingAuth('카드', billingOptions);
    },
    [tossInstance]
  );

  return {
    isReady,
    isLoading,
    error,
    requestPayment,
    requestBillingAuth,
    loadSDK,
  };
}
