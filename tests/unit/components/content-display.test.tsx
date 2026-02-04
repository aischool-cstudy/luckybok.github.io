import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { ContentDisplay } from '@/components/features/generate/content-display';
import type { GeneratedContent } from '@/lib/ai/schemas';

const mockContent: GeneratedContent = {
  title: 'Python 리스트 컴프리헨션 완벽 가이드',
  learningObjectives: [
    '리스트 컴프리헨션의 기본 문법을 이해한다',
    '일반 for 루프와 리스트 컴프리헨션을 비교할 수 있다',
    '조건문을 포함한 리스트 컴프리헨션을 작성할 수 있다',
  ],
  explanation:
    '리스트 컴프리헨션은 기존 리스트를 기반으로 새로운 리스트를 만드는 간결한 방법입니다.',
  codeExample:
    '```python\n# 기본 리스트 컴프리헨션\nnumbers = [1, 2, 3, 4, 5]\nsquares = [x**2 for x in numbers]\n```',
  exercises: [
    {
      question: '1부터 10까지의 짝수만 포함하는 리스트를 컴프리헨션으로 작성하세요.',
      hint: 'if 조건문을 사용하세요.',
      difficulty: 'easy',
    },
    {
      question: '문자열 리스트에서 길이가 3보다 큰 문자열만 대문자로 변환하세요.',
      difficulty: 'medium',
    },
    {
      question: '중첩 리스트를 평탄화하는 리스트 컴프리헨션을 작성하세요.',
      difficulty: 'hard',
    },
  ],
  summary:
    '리스트 컴프리헨션은 Python에서 리스트를 생성하는 간결하고 가독성 높은 방법입니다.',
  estimatedReadTime: 10,
};

describe('ContentDisplay', () => {
  describe('렌더링', () => {
    it('제목이 표시되어야 한다', () => {
      render(<ContentDisplay content={mockContent} />);

      expect(
        screen.getByText('Python 리스트 컴프리헨션 완벽 가이드')
      ).toBeInTheDocument();
    });

    it('예상 읽기 시간이 표시되어야 한다', () => {
      render(<ContentDisplay content={mockContent} />);

      expect(screen.getByText(/읽기 시간: 10분/)).toBeInTheDocument();
    });

    it('학습 목표가 표시되어야 한다', () => {
      render(<ContentDisplay content={mockContent} />);

      expect(screen.getByText('학습 목표')).toBeInTheDocument();
      expect(
        screen.getByText(/리스트 컴프리헨션의 기본 문법을 이해한다/)
      ).toBeInTheDocument();
    });

    it('핵심 개념이 표시되어야 한다', () => {
      render(<ContentDisplay content={mockContent} />);

      expect(screen.getByText('핵심 개념')).toBeInTheDocument();
      expect(
        screen.getByText(/리스트 컴프리헨션은 기존 리스트를 기반으로/)
      ).toBeInTheDocument();
    });

    it('예제 코드가 표시되어야 한다', () => {
      render(<ContentDisplay content={mockContent} />);

      expect(screen.getByText('예제 코드')).toBeInTheDocument();
      expect(screen.getByText(/numbers = \[1, 2, 3, 4, 5\]/)).toBeInTheDocument();
    });

    it('핵심 요약이 표시되어야 한다', () => {
      render(<ContentDisplay content={mockContent} />);

      expect(screen.getByText('핵심 요약')).toBeInTheDocument();
    });
  });

  describe('탭 전환', () => {
    it('학습 콘텐츠 탭이 기본으로 선택되어야 한다', () => {
      render(<ContentDisplay content={mockContent} />);

      // 학습 콘텐츠 탭이 활성화되어 있는지 확인 (text-primary 클래스)
      const contentTab = screen.getByRole('button', { name: /학습 콘텐츠/ });
      expect(contentTab).toHaveClass('text-primary');
    });

    it('퀴즈 탭으로 전환할 수 있어야 한다', async () => {
      const user = userEvent.setup();
      render(<ContentDisplay content={mockContent} />);

      const quizTab = screen.getByRole('button', { name: /퀴즈/ });
      await user.click(quizTab);

      // 퀴즈 문제가 표시되어야 함
      expect(screen.getByText('문제 1')).toBeInTheDocument();
    });

    it('퀴즈 탭에 문제 수가 표시되어야 한다', () => {
      render(<ContentDisplay content={mockContent} />);

      // 퀴즈 탭에 Badge로 문제 수 표시
      const quizTab = screen.getByRole('button', { name: /퀴즈/ });
      expect(quizTab).toBeInTheDocument();
      // 퀴즈 탭 내에 exercises 수(3)가 있는지 확인
      expect(quizTab.textContent).toContain('3');
    });
  });

  describe('퀴즈 카드', () => {
    it('퀴즈 탭에서 모든 문제가 표시되어야 한다', async () => {
      const user = userEvent.setup();
      render(<ContentDisplay content={mockContent} />);

      await user.click(screen.getByRole('button', { name: /퀴즈/ }));

      expect(screen.getByText('문제 1')).toBeInTheDocument();
      expect(screen.getByText('문제 2')).toBeInTheDocument();
      expect(screen.getByText('문제 3')).toBeInTheDocument();
    });

    it('난이도 배지가 표시되어야 한다', async () => {
      const user = userEvent.setup();
      render(<ContentDisplay content={mockContent} />);

      await user.click(screen.getByRole('button', { name: /퀴즈/ }));

      expect(screen.getByText('쉬움')).toBeInTheDocument();
      expect(screen.getByText('보통')).toBeInTheDocument();
      expect(screen.getByText('어려움')).toBeInTheDocument();
    });

    it('힌트 토글이 동작해야 한다', async () => {
      const user = userEvent.setup();
      render(<ContentDisplay content={mockContent} />);

      await user.click(screen.getByRole('button', { name: /퀴즈/ }));

      // 힌트 보기 버튼 클릭
      const hintButton = screen.getByRole('button', { name: /힌트 보기/ });
      await user.click(hintButton);

      // 힌트 내용이 표시되어야 함
      expect(screen.getByText(/if 조건문을 사용하세요/)).toBeInTheDocument();
    });
  });

  describe('스트리밍 상태', () => {
    it('스트리밍 중일 때 로딩 표시가 나타나야 한다', () => {
      render(<ContentDisplay content={{}} isStreaming={true} />);

      expect(
        screen.getByText(/AI가 콘텐츠를 생성하고 있어요/)
      ).toBeInTheDocument();
    });

    it('스트리밍이 완료되면 로딩 표시가 사라져야 한다', () => {
      render(<ContentDisplay content={mockContent} isStreaming={false} />);

      expect(
        screen.queryByText(/AI가 콘텐츠를 생성하고 있어요/)
      ).not.toBeInTheDocument();
    });
  });

  describe('부분 콘텐츠', () => {
    it('부분 콘텐츠일 때 스켈레톤이 표시되어야 한다', () => {
      const partialContent = {
        title: 'Python 리스트 컴프리헨션',
        // 나머지 필드 없음
      };

      render(<ContentDisplay content={partialContent} isStreaming={true} />);

      // 제목은 표시되어야 함
      expect(screen.getByText('Python 리스트 컴프리헨션')).toBeInTheDocument();

      // 스켈레톤 (애니메이션 로딩)이 존재해야 함
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('빈 콘텐츠', () => {
    it('빈 콘텐츠에서도 에러 없이 렌더링되어야 한다', () => {
      render(<ContentDisplay content={{}} />);

      // 탭 버튼은 표시되어야 함
      expect(screen.getByRole('button', { name: /학습 콘텐츠/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /퀴즈/ })).toBeInTheDocument();
    });
  });
});
