/**
 * Toast 훅 (간단한 구현)
 * 실제 프로덕션에서는 sonner 또는 react-hot-toast 사용 권장
 */

import { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface ToastState {
  toasts: Toast[];
}

let toastCounter = 0;

export function useToast() {
  const [state, setState] = useState<ToastState>({ toasts: [] });

  const toast = useCallback(
    ({
      title,
      description,
      variant = 'default',
    }: {
      title: string;
      description?: string;
      variant?: 'default' | 'destructive';
    }) => {
      const id = `toast-${++toastCounter}`;

      // 새 토스트 추가
      setState((prev) => ({
        toasts: [...prev.toasts, { id, title, description, variant }],
      }));

      // 콘솔에 로그 (디버깅용)
      if (variant === 'destructive') {
        console.error(`[Toast] ${title}: ${description}`);
      } else {
        console.log(`[Toast] ${title}: ${description}`);
      }

      // 3초 후 자동 제거
      setTimeout(() => {
        setState((prev) => ({
          toasts: prev.toasts.filter((t) => t.id !== id),
        }));
      }, 3000);

      return id;
    },
    []
  );

  const dismiss = useCallback((toastId: string) => {
    setState((prev) => ({
      toasts: prev.toasts.filter((t) => t.id !== toastId),
    }));
  }, []);

  return {
    toast,
    dismiss,
    toasts: state.toasts,
  };
}
