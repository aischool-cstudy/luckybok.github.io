'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

interface NavigationProps {
  user?: {
    email?: string;
  } | null;
  variant?: 'default' | 'marketing';
}

const protectedLinks = [
  { href: '/generate', label: '콘텐츠 생성' },
  { href: '/history', label: '생성 기록' },
  { href: '/settings', label: '설정' },
];

const marketingLinks = [
  { href: '/#features', label: '기능' },
  { href: '/pricing', label: '요금제' },
  { href: '/#faq', label: 'FAQ' },
];

export function Navigation({ user, variant = 'default' }: NavigationProps) {
  const pathname = usePathname();
  const links = user ? protectedLinks : variant === 'marketing' ? marketingLinks : [];

  return (
    <nav className="flex items-center gap-1">
      {links.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(link.href + '/');

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'text-sm font-medium px-3 py-2 rounded-md transition-colors',
              isActive
                ? 'text-foreground bg-muted'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
