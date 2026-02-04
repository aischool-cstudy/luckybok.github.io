import type { Metadata } from 'next';
import Link from 'next/link';
import { LogIn, Shield, Zap, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/ui';
import { LoginForm } from '@/components/features/auth';

// 정적 폼 캐싱: 24시간
export const revalidate = 86400;

export const metadata: Metadata = {
  title: '로그인',
  description: 'CodeGen AI에 로그인하세요',
};

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirectTo } = await searchParams;

  return (
    <Card className="overflow-hidden border-0 shadow-xl">
      {/* Gradient Header */}
      <div className="h-2 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />

      <CardHeader className="space-y-4 pb-6 pt-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10">
          <LogIn className="h-8 w-8 text-primary" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">다시 오신 것을 환영합니다</CardTitle>
          <CardDescription className="mt-2">
            이메일과 비밀번호로 로그인하세요
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pb-8">
        <LoginForm redirectTo={redirectTo} />

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">또는</span>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          아직 계정이 없으신가요?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline underline-offset-4">
            무료로 시작하기
          </Link>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Badge variant="secondary" className="gap-1.5 bg-green-500/10 text-green-600 dark:text-green-400">
            <Shield className="h-3 w-3" />
            안전한 로그인
          </Badge>
          <Badge variant="secondary" className="gap-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Zap className="h-3 w-3" />
            빠른 접속
          </Badge>
          <Badge variant="secondary" className="gap-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Clock className="h-3 w-3" />
            자동 로그인
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
