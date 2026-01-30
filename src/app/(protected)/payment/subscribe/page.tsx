'use client';

/**
 * 구독 결제 페이지
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, Crown, Calendar, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlanSelector } from '@/components/features/subscription/plan-selector';
import { cn } from '@/lib/utils';
import { prepareSubscription, getCurrentSubscription } from '@/actions/subscription';
import { useToast } from '@/hooks/use-toast';
import { useTossPayments } from '@/hooks/use-toss-payments';
import type { PlanType, BillingCycle, SubscriptionSummary } from '@/types/payment.types';

export default function SubscribePage() {
  const { toast } = useToast();
  const { isReady: isTossReady, requestBillingAuth, error: tossError } = useTossPayments();
  const [isLoading, setIsLoading] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionSummary | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanType>('starter');

  useEffect(() => {
    // 현재 구독 상태 조회
    const fetchSubscription = async () => {
      const result = await getCurrentSubscription();
      if (result.success && result.data !== undefined) {
        setCurrentSubscription(result.data);
        if (result.data) {
          setCurrentPlan(result.data.plan);
        }
      }
    };
    fetchSubscription();
  }, []);

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
    <div className="container mx-auto py-8 px-4">
      {/* 헤더 */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            대시보드로 돌아가기
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">플랜 선택</h1>
        <p className="text-muted-foreground mt-2">
          필요에 맞는 플랜을 선택하세요. 언제든지 변경하거나 취소할 수 있습니다.
        </p>
      </div>

      {/* 현재 구독 상태 */}
      {currentSubscription && (
        <Card className={cn(
          'mb-8 overflow-hidden',
          currentSubscription.cancelAtPeriodEnd
            ? 'border-orange-200 dark:border-orange-800'
            : 'border-primary/20'
        )}>
          <div className={cn(
            'h-1',
            currentSubscription.cancelAtPeriodEnd
              ? 'bg-orange-500'
              : 'bg-gradient-to-r from-blue-500 to-purple-500'
          )} />
          <CardContent className="pt-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  currentSubscription.cancelAtPeriodEnd
                    ? 'bg-orange-100 dark:bg-orange-900/30'
                    : 'bg-primary/10'
                )}>
                  {currentSubscription.cancelAtPeriodEnd ? (
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                  ) : (
                    <Crown className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      현재 {currentSubscription.plan.toUpperCase()} 플랜
                    </span>
                    <Badge variant={currentSubscription.cancelAtPeriodEnd ? 'outline' : 'default'} className={cn(
                      currentSubscription.cancelAtPeriodEnd && 'border-orange-500 text-orange-500'
                    )}>
                      {currentSubscription.cancelAtPeriodEnd ? '취소 예정' : '활성'}
                    </Badge>
                  </div>
                  {currentSubscription.cancelAtPeriodEnd && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString('ko-KR')}에 종료됩니다
                    </p>
                  )}
                </div>
              </div>
              {!currentSubscription.cancelAtPeriodEnd && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
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

      {/* 안내 */}
      <div className="mt-12 text-center text-sm text-muted-foreground">
        <p>구독은 결제 주기에 따라 자동 갱신됩니다.</p>
        <p>다음 결제일 전에 언제든지 취소할 수 있습니다.</p>
      </div>
    </div>
  );
}
