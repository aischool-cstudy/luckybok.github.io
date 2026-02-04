import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '@/hooks/use-toast';

// clientLogger 모킹
vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('초기 상태', () => {
    it('초기 toasts 배열이 비어있어야 한다', () => {
      const { result } = renderHook(() => useToast());

      expect(result.current.toasts).toEqual([]);
    });

    it('toast와 dismiss 함수가 반환되어야 한다', () => {
      const { result } = renderHook(() => useToast());

      expect(typeof result.current.toast).toBe('function');
      expect(typeof result.current.dismiss).toBe('function');
    });
  });

  describe('toast 함수', () => {
    it('토스트를 추가할 수 있어야 한다', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: '테스트 메시지' });
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('테스트 메시지');
    });

    it('description을 포함한 토스트를 추가할 수 있어야 한다', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({
          title: '제목',
          description: '설명',
        });
      });

      expect(result.current.toasts[0].description).toBe('설명');
    });

    it('variant를 지정할 수 있어야 한다', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({
          title: '에러 메시지',
          variant: 'destructive',
        });
      });

      expect(result.current.toasts[0].variant).toBe('destructive');
    });

    it('기본 variant는 default여야 한다', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: '메시지' });
      });

      expect(result.current.toasts[0].variant).toBe('default');
    });

    it('토스트 ID를 반환해야 한다', () => {
      const { result } = renderHook(() => useToast());

      let toastId: string = '';
      act(() => {
        toastId = result.current.toast({ title: '메시지' });
      });

      expect(toastId).toMatch(/^toast-\d+$/);
    });

    it('여러 토스트를 추가할 수 있어야 한다', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: '첫 번째' });
        result.current.toast({ title: '두 번째' });
        result.current.toast({ title: '세 번째' });
      });

      expect(result.current.toasts).toHaveLength(3);
    });
  });

  describe('자동 제거', () => {
    it('3초 후 토스트가 자동으로 제거되어야 한다', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: '메시지' });
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('여러 토스트가 각각의 타이머로 제거되어야 한다', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: '첫 번째' });
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      act(() => {
        result.current.toast({ title: '두 번째' });
      });

      expect(result.current.toasts).toHaveLength(2);

      // 첫 번째 토스트 제거 (2초 더 경과)
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('두 번째');

      // 두 번째 토스트 제거 (1초 더 경과)
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe('dismiss 함수', () => {
    it('특정 토스트를 수동으로 제거할 수 있어야 한다', () => {
      const { result } = renderHook(() => useToast());

      let toastId: string = '';
      act(() => {
        toastId = result.current.toast({ title: '메시지' });
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        result.current.dismiss(toastId);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('존재하지 않는 ID로 dismiss해도 에러가 발생하지 않아야 한다', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: '메시지' });
      });

      expect(() => {
        act(() => {
          result.current.dismiss('non-existent-id');
        });
      }).not.toThrow();

      expect(result.current.toasts).toHaveLength(1);
    });

    it('여러 토스트 중 하나만 제거할 수 있어야 한다', () => {
      const { result } = renderHook(() => useToast());

      let secondId: string = '';
      act(() => {
        result.current.toast({ title: '첫 번째' });
        secondId = result.current.toast({ title: '두 번째' });
        result.current.toast({ title: '세 번째' });
      });

      act(() => {
        result.current.dismiss(secondId);
      });

      expect(result.current.toasts).toHaveLength(2);
      expect(result.current.toasts.find((t) => t.title === '두 번째')).toBeUndefined();
    });
  });

  describe('로깅', () => {
    it('default variant 토스트는 info 로그를 기록해야 한다', async () => {
      const { clientLogger } = await import('@/lib/client-logger');
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: '정보 메시지', description: '설명' });
      });

      expect(clientLogger.info).toHaveBeenCalledWith('[Toast] 정보 메시지', { description: '설명' });
    });

    it('destructive variant 토스트는 error 로그를 기록해야 한다', async () => {
      const { clientLogger } = await import('@/lib/client-logger');
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({
          title: '에러 메시지',
          description: '에러 설명',
          variant: 'destructive',
        });
      });

      expect(clientLogger.error).toHaveBeenCalledWith('[Toast] 에러 메시지', undefined, {
        description: '에러 설명',
      });
    });
  });
});
