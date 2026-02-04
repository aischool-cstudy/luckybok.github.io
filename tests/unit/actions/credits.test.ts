import { describe, it, expect, vi, beforeEach } from 'vitest';

// Logger 모킹
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

// Auth 모킹
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}));

// RPC 결과 파싱 모킹
vi.mock('@/lib/supabase/helpers', () => ({
  parseRpcResult: vi.fn((result) => {
    if (result?.success === false) {
      return { success: false, error: result.error || 'Unknown error' };
    }
    return { success: true, data: result };
  }),
}));

// Supabase 클라이언트 모킹
const mockFromChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => mockFromChain),
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// 테스트 대상 함수들 import
import {
  getCreditBalance,
  checkGenerationAvailability,
  useCredit,
  addCredit,
  getCreditHistory,
} from '@/actions/credits';
import { getAuthUser } from '@/lib/auth';

const mockGetAuthUser = getAuthUser as ReturnType<typeof vi.fn>;

describe('Credits Server Actions', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    // 모든 체인 메서드를 mockReturnThis로 리셋
    mockFromChain.select.mockReturnThis();
    mockFromChain.insert.mockReturnThis();
    mockFromChain.update.mockReturnThis();
    mockFromChain.eq.mockReturnThis();
    mockFromChain.in.mockReturnThis();
    mockFromChain.gt.mockReturnThis();
    mockFromChain.not.mockReturnThis();
    mockFromChain.lte.mockReturnThis();
    mockFromChain.gte.mockReturnThis();
    mockFromChain.order.mockReturnThis();
    mockFromChain.range.mockReturnThis();
    mockFromChain.single.mockReset();
  });

  describe('getCreditBalance', () => {
    it('크레딧 잔액을 정상적으로 조회해야 한다', async () => {
      // Auth 모킹
      mockGetAuthUser.mockResolvedValue({
        user: mockUser,
        supabase: mockSupabaseClient,
      });

      // 프로필 조회 모킹
      mockFromChain.single.mockResolvedValueOnce({
        data: { credits_balance: 50 },
        error: null,
      });

      // 만료 예정 크레딧 조회 모킹 (order 다음에 실행됨)
      mockFromChain.order.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await getCreditBalance();

      expect(result).not.toBeNull();
      expect(result?.balance).toBe(50);
      expect(result?.expiringCredits).toBe(0);
    });

    it('userId를 직접 전달하면 해당 사용자 조회해야 한다', async () => {
      // 프로필 조회 모킹
      mockFromChain.single.mockResolvedValueOnce({
        data: { credits_balance: 100 },
        error: null,
      });

      mockFromChain.order.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await getCreditBalance('specific-user-id');

      expect(result).not.toBeNull();
      expect(result?.balance).toBe(100);
    });

    it('비로그인 사용자는 null을 반환해야 한다', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const result = await getCreditBalance();

      expect(result).toBeNull();
    });

    it('프로필이 없으면 null을 반환해야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({
        user: mockUser,
        supabase: mockSupabaseClient,
      });

      mockFromChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await getCreditBalance();

      expect(result).toBeNull();
    });

    it('만료 예정 크레딧을 계산해야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({
        user: mockUser,
        supabase: mockSupabaseClient,
      });

      mockFromChain.single.mockResolvedValueOnce({
        data: { credits_balance: 100 },
        error: null,
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 15);

      mockFromChain.order.mockResolvedValue({
        data: [
          { amount: 30, expires_at: expiresAt.toISOString() },
          { amount: 20, expires_at: expiresAt.toISOString() },
        ],
        error: null,
      });

      const result = await getCreditBalance();

      expect(result?.expiringCredits).toBe(50);
      expect(result?.expiringDate).toBeDefined();
    });
  });

  describe('checkGenerationAvailability', () => {
    it('비로그인 사용자는 생성 불가해야 한다', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const result = await checkGenerationAvailability();

      expect(result.canGenerate).toBe(false);
      expect(result.reason).toBe('로그인이 필요합니다.');
    });

    it('프로필이 없으면 생성 불가해야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({
        user: mockUser,
        supabase: mockSupabaseClient,
      });

      mockFromChain.single.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await checkGenerationAvailability();

      expect(result.canGenerate).toBe(false);
      expect(result.reason).toBe('사용자 정보를 찾을 수 없습니다.');
    });

    it('일일 횟수가 남아있으면 생성 가능 (크레딧 미사용)', async () => {
      mockGetAuthUser.mockResolvedValue({
        user: mockUser,
        supabase: mockSupabaseClient,
      });

      mockFromChain.single.mockResolvedValue({
        data: {
          plan: 'pro',
          daily_generations_remaining: 5,
          credits_balance: 10,
        },
        error: null,
      });

      const result = await checkGenerationAvailability();

      expect(result.canGenerate).toBe(true);
      expect(result.dailyRemaining).toBe(5);
      expect(result.useCredits).toBe(false);
    });

    it('일일 횟수 0이고 크레딧 있으면 생성 가능 (크레딧 사용)', async () => {
      mockGetAuthUser.mockResolvedValue({
        user: mockUser,
        supabase: mockSupabaseClient,
      });

      mockFromChain.single.mockResolvedValue({
        data: {
          plan: 'starter',
          daily_generations_remaining: 0,
          credits_balance: 10,
        },
        error: null,
      });

      const result = await checkGenerationAvailability();

      expect(result.canGenerate).toBe(true);
      expect(result.dailyRemaining).toBe(0);
      expect(result.creditBalance).toBe(10);
      expect(result.useCredits).toBe(true);
    });

    it('일일 횟수 0이고 크레딧도 0이면 생성 불가', async () => {
      mockGetAuthUser.mockResolvedValue({
        user: mockUser,
        supabase: mockSupabaseClient,
      });

      mockFromChain.single.mockResolvedValue({
        data: {
          plan: 'starter',
          daily_generations_remaining: 0,
          credits_balance: 0,
        },
        error: null,
      });

      const result = await checkGenerationAvailability();

      expect(result.canGenerate).toBe(false);
      expect(result.reason).toContain('오늘의 생성 횟수를 모두 사용했습니다');
    });
  });

  describe('useCredit', () => {
    it('0 이하의 금액은 에러 반환해야 한다', async () => {
      const result = await useCredit('user-123', 0, '테스트');

      expect(result.success).toBe(false);
      expect(result.error).toBe('유효하지 않은 크레딧 양입니다.');
    });

    it('음수 금액은 에러 반환해야 한다', async () => {
      const result = await useCredit('user-123', -5, '테스트');

      expect(result.success).toBe(false);
      expect(result.error).toBe('유효하지 않은 크레딧 양입니다.');
    });

    it('RPC 성공 시 새 잔액 반환해야 한다', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: { success: true, new_balance: 45 },
        error: null,
      });

      const result = await useCredit('user-123', 5, '콘텐츠 생성');

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(45);
    });

    it('RPC 오류 시 에러 반환해야 한다', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

      const result = await useCredit('user-123', 5, '콘텐츠 생성');

      expect(result.success).toBe(false);
      expect(result.error).toBe('크레딧 사용에 실패했습니다.');
    });

    it('RPC 결과가 실패면 에러 반환해야 한다', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: { success: false, error: '잔액 부족' },
        error: null,
      });

      const result = await useCredit('user-123', 100, '콘텐츠 생성');

      expect(result.success).toBe(false);
      expect(result.error).toBe('잔액 부족');
    });
  });

  describe('addCredit', () => {
    it('0 이하의 금액은 에러 반환해야 한다', async () => {
      const result = await addCredit('user-123', 0, 'purchase', '테스트');

      expect(result.success).toBe(false);
      expect(result.error).toBe('유효하지 않은 크레딧 양입니다.');
    });

    it('음수 금액은 에러 반환해야 한다', async () => {
      const result = await addCredit('user-123', -10, 'purchase', '테스트');

      expect(result.success).toBe(false);
      expect(result.error).toBe('유효하지 않은 크레딧 양입니다.');
    });

    it('RPC 성공 시 새 잔액 반환해야 한다', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: { success: true, new_balance: 150 },
        error: null,
      });

      const result = await addCredit('user-123', 100, 'purchase', '크레딧 구매');

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(150);
    });

    it('만료일과 함께 크레딧 추가해야 한다', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: { success: true, new_balance: 150 },
        error: null,
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      const result = await addCredit(
        'user-123',
        100,
        'purchase',
        '크레딧 구매',
        'payment-123',
        expiresAt
      );

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'add_credit_atomic',
        expect.objectContaining({
          p_user_id: 'user-123',
          p_amount: 100,
          p_type: 'purchase',
          p_payment_id: 'payment-123',
          p_expires_at: expiresAt.toISOString(),
        })
      );
    });

    it('RPC 오류 시 에러 반환해야 한다', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

      const result = await addCredit('user-123', 100, 'purchase', '크레딧 구매');

      expect(result.success).toBe(false);
      expect(result.error).toBe('크레딧 추가에 실패했습니다.');
    });

    it.each([
      'purchase',
      'subscription_grant',
      'refund',
      'admin_adjustment',
    ] as const)('트랜잭션 타입 "%s"를 처리해야 한다', async (type) => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: { success: true, new_balance: 100 },
        error: null,
      });

      const result = await addCredit('user-123', 50, type, '테스트');

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'add_credit_atomic',
        expect.objectContaining({ p_type: type })
      );
    });
  });

  describe('getCreditHistory', () => {
    it('비로그인 사용자는 빈 배열 반환해야 한다', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const result = await getCreditHistory();

      expect(result.transactions).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('트랜잭션 히스토리를 조회해야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({
        user: mockUser,
        supabase: mockSupabaseClient,
      });

      const mockTransactions = [
        { id: '1', type: 'purchase', amount: 100, created_at: '2026-01-01' },
        { id: '2', type: 'usage', amount: -5, created_at: '2026-01-02' },
      ];

      mockFromChain.range.mockResolvedValue({
        data: mockTransactions,
        count: 2,
        error: null,
      });

      const result = await getCreditHistory();

      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('페이지네이션이 올바르게 동작해야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({
        user: mockUser,
        supabase: mockSupabaseClient,
      });

      mockFromChain.range.mockResolvedValue({
        data: [],
        count: 50,
        error: null,
      });

      await getCreditHistory(2, 10);

      // range(10, 19) 호출 확인 (2페이지, 10개씩)
      expect(mockFromChain.range).toHaveBeenCalledWith(10, 19);
    });

    it('기본값으로 첫 페이지 10개 조회해야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({
        user: mockUser,
        supabase: mockSupabaseClient,
      });

      mockFromChain.range.mockResolvedValue({
        data: [],
        count: 0,
        error: null,
      });

      await getCreditHistory();

      expect(mockFromChain.range).toHaveBeenCalledWith(0, 9);
    });

    it('조회 오류 시 빈 배열 반환해야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({
        user: mockUser,
        supabase: mockSupabaseClient,
      });

      mockFromChain.range.mockResolvedValue({
        data: null,
        count: null,
        error: { message: 'Query failed' },
      });

      const result = await getCreditHistory();

      expect(result.transactions).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});

// 추가 로직 테스트 (기존 테스트 유지)
describe('Credits System Logic', () => {
  describe('Credit Transaction Types', () => {
    const validTypes = ['purchase', 'subscription_grant', 'usage', 'refund', 'admin_adjustment'];

    it('모든 유효한 트랜잭션 타입을 인식해야 한다', () => {
      validTypes.forEach((type) => {
        expect(validTypes.includes(type)).toBe(true);
      });
    });

    it('사용(usage)은 음수 금액으로 기록되어야 한다', () => {
      const usageAmount = 5;
      const recordedAmount = -usageAmount;
      expect(recordedAmount).toBeLessThan(0);
    });

    it('구매(purchase)는 양수 금액으로 기록되어야 한다', () => {
      const purchaseAmount = 100;
      expect(purchaseAmount).toBeGreaterThan(0);
    });
  });

  describe('Credit Expiration', () => {
    it('만료일이 설정된 크레딧을 추적해야 한다', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const now = new Date();
      const isExpired = expiresAt < now;

      expect(isExpired).toBe(false);
    });

    it('만료된 크레딧을 감지해야 한다', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1);

      const now = new Date();
      const isExpired = expiresAt < now;

      expect(isExpired).toBe(true);
    });

    it('30일 이내 만료 예정 크레딧을 감지해야 한다', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 15);

      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

      const now = new Date();
      const isExpiringSoon = expiresAt >= now && expiresAt <= thirtyDaysLater;

      expect(isExpiringSoon).toBe(true);
    });
  });
});
