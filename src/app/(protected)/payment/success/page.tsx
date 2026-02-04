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
  successSubtitle: string;
  processingTitle: string;
  iconColor: string;
  bgColor: string;
  gradientFrom: string;
  gradientTo: string;
  retryPath: string;
}> = {
  subscription: {
    icon: CreditCard,
    successTitle: '구독이 시작되었습니다!',
    successSubtitle: '이제 모든 프리미엄 기능을 이용할 수 있어요',
    processingTitle: '구독을 처리하고 있습니다...',
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-purple-500',
    retryPath: '/payment/subscribe',
  },
  credit: {
    icon: Coins,
    successTitle: '충전이 완료되었습니다!',
    successSubtitle: '크레딧이 계정에 추가되었어요',
    processingTitle: '크레딧을 충전하고 있습니다...',
    iconColor: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    gradientFrom: 'from-yellow-400',
    gradientTo: 'to-orange-500',
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

  // 처리 중 화면 - 개선된 디자인
  if (isProcessing) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="w-full max-w-md overflow-hidden">
          {/* 상단 그라데이션 */}
          <div className={cn('h-1.5 bg-gradient-to-r', config.gradientFrom, config.gradientTo)} />

          <CardContent className="pt-12 pb-10 text-center">
            {/* 로딩 아이콘 */}
            <div className="relative mx-auto mb-8">
              {/* 배경 펄스 효과 */}
              <div className={cn(
                'absolute inset-0 rounded-full animate-ping opacity-20',
                config.bgColor
              )} />
              <div className={cn(
                'relative w-24 h-24 rounded-full flex items-center justify-center',
                config.bgColor
              )}>
                <Loader2 className={cn('h-12 w-12 animate-spin', config.iconColor)} />
              </div>
            </div>

            <p className="text-xl font-semibold">{config.processingTitle}</p>
            <p className="text-muted-foreground mt-2">잠시만 기다려주세요</p>

            {/* 진행 표시 */}
            <div className="mt-6 flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'w-2 h-2 rounded-full animate-bounce',
                    config.bgColor.replace('/10', '')
                  )}
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 결과 화면 - 개선된 디자인
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-md overflow-hidden shadow-xl">
        {/* 상단 그라데이션 바 */}
        {result?.success ? (
          <div className={cn('h-2 bg-gradient-to-r', config.gradientFrom, config.gradientTo)} />
        ) : (
          <div className="h-2 bg-destructive" />
        )}

        <CardHeader className="text-center pt-10">
          {result?.success ? (
            <div className="relative">
              {/* 배경 글로우 효과 */}
              <div className={cn(
                'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
                'w-40 h-40 rounded-full blur-3xl opacity-20 -z-10',
                'bg-gradient-to-r', config.gradientFrom, config.gradientTo
              )} />

              {/* 메인 아이콘 */}
              <div className="relative mx-auto mb-8">
                <div className={cn(
                  'w-24 h-24 rounded-2xl flex items-center justify-center',
                  'bg-gradient-to-br',
                  type === 'subscription'
                    ? 'from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40'
                    : 'from-yellow-100 to-orange-100 dark:from-yellow-900/40 dark:to-orange-900/40'
                )}>
                  <Icon className={cn('h-12 w-12', config.iconColor)} />
                </div>
                {/* 체크 뱃지 */}
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
              </div>

              {/* 축하 효과 */}
              {showConfetti && (
                <>
                  <div className="absolute top-0 left-1/4 -translate-y-2">
                    <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
                  </div>
                  <div className="absolute top-4 right-1/4">
                    <Sparkles className="h-4 w-4 text-pink-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                  </div>
                </>
              )}

              <CardTitle className="text-2xl font-bold">{config.successTitle}</CardTitle>
              <p className="text-muted-foreground mt-2">{config.successSubtitle}</p>
            </div>
          ) : (
            <>
              <div className="mx-auto mb-6 w-24 h-24 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <CardTitle className="text-2xl font-bold">결제 처리 실패</CardTitle>
              <p className="text-muted-foreground mt-2">결제 과정에서 문제가 발생했습니다</p>
            </>
          )}
        </CardHeader>

        <CardContent className="text-center space-y-6 pb-8">
          {/* 결제 상세 정보 */}
          {result?.success && result.details && (
            <div className={cn(
              'p-5 rounded-xl border',
              type === 'subscription'
                ? 'bg-blue-500/5 border-blue-500/10'
                : 'bg-yellow-500/5 border-yellow-500/10'
            )}>
              {type === 'subscription' && result.details.plan && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">구독 플랜</span>
                  <div className="text-right">
                    <span className="font-bold text-lg">
                      {planDisplayNames[result.details.plan] || result.details.plan}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1">
                      ({billingCycleNames[result.details.billingCycle!] || result.details.billingCycle})
                    </span>
                  </div>
                </div>
              )}
              {type === 'credit' && result.details.credits && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">충전 크레딧</span>
                    <span className="font-bold text-lg text-green-600 dark:text-green-400">
                      +{result.details.credits}개
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">현재 잔액</span>
                    <span className="font-bold text-xl bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                      {result.details.balance?.toLocaleString()}개
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 실패 메시지 */}
          {!result?.success && (
            <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/10">
              <p className="text-destructive font-medium">{result?.message}</p>
            </div>
          )}

          {/* 카운트다운 */}
          {result?.success && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center font-mono font-bold">
                {countdown}
              </div>
              <span>초 후 대시보드로 이동합니다</span>
            </div>
          )}

          {/* 버튼 */}
          <div className="space-y-3 pt-2">
            <Button
              asChild
              className={cn(
                'w-full h-12 text-base font-semibold',
                result?.success && 'bg-gradient-to-r shadow-lg',
                result?.success && type === 'subscription' && 'from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600',
                result?.success && type === 'credit' && 'from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600'
              )}
              size="lg"
            >
              <Link href="/dashboard">
                {result?.success ? '대시보드로 이동' : '대시보드로 돌아가기'}
              </Link>
            </Button>
            {!result?.success && (
              <Button asChild variant="outline" className="w-full h-11">
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
