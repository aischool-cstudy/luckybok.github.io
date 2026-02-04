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
function createChainMock(finalValue: unknown = null, finalError: unknown = null) {
  const chain: Record<string, Mock> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: finalValue, error: finalError });
  return chain;
}

// Auth 모킹
const mockRequireAuth = vi.fn();
vi.mock('@/lib/auth', () => ({
  requireAuth: () => mockRequireAuth(),
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthError';
    }
  },
}));

// History Utils 모킹
const mockParseContentJson = vi.fn();
vi.mock('@/lib/history-utils', () => ({
  parseContentJson: (content: string) => mockParseContentJson(content),
}));

// PDF 라이브러리 모킹
const mockRenderToBuffer = vi.fn();
const mockRegisterFonts = vi.fn();
const mockContentTemplate = vi.fn();

vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: () => mockRenderToBuffer(),
}));

vi.mock('@/lib/pdf', () => ({
  registerFonts: () => mockRegisterFonts(),
  ContentTemplate: (props: unknown) => mockContentTemplate(props),
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

const mockContentData = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  user_id: 'user-123',
  language: 'python',
  topic: 'Python 리스트',
  difficulty: 'beginner',
  target_audience: 'non_tech',
  title: 'Python 리스트 완벽 가이드',
  content: JSON.stringify({
    title: 'Python 리스트 완벽 가이드',
    learningObjectives: ['목표1', '목표2', '목표3'],
    explanation: '설명',
    codeExample: '```python\ncode\n```',
    exercises: [],
    summary: '요약',
  }),
  created_at: '2024-01-15T10:00:00Z',
};

const mockParsedContent = {
  title: 'Python 리스트 완벽 가이드',
  learningObjectives: ['목표1', '목표2', '목표3'],
  explanation: '설명',
  codeExample: '```python\ncode\n```',
  exercises: [],
  summary: '요약',
};

// ────────────────────────────────────────────────────────────
// 테스트
// ────────────────────────────────────────────────────────────

describe('exportContentToPDF Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('입력 검증', () => {
    it('유효하지 않은 UUID 형식을 거부해야 한다', async () => {
      const { exportContentToPDF } = await import('@/actions/export');
      const result = await exportContentToPDF({ contentId: 'invalid-id' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('유효하지 않은 콘텐츠 ID');
      }
    });

    it('빈 contentId를 거부해야 한다', async () => {
      const { exportContentToPDF } = await import('@/actions/export');
      const result = await exportContentToPDF({ contentId: '' });

      expect(result.success).toBe(false);
    });
  });

  describe('인증 체크', () => {
    it('비로그인 사용자를 거부해야 한다', async () => {
      const { AuthError } = await import('@/lib/auth');
      mockRequireAuth.mockRejectedValue(new AuthError('로그인이 필요합니다'));

      const { exportContentToPDF } = await import('@/actions/export');
      const result = await exportContentToPDF({
        contentId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('로그인이 필요합니다');
      }
    });
  });

  describe('플랜 체크', () => {
    it('Starter 플랜 사용자를 거부해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const profileChain = createChainMock({ plan: 'starter' });
      mockFrom.mockReturnValue(profileChain);

      const { exportContentToPDF } = await import('@/actions/export');
      const result = await exportContentToPDF({
        contentId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Pro 플랜 이상에서 사용');
      }
    });

    it('Pro 플랜 사용자를 허용해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockParseContentJson.mockReturnValue(mockParsedContent);
      mockRenderToBuffer.mockResolvedValue(Buffer.from('PDF content'));

      // 프로필 조회 → 콘텐츠 조회 순서
      const profileChain = createChainMock({ plan: 'pro' });
      const contentChain = createChainMock(mockContentData);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain;
        return contentChain;
      });

      const { exportContentToPDF } = await import('@/actions/export');
      const result = await exportContentToPDF({
        contentId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(true);
    });

    it('Team 플랜 사용자를 허용해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockParseContentJson.mockReturnValue(mockParsedContent);
      mockRenderToBuffer.mockResolvedValue(Buffer.from('PDF content'));

      const profileChain = createChainMock({ plan: 'team' });
      const contentChain = createChainMock(mockContentData);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain;
        return contentChain;
      });

      const { exportContentToPDF } = await import('@/actions/export');
      const result = await exportContentToPDF({
        contentId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(true);
    });

    it('Enterprise 플랜 사용자를 허용해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockParseContentJson.mockReturnValue(mockParsedContent);
      mockRenderToBuffer.mockResolvedValue(Buffer.from('PDF content'));

      const profileChain = createChainMock({ plan: 'enterprise' });
      const contentChain = createChainMock(mockContentData);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain;
        return contentChain;
      });

      const { exportContentToPDF } = await import('@/actions/export');
      const result = await exportContentToPDF({
        contentId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('콘텐츠 소유권 검증', () => {
    it('다른 사용자의 콘텐츠 접근을 거부해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const profileChain = createChainMock({ plan: 'pro' });
      const contentChain = createChainMock(null); // 소유권 검증 실패 (user_id가 다름)

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain;
        return contentChain;
      });

      const { exportContentToPDF } = await import('@/actions/export');
      const result = await exportContentToPDF({
        contentId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('콘텐츠를 찾을 수 없습니다');
      }
    });

    it('존재하지 않는 콘텐츠 접근을 거부해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const profileChain = createChainMock({ plan: 'pro' });
      const contentChain = createChainMock(null, { message: 'Not found' });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain;
        return contentChain;
      });

      const { exportContentToPDF } = await import('@/actions/export');
      const result = await exportContentToPDF({
        contentId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('콘텐츠를 찾을 수 없습니다');
      }
    });
  });

  describe('JSON 파싱', () => {
    it('유효하지 않은 JSON 콘텐츠를 처리해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockParseContentJson.mockReturnValue(null); // 파싱 실패

      const profileChain = createChainMock({ plan: 'pro' });
      const contentChain = createChainMock({
        ...mockContentData,
        content: 'invalid json',
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain;
        return contentChain;
      });

      const { exportContentToPDF } = await import('@/actions/export');
      const result = await exportContentToPDF({
        contentId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('콘텐츠 형식이 올바르지 않습니다');
      }
    });
  });

  describe('PDF 렌더링', () => {
    it('PDF 렌더링 성공 시 버퍼와 파일명을 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockParseContentJson.mockReturnValue(mockParsedContent);
      mockRenderToBuffer.mockResolvedValue(Buffer.from('PDF content'));

      const profileChain = createChainMock({ plan: 'pro' });
      const contentChain = createChainMock(mockContentData);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain;
        return contentChain;
      });

      const { exportContentToPDF } = await import('@/actions/export');
      const result = await exportContentToPDF({
        contentId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.pdf).toBeInstanceOf(Uint8Array);
        expect(result.filename).toMatch(/^CodeGen_.*\.pdf$/);
        expect(result.filename).toContain('Python_리스트');
      }
    });

    it('PDF 렌더링 실패를 처리해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockParseContentJson.mockReturnValue(mockParsedContent);
      mockRenderToBuffer.mockRejectedValue(new Error('PDF render failed'));

      const profileChain = createChainMock({ plan: 'pro' });
      const contentChain = createChainMock(mockContentData);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain;
        return contentChain;
      });

      const { exportContentToPDF } = await import('@/actions/export');
      const result = await exportContentToPDF({
        contentId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('PDF 생성 중 오류');
      }
    });

    it('폰트 등록 함수가 호출되어야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockParseContentJson.mockReturnValue(mockParsedContent);
      mockRenderToBuffer.mockResolvedValue(Buffer.from('PDF content'));

      const profileChain = createChainMock({ plan: 'pro' });
      const contentChain = createChainMock(mockContentData);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain;
        return contentChain;
      });

      const { exportContentToPDF } = await import('@/actions/export');
      await exportContentToPDF({
        contentId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(mockRegisterFonts).toHaveBeenCalled();
    });
  });

  describe('파일명 생성', () => {
    it('특수문자가 제거된 파일명을 생성해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockParseContentJson.mockReturnValue({
        ...mockParsedContent,
        title: 'Python <script>리스트</script> & 튜플!!!',
      });
      mockRenderToBuffer.mockResolvedValue(Buffer.from('PDF content'));

      const profileChain = createChainMock({ plan: 'pro' });
      const contentChain = createChainMock({
        ...mockContentData,
        topic: 'Python <script>리스트</script>',
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain;
        return contentChain;
      });

      const { exportContentToPDF } = await import('@/actions/export');
      const result = await exportContentToPDF({
        contentId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // 특수문자가 제거되어야 함
        expect(result.filename).not.toContain('<');
        expect(result.filename).not.toContain('>');
        expect(result.filename).not.toContain('&');
        expect(result.filename).not.toContain('!');
      }
    });

    it('50자 이상의 제목이 잘려야 한다', async () => {
      const longTitle = '아주 긴 제목'.repeat(20); // 60자 이상
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });
      mockParseContentJson.mockReturnValue({
        ...mockParsedContent,
        title: longTitle,
      });
      mockRenderToBuffer.mockResolvedValue(Buffer.from('PDF content'));

      const profileChain = createChainMock({ plan: 'pro' });
      const contentChain = createChainMock({
        ...mockContentData,
        title: longTitle,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain;
        return contentChain;
      });

      const { exportContentToPDF } = await import('@/actions/export');
      const result = await exportContentToPDF({
        contentId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // 파일명이 적절한 길이로 제한되어야 함
        expect(result.filename.length).toBeLessThan(100);
      }
    });
  });

  describe('프로필 조회 실패', () => {
    it('프로필이 없으면 에러를 반환해야 한다', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabaseClient });

      const profileChain = createChainMock(null, { message: 'Profile not found' });
      mockFrom.mockReturnValue(profileChain);

      const { exportContentToPDF } = await import('@/actions/export');
      const result = await exportContentToPDF({
        contentId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('사용자 정보를 찾을 수 없습니다');
      }
    });
  });
});
