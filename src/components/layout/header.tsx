import Link from 'next/link';
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
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {siteConfig.name}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <Navigation user={user} variant={variant} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:block">
                {user.email}
              </span>
              {/* LogoutButton은 클라이언트 컴포넌트라 직접 import하지 않음 */}
            </>
          ) : isMarketing ? (
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
              >
                로그인
              </Link>
              <Link
                href="/register"
                className="text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors"
              >
                무료로 시작하기
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
