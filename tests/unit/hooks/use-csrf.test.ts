import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCSRF, useCSRFForm, withCSRFToken, withCSRFTokenObject } from '@/hooks/use-csrf';

// clientLogger 모킹
vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('useCSRF', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('초기 상태', () => {
    it('초기 로딩 상태여야 한다', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // 응답 보류

      const { result } = renderHook(() => useCSRF());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.token).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('토큰 발급', () => {
    it('성공적으로 토큰을 발급받아야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'test-csrf-token' }),
      });

      const { result } = renderHook(() => useCSRF());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.token).toBe('test-csrf-token');
      expect(result.current.error).toBeNull();
    });

    it('API 오류 시 에러 상태를 설정해야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: '토큰 발급 실패' }),
      });

      const { result } = renderHook(() => useCSRF());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.token).toBeNull();
      expect(result.current.error).toBe('토큰 발급 실패');
    });

    it('네트워크 오류 시 에러 상태를 설정해야 한다', async () => {
      mockFetch.mockRejectedValueOnce(new Error('네트워크 오류'));

      const { result } = renderHook(() => useCSRF());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.token).toBeNull();
      expect(result.current.error).toBe('네트워크 오류');
    });

    it('올바른 엔드포인트로 요청해야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'test-token' }),
      });

      renderHook(() => useCSRF());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/csrf/token', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('토큰 갱신', () => {
    it('refreshToken 함수로 토큰을 수동 갱신할 수 있어야 한다', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'first-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'refreshed-token' }),
        });

      const { result } = renderHook(() => useCSRF());

      await waitFor(() => {
        expect(result.current.token).toBe('first-token');
      });

      await act(async () => {
        await result.current.refreshToken();
      });

      expect(result.current.token).toBe('refreshed-token');
    });
  });
});

describe('withCSRFToken', () => {
  it('FormData에 CSRF 토큰을 추가해야 한다', () => {
    const formData = new FormData();
    formData.append('name', 'test');
    formData.append('email', 'test@example.com');

    const result = withCSRFToken(formData, 'csrf-token-123');

    expect(result.get('name')).toBe('test');
    expect(result.get('email')).toBe('test@example.com');
    expect(result.get('_csrf')).toBe('csrf-token-123');
  });

  it('기존 FormData를 변경하지 않아야 한다', () => {
    const formData = new FormData();
    formData.append('name', 'test');

    withCSRFToken(formData, 'csrf-token');

    expect(formData.get('_csrf')).toBeNull();
  });
});

describe('withCSRFTokenObject', () => {
  it('객체에 CSRF 토큰을 추가해야 한다', () => {
    const data = { name: 'test', email: 'test@example.com' };

    const result = withCSRFTokenObject(data, 'csrf-token-123');

    expect(result.name).toBe('test');
    expect(result.email).toBe('test@example.com');
    expect(result._csrf).toBe('csrf-token-123');
  });

  it('기존 객체를 변경하지 않아야 한다', () => {
    const data = { name: 'test' };

    withCSRFTokenObject(data, 'csrf-token');

    expect('_csrf' in data).toBe(false);
  });

  it('빈 객체에도 토큰을 추가할 수 있어야 한다', () => {
    const data = {};

    const result = withCSRFTokenObject(data, 'csrf-token');

    expect(result._csrf).toBe('csrf-token');
  });
});

describe('useCSRFForm', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('토큰이 있을 때 isReady가 true여야 한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'test-token' }),
    });

    const { result } = renderHook(() => useCSRFForm());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
  });

  it('로딩 중일 때 isReady가 false여야 한다', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useCSRFForm());

    expect(result.current.isReady).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it('토큰이 없을 때 isReady가 false여야 한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: '토큰 발급 실패' }),
    });

    const { result } = renderHook(() => useCSRFForm());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isReady).toBe(false);
  });

  describe('handleSubmit', () => {
    it('토큰이 없으면 onSubmit을 호출하지 않아야 한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: '토큰 발급 실패' }),
      });

      const { result } = renderHook(() => useCSRFForm());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const onSubmit = vi.fn();
      const handler = result.current.handleSubmit(onSubmit);

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: document.createElement('form'),
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await handler(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('토큰이 있으면 onSubmit을 호출해야 한다', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'test-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'refreshed-token' }),
        });

      const { result } = renderHook(() => useCSRFForm());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      const onSubmit = vi.fn();
      const handler = result.current.handleSubmit(onSubmit);

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: document.createElement('form'),
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await handler(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(onSubmit).toHaveBeenCalledWith(mockEvent);
    });

    it('제출 후 토큰을 갱신해야 한다', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'first-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'refreshed-token' }),
        });

      const { result } = renderHook(() => useCSRFForm());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      const onSubmit = vi.fn();
      const handler = result.current.handleSubmit(onSubmit);

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: document.createElement('form'),
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await handler(mockEvent);
      });

      await waitFor(() => {
        expect(result.current.token).toBe('refreshed-token');
      });
    });
  });
});
