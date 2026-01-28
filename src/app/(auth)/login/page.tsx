import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { LoginForm } from '@/components/features/auth';

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
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">로그인</CardTitle>
        <CardDescription>
          이메일과 비밀번호로 로그인하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm redirectTo={redirectTo} />
        <div className="text-center text-sm text-muted-foreground">
          아직 계정이 없으신가요?{' '}
          <Link href="/register" className="text-primary underline-offset-4 hover:underline">
            회원가입
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
