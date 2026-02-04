'use client';

import { useState, useEffect, useCallback } from 'react';
import { clientLogger } from '@/lib/client-logger';

/**
 * CSRF 훅 반환 타입
 */
interface UseCSRFReturn {
  /** CSRF 토큰 */
  token: string | null;
  /** 토큰 로딩 중 */
  isLoading: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 토큰 수동 갱신 */
  refreshToken: () => Promise<void>;
}

/**
 * CSRF 토큰 관리 훅
 *
 * @example
 * function SettingsForm() {
 *   const { token, isLoading, error, refreshToken } = useCSRF();
 *
 *   const handleSubmit = async (data: FormData) => {
 *     if (!token) return;
 *
 *     const result = await changePassword({
 *       ...data,
 *       _csrf: token,
 *     });
 *
 *     if (result.success) {
 *       await refreshToken(); // 사용 후 토큰 갱신
 *     }
 *   };
 * }
 */
export function useCSRF(): UseCSRFReturn {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/csrf/token', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '토큰 발급에 실패했습니다.');
      }

      const data = await response.json();
      setToken(data.token);
    } catch (err) {
      const message = err instanceof Error ? err.message : '토큰 발급 중 오류가 발생했습니다.';
      setError(message);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 컴포넌트 마운트 시 토큰 발급
  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // 토큰 자동 갱신 (50분마다 - 만료 10분 전)
  useEffect(() => {
    if (!token) return;

    const refreshInterval = 50 * 60 * 1000; // 50분
    const intervalId = setInterval(() => {
      fetchToken();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [token, fetchToken]);

  return {
    token,
    isLoading,
    error,
    refreshToken: fetchToken,
  };
}

/**
 * FormData에 CSRF 토큰 추가
 *
 * @param formData 기존 FormData
 * @param token CSRF 토큰
 * @returns CSRF 토큰이 추가된 FormData
 *
 * @example
 * const formData = new FormData(event.currentTarget);
 * const dataWithCSRF = withCSRFToken(formData, token);
 */
export function withCSRFToken(formData: FormData, token: string): FormData {
  const newFormData = new FormData();

  // 기존 데이터 복사
  for (const [key, value] of formData.entries()) {
    newFormData.append(key, value);
  }

  // CSRF 토큰 추가
  newFormData.append('_csrf', token);

  return newFormData;
}

/**
 * 객체에 CSRF 토큰 추가
 *
 * @param data 기존 객체
 * @param token CSRF 토큰
 * @returns CSRF 토큰이 추가된 객체
 *
 * @example
 * const dataWithCSRF = withCSRFTokenObject(formData, token);
 * await changePassword(dataWithCSRF);
 */
export function withCSRFTokenObject<T extends Record<string, unknown>>(
  data: T,
  token: string
): T & { _csrf: string } {
  return {
    ...data,
    _csrf: token,
  };
}

/**
 * CSRF 보호가 필요한 폼 래퍼 훅
 *
 * @example
 * function PasswordForm() {
 *   const { token, isReady, error, handleSubmit } = useCSRFForm();
 *
 *   return (
 *     <form onSubmit={handleSubmit(async (data) => {
 *       await changePassword({ ...data, _csrf: token! });
 *     })}>
 *       {!isReady && <p>보안 토큰 로딩 중...</p>}
 *       {error && <p className="text-red-500">{error}</p>}
 *       ...
 *     </form>
 *   );
 * }
 */
export function useCSRFForm() {
  const { token, isLoading, error, refreshToken } = useCSRF();

  const handleSubmit = useCallback(
    (
      onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void> | void
    ) => {
      return async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!token) {
          clientLogger.error('CSRF 토큰이 없습니다.');
          return;
        }

        await onSubmit(event);
        // 성공적인 제출 후 토큰 갱신
        await refreshToken();
      };
    },
    [token, refreshToken]
  );

  return {
    token,
    isReady: !isLoading && !!token,
    isLoading,
    error,
    handleSubmit,
    refreshToken,
  };
}
