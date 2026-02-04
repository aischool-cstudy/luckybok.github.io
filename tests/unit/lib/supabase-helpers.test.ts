import { describe, it, expect, vi, beforeEach } from 'vitest';

// Logger 모킹
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

// Supabase 클라이언트 모킹
const mockFromChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

const mockSupabaseClient = {
  from: vi.fn(() => mockFromChain),
  rpc: vi.fn(),
};

// 테스트 대상 import
import {
  getProfile,
  updateProfile,
  useGenerationCredit,
  getCreditTransactions,
  getActiveSubscription,
  getSubscriptionHistory,
  getPaymentHistory,
  getPaymentByOrderId,
  getGeneratedContents,
  getGeneratedContent,
  normalizeJoinResult,
  parseRpcResult,
  createRpcErrorResponse,
} from '@/lib/supabase/helpers';
import { logError } from '@/lib/logger';

describe('Supabase Helper Functions', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    // 체인 메서드 리셋
    mockFromChain.select.mockReturnThis();
    mockFromChain.insert.mockReturnThis();
    mockFromChain.update.mockReturnThis();
    mockFromChain.eq.mockReturnThis();
    mockFromChain.order.mockReturnThis();
    mockFromChain.limit.mockReturnThis();
    mockFromChain.range.mockReturnThis();
    mockFromChain.single.mockReset();
  });

  describe('getProfile', () => {
    it('프로필을 정상적으로 조회해야 한다', async () => {
      const mockProfile = { id: mockUserId, name: '테스트', email: 'test@example.com' };
      mockFromChain.single.mockResolvedValue({ data: mockProfile, error: null });

      const result = await getProfile(mockSupabaseClient as never, mockUserId);

      expect(result).toEqual(mockProfile);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
    });

    it('에러 발생 시 null을 반환하고 로깅해야 한다', async () => {
      mockFromChain.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await getProfile(mockSupabaseClient as never, mockUserId);

      expect(result).toBeNull();
      expect(logError).toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('프로필을 정상적으로 업데이트해야 한다', async () => {
      const updates = { name: '새 이름' };
      const updatedProfile = { id: mockUserId, name: '새 이름', email: 'test@example.com' };
      mockFromChain.single.mockResolvedValue({ data: updatedProfile, error: null });

      const result = await updateProfile(mockSupabaseClient as never, mockUserId, updates);

      expect(result).toEqual(updatedProfile);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
    });

    it('에러 발생 시 null을 반환해야 한다', async () => {
      mockFromChain.single.mockResolvedValue({ data: null, error: { message: 'Update failed' } });

      const result = await updateProfile(mockSupabaseClient as never, mockUserId, { name: 'test' });

      expect(result).toBeNull();
      expect(logError).toHaveBeenCalled();
    });
  });

  describe('useGenerationCredit', () => {
    it('RPC 성공 시 true를 반환해야 한다', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null });

      const result = await useGenerationCredit(mockSupabaseClient as never, mockUserId);

      expect(result).toBe(true);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('use_generation_credit', {
        p_user_id: mockUserId,
      });
    });

    it('RPC가 false 반환 시 false를 반환해야 한다', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: false, error: null });

      const result = await useGenerationCredit(mockSupabaseClient as never, mockUserId);

      expect(result).toBe(false);
    });

    it('에러 발생 시 false를 반환해야 한다', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } });

      const result = await useGenerationCredit(mockSupabaseClient as never, mockUserId);

      expect(result).toBe(false);
      expect(logError).toHaveBeenCalled();
    });
  });

  describe('getCreditTransactions', () => {
    it('거래 내역을 조회해야 한다', async () => {
      const mockTransactions = [
        { id: '1', amount: 100, type: 'purchase' },
        { id: '2', amount: -5, type: 'usage' },
      ];
      mockFromChain.limit.mockResolvedValue({ data: mockTransactions, error: null });

      const result = await getCreditTransactions(mockSupabaseClient as never, mockUserId);

      expect(result).toEqual(mockTransactions);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('credit_transactions');
    });

    it('에러 시 빈 배열을 반환해야 한다', async () => {
      mockFromChain.limit.mockResolvedValue({ data: null, error: { message: 'Error' } });

      const result = await getCreditTransactions(mockSupabaseClient as never, mockUserId);

      expect(result).toEqual([]);
    });

    it('기본 limit 20으로 조회해야 한다', async () => {
      mockFromChain.limit.mockResolvedValue({ data: [], error: null });

      await getCreditTransactions(mockSupabaseClient as never, mockUserId);

      expect(mockFromChain.limit).toHaveBeenCalledWith(20);
    });

    it('커스텀 limit로 조회할 수 있어야 한다', async () => {
      mockFromChain.limit.mockResolvedValue({ data: [], error: null });

      await getCreditTransactions(mockSupabaseClient as never, mockUserId, 50);

      expect(mockFromChain.limit).toHaveBeenCalledWith(50);
    });
  });

  describe('getActiveSubscription', () => {
    it('활성 구독을 조회해야 한다', async () => {
      const mockSubscription = { id: 'sub_123', status: 'active', plan: 'pro' };
      mockFromChain.single.mockResolvedValue({ data: mockSubscription, error: null });

      const result = await getActiveSubscription(mockSupabaseClient as never, mockUserId);

      expect(result).toEqual(mockSubscription);
      expect(mockFromChain.eq).toHaveBeenCalledWith('status', 'active');
    });

    it('구독이 없으면 null을 반환해야 한다 (PGRST116 에러)', async () => {
      mockFromChain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      const result = await getActiveSubscription(mockSupabaseClient as never, mockUserId);

      expect(result).toBeNull();
      // PGRST116은 에러 로깅하지 않음
      expect(logError).not.toHaveBeenCalled();
    });

    it('다른 에러는 로깅해야 한다', async () => {
      mockFromChain.single.mockResolvedValue({ data: null, error: { code: 'OTHER', message: 'Error' } });

      await getActiveSubscription(mockSupabaseClient as never, mockUserId);

      expect(logError).toHaveBeenCalled();
    });
  });

  describe('getSubscriptionHistory', () => {
    it('구독 이력을 조회해야 한다', async () => {
      const mockHistory = [
        { id: 'sub_1', status: 'canceled' },
        { id: 'sub_2', status: 'active' },
      ];
      mockFromChain.limit.mockResolvedValue({ data: mockHistory, error: null });

      const result = await getSubscriptionHistory(mockSupabaseClient as never, mockUserId);

      expect(result).toEqual(mockHistory);
    });

    it('에러 시 빈 배열을 반환해야 한다', async () => {
      mockFromChain.limit.mockResolvedValue({ data: null, error: { message: 'Error' } });

      const result = await getSubscriptionHistory(mockSupabaseClient as never, mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('getPaymentHistory', () => {
    it('결제 이력을 조회해야 한다', async () => {
      const mockPayments = [
        { id: 'pay_1', amount: 29900, status: 'paid' },
        { id: 'pay_2', amount: 9900, status: 'paid' },
      ];
      mockFromChain.limit.mockResolvedValue({ data: mockPayments, error: null });

      const result = await getPaymentHistory(mockSupabaseClient as never, mockUserId);

      expect(result).toEqual(mockPayments);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('payments');
    });
  });

  describe('getPaymentByOrderId', () => {
    it('주문 ID로 결제를 조회해야 한다', async () => {
      const mockPayment = { id: 'pay_1', order_id: 'ORD_123', amount: 29900 };
      mockFromChain.single.mockResolvedValue({ data: mockPayment, error: null });

      const result = await getPaymentByOrderId(mockSupabaseClient as never, 'ORD_123');

      expect(result).toEqual(mockPayment);
      expect(mockFromChain.eq).toHaveBeenCalledWith('order_id', 'ORD_123');
    });

    it('결제가 없으면 null을 반환해야 한다', async () => {
      mockFromChain.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await getPaymentByOrderId(mockSupabaseClient as never, 'ORD_999');

      expect(result).toBeNull();
    });
  });

  describe('getGeneratedContents', () => {
    it('생성된 콘텐츠 목록을 조회해야 한다', async () => {
      const mockContents = [
        { id: '1', title: '콘텐츠 1', language: 'python' },
        { id: '2', title: '콘텐츠 2', language: 'javascript' },
      ];

      // order 후 바로 실행되는 경우 (await query)
      const mockChainResult = {
        ...mockFromChain,
        then: (resolve: (arg: { data: unknown[]; error: null }) => void) => {
          resolve({ data: mockContents, error: null });
        },
      };
      mockFromChain.order.mockReturnValue(mockChainResult);

      const result = await getGeneratedContents(mockSupabaseClient as never, mockUserId);

      expect(result).toEqual(mockContents);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('generated_contents');
    });

    it('옵션으로 language 필터링이 가능해야 한다', async () => {
      // order가 chain을 반환하고, eq도 chain을 반환해야 함
      const chainWithResult = {
        ...mockFromChain,
        eq: vi.fn().mockReturnValue({
          then: (resolve: (arg: { data: unknown[]; error: null }) => void) => {
            resolve({ data: [], error: null });
          },
        }),
      };
      mockFromChain.order.mockReturnValue(chainWithResult);

      await getGeneratedContents(mockSupabaseClient as never, mockUserId, { language: 'python' });

      expect(chainWithResult.eq).toHaveBeenCalledWith('language', 'python');
    });

    it('옵션으로 limit과 offset 설정이 가능해야 한다', async () => {
      // order -> limit -> range 체인
      const rangeResult = {
        then: (resolve: (arg: { data: unknown[]; error: null }) => void) => {
          resolve({ data: [], error: null });
        },
      };
      const limitResult = {
        range: vi.fn().mockReturnValue(rangeResult),
      };
      const orderResult = {
        ...mockFromChain,
        limit: vi.fn().mockReturnValue(limitResult),
      };
      mockFromChain.order.mockReturnValue(orderResult);

      await getGeneratedContents(mockSupabaseClient as never, mockUserId, {
        limit: 10,
        offset: 20,
      });

      expect(orderResult.limit).toHaveBeenCalledWith(10);
      expect(limitResult.range).toHaveBeenCalledWith(20, 29);
    });

    it('에러 시 빈 배열을 반환해야 한다', async () => {
      const mockChainResult = {
        ...mockFromChain,
        then: (resolve: (arg: { data: null; error: { message: string } }) => void) => {
          resolve({ data: null, error: { message: 'Error' } });
        },
      };
      mockFromChain.order.mockReturnValue(mockChainResult);

      const result = await getGeneratedContents(mockSupabaseClient as never, mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('getGeneratedContent', () => {
    it('ID로 콘텐츠를 조회해야 한다', async () => {
      const mockContent = { id: 'content_123', title: '테스트', content: '내용' };
      mockFromChain.single.mockResolvedValue({ data: mockContent, error: null });

      const result = await getGeneratedContent(mockSupabaseClient as never, 'content_123');

      expect(result).toEqual(mockContent);
      expect(mockFromChain.eq).toHaveBeenCalledWith('id', 'content_123');
    });

    it('콘텐츠가 없으면 null을 반환해야 한다', async () => {
      mockFromChain.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await getGeneratedContent(mockSupabaseClient as never, 'invalid_id');

      expect(result).toBeNull();
    });
  });
});

describe('Utility Functions', () => {
  describe('normalizeJoinResult', () => {
    it('배열 결과의 첫 번째 항목을 반환해야 한다', () => {
      const data = [{ card_company: '신한카드', card_number: '1234' }];

      const result = normalizeJoinResult<{ card_company: string }>(data);

      expect(result?.card_company).toBe('신한카드');
    });

    it('단일 객체 결과를 그대로 반환해야 한다', () => {
      const data = { card_company: '국민카드', card_number: '5678' };

      const result = normalizeJoinResult<typeof data>(data);

      expect(result?.card_company).toBe('국민카드');
    });

    it('null/undefined 입력에 null을 반환해야 한다', () => {
      expect(normalizeJoinResult(null)).toBeNull();
      expect(normalizeJoinResult(undefined)).toBeNull();
    });

    it('빈 배열에 undefined를 반환해야 한다', () => {
      expect(normalizeJoinResult([])).toBeUndefined();
    });
  });

  describe('parseRpcResult', () => {
    it('성공한 배열 결과를 파싱해야 한다', () => {
      const rpcResult = [{ success: true, subscription_id: 'sub_123' }];

      const parsed = parseRpcResult(rpcResult);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.subscription_id).toBe('sub_123');
      }
    });

    it('성공한 단일 객체 결과를 파싱해야 한다', () => {
      const rpcResult = { success: true, new_balance: 150 };

      const parsed = parseRpcResult(rpcResult);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.new_balance).toBe(150);
      }
    });

    it('실패한 결과에서 에러 메시지를 추출해야 한다', () => {
      const rpcResult = [{ success: false, error_message: '잔액이 부족합니다' }];

      const parsed = parseRpcResult(rpcResult);

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error).toBe('잔액이 부족합니다');
      }
    });

    it('null 결과에 에러를 반환해야 한다', () => {
      const parsed = parseRpcResult(null);

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error).toBe('RPC 결과가 없습니다');
      }
    });

    it('error_message가 없는 실패에 기본 메시지를 반환해야 한다', () => {
      const rpcResult = { success: false };

      const parsed = parseRpcResult(rpcResult);

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error).toBe('처리에 실패했습니다');
      }
    });

    it('빈 배열에 에러를 반환해야 한다', () => {
      const parsed = parseRpcResult([]);

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error).toBe('RPC 결과가 없습니다');
      }
    });
  });

  describe('createRpcErrorResponse', () => {
    it('작업명을 포함한 에러 응답을 생성해야 한다', () => {
      const response = createRpcErrorResponse('결제 처리');

      expect(response.success).toBe(false);
      expect(response.error).toBe('결제 처리 중 오류가 발생했습니다');
    });

    it('다양한 작업명으로 에러 응답을 생성할 수 있어야 한다', () => {
      expect(createRpcErrorResponse('구독 생성').error).toBe('구독 생성 중 오류가 발생했습니다');
      expect(createRpcErrorResponse('프로필 업데이트').error).toBe('프로필 업데이트 중 오류가 발생했습니다');
    });
  });
});
