import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus, Gift, Check, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/ui';
import { RegisterForm } from '@/components/features/auth';

// 정적 폼 캐싱: 24시간
export const revalidate = 86400;

export const metadata: Metadata = {
  title: '회원가입',
  description: 'CodeGen AI에 가입하세요',
};

export default function RegisterPage() {
  return (
    <Card className="overflow-hidden border-0 shadow-xl">
      {/* Gradient Header */}
      <div className="h-2 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500" />

      <CardHeader className="space-y-4 pb-6 pt-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10">
          <UserPlus className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">무료로 시작하기</CardTitle>
          <CardDescription className="mt-2">
            계정을 만들고 AI 코딩 교육 콘텐츠를 생성하세요
          </CardDescription>
        </div>

        {/* Free Plan Benefits */}
        <div className="flex items-center justify-center gap-2">
          <Badge className="gap-1.5 bg-gradient-to-r from-green-500 to-emerald-500 border-0">
            <Gift className="h-3 w-3" />
            무료 플랜 포함
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pb-8">
        {/* Free Plan Features */}
        <div className="rounded-xl bg-gradient-to-br from-green-500/5 to-emerald-500/5 p-4">
          <p className="text-sm font-medium mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-green-600" />
            가입하면 바로 사용 가능
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-500" />
              일일 10회 생성
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-500" />
              Python 지원
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-500" />
              기본 템플릿
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-500" />
              무제한 저장
            </span>
          </div>
        </div>

        <RegisterForm />

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
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline underline-offset-4">
            로그인
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
