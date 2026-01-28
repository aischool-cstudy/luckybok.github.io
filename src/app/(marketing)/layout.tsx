import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { Footer, Navigation, MobileNav } from '@/components/layout';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {siteConfig.name}
              </span>
            </Link>
            <div className="hidden md:block">
              <Navigation variant="marketing" />
            </div>
          </div>
          <div className="flex items-center gap-4">
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
            <div className="md:hidden">
              <MobileNav variant="marketing" />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer variant="marketing" />
    </div>
  );
}
