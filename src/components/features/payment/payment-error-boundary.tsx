'use client';

/**
 * 결제 페이지 전용 에러 바운더리
 * - 사용자 친화적 에러 UI
 * - 재시도 버튼
 * - 고객지원 링크
 * - 에러 로깅 (Sentry 연동 준비)
 */

import { Component, type ReactNode } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Home,
  MessageCircle,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { logClientError } from '@/lib/client-logger';

interface PaymentErrorBoundaryProps {
  children: ReactNode;
  /** 에러 발생 시 표시할 제목 */
  title?: string;
  /** 에러 발생 시 표시할 설명 */
  description?: string;
  /** 재시도 버튼 클릭 시 호출할 함수 */
  onRetry?: () => void;
  /** 폴백 컴포넌트 */
  fallback?: ReactNode;
}

interface PaymentErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

export class PaymentErrorBoundary extends Component<
  PaymentErrorBoundaryProps,
  PaymentErrorBoundaryState
> {
  constructor(props: PaymentErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<PaymentErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 에러 상태 업데이트
    this.setState({ errorInfo });

    // 에러 로깅 (client-logger + Sentry 연동)
    logClientError(error, 'PaymentErrorBoundary');

    // TODO: Sentry 연동
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     extra: { componentStack: errorInfo.componentStack },
    //     tags: { type: 'payment_error_boundary' },
    //   });
    // }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    this.props.onRetry?.();
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // 커스텀 폴백이 제공된 경우
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, showDetails } = this.state;
      const {
        title = '결제 페이지를 불러올 수 없습니다',
        description = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      } = this.props;

      return (
        <div
          className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-red-50/50 via-background to-orange-50/50 dark:from-red-950/20 dark:to-orange-950/20"
          role="alert"
          aria-live="assertive"
        >
          <Card className="max-w-md w-full overflow-hidden shadow-xl">
            {/* 상단 그라데이션 바 */}
            <div className="h-2 bg-gradient-to-r from-red-500 via-rose-500 to-orange-500" />

            <CardHeader className="text-center pt-10 pb-4">
              <div className="relative mx-auto mb-6">
                {/* 배경 글로우 효과 */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full blur-3xl opacity-20 bg-red-500 -z-10" />

                {/* 메인 아이콘 */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/40 dark:to-orange-900/40 flex items-center justify-center shadow-lg">
                  <AlertTriangle
                    className="h-10 w-10 text-red-500"
                    aria-hidden="true"
                  />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              <p className="text-muted-foreground mt-2">{description}</p>
            </CardHeader>

            <CardContent className="space-y-6 pb-8">
              {/* 에러 메시지 박스 */}
              <div className="p-5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                <p className="text-red-600 dark:text-red-400 font-medium text-center">
                  결제 페이지를 표시할 수 없습니다.
                </p>
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  네트워크 연결을 확인하고 다시 시도해주세요.
                </p>
              </div>

              {/* 에러 코드 표시 */}
              {error && (
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-2 text-xs font-mono bg-muted px-4 py-2 rounded-full text-muted-foreground">
                    에러 코드: {error.name || 'UNKNOWN_ERROR'}
                  </span>
                </div>
              )}

              {/* 액션 버튼들 */}
              <div className="space-y-3 pt-2">
                <Button
                  onClick={this.handleRetry}
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg"
                  size="lg"
                  aria-label="페이지 다시 시도"
                >
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                  다시 시도
                </Button>

                <Button variant="outline" asChild className="w-full h-11">
                  <Link href="/dashboard" aria-label="대시보드로 이동">
                    <Home className="h-4 w-4 mr-2" aria-hidden="true" />
                    대시보드로 돌아가기
                  </Link>
                </Button>
              </div>

              {/* 개발자용 에러 상세 정보 (토글) */}
              {process.env.NODE_ENV === 'development' && error && (
                <div className="pt-4 border-t">
                  <button
                    onClick={this.toggleDetails}
                    className="flex items-center justify-center gap-1 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                    aria-expanded={showDetails}
                    aria-controls="error-details"
                  >
                    기술적 상세 정보
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${
                        showDetails ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {showDetails && (
                    <div
                      id="error-details"
                      className="mt-3 p-3 bg-muted/50 rounded-lg text-xs font-mono overflow-auto max-h-40"
                    >
                      <p className="text-red-600 dark:text-red-400 font-semibold mb-2 break-words">
                        {error.message}
                      </p>
                      {errorInfo?.componentStack && (
                        <pre className="text-muted-foreground whitespace-pre-wrap break-words text-[10px]">
                          {errorInfo.componentStack.split('\n').slice(0, 8).join('\n')}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 고객 지원 안내 */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-4 border-t">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                <span>
                  문제가 계속되면{' '}
                  <a
                    href="mailto:support@codegen.ai"
                    className="text-primary hover:underline font-medium"
                    aria-label="고객지원 이메일 보내기"
                  >
                    고객센터
                  </a>
                  에 문의해주세요
                </span>
              </div>
            </CardContent>

            <CardFooter className="justify-center pt-0 pb-6">
              <p className="text-xs text-muted-foreground">
                CodeGen AI • 안전한 결제 서비스
              </p>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 함수형 컴포넌트용 래퍼
 */
export function withPaymentErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<PaymentErrorBoundaryProps, 'children'>
) {
  return function WithPaymentErrorBoundary(props: P) {
    return (
      <PaymentErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </PaymentErrorBoundary>
    );
  };
}

export default PaymentErrorBoundary;
