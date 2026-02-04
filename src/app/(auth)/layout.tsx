import Link from 'next/link';
import { Code2, Sparkles } from 'lucide-react';
import { siteConfig } from '@/config/site';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

      {/* Logo */}
      <Link href="/" className="relative z-10 mb-8 flex items-center gap-3 group">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-600 shadow-lg shadow-primary/25 group-hover:shadow-xl group-hover:shadow-primary/30 transition-shadow">
          <Code2 className="h-6 w-6 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            {siteConfig.name}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            AI 코딩 교육 플랫폼
          </span>
        </div>
      </Link>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">{children}</div>

      {/* Footer */}
      <p className="relative z-10 mt-8 text-center text-xs text-muted-foreground">
        계속 진행하면 <Link href="/terms" className="underline hover:text-primary">이용약관</Link> 및{' '}
        <Link href="/privacy" className="underline hover:text-primary">개인정보처리방침</Link>에 동의하게 됩니다.
      </p>
    </div>
  );
}
