'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import {
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Home,
  HelpCircle,
  ChevronDown,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { captureError } from '@/lib/client-logger';
import { cn } from '@/lib/utils';

export default function SubscribeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    captureError(error, {
      component: 'SubscribePage',
      action: 'load',
    });
  }, [error]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    reset();
    setIsRetrying(false);
  };

  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md overflow-hidden shadow-xl">
        {/* 상단 그라데이션 바 */}
        <div className="h-2 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500" />

        <CardHeader className="text-center pt-10">
          <div className="relative mx-auto mb-6">
            {/* 배경 글로우 효과 */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full blur-3xl opacity-20 bg-red-500 -z-10" />

            {/* 메인 아이콘 */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/40 dark:to-orange-900/40 flex items-center justify-center shadow-lg">
              <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>

            {/* 구독 뱃지 */}
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shadow-md border-2 border-background">
              <CreditCard className="h-4 w-4 text-blue-500" />
            </div>
          </div>

          <CardTitle className="text-2xl font-bold">구독 페이지 오류</CardTitle>
          <p className="text-muted-foreground mt-2">
            페이지를 불러오는 중 문제가 발생했습니다
          </p>
        </CardHeader>

        <CardContent className="space-y-6 pb-8">
          {/* 에러 메시지 박스 */}
          <div className="p-5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
            <p className="text-red-600 dark:text-red-400 font-medium text-center">
              구독 정보를 불러올 수 없습니다.
            </p>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              네트워크 연결을 확인하고 다시 시도해주세요.
            </p>
          </div>

          {/* 에러 코드 */}
          {error.digest && (
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted px-4 py-2 rounded-full font-mono">
                오류 코드: {error.digest}
              </span>
            </div>
          )}

          {/* 버튼 그룹 */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-lg"
              size="lg"
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isRetrying ? '다시 시도 중...' : '다시 시도'}
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" asChild className="h-11">
                <Link href="/pricing">
                  <CreditCard className="h-4 w-4 mr-2" />
                  요금제 보기
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-11">
                <Link href="/dashboard">
                  <Home className="h-4 w-4 mr-2" />
                  대시보드
                </Link>
              </Button>
            </div>
          </div>

          {/* 개발 환경 디버그 정보 */}
          {process.env.NODE_ENV === 'development' && error.message && (
            <div className="pt-4 border-t">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center justify-center gap-1 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                기술적 상세 정보
                <ChevronDown className={cn(
                  'h-3 w-3 transition-transform',
                  showDetails && 'rotate-180'
                )} />
              </button>

              {showDetails && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg text-xs font-mono overflow-auto max-h-32">
                  <p className="text-red-600 dark:text-red-400 break-words">
                    {error.message}
                  </p>
                  {error.stack && (
                    <pre className="text-muted-foreground whitespace-pre-wrap break-words mt-2 text-[10px]">
                      {error.stack.split('\n').slice(0, 5).join('\n')}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 고객센터 안내 */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-4 border-t">
            <HelpCircle className="h-4 w-4" />
            <span>
              문제가 계속되면{' '}
              <a
                href="mailto:support@codegen.ai"
                className="text-primary hover:underline font-medium"
              >
                고객센터
              </a>
              에 문의해주세요
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
