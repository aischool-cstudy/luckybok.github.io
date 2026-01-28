'use client';

/**
 * 결제 실패 페이지
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// 토스페이먼츠 에러 코드별 메시지
const errorMessages: Record<string, string> = {
  PAY_PROCESS_CANCELED: '결제가 취소되었습니다.',
  PAY_PROCESS_ABORTED: '결제가 중단되었습니다.',
  REJECT_CARD_COMPANY: '카드사에서 결제를 거절했습니다.',
  INVALID_CARD_NUMBER: '유효하지 않은 카드 번호입니다.',
  INVALID_CARD_EXPIRATION: '카드 유효기간이 만료되었습니다.',
  INVALID_STOPPED_CARD: '정지된 카드입니다.',
  EXCEED_MAX_AMOUNT: '결제 한도를 초과했습니다.',
  INVALID_PASSWORD: '카드 비밀번호가 올바르지 않습니다.',
  NOT_SUPPORTED_CARD: '지원하지 않는 카드입니다.',
  FAILED_INTERNAL_SYSTEM_PROCESSING: '결제 시스템 오류가 발생했습니다.',
};

function PaymentFailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '';
  const message = searchParams.get('message') || '';

  const errorMessage = errorMessages[code] || message || '알 수 없는 오류가 발생했습니다.';

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <CardTitle className="text-2xl">결제 실패</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-2">{errorMessage}</p>
          {code && (
            <p className="text-xs text-muted-foreground mb-6">오류 코드: {code}</p>
          )}
          <div className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/payment/credits">다시 시도</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard">대시보드로 이동</Link>
            </Button>
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
