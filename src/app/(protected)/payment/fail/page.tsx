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
      <Card className="w-full max-w-md overflow-hidden">
        {/* 상단 컬러 바 */}
        <div className={cn(
          'h-2',
          isUserCanceled ? 'bg-muted-foreground' : 'bg-destructive'
        )} />

        <CardHeader className="text-center pt-8">
          <div className="relative mx-auto mb-6">
            {/* 배경 글로우 효과 */}
            <div className={cn(
              'absolute inset-0 blur-2xl opacity-30 -z-10 rounded-full',
              isUserCanceled ? 'bg-muted-foreground' : 'bg-destructive'
            )} />

            {/* 메인 아이콘 */}
            <div className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center',
              isUserCanceled ? 'bg-muted' : 'bg-destructive/10'
            )}>
              {isUserCanceled ? (
                <XCircle className="h-10 w-10 text-muted-foreground" />
              ) : (
                <AlertTriangle className="h-10 w-10 text-destructive" />
              )}
            </div>

            {/* 결제 유형 뱃지 */}
            <div className={cn(
              'absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center',
              config.bgColor
            )}>
              <Icon className={cn('h-4 w-4', config.iconColor)} />
            </div>
          </div>

          <CardTitle className="text-2xl">
            {isUserCanceled ? '결제가 취소되었습니다' : config.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="text-center space-y-6 pb-8">
          {/* 에러 메시지 */}
          <div className={cn(
            'p-4 rounded-lg',
            isUserCanceled ? 'bg-muted' : 'bg-destructive/5'
          )}>
            <p className={cn(
              'font-medium',
              isUserCanceled ? 'text-muted-foreground' : 'text-destructive'
            )}>
              {errorMessage}
            </p>
            {additionalHelp && (
              <p className="text-sm text-muted-foreground mt-2">{additionalHelp}</p>
            )}
          </div>

          {/* 에러 코드 */}
          {code && !isUserCanceled && (
            <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-1 rounded inline-block">
              오류 코드: {code}
            </p>
          )}

          {/* 버튼 */}
          <div className="space-y-3 pt-2">
            <Button asChild className="w-full gap-2" size="lg">
              <Link href={config.retryPath}>
                <RefreshCw className="h-4 w-4" />
                {config.retryLabel}
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full gap-2">
              <Link href="/dashboard">
                <Home className="h-4 w-4" />
                대시보드로 이동
              </Link>
            </Button>
          </div>

          {/* 고객센터 안내 */}
          {!isUserCanceled && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
              <HelpCircle className="h-4 w-4" />
              <span>
                문제가 계속되면{' '}
                <Link href="/support" className="text-primary hover:underline font-medium">
                  고객센터
                </Link>
                에 문의해주세요.
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
