import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// @vercel/kv 모킹 (선택적 의존성)
vi.mock('@vercel/kv', () => ({
  kv: undefined,
}));

import {
  checkRateLimit,
  checkRateLimitSync,
  clearRateLimitStore,
  clearRateLimit,
  getRateLimitErrorMessage,
  getClientIP,
  RATE_LIMIT_PRESETS,
  type RateLimitConfig,
  type RateLimitResult,
} from '@/lib/rate-limit';

describe('Rate Limit', () => {
  beforeEach(async () => {
    // 각 테스트 전 스토어 초기화
    await clearRateLimitStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkRateLimit (비동기)', () => {
    it('첫 요청은 허용되어야 한다', async () => {
      const result = await checkRateLimit(
        'test-user-1',
        'test_action',
        RATE_LIMIT_PRESETS.DEFAULT
      );

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.remaining).toBe(29); // DEFAULT max: 30
      expect(result.limit).toBe(30);
    });

    it('제한 내 요청은 모두 허용되어야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 60000, max: 5 };

      for (let i = 0; i < 5; i++) {
        const result = await checkRateLimit('test-user-2', 'test_action', config);
        expect(result.allowed).toBe(true);
        expect(result.current).toBe(i + 1);
        expect(result.remaining).toBe(4 - i);
      }
    });

    it('제한 초과 시 요청이 거부되어야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 60000, max: 3 };

      // 3회 허용
      for (let i = 0; i < 3; i++) {
        await checkRateLimit('test-user-3', 'limit_test', config);
      }

      // 4번째 요청은 거부
      const result = await checkRateLimit('test-user-3', 'limit_test', config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.current).toBe(3);
    });

    it('다른 식별자는 독립적으로 제한되어야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 60000, max: 2 };

      // user-a 2회 사용
      await checkRateLimit('user-a', 'independent_test', config);
      await checkRateLimit('user-a', 'independent_test', config);

      // user-a 제한 초과
      const resultA = await checkRateLimit('user-a', 'independent_test', config);
      expect(resultA.allowed).toBe(false);

      // user-b는 여전히 사용 가능
      const resultB = await checkRateLimit('user-b', 'independent_test', config);
      expect(resultB.allowed).toBe(true);
    });

    it('다른 액션은 독립적으로 제한되어야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 60000, max: 2 };

      // action-a 2회 사용
      await checkRateLimit('same-user', 'action_a', config);
      await checkRateLimit('same-user', 'action_a', config);

      // action-a 제한 초과
      const resultA = await checkRateLimit('same-user', 'action_a', config);
      expect(resultA.allowed).toBe(false);

      // action-b는 여전히 사용 가능
      const resultB = await checkRateLimit('same-user', 'action_b', config);
      expect(resultB.allowed).toBe(true);
    });

    it('resetIn이 양수여야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 60000, max: 1 };

      await checkRateLimit('reset-test', 'reset_action', config);
      const result = await checkRateLimit('reset-test', 'reset_action', config);

      expect(result.allowed).toBe(false);
      expect(result.resetIn).toBeGreaterThan(0);
      expect(result.resetIn).toBeLessThanOrEqual(config.windowMs);
    });
  });

  describe('checkRateLimitSync (동기)', () => {
    it('동기식 체크가 동작해야 한다', () => {
      const config: RateLimitConfig = { windowMs: 60000, max: 3 };

      const result1 = checkRateLimitSync('sync-user', 'sync_action', config);
      expect(result1.allowed).toBe(true);
      expect(result1.current).toBe(1);

      const result2 = checkRateLimitSync('sync-user', 'sync_action', config);
      expect(result2.allowed).toBe(true);
      expect(result2.current).toBe(2);

      const result3 = checkRateLimitSync('sync-user', 'sync_action', config);
      expect(result3.allowed).toBe(true);
      expect(result3.current).toBe(3);

      const result4 = checkRateLimitSync('sync-user', 'sync_action', config);
      expect(result4.allowed).toBe(false);
    });
  });

  describe('RATE_LIMIT_PRESETS', () => {
    it('모든 프리셋이 올바른 형식이어야 한다', () => {
      const presets = Object.values(RATE_LIMIT_PRESETS);

      for (const preset of presets) {
        expect(preset).toHaveProperty('windowMs');
        expect(preset).toHaveProperty('max');
        expect(preset.windowMs).toBeGreaterThan(0);
        expect(preset.max).toBeGreaterThan(0);
      }
    });

    it('결제 관련 프리셋이 더 제한적이어야 한다', () => {
      expect(RATE_LIMIT_PRESETS.PAYMENT_PREPARE.max).toBeLessThan(
        RATE_LIMIT_PRESETS.DEFAULT.max
      );
      expect(RATE_LIMIT_PRESETS.PAYMENT_CONFIRM.max).toBeLessThan(
        RATE_LIMIT_PRESETS.PAYMENT_PREPARE.max
      );
      expect(RATE_LIMIT_PRESETS.REFUND_REQUEST.max).toBeLessThan(
        RATE_LIMIT_PRESETS.DEFAULT.max
      );
    });

    it('SUBSCRIPTION_CREATE가 가장 제한적이어야 한다', () => {
      expect(RATE_LIMIT_PRESETS.SUBSCRIPTION_CREATE.max).toBeLessThanOrEqual(
        RATE_LIMIT_PRESETS.REFUND_REQUEST.max
      );
    });
  });

  describe('clearRateLimitStore', () => {
    it('스토어 초기화 후 다시 요청 가능해야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 60000, max: 1 };

      // 제한 도달
      await checkRateLimit('clear-test', 'clear_action', config);
      const blocked = await checkRateLimit('clear-test', 'clear_action', config);
      expect(blocked.allowed).toBe(false);

      // 스토어 초기화
      await clearRateLimitStore();

      // 다시 허용
      const allowed = await checkRateLimit('clear-test', 'clear_action', config);
      expect(allowed.allowed).toBe(true);
    });
  });

  describe('clearRateLimit', () => {
    it('특정 키만 초기화되어야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 60000, max: 1 };

      // 두 사용자 모두 제한 도달
      await checkRateLimit('clear-specific-a', 'specific_action', config);
      await checkRateLimit('clear-specific-b', 'specific_action', config);

      const blockedA = await checkRateLimit('clear-specific-a', 'specific_action', config);
      const blockedB = await checkRateLimit('clear-specific-b', 'specific_action', config);
      expect(blockedA.allowed).toBe(false);
      expect(blockedB.allowed).toBe(false);

      // user-a만 초기화
      await clearRateLimit('clear-specific-a', 'specific_action');

      // user-a는 허용, user-b는 여전히 거부
      const allowedA = await checkRateLimit('clear-specific-a', 'specific_action', config);
      const stillBlockedB = await checkRateLimit('clear-specific-b', 'specific_action', config);

      expect(allowedA.allowed).toBe(true);
      expect(stillBlockedB.allowed).toBe(false);
    });
  });

  describe('getRateLimitErrorMessage', () => {
    it('초 단위 메시지를 반환해야 한다', () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetIn: 30000, // 30초
        current: 5,
        limit: 5,
      };

      const message = getRateLimitErrorMessage(result);
      expect(message).toContain('30초');
      expect(message).toContain('요청이 너무 많습니다');
    });

    it('분 단위 메시지를 반환해야 한다', () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetIn: 120000, // 2분
        current: 5,
        limit: 5,
      };

      const message = getRateLimitErrorMessage(result);
      expect(message).toContain('분');
      expect(message).toContain('요청이 너무 많습니다');
    });

    it('60초 초과 시 분으로 변환해야 한다', () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetIn: 90000, // 90초 = 2분 (올림)
        current: 5,
        limit: 5,
      };

      const message = getRateLimitErrorMessage(result);
      expect(message).toContain('2분');
    });
  });

  describe('getClientIP', () => {
    it('x-forwarded-for 헤더에서 IP를 추출해야 한다', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '192.168.1.1, 10.0.0.1');

      const ip = getClientIP(headers);
      expect(ip).toBe('192.168.1.1');
    });

    it('x-real-ip 헤더에서 IP를 추출해야 한다', () => {
      const headers = new Headers();
      headers.set('x-real-ip', '192.168.1.100');

      const ip = getClientIP(headers);
      expect(ip).toBe('192.168.1.100');
    });

    it('x-forwarded-for가 x-real-ip보다 우선해야 한다', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '10.0.0.1');
      headers.set('x-real-ip', '192.168.1.100');

      const ip = getClientIP(headers);
      expect(ip).toBe('10.0.0.1');
    });

    it('헤더가 없으면 unknown을 반환해야 한다', () => {
      const headers = new Headers();

      const ip = getClientIP(headers);
      expect(ip).toBe('unknown');
    });

    it('빈 x-forwarded-for는 건너뛰어야 한다', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '');
      headers.set('x-real-ip', '192.168.1.100');

      const ip = getClientIP(headers);
      expect(ip).toBe('192.168.1.100');
    });
  });

  describe('윈도우 만료 후 리셋', () => {
    it('윈도우 시간이 지나면 요청이 다시 허용되어야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 100, max: 1 }; // 100ms 윈도우

      // 첫 요청 허용
      const result1 = await checkRateLimit('window-test', 'window_action', config);
      expect(result1.allowed).toBe(true);

      // 두 번째 요청 거부
      const result2 = await checkRateLimit('window-test', 'window_action', config);
      expect(result2.allowed).toBe(false);

      // 윈도우 시간 대기
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 윈도우 만료 후 다시 허용
      const result3 = await checkRateLimit('window-test', 'window_action', config);
      expect(result3.allowed).toBe(true);
    });

    it('슬라이딩 윈도우가 올바르게 동작해야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 200, max: 2 };

      // 첫 번째 요청
      await checkRateLimit('sliding-test', 'sliding_action', config);

      // 50ms 후 두 번째 요청
      await new Promise((resolve) => setTimeout(resolve, 50));
      await checkRateLimit('sliding-test', 'sliding_action', config);

      // 세 번째 요청 거부
      const blocked = await checkRateLimit('sliding-test', 'sliding_action', config);
      expect(blocked.allowed).toBe(false);

      // 150ms 더 대기 (첫 번째 요청이 윈도우 밖으로)
      await new Promise((resolve) => setTimeout(resolve, 160));

      // 이제 허용
      const allowed = await checkRateLimit('sliding-test', 'sliding_action', config);
      expect(allowed.allowed).toBe(true);
    });
  });

  describe('동시 요청 처리', () => {
    it('동시 요청 시에도 제한이 올바르게 적용되어야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 60000, max: 5 };

      // 10개의 동시 요청
      const promises = Array.from({ length: 10 }, (_, i) =>
        checkRateLimit('concurrent-test', 'concurrent_action', config)
      );

      const results = await Promise.all(promises);

      // 최대 5개만 허용
      const allowedCount = results.filter((r) => r.allowed).length;
      const blockedCount = results.filter((r) => !r.allowed).length;

      expect(allowedCount).toBe(5);
      expect(blockedCount).toBe(5);
    });
  });

  describe('에러 케이스', () => {
    it('빈 식별자도 처리되어야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 60000, max: 5 };

      const result = await checkRateLimit('', 'empty_id_action', config);
      expect(result.allowed).toBe(true);
    });

    it('특수 문자가 포함된 식별자도 처리되어야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 60000, max: 5 };

      const result = await checkRateLimit(
        'user:123@test.com',
        'special_char_action',
        config
      );
      expect(result.allowed).toBe(true);
    });

    it('매우 긴 식별자도 처리되어야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 60000, max: 5 };
      const longId = 'a'.repeat(1000);

      const result = await checkRateLimit(longId, 'long_id_action', config);
      expect(result.allowed).toBe(true);
    });
  });

  describe('경계 조건', () => {
    it('max가 0이면 모든 요청이 거부되어야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 60000, max: 0 };

      const result = await checkRateLimit('zero-max-test', 'zero_max', config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('max가 1이면 첫 요청만 허용되어야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 60000, max: 1 };

      const result1 = await checkRateLimit('one-max-test', 'one_max', config);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(0);

      const result2 = await checkRateLimit('one-max-test', 'one_max', config);
      expect(result2.allowed).toBe(false);
    });

    it('매우 짧은 윈도우도 동작해야 한다', async () => {
      const config: RateLimitConfig = { windowMs: 10, max: 2 };

      const result1 = await checkRateLimit('short-window', 'short_win', config);
      expect(result1.allowed).toBe(true);

      // 짧은 대기 후
      await new Promise((resolve) => setTimeout(resolve, 20));

      const result2 = await checkRateLimit('short-window', 'short_win', config);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('실제 사용 시나리오', () => {
    it('결제 준비 Rate Limit 시나리오', async () => {
      const userId = 'payment-user-123';

      // 10회 허용 (PAYMENT_PREPARE.max = 10)
      for (let i = 0; i < 10; i++) {
        const result = await checkRateLimit(
          userId,
          'prepare_credit_purchase',
          RATE_LIMIT_PRESETS.PAYMENT_PREPARE
        );
        expect(result.allowed).toBe(true);
      }

      // 11번째 요청 거부
      const blocked = await checkRateLimit(
        userId,
        'prepare_credit_purchase',
        RATE_LIMIT_PRESETS.PAYMENT_PREPARE
      );
      expect(blocked.allowed).toBe(false);
    });

    it('인증 Rate Limit 시나리오', async () => {
      const ip = '192.168.1.1';

      // 5회 허용 (AUTH.max = 5)
      for (let i = 0; i < 5; i++) {
        const result = await checkRateLimit(
          ip,
          'login_attempt',
          RATE_LIMIT_PRESETS.AUTH
        );
        expect(result.allowed).toBe(true);
      }

      // 6번째 요청 거부
      const blocked = await checkRateLimit(
        ip,
        'login_attempt',
        RATE_LIMIT_PRESETS.AUTH
      );
      expect(blocked.allowed).toBe(false);

      // 에러 메시지 확인
      const errorMsg = getRateLimitErrorMessage(blocked);
      expect(errorMsg).toContain('요청이 너무 많습니다');
    });
  });
});
