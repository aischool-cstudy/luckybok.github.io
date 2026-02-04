'use client';

/**
 * 결제 실패 페이지
 *
 * URL 파라미터:
 * - type: 'subscription' | 'credit' (결제 유형)
 * - code: 토스페이먼츠 에러 코드
 * - message: 에러 메시지
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle, CreditCard, Coins, AlertTriangle, RefreshCw, Home, Loader2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// 결제 유형
type PaymentType = 'subscription' | 'credit';

// 결제 유형별 설정
const paymentTypeConfig: Record<PaymentType, {
  title: string;
  icon: typeof CreditCard;
  iconColor: string;
  bgColor: string;
  retryPath: string;
  retryLabel: string;
}> = {
  subscription: {
    title: '구독 결제 실패',
    icon: CreditCard,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    retryPath: '/payment/subscribe',
    retryLabel: '다시 시도하기',
  },
  credit: {
    title: '크레딧 결제 실패',
    icon: Coins,
    iconColor: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    retryPath: '/payment/credits',
    retryLabel: '다시 시도하기',
  },
};

// 토스페이먼츠 에러 코드별 메시지
const errorMessages: Record<string, string> = {
  // 사용자 취소/중단
  PAY_PROCESS_CANCELED: '결제가 취소되었습니다.',
  PAY_PROCESS_ABORTED: '결제가 중단되었습니다.',
  USER_CANCEL: '사용자가 결제를 취소했습니다.',

  // 카드 관련 에러
  REJECT_CARD_COMPANY: '카드사에서 결제를 거절했습니다. 다른 카드를 사용해주세요.',
  INVALID_CARD_NUMBER: '유효하지 않은 카드 번호입니다.',
  INVALID_CARD_EXPIRATION: '카드 유효기간이 만료되었습니다.',
  INVALID_STOPPED_CARD: '정지된 카드입니다. 카드사에 문의해주세요.',
  EXCEED_MAX_AMOUNT: '결제 한도를 초과했습니다. 카드사에 문의하거나 다른 카드를 사용해주세요.',
  INVALID_PASSWORD: '카드 비밀번호가 올바르지 않습니다.',
  NOT_SUPPORTED_CARD: '지원하지 않는 카드입니다. 다른 카드를 사용해주세요.',
  RESTRICTED_CARD: '사용이 제한된 카드입니다.',

  // 시스템 에러
  FAILED_INTERNAL_SYSTEM_PROCESSING: '결제 시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  FAILED_TOSS_INTERNAL_SYSTEM: '토스 결제 시스템 오류가 발생했습니다.',

  // 빌링 관련 에러 (구독)
  INVALID_BILLING_KEY: '유효하지 않은 빌링키입니다. 카드를 다시 등록해주세요.',
  EXPIRED_BILLING_KEY: '빌링키가 만료되었습니다. 카드를 다시 등록해주세요.',
};

// 에러 유형별 추가 안내
const getAdditionalHelp = (code: string, type: PaymentType): string | null => {
  // 사용자 취소인 경우 추가 안내 없음
  if (['PAY_PROCESS_CANCELED', 'PAY_PROCESS_ABORTED', 'USER_CANCEL'].includes(code)) {
    return null;
  }

  // 카드 관련 에러인 경우
  if (code.includes('CARD') || code.includes('REJECT')) {
    return '문제가 지속되면 카드사 고객센터에 문의해주세요.';
  }

  // 빌링 관련 에러 (구독)
  if (type === 'subscription' && code.includes('BILLING')) {
    return '설정 > 결제 수단에서 카드를 다시 등록해주세요.';
  }

  return null;
};

function PaymentFailContent() {
  const searchParams = useSearchParams();
  const type = (searchParams.get('type') as PaymentType) || 'credit';
  const code = searchParams.get('code') || '';
  const message = searchParams.get('message') || '';

  const config = paymentTypeConfig[type] || paymentTypeConfig.credit;
  const errorMessage = errorMessages[code] || message || '알 수 없는 오류가 발생했습니다.';
  const additionalHelp = getAdditionalHelp(code, type);
  const Icon = config.icon;

  // 사용자가 취소한 경우인지 확인
  const isUserCanceled = ['PAY_PROCESS_CANCELED', 'PAY_PROCESS_ABORTED', 'USER_CANCEL'].includes(code);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-md overflow-hidden shadow-xl">
        {/* 상단 컬러 바 */}
        <div className={cn(
          'h-2',
          isUserCanceled
            ? 'bg-gradient-to-r from-slate-400 to-slate-500'
            : 'bg-gradient-to-r from-red-500 to-rose-500'
        )} />

        <CardHeader className="text-center pt-10">
          <div className="relative mx-auto mb-8">
            {/* 배경 글로우 효과 */}
            <div className={cn(
              'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
              'w-40 h-40 rounded-full blur-3xl opacity-15 -z-10',
              isUserCanceled ? 'bg-slate-500' : 'bg-red-500'
            )} />

            {/* 메인 아이콘 */}
            <div className={cn(
              'w-24 h-24 rounded-2xl flex items-center justify-center',
              isUserCanceled
                ? 'bg-slate-100 dark:bg-slate-800'
                : 'bg-red-100 dark:bg-red-900/30'
            )}>
              {isUserCanceled ? (
                <XCircle className="h-12 w-12 text-slate-500" />
              ) : (
                <AlertTriangle className="h-12 w-12 text-red-500" />
              )}
            </div>

            {/* 결제 유형 뱃지 */}
            <div className={cn(
              'absolute -bottom-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg',
              config.bgColor, 'border-2 border-background'
            )}>
              <Icon className={cn('h-5 w-5', config.iconColor)} />
            </div>
          </div>

          <CardTitle className="text-2xl font-bold">
            {isUserCanceled ? '결제가 취소되었습니다' : config.title}
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            {isUserCanceled ? '언제든 다시 시도할 수 있어요' : '결제 과정에서 문제가 발생했습니다'}
          </p>
        </CardHeader>

        <CardContent className="text-center space-y-6 pb-8">
          {/* 에러 메시지 */}
          <div className={cn(
            'p-5 rounded-xl border',
            isUserCanceled
              ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
          )}>
            <p className={cn(
              'font-medium',
              isUserCanceled ? 'text-slate-600 dark:text-slate-400' : 'text-red-600 dark:text-red-400'
            )}>
              {errorMessage}
            </p>
            {additionalHelp && (
              <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-current/10">
                {additionalHelp}
              </p>
            )}
          </div>

          {/* 에러 코드 */}
          {code && !isUserCanceled && (
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted px-4 py-2 rounded-full">
              <span className="font-mono">오류 코드: {code}</span>
            </div>
          )}

          {/* 버튼 */}
          <div className="space-y-3 pt-2">
            <Button
              asChild
              className={cn(
                'w-full h-12 text-base font-semibold',
                !isUserCanceled && 'bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg'
              )}
              size="lg"
            >
              <Link href={config.retryPath}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {config.retryLabel}
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full h-11">
              <Link href="/dashboard">
                <Home className="h-4 w-4 mr-2" />
                대시보드로 이동
              </Link>
            </Button>
          </div>

          {/* 고객센터 안내 */}
          {!isUserCanceled && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-4 border-t">
              <HelpCircle className="h-4 w-4" />
              <span>
                문제가 계속되면{' '}
                <Link href="/support" className="text-primary hover:underline font-medium">
                  고객센터
                </Link>
                에 문의해주세요
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Suspense
        fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <Card className="w-full max-w-md">
              <CardContent className="pt-8 pb-8 text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">로딩 중...</p>
              </CardContent>
            </Card>
          </div>
        }
      >
        <PaymentFailContent />
      </Suspense>
    </div>
  );
}
