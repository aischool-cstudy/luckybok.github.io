'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { logClientError } from '@/lib/client-logger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 구조화된 에러 로깅 (민감 정보 마스킹 포함)
    logClientError(error, 'PageError');
  }, [error]);

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
      <div className="relative">
        {/* Background Effects */}
        <div className="absolute -inset-20 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10 blur-3xl rounded-full" />

        <div className="relative text-center max-w-md mx-auto">
          {/* Error Icon */}
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-red-500 to-orange-500 shadow-xl shadow-red-500/30">
                <AlertTriangle className="h-12 w-12 text-white" />
              </div>
            </div>
          </div>

          {/* Error Message */}
          <h2 className="text-3xl font-bold mb-3">문제가 발생했습니다</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            예상치 못한 오류가 발생했습니다.<br />
            잠시 후 다시 시도해 주세요.
          </p>

          {/* Error Digest (Development) */}
          {process.env.NODE_ENV === 'development' && error.digest && (
            <div className="mb-6 p-3 rounded-xl bg-muted/50 border">
              <p className="font-mono text-xs text-muted-foreground">
                Error: {error.digest}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => reset()}
              className="w-full sm:w-auto bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-lg shadow-red-500/25"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              다시 시도
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                홈으로 이동
              </Link>
            </Button>
          </div>

          {/* Help Link */}
          <p className="mt-8 text-sm text-muted-foreground flex items-center justify-center gap-1">
            <HelpCircle className="h-3.5 w-3.5" />
            문제가 계속되면{' '}
            <a href="mailto:support@codegen.ai" className="text-primary hover:underline">
              고객 지원
            </a>
            에 문의하세요
          </p>
        </div>
      </div>
    </div>
  );
}
