'use client';

/**
 * 결제 수단 추가 실패 페이지
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle, CreditCard, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// 에러 코드별 메시지
const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  PAY_PROCESS_CANCELED: {
    title: '카드 등록이 취소되었습니다',
    description: '사용자가 등록을 취소했습니다. 다시 시도해주세요.',
  },
  PAY_PROCESS_ABORTED: {
    title: '카드 등록이 중단되었습니다',
    description: '등록 과정에서 문제가 발생했습니다.',
  },
  REJECT_CARD_COMPANY: {
    title: '카드사에서 거절했습니다',
    description: '카드사 정책에 따라 등록이 거절되었습니다. 다른 카드를 사용해주세요.',
  },
  INVALID_CARD_NUMBER: {
    title: '유효하지 않은 카드 번호',
    description: '카드 번호를 다시 확인해주세요.',
  },
  INVALID_CARD_EXPIRATION: {
    title: '유효기간 오류',
    description: '카드 유효기간을 다시 확인해주세요.',
  },
  EXCEED_MAX_CARD_INSTALLMENT_PLAN: {
    title: '할부 개월 수 초과',
    description: '할부 가능 개월 수를 초과했습니다.',
  },
  NOT_SUPPORTED_CARD: {
    title: '지원하지 않는 카드',
    description: '해당 카드는 등록이 지원되지 않습니다.',
  },
};

function AddPaymentMethodFailContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('code') || 'UNKNOWN_ERROR';
  const errorMessage = searchParams.get('message') || '알 수 없는 오류가 발생했습니다';

  const errorInfo = ERROR_MESSAGES[errorCode] || {
    title: '카드 등록에 실패했습니다',
    description: errorMessage,
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-md overflow-hidden">
        {/* 상단 에러 바 */}
        <div className="h-2 bg-destructive" />

        <CardHeader className="text-center pt-8">
          <div className="relative">
            {/* 배경 효과 */}
            <div className="absolute inset-0 blur-2xl opacity-20 -z-10 bg-destructive" />

            {/* 아이콘 */}
            <div className="relative mx-auto mb-6">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <CreditCard className="h-10 w-10 text-destructive" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-destructive rounded-full flex items-center justify-center">
                <XCircle className="h-5 w-5 text-white" />
              </div>
            </div>

            <CardTitle className="text-2xl">{errorInfo.title}</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="text-center space-y-6 pb-8">
          {/* 에러 설명 */}
          <p className="text-muted-foreground">{errorInfo.description}</p>

          {/* 에러 코드 표시 */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span>에러 코드: {errorCode}</span>
            </div>
          </div>

          {/* 도움말 */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>문제가 계속되면 다음을 확인해주세요:</p>
            <ul className="list-disc list-inside text-left space-y-1 mt-2">
              <li>카드 정보가 정확한지 확인</li>
              <li>카드 한도가 충분한지 확인</li>
              <li>해외 결제가 차단되어 있지 않은지 확인</li>
            </ul>
          </div>

          {/* 액션 버튼 */}
          <div className="space-y-2">
            <Button asChild className="w-full" size="lg">
              <Link href="/settings/payment-methods/add">다시 시도</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/settings">설정으로 돌아가기</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AddPaymentMethodFailPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Suspense
        fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <Card className="w-full max-w-md">
              <CardContent className="pt-8 pb-8 text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
                <p className="text-lg font-medium">로딩 중...</p>
              </CardContent>
            </Card>
          </div>
        }
      >
        <AddPaymentMethodFailContent />
      </Suspense>
    </div>
  );
}
