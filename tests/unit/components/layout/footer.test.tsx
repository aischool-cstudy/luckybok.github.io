import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/footer';

// Next.js Link 모킹
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// siteConfig 모킹
vi.mock('@/config/site', () => ({
  siteConfig: {
    name: 'CodeGen AI',
    description: 'AI 코딩 교육 콘텐츠',
  },
}));

describe('Footer', () => {
  const mockYear = 2026;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(mockYear, 0, 1));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('default variant', () => {
    it('푸터가 렌더링되어야 한다', () => {
      render(<Footer />);

      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('저작권 텍스트가 표시되어야 한다', () => {
      render(<Footer />);

      expect(screen.getByText(/© 2026 CodeGen AI/)).toBeInTheDocument();
    });

    it('All rights reserved 텍스트가 표시되어야 한다', () => {
      render(<Footer />);

      expect(screen.getByText(/All rights reserved/)).toBeInTheDocument();
    });

    it('현재 연도가 표시되어야 한다', () => {
      render(<Footer />);

      expect(screen.getByText(new RegExp(mockYear.toString()))).toBeInTheDocument();
    });
  });

  describe('marketing variant', () => {
    it('마케팅 푸터가 렌더링되어야 한다', () => {
      render(<Footer variant="marketing" />);

      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('사이트 이름이 표시되어야 한다', () => {
      render(<Footer variant="marketing" />);

      expect(screen.getByRole('link', { name: 'CodeGen AI' })).toBeInTheDocument();
    });

    it('사이트 설명이 표시되어야 한다', () => {
      render(<Footer variant="marketing" />);

      expect(screen.getByText('AI 기반 코딩 교육 콘텐츠 자동 생성기')).toBeInTheDocument();
    });

    describe('제품 섹션', () => {
      it('제품 헤딩이 표시되어야 한다', () => {
        render(<Footer variant="marketing" />);

        expect(screen.getByRole('heading', { name: '제품' })).toBeInTheDocument();
      });

      it('기능 링크가 있어야 한다', () => {
        render(<Footer variant="marketing" />);

        expect(screen.getByRole('link', { name: '기능' })).toHaveAttribute('href', '/#features');
      });

      it('요금제 링크가 있어야 한다', () => {
        render(<Footer variant="marketing" />);

        expect(screen.getByRole('link', { name: '요금제' })).toHaveAttribute('href', '/pricing');
      });

      it('FAQ 링크가 있어야 한다', () => {
        render(<Footer variant="marketing" />);

        expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/#faq');
      });
    });

    describe('회사 섹션', () => {
      it('회사 헤딩이 표시되어야 한다', () => {
        render(<Footer variant="marketing" />);

        expect(screen.getByRole('heading', { name: '회사' })).toBeInTheDocument();
      });

      it('소개 링크가 있어야 한다', () => {
        render(<Footer variant="marketing" />);

        expect(screen.getByRole('link', { name: '소개' })).toHaveAttribute('href', '/about');
      });

      it('블로그 링크가 있어야 한다', () => {
        render(<Footer variant="marketing" />);

        expect(screen.getByRole('link', { name: '블로그' })).toHaveAttribute('href', '/blog');
      });

      it('문의 링크가 있어야 한다', () => {
        render(<Footer variant="marketing" />);

        expect(screen.getByRole('link', { name: '문의' })).toHaveAttribute('href', '/contact');
      });
    });

    describe('법적 고지 섹션', () => {
      it('법적 고지 헤딩이 표시되어야 한다', () => {
        render(<Footer variant="marketing" />);

        expect(screen.getByRole('heading', { name: '법적 고지' })).toBeInTheDocument();
      });

      it('이용약관 링크가 있어야 한다', () => {
        render(<Footer variant="marketing" />);

        expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/terms');
      });

      it('개인정보처리방침 링크가 있어야 한다', () => {
        render(<Footer variant="marketing" />);

        expect(screen.getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute(
          'href',
          '/privacy'
        );
      });
    });

    it('저작권 텍스트가 하단에 표시되어야 한다', () => {
      render(<Footer variant="marketing" />);

      // 마케팅 variant도 저작권 텍스트를 포함
      expect(screen.getByText(/All rights reserved/)).toBeInTheDocument();
    });
  });
});
