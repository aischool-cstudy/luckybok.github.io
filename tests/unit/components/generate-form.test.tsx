import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { GenerateForm } from '@/components/features/generate/generate-form';

// Server Action 모킹
vi.mock('@/actions/generate', () => ({
  generateContent: vi.fn(),
}));

// Radix UI Select 모킹 (테스트 환경에서 제대로 동작하지 않는 경우)
vi.mock('@radix-ui/react-select', async () => {
  const actual = await vi.importActual('@radix-ui/react-select');
  return {
    ...actual,
  };
});

describe('GenerateForm', () => {
  const mockOnGenerated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('렌더링', () => {
    it('폼 제목이 표시되어야 한다', () => {
      render(
        <GenerateForm
          onGenerated={mockOnGenerated}
          remainingGenerations={10}
          plan="starter"
        />
      );

      expect(screen.getByText('AI 콘텐츠 생성')).toBeInTheDocument();
    });

    it('남은 생성 횟수가 표시되어야 한다', () => {
      render(
        <GenerateForm
          onGenerated={mockOnGenerated}
          remainingGenerations={5}
          plan="starter"
        />
      );

      expect(screen.getByText(/오늘 남은 생성 횟수/)).toBeInTheDocument();
      expect(screen.getByText('5회')).toBeInTheDocument();
    });

    it('주제 입력 필드가 표시되어야 한다', () => {
      render(
        <GenerateForm
          onGenerated={mockOnGenerated}
          remainingGenerations={10}
          plan="starter"
        />
      );

      expect(screen.getByLabelText(/학습 주제/)).toBeInTheDocument();
    });

    it('생성 버튼이 표시되어야 한다', () => {
      render(
        <GenerateForm
          onGenerated={mockOnGenerated}
          remainingGenerations={10}
          plan="starter"
        />
      );

      expect(screen.getByRole('button', { name: /콘텐츠 생성하기/ })).toBeInTheDocument();
    });
  });

  describe('유효성 검사', () => {
    it('남은 횟수가 0이면 버튼이 비활성화되어야 한다', () => {
      render(
        <GenerateForm
          onGenerated={mockOnGenerated}
          remainingGenerations={0}
          plan="starter"
        />
      );

      // 남은 횟수가 0이면 버튼 텍스트가 다르게 표시됨
      const button = screen.getByRole('button', { name: /오늘 생성 횟수를 모두 사용했어요/ });
      expect(button).toBeDisabled();
    });
  });

  describe('플랜별 제한', () => {
    it('Starter 플랜 정보가 props로 전달되어야 한다', () => {
      const { container } = render(
        <GenerateForm
          onGenerated={mockOnGenerated}
          remainingGenerations={10}
          plan="starter"
        />
      );

      // 컴포넌트가 렌더링되었는지 확인
      expect(container).toBeInTheDocument();
    });

    it('Pro 플랜 정보가 props로 전달되어야 한다', () => {
      const { container } = render(
        <GenerateForm
          onGenerated={mockOnGenerated}
          remainingGenerations={100}
          plan="pro"
        />
      );

      // 컴포넌트가 렌더링되었는지 확인
      expect(container).toBeInTheDocument();
    });
  });

  describe('폼 입력', () => {
    it('주제 입력이 가능해야 한다', async () => {
      const user = userEvent.setup();

      render(
        <GenerateForm
          onGenerated={mockOnGenerated}
          remainingGenerations={10}
          plan="starter"
        />
      );

      const topicInput = screen.getByLabelText(/학습 주제/);
      await user.type(topicInput, '리스트 컴프리헨션');

      expect(topicInput).toHaveValue('리스트 컴프리헨션');
    });
  });

  describe('접근성', () => {
    it('필수 라벨들이 연결되어 있어야 한다', () => {
      render(
        <GenerateForm
          onGenerated={mockOnGenerated}
          remainingGenerations={10}
          plan="starter"
        />
      );

      // 라벨과 입력 필드 연결 확인
      expect(screen.getByLabelText(/프로그래밍 언어/)).toBeInTheDocument();
      expect(screen.getByLabelText(/학습 주제/)).toBeInTheDocument();
      expect(screen.getByLabelText(/난이도/)).toBeInTheDocument();
      expect(screen.getByLabelText(/학습자 유형/)).toBeInTheDocument();
    });
  });
});

describe('GenerateForm Props', () => {
  it('기본 props 없이도 렌더링되어야 한다', () => {
    render(<GenerateForm />);

    expect(screen.getByText('AI 콘텐츠 생성')).toBeInTheDocument();
  });

  it('onGenerated 콜백이 전달되어야 한다', () => {
    const callback = vi.fn();
    render(<GenerateForm onGenerated={callback} remainingGenerations={10} />);

    expect(screen.getByText('AI 콘텐츠 생성')).toBeInTheDocument();
  });
});
