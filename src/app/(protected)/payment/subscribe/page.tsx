'use client';

/**
 * 구독 결제 페이지
 * - 접근성 개선 (ARIA, 키보드 탐색, 스켈레톤 로더)
 * - 에러 바운더리 적용
 */

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Crown,
  Calendar,
  AlertCircle,
  Rocket,
  Shield,
  Sparkles,
  Check,
  Zap,
  RefreshCw,
  HelpCircle,
  ChevronDown,
  CreditCard,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SubscriptionStatusSkeleton } from '@/components/ui/skeleton';
import { PlanSelector } from '@/components/features/subscription/plan-selector';
import { PaymentErrorBoundary } from '@/components/features/payment/payment-error-boundary';
import { cn } from '@/lib/utils';
import { prepareSubscription, getCurrentSubscription } from '@/actions/subscription';
import { useToast } from '@/hooks/use-toast';
import { useTossPayments } from '@/hooks/use-toss-payments';
import { clientLogger } from '@/lib/client-logger';
import type { PlanType, BillingCycle, SubscriptionSummary } from '@/types/payment.types';

function SubscribePageContent() {
  const { toast } = useToast();
  const { isReady: isTossReady, requestBillingAuth, error: tossError } = useTossPayments();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionSummary | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanType>('starter');

  useEffect(() => {
    // 현재 구독 상태 조회
    const fetchSubscription = async () => {
      setIsSubscriptionLoading(true);
      try {
        const result = await getCurrentSubscription();
        if (result.success && result.data !== undefined) {
          setCurrentSubscription(result.data);
          if (result.data) {
            setCurrentPlan(result.data.plan);
          }
        }
      } catch (error) {
        clientLogger.error('구독 상태 조회 실패', error);
        toast({
          title: '오류',
          description: '구독 상태를 불러오는데 실패했습니다.',
          variant: 'destructive',
        });
      } finally {
        setIsSubscriptionLoading(false);
      }
    };
    fetchSubscription();
  }, [toast]);

  // SDK 로드 에러 처리
  useEffect(() => {
    if (tossError) {
      toast({
        title: '오류',
        description: tossError.message,
        variant: 'destructive',
      });
    }
  }, [tossError, toast]);

  const handleSelectPlan = async (plan: PlanType, billingCycle: BillingCycle) => {
    if (plan === 'starter') return;

    if (!isTossReady) {
      toast({
        title: '오류',
        description: '결제 시스템을 불러오는 중입니다. 잠시 후 다시 시도해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await prepareSubscription({ plan: plan as 'pro' | 'team' | 'enterprise', billingCycle });

      if (!result.success || !result.data) {
        toast({
          title: '오류',
          description: result.error || '구독 준비에 실패했습니다',
          variant: 'destructive',
        });
        return;
      }

      const { orderId, customerKey, plan: selectedPlan, billingCycle: selectedCycle } = result.data;

      // URL에 구독 정보 저장 (성공 페이지에서 사용)
      const successUrl = new URL(`${window.location.origin}/payment/success`);
      successUrl.searchParams.set('type', 'subscription');
      successUrl.searchParams.set('orderId', orderId);
      successUrl.searchParams.set('plan', selectedPlan);
      successUrl.searchParams.set('billingCycle', selectedCycle);

      // 토스페이먼츠 빌링 인증 요청
      await requestBillingAuth({
        customerKey,
        successUrl: successUrl.toString(),
        failUrl: `${window.location.origin}/payment/fail?type=subscription`,
      });
    } catch (error) {
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '구독 처리 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 container mx-auto py-8 px-4">
        {/* 헤더 */}
        <div className="mb-10 text-center">
          <Button variant="ghost" size="sm" asChild className="mb-6">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              대시보드로 돌아가기
            </Link>
          </Button>

          {/* 아이콘 */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-xl">
                <Rocket className="h-10 w-10 text-white" />
              </div>
            </div>
          </div>

          <Badge className="mb-4 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">
            <Sparkles className="h-3 w-3 mr-1" />
            프리미엄 플랜
          </Badge>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            플랜 선택
          </h1>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto">
            필요에 맞는 플랜을 선택하세요. 언제든지 변경하거나 취소할 수 있습니다.
          </p>

          {/* 혜택 뱃지 */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <Shield className="h-3.5 w-3.5 text-green-500" />
              안전한 결제
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
              언제든 취소 가능
            </div>
          </div>
        </div>

        {/* 현재 구독 상태 */}
        {isSubscriptionLoading ? (
          <Card className="mb-10 overflow-hidden max-w-2xl mx-auto border-blue-500/20">
            <div className="h-1.5 bg-gradient-to-r from-blue-500 to-purple-500" aria-hidden="true" />
            <CardContent className="pt-5 pb-5">
              <SubscriptionStatusSkeleton />
            </CardContent>
          </Card>
        ) : currentSubscription && (
          <Card
            className={cn(
              'mb-10 overflow-hidden max-w-2xl mx-auto',
              currentSubscription.cancelAtPeriodEnd
                ? 'border-orange-200 dark:border-orange-800'
                : 'border-blue-500/20'
            )}
            role="region"
            aria-label="현재 구독 상태"
          >
            <div
              className={cn(
                'h-1.5',
                currentSubscription.cancelAtPeriodEnd
                  ? 'bg-orange-500'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500'
              )}
              aria-hidden="true"
            />
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-xl',
                      currentSubscription.cancelAtPeriodEnd
                        ? 'bg-orange-100 dark:bg-orange-900/30'
                        : 'bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30'
                    )}
                    aria-hidden="true"
                  >
                    {currentSubscription.cancelAtPeriodEnd ? (
                      <AlertCircle className="h-6 w-6 text-orange-500" />
                    ) : (
                      <Crown className="h-6 w-6 text-blue-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg" aria-live="polite">
                        현재 {currentSubscription.plan.toUpperCase()} 플랜
                      </span>
                      <Badge
                        variant={currentSubscription.cancelAtPeriodEnd ? 'outline' : 'default'}
                        className={cn(
                          currentSubscription.cancelAtPeriodEnd
                            ? 'border-orange-500 text-orange-500'
                            : 'bg-green-500 hover:bg-green-500'
                        )}
                        aria-label={currentSubscription.cancelAtPeriodEnd ? '구독 취소 예정' : '구독 활성 상태'}
                      >
                        {currentSubscription.cancelAtPeriodEnd ? '취소 예정' : '활성'}
                      </Badge>
                    </div>
                    {currentSubscription.cancelAtPeriodEnd && (
                      <p className="text-sm text-muted-foreground mt-0.5" aria-live="polite">
                        {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString('ko-KR')}에 종료됩니다
                      </p>
                    )}
                  </div>
                </div>
                {!currentSubscription.cancelAtPeriodEnd && (
                  <div
                    className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg"
                    aria-label={`다음 결제일: ${new Date(currentSubscription.currentPeriodEnd).toLocaleDateString('ko-KR')}`}
                  >
                    <Calendar className="h-4 w-4 text-blue-500" aria-hidden="true" />
                    다음 결제: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString('ko-KR')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 플랜 선택기 */}
        <PlanSelector
          currentPlan={currentPlan}
          isLoading={isLoading}
          onSelectPlan={handleSelectPlan}
        />

        {/* 신뢰 배지 섹션 */}
        <div
          className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground"
          role="list"
          aria-label="결제 보안 및 혜택"
        >
          <div className="flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-full" role="listitem">
            <Shield className="h-4 w-4 text-green-500" aria-hidden="true" />
            <span>SSL 보안 결제</span>
          </div>
          <div className="flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-full" role="listitem">
            <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
            <span>7일 환불 보장</span>
          </div>
          <div className="flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-full" role="listitem">
            <RefreshCw className="h-4 w-4 text-green-500" aria-hidden="true" />
            <span>언제든 취소 가능</span>
          </div>
          <div className="flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-full" role="listitem">
            <Lock className="h-4 w-4 text-green-500" aria-hidden="true" />
            <span>카드 정보 암호화</span>
          </div>
        </div>

        {/* FAQ 섹션 */}
        <section className="mt-16 max-w-3xl mx-auto" aria-labelledby="subscription-faq-heading">
          <div className="text-center mb-8">
            <Badge className="mb-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">
              <HelpCircle className="h-3 w-3 mr-1" aria-hidden="true" />
              자주 묻는 질문
            </Badge>
            <h2 id="subscription-faq-heading" className="text-2xl font-bold">구독 관련 FAQ</h2>
          </div>

          <div className="space-y-3" role="list" aria-label="자주 묻는 질문 목록">
            {[
              {
                q: '결제 주기는 어떻게 되나요?',
                a: '월간 또는 연간 결제를 선택하실 수 있습니다. 연간 결제 시 약 17% 할인(2개월 무료)이 적용됩니다.',
                icon: Calendar,
                color: 'text-blue-500',
                bg: 'bg-blue-500/10',
              },
              {
                q: '구독 취소는 어떻게 하나요?',
                a: '설정 > 구독 관리에서 언제든지 취소할 수 있습니다. 취소 후에도 결제 기간이 끝날 때까지 서비스를 이용할 수 있습니다.',
                icon: RefreshCw,
                color: 'text-purple-500',
                bg: 'bg-purple-500/10',
              },
              {
                q: '환불 정책은 어떻게 되나요?',
                a: '결제 후 7일 이내, 서비스 사용량이 없는 경우 전액 환불이 가능합니다. 고객센터로 문의해 주세요.',
                icon: CreditCard,
                color: 'text-green-500',
                bg: 'bg-green-500/10',
              },
              {
                q: '플랜 변경은 가능한가요?',
                a: '언제든지 상위 플랜으로 업그레이드하거나 하위 플랜으로 변경할 수 있습니다. 변경은 다음 결제 주기부터 적용됩니다.',
                icon: Zap,
                color: 'text-amber-500',
                bg: 'bg-amber-500/10',
              },
            ].map((faq, index) => (
              <details
                key={index}
                className="group p-4 rounded-xl border hover:border-primary/30 hover:shadow-md transition-all focus-within:ring-2 focus-within:ring-primary/50"
                role="listitem"
              >
                <summary
                  className="flex items-center gap-3 cursor-pointer list-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
                  aria-label={faq.q}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      (e.target as HTMLElement).click();
                    }
                  }}
                >
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', faq.bg)} aria-hidden="true">
                    <faq.icon className={cn('h-4 w-4', faq.color)} />
                  </div>
                  <span className="flex-1 font-medium">{faq.q}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-3 ml-12 text-sm text-muted-foreground leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* 안내 카드 */}
        <Card className="mt-12 border-dashed max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-center sm:text-left">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                <Shield className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="font-medium">안심하고 구독하세요</p>
                <p className="text-sm text-muted-foreground mt-1">
                  구독은 결제 주기에 따라 자동 갱신되며, 다음 결제일 전에 언제든지 취소할 수 있습니다.
                  <br className="hidden sm:block" />
                  결제는 토스페이먼츠를 통해 안전하게 처리됩니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 결제 수단 안내 */}
        <footer className="mt-8 text-center" role="contentinfo">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
            <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
            신용카드 / 체크카드 결제 지원 • 토스페이먼츠 안전 결제
          </p>
        </footer>
      </div>
    </div>
  );
}

/**
 * 구독 결제 페이지 (Error Boundary 적용)
 */
export default function SubscribePage() {
  return (
    <PaymentErrorBoundary
      title="구독 페이지를 불러올 수 없습니다"
      description="일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
    >
      <SubscribePageContent />
    </PaymentErrorBoundary>
  );
}
