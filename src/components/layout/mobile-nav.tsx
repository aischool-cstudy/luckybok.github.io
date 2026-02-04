'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LayoutDashboard, Sparkles, History, Settings, Home, Layers, CreditCard, HelpCircle, ArrowRight, LogIn } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui';

interface MobileNavProps {
  user?: {
    email?: string;
  } | null;
  variant?: 'default' | 'marketing';
}

const protectedLinks = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/generate', label: '콘텐츠 생성', icon: Sparkles },
  { href: '/history', label: '생성 기록', icon: History },
  { href: '/settings', label: '설정', icon: Settings },
];

const marketingLinks = [
  { href: '/', label: '홈', icon: Home },
  { href: '/#features', label: '기능', icon: Layers },
  { href: '/pricing', label: '요금제', icon: CreditCard },
  { href: '/#faq', label: 'FAQ', icon: HelpCircle },
];

export function MobileNav({ user, variant = 'default' }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const links = user ? protectedLinks : variant === 'marketing' ? marketingLinks : [];

  // ESC 키로 메뉴 닫기
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen) {
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  }, [isOpen]);

  // 메뉴 외부 클릭 시 닫기 및 키보드 이벤트 등록
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // 메뉴 열릴 때 첫 번째 링크에 포커스
      const firstLink = menuRef.current?.querySelector('a');
      firstLink?.focus();
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-2 rounded-lg transition-colors",
          isOpen && "bg-muted"
        )}
        aria-label={isOpen ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={isOpen}
        aria-controls="mobile-menu"
      >
        {isOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </Button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Menu */}
          <div
            ref={menuRef}
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="모바일 메뉴"
            className="fixed inset-x-4 top-20 z-50 rounded-2xl border bg-background/95 backdrop-blur-md p-4 shadow-xl animate-in slide-in-from-top-2 duration-200"
          >
            <nav aria-label="모바일 네비게이션" className="flex flex-col gap-1">
              {links.map((link) => {
                const isActive =
                  pathname === link.href || pathname.startsWith(link.href + '/');
                const Icon = link.icon;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                      isActive
                        ? 'bg-gradient-to-r from-primary to-purple-600 text-primary-foreground shadow-md'
                        : 'hover:bg-muted'
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-muted-foreground")} aria-hidden="true" />
                    {link.label}
                  </Link>
                );
              })}

              {!user && (
                <div className="mt-4 pt-4 border-t flex flex-col gap-2">
                  <Link
                    href="/login"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border hover:bg-muted transition-colors"
                  >
                    <LogIn className="h-4 w-4" />
                    로그인
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-primary to-purple-600 text-primary-foreground hover:from-primary/90 hover:to-purple-600/90 transition-all shadow-md"
                  >
                    무료로 시작하기
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
