import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { RegisterForm } from '@/components/features/auth';

export const metadata: Metadata = {
  title: '회원가입',
  description: 'CodeGen AI에 가입하세요',
};

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">회원가입</CardTitle>
        <CardDescription>
          계정을 만들고 AI 코딩 교육 콘텐츠를 생성하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RegisterForm />
        <div className="text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            로그인
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
