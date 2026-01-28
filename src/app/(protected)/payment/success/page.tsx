'use client';

/**
 * 결제 성공 페이지
 */

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { confirmCreditPayment } from '@/actions/payment';
import { confirmSubscription } from '@/actions/subscription';
import { useToast } from '@/hooks/use-toast';
import type { PlanType, BillingCycle } from '@/types/payment.types';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resultMessage, setResultMessage] = useState('');

  useEffect(() => {
    const processPayment = async () => {
      const type = searchParams.get('type');
      const paymentKey = searchParams.get('paymentKey');
      const orderId = searchParams.get('orderId');
      const amount = searchParams.get('amount');

      // 크레딧 구매
      if (type === 'credit' && paymentKey && orderId && amount) {
        const result = await confirmCreditPayment({
          paymentKey,
          orderId,
          amount: parseInt(amount, 10),
        });

        if (result.success && result.data) {
          setIsSuccess(true);
          setResultMessage(`${result.data.credits}개의 크레딧이 충전되었습니다. 현재 잔액: ${result.data.balance}개`);
        } else {
          setIsSuccess(false);
          setResultMessage(result.error || '결제 처리에 실패했습니다');
          toast({
            title: '오류',
            description: result.error || '결제 처리에 실패했습니다',
            variant: 'destructive',
          });
        }
      }
      // 구독 결제
      else if (type === 'subscription') {
        const authKey = searchParams.get('authKey');
        const customerKey = searchParams.get('customerKey');
        const plan = searchParams.get('plan') as PlanType;
        const billingCycle = searchParams.get('billingCycle') as BillingCycle;

        if (!authKey || !customerKey || !orderId || !plan || !billingCycle) {
          setIsSuccess(false);
          setResultMessage('필수 정보가 누락되었습니다');
          setIsProcessing(false);
          return;
        }

        const result = await confirmSubscription({
          authKey,
          customerKey,
          orderId,
          plan: plan as 'pro' | 'team' | 'enterprise',
          billingCycle,
        });

        if (result.success) {
          setIsSuccess(true);
          setResultMessage(`${plan.toUpperCase()} 플랜 구독이 시작되었습니다!`);
        } else {
          setIsSuccess(false);
          setResultMessage(result.error || '구독 처리에 실패했습니다');
          toast({
            title: '오류',
            description: result.error || '구독 처리에 실패했습니다',
            variant: 'destructive',
          });
        }
      } else {
        setIsSuccess(false);
        setResultMessage('잘못된 접근입니다');
      }

      setIsProcessing(false);
    };

    processPayment();
  }, [searchParams, toast]);

  if (isProcessing) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <p className="text-lg font-medium">결제를 처리하고 있습니다...</p>
            <p className="text-muted-foreground mt-2">잠시만 기다려주세요.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {isSuccess ? (
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-destructive/10 mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl">!</span>
            </div>
          )}
          <CardTitle className="text-2xl">
            {isSuccess ? '결제 완료!' : '결제 처리 실패'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-6">{resultMessage}</p>
          <div className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/dashboard">대시보드로 이동</Link>
            </Button>
            {!isSuccess && (
              <Button asChild variant="outline" className="w-full">
                <Link href="/payment/credits">다시 시도</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Suspense
        fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <Card className="w-full max-w-md">
              <CardContent className="pt-6 text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
                <p className="text-lg font-medium">로딩 중...</p>
              </CardContent>
            </Card>
          </div>
        }
      >
        <PaymentSuccessContent />
      </Suspense>
    </div>
  );
}
