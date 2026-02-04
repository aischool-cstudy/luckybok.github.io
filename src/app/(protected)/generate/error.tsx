'use client';

import { useEffect } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { captureError } from '@/lib/client-logger';

export default function GenerateError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry로 에러 전송
    captureError(error, {
      component: 'GeneratePage',
      action: 'load',
    });
  }, [error]);

  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">오류가 발생했습니다</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            콘텐츠 생성 페이지를 불러오는 중 문제가 발생했습니다.
            <br />
            잠시 후 다시 시도해주세요.
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
            <Button variant="outline" asChild className="flex-1">
              <Link href="/dashboard">
                <Home className="mr-2 h-4 w-4" />
                대시보드로
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
