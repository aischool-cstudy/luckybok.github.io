import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkipLink } from '@/components/layout/skip-link';

describe('SkipLink', () => {
  describe('렌더링', () => {
    it('기본 텍스트로 렌더링되어야 한다', () => {
      render(<SkipLink />);

      expect(screen.getByText('메인 콘텐츠로 건너뛰기')).toBeInTheDocument();
    });

    it('커스텀 텍스트로 렌더링할 수 있어야 한다', () => {
      render(<SkipLink text="본문으로 이동" />);

      expect(screen.getByText('본문으로 이동')).toBeInTheDocument();
    });

    it('기본 타겟 ID가 main-content여야 한다', () => {
      render(<SkipLink />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '#main-content');
    });

    it('커스텀 타겟 ID를 설정할 수 있어야 한다', () => {
      render(<SkipLink targetId="content-area" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '#content-area');
    });
  });

  describe('접근성', () => {
    it('링크 요소여야 한다', () => {
      render(<SkipLink />);

      expect(screen.getByRole('link')).toBeInTheDocument();
    });

    it('sr-only 클래스가 있어야 한다 (스크린 리더 전용)', () => {
      render(<SkipLink />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('sr-only');
    });

    it('포커스 시 visible이 되어야 한다', () => {
      render(<SkipLink />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('focus:not-sr-only');
    });
  });

  describe('스타일', () => {
    it('추가 클래스명을 적용할 수 있어야 한다', () => {
      render(<SkipLink className="custom-class" />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('custom-class');
    });

    it('기본 스타일 클래스가 있어야 한다', () => {
      render(<SkipLink />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('text-sm');
      expect(link).toHaveClass('font-medium');
    });

    it('포커스 스타일 클래스가 있어야 한다', () => {
      render(<SkipLink />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('focus:fixed');
      expect(link).toHaveClass('focus:top-4');
      expect(link).toHaveClass('focus:left-4');
      expect(link).toHaveClass('focus:z-[100]');
    });

    it('포커스 링 스타일이 있어야 한다', () => {
      render(<SkipLink />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('focus:ring-2');
      expect(link).toHaveClass('focus:ring-primary');
    });
  });

  describe('Props 조합', () => {
    it('모든 props를 함께 사용할 수 있어야 한다', () => {
      render(
        <SkipLink targetId="custom-main" text="커스텀 건너뛰기" className="extra-style" />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '#custom-main');
      expect(link).toHaveTextContent('커스텀 건너뛰기');
      expect(link).toHaveClass('extra-style');
    });
  });
});
