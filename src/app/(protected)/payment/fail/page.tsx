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
import { XCircle, CreditCard, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// 결제 유형
type PaymentType = 'subscription' | 'credit';

// 결제 유형별 설정
const paymentTypeConfig: Record<PaymentType, {
  title: string;
  icon: typeof CreditCard;
  retryPath: string;
  retryLabel: string;
}> = {
  subscription: {
    title: '구독 결제 실패',
    icon: CreditCard,
    retryPath: '/payment/subscribe',
    retryLabel: '구독 다시 시도',
  },
  credit: {
    title: '크레딧 결제 실패',
    icon: Coins,
    retryPath: '/payment/credits',
    retryLabel: '크레딧 구매 다시 시도',
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
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="relative mx-auto mb-4">
            <XCircle className="h-16 w-16 text-destructive" />
            <Icon className="h-6 w-6 absolute -bottom-1 -right-1 text-muted-foreground bg-background rounded-full p-0.5" />
          </div>
          <CardTitle className="text-2xl">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div>
            <p className={isUserCanceled ? 'text-muted-foreground' : 'text-destructive font-medium'}>
              {errorMessage}
            </p>
            {additionalHelp && (
              <p className="text-sm text-muted-foreground mt-2">{additionalHelp}</p>
            )}
          </div>

          {code && !isUserCanceled && (
            <p className="text-xs text-muted-foreground">오류 코드: {code}</p>
          )}

          <div className="space-y-2 pt-2">
            <Button asChild className="w-full">
              <Link href={config.retryPath}>{config.retryLabel}</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard">대시보드로 이동</Link>
            </Button>
            {!isUserCanceled && (
              <p className="text-xs text-muted-foreground pt-2">
                문제가 계속되면{' '}
                <Link href="/support" className="text-primary hover:underline">
                  고객센터
                </Link>
                에 문의해주세요.
              </p>
            )}
          </div>
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
              <CardContent className="pt-6 text-center">
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
