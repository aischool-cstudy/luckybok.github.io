/**
 * @fileoverview 일일 생성 횟수 관리 유틸리티 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ensureDailyLimitReset,
  checkGenerationAvailability,
  restoreGenerationCredit,
  deductCredit,
  deductDailyGeneration,
} from '@/lib/ai/daily-limit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// Mock dependencies
vi.mock('@/config/pricing', () => ({
  getDailyLimitByPlan: vi.fn((plan: string) => {
    const limits: Record<string, number> = {
      starter: 10,
      pro: 100,
      team: 500,
      enterprise: 1000,
    };
    return limits[plan] || 10;
  }),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

describe('daily-limit', () => {
  // Mock Supabase client
  const createMockSupabase = () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockInsert = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockRpc = vi.fn();

    return {
      from: vi.fn(() => ({
        update: mockUpdate,
        insert: mockInsert,
        eq: mockEq,
      })),
      rpc: mockRpc,
      _mocks: { mockUpdate, mockInsert, mockEq, mockRpc },
    } as unknown as SupabaseClient<Database> & {
      _mocks: {
        mockUpdate: ReturnType<typeof vi.fn>;
        mockInsert: ReturnType<typeof vi.fn>;
        mockEq: ReturnType<typeof vi.fn>;
        mockRpc: ReturnType<typeof vi.fn>;
      };
    };
  };

  describe('ensureDailyLimitReset', () => {
    it('리셋이 필요하지 않으면 현재 값을 반환해야 한다', async () => {
      const supabase = createMockSupabase();
      const now = new Date();
      const profile = {
        plan: 'pro',
        daily_generations_remaining: 50,
        daily_reset_at: now.toISOString(),
        credits_balance: 100,
      };

      const result = await ensureDailyLimitReset(supabase, 'user-123', profile);

      expect(result.remainingGenerations).toBe(50);
      expect(result.wasReset).toBe(false);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('날짜가 바뀌면 리셋을 수행해야 한다', async () => {
      const supabase = createMockSupabase();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const profile = {
        plan: 'pro',
        daily_generations_remaining: 0,
        daily_reset_at: yesterday.toISOString(),
        credits_balance: 100,
      };

      const result = await ensureDailyLimitReset(supabase, 'user-123', profile);

      expect(result.remainingGenerations).toBe(100); // pro plan limit
      expect(result.wasReset).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('profiles');
    });

    it('daily_reset_at이 null이면 리셋을 수행해야 한다', async () => {
      const supabase = createMockSupabase();
      const profile = {
        plan: 'starter',
        daily_generations_remaining: 5,
        daily_reset_at: null,
        credits_balance: 0,
      };

      const result = await ensureDailyLimitReset(supabase, 'user-123', profile);

      expect(result.remainingGenerations).toBe(10); // starter plan limit
      expect(result.wasReset).toBe(true);
    });

    it('플랜별 올바른 일일 제한을 설정해야 한다', async () => {
      const supabase = createMockSupabase();
      const testCases = [
        { plan: 'starter', expected: 10 },
        { plan: 'pro', expected: 100 },
        { plan: 'team', expected: 500 },
        { plan: 'enterprise', expected: 1000 },
      ];

      for (const { plan, expected } of testCases) {
        const profile = {
          plan,
          daily_generations_remaining: 0,
          daily_reset_at: null,
          credits_balance: 0,
        };

        const result = await ensureDailyLimitReset(supabase, 'user-123', profile);
        expect(result.remainingGenerations).toBe(expected);
      }
    });
  });

  describe('checkGenerationAvailability', () => {
    it('일일 횟수가 남아있으면 생성 가능해야 한다', () => {
      const result = checkGenerationAvailability(5, 0);

      expect(result.canGenerate).toBe(true);
      expect(result.useCredits).toBe(false);
      expect(result.errorMessage).toBeUndefined();
    });

    it('일일 횟수가 없고 크레딧이 있으면 크레딧 사용해야 한다', () => {
      const result = checkGenerationAvailability(0, 10);

      expect(result.canGenerate).toBe(true);
      expect(result.useCredits).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('일일 횟수와 크레딧 모두 없으면 에러 메시지 반환해야 한다', () => {
      const result = checkGenerationAvailability(0, 0);

      expect(result.canGenerate).toBe(false);
      expect(result.useCredits).toBe(false);
      expect(result.errorMessage).toBe(
        '오늘의 생성 횟수를 모두 사용했습니다. 크레딧을 충전하거나 플랜을 업그레이드해주세요.'
      );
    });

    it('일일 횟수가 양수면 크레딧이 있어도 일일 횟수 우선 사용해야 한다', () => {
      const result = checkGenerationAvailability(3, 100);

      expect(result.canGenerate).toBe(true);
      expect(result.useCredits).toBe(false);
    });
  });

  describe('restoreGenerationCredit', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('복구 성공 시 결과를 반환해야 한다', async () => {
      const supabase = createMockSupabase();
      supabase._mocks.mockRpc.mockResolvedValue({
        data: [{ success: true, restored_value: 5 }],
        error: null,
      });
      // Override rpc
      (supabase as any).rpc = supabase._mocks.mockRpc;

      const result = await restoreGenerationCredit(supabase, 'user-123', false, '테스트 주제');

      expect(result.success).toBe(true);
      expect(result.restoredValue).toBe(5);
    });

    it('RPC 실패 시 에러 반환해야 한다', async () => {
      const supabase = createMockSupabase();
      supabase._mocks.mockRpc.mockResolvedValue({
        data: [{ success: false, error_message: '복구 실패' }],
        error: null,
      });
      (supabase as any).rpc = supabase._mocks.mockRpc;

      const result = await restoreGenerationCredit(supabase, 'user-123', true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('복구 실패');
    });

    it('연결 에러 시 재시도해야 한다', async () => {
      const supabase = createMockSupabase();
      let callCount = 0;
      supabase._mocks.mockRpc.mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return { data: null, error: { code: '08006', message: 'connection timeout' } };
        }
        return { data: [{ success: true, restored_value: 10 }], error: null };
      });
      (supabase as any).rpc = supabase._mocks.mockRpc;

      const result = await restoreGenerationCredit(supabase, 'user-123', false);

      expect(result.success).toBe(true);
      expect(callCount).toBe(3);
    });

    it('최대 재시도 후 실패하면 에러 반환해야 한다', async () => {
      const supabase = createMockSupabase();
      supabase._mocks.mockRpc.mockResolvedValue({
        data: null,
        error: { code: '08006', message: 'connection timeout' },
      });
      (supabase as any).rpc = supabase._mocks.mockRpc;

      const result = await restoreGenerationCredit(supabase, 'user-123', false);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('재시도 불가능한 에러는 즉시 반환해야 한다', async () => {
      const supabase = createMockSupabase();
      let callCount = 0;
      supabase._mocks.mockRpc.mockImplementation(async () => {
        callCount++;
        return { data: null, error: { code: '23505', message: 'unique violation' } };
      });
      (supabase as any).rpc = supabase._mocks.mockRpc;

      const result = await restoreGenerationCredit(supabase, 'user-123', false);

      expect(result.success).toBe(false);
      expect(callCount).toBe(1); // 재시도 없이 1회만 호출
    });
  });

  describe('deductCredit', () => {
    it('크레딧 차감 및 트랜잭션 기록해야 한다', async () => {
      const supabase = createMockSupabase();

      await deductCredit(supabase, 'user-123', 10, 'Python 기초');

      expect(supabase.from).toHaveBeenCalledWith('credit_transactions');
      expect(supabase.from).toHaveBeenCalledWith('profiles');
    });

    it('트랜잭션에 올바른 데이터가 기록되어야 한다', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });

      const supabase = {
        from: vi.fn((table: string) => {
          if (table === 'credit_transactions') {
            return { insert: mockInsert };
          }
          return { update: mockUpdate, eq: mockEq };
        }),
      } as unknown as SupabaseClient<Database>;

      await deductCredit(supabase, 'user-123', 10, 'Python 기초');

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user-123',
        type: 'usage',
        amount: -1,
        balance: 9,
        description: '콘텐츠 생성: Python 기초',
      });
    });
  });

  describe('deductDailyGeneration', () => {
    it('일일 생성 횟수를 1 차감해야 한다', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });

      const supabase = {
        from: vi.fn(() => ({
          update: mockUpdate,
          eq: mockEq,
        })),
      } as unknown as SupabaseClient<Database>;

      await deductDailyGeneration(supabase, 'user-123', 5);

      expect(mockUpdate).toHaveBeenCalledWith({
        daily_generations_remaining: 4,
      });
      expect(mockEq).toHaveBeenCalledWith('id', 'user-123');
    });
  });
});
