import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

// ────────────────────────────────────────────────────────────
// 모킹 설정
// ────────────────────────────────────────────────────────────

// Supabase 클라이언트 모킹
const mockFrom = vi.fn();
const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
  from: mockFrom,
};

// 체이닝 헬퍼
function createChainMock(options: {
  data?: unknown;
  error?: unknown;
  count?: number;
} = {}) {
  const chain: Record<string, Mock> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.range = vi.fn().mockResolvedValue({
    data: options.data ?? null,
    error: options.error ?? null,
    count: options.count ?? 0,
  });
  chain.single = vi.fn().mockResolvedValue({
    data: options.data ?? null,
    error: options.error ?? null,
  });
  return chain;
}

// Auth 모킹
const mockRequireAuth = vi.fn();
const mockGetAuthUser = vi.fn();

vi.mock('@/lib/auth', () => ({
  requireAuth: () => mockRequireAuth(),
  getAuthUser: () => mockGetAuthUser(),
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthError';
    }
  },
}));

// Next.js 모킹
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Logger 모킹
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
}));

// ────────────────────────────────────────────────────────────
// 테스트 데이터
// ────────────────────────────────────────────────────────────

const mockUser = { id: 'user-123', email: 'test@example.com' };

const mockContent = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  user_id: 'user-123',
  language: 'python',
  topic: 'Python 리스트',
  difficulty: 'beginner',
  target_audience: 'non_tech',
  title: 'Python 리스트 완벽 가이드',
  content: '{"title": "Python 리스트"}',
  code_examples: '```python\ncode\n```',
  model_used: 'llama-3.3-70b',
  generation_time_ms: 1500,
  created_at: '2024-01-15T10:00:00Z',
};

const mockContents = [
  { ...mockContent, id: '1', created_at: '2024-01-15' },
  { ...mockContent, id: '2', language: 'javascript', created_at: '2024-01-14' },
  { ...mockContent, id: '3', difficulty: 'intermediate', created_at: '2024-01-13' },
];

// ────────────────────────────────────────────────────────────
// 테스트
// ────────────────────────────────────────────────────────────

describe('getContentById Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('성공 케이스', () => {
    it('로그인한 사용자의 콘텐츠를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: mockContent });
      mockFrom.mockReturnValue(chain);

      const { getContentById } = await import('@/actions/history');
      const result = await getContentById('550e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(mockContent.id);
        expect(result.data.title).toBe(mockContent.title);
        expect(result.data.language).toBe(mockContent.language);
      }
    });

    it('user_id 조건이 쿼리에 포함되어야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: mockContent });
      mockFrom.mockReturnValue(chain);

      const { getContentById } = await import('@/actions/history');
      await getContentById('550e8400-e29b-41d4-a716-446655440000');

      // eq가 id와 user_id 모두에 대해 호출되었는지 확인
      expect(chain.eq).toHaveBeenCalledWith('id', '550e8400-e29b-41d4-a716-446655440000');
      expect(chain.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });
  });

  describe('실패 케이스', () => {
    it('비로그인 사용자를 거부해야 한다', async () => {
      const { AuthError } = await import('@/lib/auth');
      mockRequireAuth.mockRejectedValue(new AuthError('로그인이 필요합니다'));

      const { getContentById } = await import('@/actions/history');
      const result = await getContentById('550e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('로그인이 필요합니다');
      }
    });

    it('존재하지 않는 콘텐츠에 에러를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: null, error: { message: 'Not found' } });
      mockFrom.mockReturnValue(chain);

      const { getContentById } = await import('@/actions/history');
      const result = await getContentById('non-existent-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('콘텐츠를 찾을 수 없습니다');
      }
    });

    it('다른 사용자의 콘텐츠 접근을 거부해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      // user_id가 다르면 Supabase에서 null 반환
      const chain = createChainMock({ data: null });
      mockFrom.mockReturnValue(chain);

      const { getContentById } = await import('@/actions/history');
      const result = await getContentById('other-user-content-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('콘텐츠를 찾을 수 없습니다');
      }
    });
  });
});

describe('deleteContent Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('성공 케이스', () => {
    it('콘텐츠 삭제가 성공해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      // delete().eq().eq() 체이닝을 위한 모킹
      const chain: Record<string, Mock> = {};
      chain.delete = vi.fn().mockReturnValue(chain);
      // eq가 두 번 연속 호출되어도 체인 반환
      chain.eq = vi.fn().mockImplementation(() => {
        // 마지막 호출은 Promise 반환
        return Object.assign(Promise.resolve({ error: null }), chain);
      });
      mockFrom.mockReturnValue(chain);

      const { deleteContent } = await import('@/actions/history');
      const result = await deleteContent('550e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(true);
    });

    it('삭제 후 revalidatePath가 호출되어야 한다', async () => {
      const { revalidatePath } = await import('next/cache');
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain: Record<string, Mock> = {};
      chain.delete = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockImplementation(() => {
        return Object.assign(Promise.resolve({ error: null }), chain);
      });
      mockFrom.mockReturnValue(chain);

      const { deleteContent } = await import('@/actions/history');
      await deleteContent('550e8400-e29b-41d4-a716-446655440000');

      expect(revalidatePath).toHaveBeenCalledWith('/history');
    });

    it('user_id 조건이 삭제 쿼리에 포함되어야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain: Record<string, Mock> = {};
      chain.delete = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockImplementation(() => {
        return Object.assign(Promise.resolve({ error: null }), chain);
      });
      mockFrom.mockReturnValue(chain);

      const { deleteContent } = await import('@/actions/history');
      await deleteContent('content-id');

      // id와 user_id 모두 체크
      expect(chain.eq).toHaveBeenCalledWith('id', 'content-id');
      expect(chain.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });
  });

  describe('실패 케이스', () => {
    it('비로그인 사용자를 거부해야 한다', async () => {
      const { AuthError } = await import('@/lib/auth');
      mockRequireAuth.mockRejectedValue(new AuthError('로그인이 필요합니다'));

      const { deleteContent } = await import('@/actions/history');
      const result = await deleteContent('content-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('로그인이 필요합니다');
      }
    });

    it('DB 에러 시 에러를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain: Record<string, Mock> = {};
      chain.delete = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockImplementation(() => {
        return Object.assign(Promise.resolve({ error: { message: 'DB Error' } }), chain);
      });
      mockFrom.mockReturnValue(chain);

      const { deleteContent } = await import('@/actions/history');
      const result = await deleteContent('content-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('삭제에 실패했습니다');
      }
    });
  });
});

describe('getFilteredHistory Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('기본 조회', () => {
    it('로그인한 사용자의 히스토리를 반환해야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: mockContents, count: 3 });
      mockFrom.mockReturnValue(chain);

      const { getFilteredHistory } = await import('@/actions/history');
      const result = await getFilteredHistory();

      expect(result.contents).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.totalPages).toBe(1);
    });

    it('비로그인 사용자는 빈 결과를 반환해야 한다', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const { getFilteredHistory } = await import('@/actions/history');
      const result = await getFilteredHistory();

      expect(result.contents).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('페이지네이션', () => {
    it('기본 페이지네이션 (1페이지, 10개)이 적용되어야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: mockContents, count: 50 });
      mockFrom.mockReturnValue(chain);

      const { getFilteredHistory } = await import('@/actions/history');
      const result = await getFilteredHistory();

      expect(chain.range).toHaveBeenCalledWith(0, 9); // offset 0, limit 10
      expect(result.totalPages).toBe(5); // 50 / 10 = 5
    });

    it('2페이지 조회 시 올바른 offset이 적용되어야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: [], count: 50 });
      mockFrom.mockReturnValue(chain);

      const { getFilteredHistory } = await import('@/actions/history');
      await getFilteredHistory(2, 10);

      expect(chain.range).toHaveBeenCalledWith(10, 19); // offset 10
    });

    it('커스텀 limit이 적용되어야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: [], count: 100 });
      mockFrom.mockReturnValue(chain);

      const { getFilteredHistory } = await import('@/actions/history');
      const result = await getFilteredHistory(1, 20);

      expect(chain.range).toHaveBeenCalledWith(0, 19);
      expect(result.totalPages).toBe(5); // 100 / 20 = 5
    });

    it('3페이지, 15개씩 조회 시 올바르게 계산되어야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: [], count: 100 });
      mockFrom.mockReturnValue(chain);

      const { getFilteredHistory } = await import('@/actions/history');
      await getFilteredHistory(3, 15);

      // (3-1) * 15 = 30, range(30, 44)
      expect(chain.range).toHaveBeenCalledWith(30, 44);
    });
  });

  describe('필터링', () => {
    it('언어 필터가 적용되어야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: [mockContents[0]], count: 1 });
      mockFrom.mockReturnValue(chain);

      const { getFilteredHistory } = await import('@/actions/history');
      await getFilteredHistory(1, 10, { language: 'python' });

      expect(chain.eq).toHaveBeenCalledWith('language', 'python');
    });

    it('난이도 필터가 소문자로 변환되어 적용되어야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: [], count: 0 });
      mockFrom.mockReturnValue(chain);

      const { getFilteredHistory } = await import('@/actions/history');
      await getFilteredHistory(1, 10, { difficulty: 'BEGINNER' });

      expect(chain.eq).toHaveBeenCalledWith('difficulty', 'beginner');
    });

    it('언어와 난이도 필터가 동시에 적용되어야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: [], count: 0 });
      mockFrom.mockReturnValue(chain);

      const { getFilteredHistory } = await import('@/actions/history');
      await getFilteredHistory(1, 10, { language: 'javascript', difficulty: 'intermediate' });

      expect(chain.eq).toHaveBeenCalledWith('language', 'javascript');
      expect(chain.eq).toHaveBeenCalledWith('difficulty', 'intermediate');
    });

    it('빈 필터 객체는 무시되어야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: mockContents, count: 3 });
      mockFrom.mockReturnValue(chain);

      const { getFilteredHistory } = await import('@/actions/history');
      await getFilteredHistory(1, 10, {});

      // user_id만 eq 호출되어야 함
      expect(chain.eq).toHaveBeenCalledTimes(1);
      expect(chain.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });
  });

  describe('정렬', () => {
    it('created_at 내림차순 정렬이 적용되어야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: mockContents, count: 3 });
      mockFrom.mockReturnValue(chain);

      const { getFilteredHistory } = await import('@/actions/history');
      await getFilteredHistory();

      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });

  describe('에러 처리', () => {
    it('DB 에러 시 빈 결과를 반환해야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: null, error: { message: 'DB Error' }, count: 0 });
      mockFrom.mockReturnValue(chain);

      const { getFilteredHistory } = await import('@/actions/history');
      const result = await getFilteredHistory();

      expect(result.contents).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('totalPages 계산', () => {
    it('정확한 페이지 수를 계산해야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      // 25개 아이템, 10개씩 → 3페이지
      const chain = createChainMock({ data: [], count: 25 });
      mockFrom.mockReturnValue(chain);

      const { getFilteredHistory } = await import('@/actions/history');
      const result = await getFilteredHistory(1, 10);

      expect(result.totalPages).toBe(3); // Math.ceil(25 / 10) = 3
    });

    it('아이템이 0개면 0페이지여야 한다', async () => {
      mockGetAuthUser.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const chain = createChainMock({ data: [], count: 0 });
      mockFrom.mockReturnValue(chain);

      const { getFilteredHistory } = await import('@/actions/history');
      const result = await getFilteredHistory();

      expect(result.totalPages).toBe(0);
    });
  });
});
