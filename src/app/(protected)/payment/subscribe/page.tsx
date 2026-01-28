'use client';

/**
 * 구독 결제 페이지
 */

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlanSelector } from '@/components/features/subscription/plan-selector';
import { prepareSubscription, getCurrentSubscription } from '@/actions/subscription';
import { useToast } from '@/hooks/use-toast';
import type { PlanType, BillingCycle, SubscriptionSummary } from '@/types/payment.types';

// TossPayments SDK 타입 선언 (전역 Window에 추가)
interface TossPaymentsInstance {
  requestBillingAuth(
    method: string,
    options: {
      customerKey: string;
      successUrl: string;
      failUrl: string;
    }
  ): Promise<void>;
}

export default function SubscribePage() {
  const { toast } = useToast();
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

    // 토스페이먼츠 SDK 로드
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v1/payment';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handleSelectPlan = async (plan: PlanType, billingCycle: BillingCycle) => {
    if (plan === 'starter') return;

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
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      const TossPayments = (window as unknown as { TossPayments?: (key: string) => TossPaymentsInstance }).TossPayments;

      if (!clientKey || !TossPayments) {
        toast({
          title: '오류',
          description: '결제 시스템을 불러오는 데 실패했습니다',
          variant: 'destructive',
        });
        return;
      }

      const tossPayments = TossPayments(clientKey);
      await tossPayments.requestBillingAuth('카드', {
        customerKey,
        successUrl: successUrl.toString(),
        failUrl: `${window.location.origin}/payment/fail`,
      });
    } catch (error) {
      console.error('구독 오류:', error);
      toast({
        title: '오류',
        description: '구독 처리 중 오류가 발생했습니다',
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
        <div className="mb-8 p-4 rounded-lg bg-muted">
          <p className="text-sm">
            현재 <strong>{currentSubscription.plan.toUpperCase()}</strong> 플랜을 사용 중입니다.
            {currentSubscription.cancelAtPeriodEnd && (
              <span className="text-destructive ml-2">
                (취소 예정: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString('ko-KR')})
              </span>
            )}
          </p>
        </div>
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
