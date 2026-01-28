'use client';

import { useEffect } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 에러 로깅 (프로덕션에서는 Sentry 등으로 전송)
    console.error('대시보드 페이지 에러:', error);
  }, [error]);

  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">대시보드 로딩 오류</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            대시보드를 불러오는 중 문제가 발생했습니다.
            <br />
            인터넷 연결을 확인하고 다시 시도해주세요.
          </p>

          {error.digest && (
            <p className="text-center text-xs text-muted-foreground">
              오류 코드: {error.digest}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={reset} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              다시 시도
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <a href="/login">
                <LogOut className="mr-2 h-4 w-4" />
                다시 로그인
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
