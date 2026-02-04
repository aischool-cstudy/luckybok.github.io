import Link from 'next/link';
import { Code2, Sparkles, ArrowRight } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { Navigation } from './navigation';
import { MobileNav } from './mobile-nav';

interface HeaderProps {
  user?: {
    email?: string;
  } | null;
  variant?: 'default' | 'marketing';
}

export function Header({ user, variant = 'default' }: HeaderProps) {
  const isMarketing = variant === 'marketing';

  return (
    <header
      role="banner"
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            href={user ? '/dashboard' : '/'}
            className="flex items-center gap-2.5 group"
            aria-label={`${siteConfig.name} - ${user ? '대시보드로 이동' : '홈으로 이동'}`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-600 shadow-md shadow-primary/20 group-hover:shadow-lg group-hover:shadow-primary/30 transition-shadow">
              <Code2 className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                {siteConfig.name}
              </span>
              {isMarketing && (
                <span className="text-[10px] text-muted-foreground hidden sm:flex items-center gap-0.5 -mt-0.5">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                  AI 코딩 교육
                </span>
              )}
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:block" aria-label="데스크탑 네비게이션">
            <Navigation user={user} variant={variant} />
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:block px-3 py-1.5 rounded-full bg-muted/50">
                {user.email}
              </span>
            </>
          ) : isMarketing ? (
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-muted"
              >
                로그인
              </Link>
              <Link
                href="/register"
                className="text-sm font-medium bg-gradient-to-r from-primary to-purple-600 text-primary-foreground hover:from-primary/90 hover:to-purple-600/90 px-4 py-2 rounded-lg transition-all shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 flex items-center gap-1.5"
              >
                무료로 시작하기
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : null}

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <MobileNav user={user} variant={variant} />
          </div>
        </div>
      </div>
    </header>
  );
}
