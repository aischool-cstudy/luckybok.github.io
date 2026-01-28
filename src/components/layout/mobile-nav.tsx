'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui';

interface MobileNavProps {
  user?: {
    email?: string;
  } | null;
  variant?: 'default' | 'marketing';
}

const protectedLinks = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/generate', label: '콘텐츠 생성' },
  { href: '/history', label: '생성 기록' },
  { href: '/settings', label: '설정' },
];

const marketingLinks = [
  { href: '/', label: '홈' },
  { href: '/#features', label: '기능' },
  { href: '/pricing', label: '요금제' },
  { href: '/#faq', label: 'FAQ' },
];

export function MobileNav({ user, variant = 'default' }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const links = user ? protectedLinks : variant === 'marketing' ? marketingLinks : [];

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2"
        aria-label="메뉴 열기"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="fixed inset-x-4 top-20 z-50 rounded-lg border bg-background p-4 shadow-lg">
            <nav className="flex flex-col gap-1">
              {links.map((link) => {
                const isActive =
                  pathname === link.href || pathname.startsWith(link.href + '/');

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      'px-4 py-3 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}

              {!user && (
                <div className="mt-4 pt-4 border-t flex flex-col gap-2">
                  <Link
                    href="/login"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-3 text-center rounded-md text-sm font-medium border hover:bg-muted transition-colors"
                  >
                    로그인
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-3 text-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    무료로 시작하기
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
