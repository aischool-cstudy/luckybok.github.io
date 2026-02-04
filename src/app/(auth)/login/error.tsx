'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui';
import { logClientError } from '@/lib/client-logger';

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logClientError(error, 'LoginError');
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
      <div className="relative text-center max-w-md mx-auto">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500">
            <AlertTriangle className="h-8 w-8 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-2">로그인 페이지 오류</h2>
        <p className="text-muted-foreground mb-6">
          로그인 페이지를 불러오는 중 문제가 발생했습니다.
          <br />
          잠시 후 다시 시도해 주세요.
        </p>

        {process.env.NODE_ENV === 'development' && error.digest && (
          <div className="mb-4 p-2 rounded-lg bg-muted/50 border">
            <p className="font-mono text-xs text-muted-foreground">Error: {error.digest}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button onClick={() => reset()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            다시 시도
          </Button>
          <Button asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              홈으로 이동
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
