'use client';

/**
 * 결제 성공 페이지
 *
 * URL 파라미터:
 * - type: 'subscription' | 'credit' (결제 유형)
 * - paymentKey, orderId, amount (크레딧 결제)
 * - authKey, customerKey, orderId, plan, billingCycle (구독 결제)
 */

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Loader2, CreditCard, Coins, Sparkles, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { confirmCreditPayment } from '@/actions/payment';
import { confirmSubscription } from '@/actions/subscription';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { PlanType, BillingCycle } from '@/types/payment.types';

// 결제 유형
type PaymentType = 'subscription' | 'credit';

// 결제 유형별 설정
const paymentTypeConfig: Record<PaymentType, {
  icon: typeof CreditCard;
  successTitle: string;
  processingTitle: string;
  iconColor: string;
  bgColor: string;
  retryPath: string;
}> = {
  subscription: {
    icon: CreditCard,
    successTitle: '구독 시작!',
    processingTitle: '구독을 처리하고 있습니다...',
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    retryPath: '/payment/subscribe',
  },
  credit: {
    icon: Coins,
    successTitle: '충전 완료!',
    processingTitle: '크레딧을 충전하고 있습니다...',
    iconColor: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    retryPath: '/payment/credits',
  },
};

// 플랜별 표시명
const planDisplayNames: Record<string, string> = {
  pro: 'Pro',
  team: 'Team',
  enterprise: 'Enterprise',
};

// 결제 주기 표시명
const billingCycleNames: Record<string, string> = {
  monthly: '월간',
  yearly: '연간',
};

interface PaymentResult {
  type: PaymentType;
  success: boolean;
  message: string;
  details?: {
    plan?: string;
    billingCycle?: string;
    credits?: number;
    balance?: number;
  };
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [showConfetti, setShowConfetti] = useState(false);

  const type = (searchParams.get('type') as PaymentType) || 'credit';
  const config = paymentTypeConfig[type] || paymentTypeConfig.credit;
  const Icon = config.icon;

  useEffect(() => {
    const processPayment = async () => {
      const paymentKey = searchParams.get('paymentKey');
      const orderId = searchParams.get('orderId');
      const amount = searchParams.get('amount');

      // 크레딧 구매
      if (type === 'credit' && paymentKey && orderId && amount) {
        const response = await confirmCreditPayment({
          paymentKey,
          orderId,
          amount: parseInt(amount, 10),
        });

        if (response.success && response.data) {
          setResult({
            type: 'credit',
            success: true,
            message: '크레딧이 성공적으로 충전되었습니다!',
            details: {
              credits: response.data.credits,
              balance: response.data.balance,
            },
          });
          setShowConfetti(true);
        } else {
          setResult({
            type: 'credit',
            success: false,
            message: response.error || '결제 처리에 실패했습니다',
          });
          toast({
            title: '오류',
            description: response.error || '결제 처리에 실패했습니다',
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
          setResult({
            type: 'subscription',
            success: false,
            message: '필수 정보가 누락되었습니다',
          });
          setIsProcessing(false);
          return;
        }

        const response = await confirmSubscription({
          authKey,
          customerKey,
          orderId,
          plan: plan as 'pro' | 'team' | 'enterprise',
          billingCycle,
        });

        if (response.success) {
          setResult({
            type: 'subscription',
            success: true,
            message: '구독이 성공적으로 시작되었습니다!',
            details: {
              plan,
              billingCycle,
            },
          });
          setShowConfetti(true);
        } else {
          setResult({
            type: 'subscription',
            success: false,
            message: response.error || '구독 처리에 실패했습니다',
          });
          toast({
            title: '오류',
            description: response.error || '구독 처리에 실패했습니다',
            variant: 'destructive',
          });
        }
      } else {
        setResult({
          type: 'credit',
          success: false,
          message: '잘못된 접근입니다',
        });
      }

      setIsProcessing(false);
    };

    processPayment();
  }, [searchParams, toast, type]);

  // 성공 시 자동 리다이렉트
  useEffect(() => {
    if (!result?.success || isProcessing) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [result?.success, isProcessing, router]);

  // 처리 중 화면
  if (isProcessing) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <div className={cn('mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6', config.bgColor)}>
              <Loader2 className={cn('h-10 w-10 animate-spin', config.iconColor)} />
            </div>
            <p className="text-xl font-medium">{config.processingTitle}</p>
            <p className="text-muted-foreground mt-2">잠시만 기다려주세요.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 결과 화면
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-md overflow-hidden">
        {/* 성공 시 상단 컬러 바 */}
        {result?.success && (
          <div className={cn('h-2', type === 'subscription' ? 'bg-blue-500' : 'bg-yellow-500')} />
        )}

        <CardHeader className="text-center pt-8">
          {result?.success ? (
            <div className="relative">
              {/* 배경 글로우 효과 */}
              <div className={cn(
                'absolute inset-0 blur-2xl opacity-30 -z-10',
                type === 'subscription' ? 'bg-blue-500' : 'bg-yellow-500'
              )} />

              {/* 메인 아이콘 */}
              <div className="relative mx-auto mb-6">
                <div className={cn(
                  'w-20 h-20 rounded-full flex items-center justify-center',
                  type === 'subscription' ? 'bg-blue-500/10' : 'bg-yellow-500/10'
                )}>
                  <Icon className={cn('h-10 w-10', config.iconColor)} />
                </div>
                {/* 체크 뱃지 */}
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
              </div>

              {/* 축하 효과 */}
              {showConfetti && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4">
                  <Sparkles className="h-6 w-6 text-yellow-400 animate-pulse" />
                </div>
              )}

              <CardTitle className="text-2xl">{config.successTitle}</CardTitle>
            </div>
          ) : (
            <>
              <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <CardTitle className="text-2xl">결제 처리 실패</CardTitle>
            </>
          )}
        </CardHeader>

        <CardContent className="text-center space-y-6 pb-8">
          {/* 결과 메시지 */}
          <p className={cn(
            'font-medium',
            result?.success ? 'text-foreground' : 'text-destructive'
          )}>
            {result?.message}
          </p>

          {/* 결제 상세 정보 */}
          {result?.success && result.details && (
            <div className={cn(
              'p-4 rounded-lg',
              type === 'subscription' ? 'bg-blue-500/5' : 'bg-yellow-500/5'
            )}>
              {type === 'subscription' && result.details.plan && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">플랜</span>
                  <span className="font-semibold">
                    {planDisplayNames[result.details.plan] || result.details.plan} ({billingCycleNames[result.details.billingCycle!] || result.details.billingCycle})
                  </span>
                </div>
              )}
              {type === 'credit' && result.details.credits && (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-muted-foreground">충전 크레딧</span>
                    <span className="font-semibold text-yellow-600">+{result.details.credits}개</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-muted-foreground">현재 잔액</span>
                    <span className="font-bold text-lg">{result.details.balance?.toLocaleString()}개</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 카운트다운 */}
          {result?.success && (
            <p className="text-sm text-muted-foreground">
              {countdown}초 후 대시보드로 이동합니다...
            </p>
          )}

          {/* 버튼 */}
          <div className="space-y-2">
            <Button asChild className="w-full" size="lg">
              <Link href="/dashboard">
                {result?.success ? '대시보드로 이동' : '대시보드로 돌아가기'}
              </Link>
            </Button>
            {!result?.success && (
              <Button asChild variant="outline" className="w-full">
                <Link href={config.retryPath}>다시 시도</Link>
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
              <CardContent className="pt-8 pb-8 text-center">
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
