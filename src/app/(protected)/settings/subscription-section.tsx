'use client';

import { useState } from 'react';
import { CreditCard, Calendar, AlertCircle, Crown } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { cancelSubscription, reactivateSubscription, type SubscriptionInfo } from '@/actions/billing';
import { PLANS } from '@/lib/payment/plans';
import type { PlanType } from '@/types/payment.types';

interface SubscriptionSectionProps {
  subscription: SubscriptionInfo | null;
  currentPlan: PlanType;
}

export function SubscriptionSection({ subscription, currentPlan }: SubscriptionSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planInfo = PLANS[currentPlan];

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    const confirmed = confirm('정말 구독을 취소하시겠습니까? 현재 결제 기간이 종료될 때까지는 서비스를 이용할 수 있습니다.');
    if (!confirmed) return;

    setIsLoading(true);
    setError(null);

    const result = await cancelSubscription(subscription.id);

    if (!result.success) {
      setError(result.error || '구독 취소에 실패했습니다');
    }

    setIsLoading(false);
  };

  const handleReactivate = async () => {
    if (!subscription) return;

    setIsLoading(true);
    setError(null);

    const result = await reactivateSubscription(subscription.id);

    if (!result.success) {
      setError(result.error || '구독 취소 철회에 실패했습니다');
    }

    setIsLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          구독 관리
        </CardTitle>
        <CardDescription>현재 구독 상태 및 플랜 정보</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 현재 플랜 정보 */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold capitalize">{planInfo.name} 플랜</span>
              {currentPlan !== 'starter' && subscription?.status === 'active' && (
                <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-500 rounded-full">
                  활성
                </span>
              )}
              {subscription?.cancelAtPeriodEnd && (
                <span className="px-2 py-0.5 text-xs bg-orange-500/10 text-orange-500 rounded-full">
                  취소 예정
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{planInfo.description}</p>
          </div>
          {currentPlan !== 'enterprise' && (
            <Link href="/pricing">
              <Button variant={currentPlan === 'starter' ? 'default' : 'outline'}>
                {currentPlan === 'starter' ? '업그레이드' : '플랜 변경'}
              </Button>
            </Link>
          )}
        </div>

        {/* 플랜 혜택 */}
        <div className="space-y-2">
          <p className="text-sm font-medium">플랜 혜택</p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {planInfo.features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* 구독 상세 정보 (유료 플랜) */}
        {subscription && currentPlan !== 'starter' && (
          <>
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">결제 주기:</span>
                <span className="font-medium">
                  {subscription.billingCycle === 'monthly' ? '월간' : '연간'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">현재 기간:</span>
                <span className="font-medium">
                  {new Date(subscription.currentPeriodStart).toLocaleDateString('ko-KR')} ~{' '}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString('ko-KR')}
                </span>
              </div>
              {subscription.cancelAtPeriodEnd && (
                <div className="flex items-start gap-2 p-3 bg-orange-500/10 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-orange-500">구독 취소 예정</p>
                    <p className="text-muted-foreground">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString('ko-KR')}에 구독이 종료됩니다.
                      그 전까지는 서비스를 계속 이용할 수 있습니다.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 구독 관리 버튼 */}
            <div className="flex gap-2 pt-2">
              {subscription.cancelAtPeriodEnd ? (
                <Button
                  variant="outline"
                  onClick={handleReactivate}
                  disabled={isLoading}
                >
                  {isLoading ? '처리 중...' : '구독 취소 철회'}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={handleCancelSubscription}
                  disabled={isLoading}
                  className="text-muted-foreground hover:text-destructive"
                >
                  {isLoading ? '처리 중...' : '구독 취소'}
                </Button>
              )}
            </div>
          </>
        )}

        {/* Starter 플랜 안내 */}
        {currentPlan === 'starter' && (
          <div className="border-t pt-4">
            <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg">
              <Crown className="h-4 w-4 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Pro로 업그레이드하세요</p>
                <p className="text-muted-foreground">
                  모든 언어 지원, PDF 내보내기, 일일 100회 생성 등 더 많은 기능을 이용하세요.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
