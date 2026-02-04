import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from '@/components/layout/header';

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

// Navigation 모킹
vi.mock('@/components/layout/navigation', () => ({
  Navigation: () => <nav data-testid="navigation">Navigation</nav>,
}));

// MobileNav 모킹
vi.mock('@/components/layout/mobile-nav', () => ({
  MobileNav: () => <nav data-testid="mobile-nav">MobileNav</nav>,
}));

// siteConfig 모킹
vi.mock('@/config/site', () => ({
  siteConfig: {
    name: 'CodeGen AI',
    description: 'AI 코딩 교육 콘텐츠',
  },
}));

describe('Header', () => {
  describe('렌더링', () => {
    it('헤더가 렌더링되어야 한다', () => {
      render(<Header />);

      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('사이트 이름이 표시되어야 한다', () => {
      render(<Header />);

      expect(screen.getByText('CodeGen AI')).toBeInTheDocument();
    });

    it('네비게이션이 포함되어야 한다', () => {
      render(<Header />);

      expect(screen.getByTestId('navigation')).toBeInTheDocument();
    });

    it('모바일 네비게이션이 포함되어야 한다', () => {
      render(<Header />);

      expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
    });
  });

  describe('로그인 사용자', () => {
    it('로그인한 사용자의 이메일이 표시되어야 한다', () => {
      const user = { email: 'test@example.com' };

      render(<Header user={user} />);

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('로그인한 사용자는 대시보드로 링크되어야 한다', () => {
      const user = { email: 'test@example.com' };

      render(<Header user={user} />);

      const logoLink = screen.getByRole('link', { name: /CodeGen AI/i });
      expect(logoLink).toHaveAttribute('href', '/dashboard');
    });
  });

  describe('비로그인 사용자 (default variant)', () => {
    it('로그인/회원가입 버튼이 표시되지 않아야 한다 (default variant)', () => {
      render(<Header variant="default" />);

      // default variant에서는 로그인/회원가입 버튼이 표시되지 않음
      expect(screen.queryByText('로그인')).not.toBeInTheDocument();
    });

    it('비로그인 시 홈으로 링크되어야 한다', () => {
      render(<Header />);

      const logoLink = screen.getByRole('link', { name: /CodeGen AI/i });
      expect(logoLink).toHaveAttribute('href', '/');
    });
  });

  describe('마케팅 variant', () => {
    it('마케팅 variant에서 AI 코딩 교육 텍스트가 표시되어야 한다', () => {
      render(<Header variant="marketing" />);

      expect(screen.getByText('AI 코딩 교육')).toBeInTheDocument();
    });

    it('마케팅 variant에서 로그인 버튼이 표시되어야 한다', () => {
      render(<Header variant="marketing" />);

      expect(screen.getByRole('link', { name: '로그인' })).toBeInTheDocument();
    });

    it('마케팅 variant에서 무료로 시작하기 버튼이 표시되어야 한다', () => {
      render(<Header variant="marketing" />);

      expect(screen.getByRole('link', { name: /무료로 시작하기/i })).toBeInTheDocument();
    });

    it('로그인 버튼이 /login으로 링크되어야 한다', () => {
      render(<Header variant="marketing" />);

      const loginLink = screen.getByRole('link', { name: '로그인' });
      expect(loginLink).toHaveAttribute('href', '/login');
    });

    it('무료로 시작하기 버튼이 /register로 링크되어야 한다', () => {
      render(<Header variant="marketing" />);

      const registerLink = screen.getByRole('link', { name: /무료로 시작하기/i });
      expect(registerLink).toHaveAttribute('href', '/register');
    });
  });

  describe('스타일', () => {
    it('sticky 포지션이어야 한다', () => {
      render(<Header />);

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('sticky');
    });

    it('backdrop blur가 적용되어야 한다', () => {
      render(<Header />);

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('backdrop-blur-md');
    });
  });
});
