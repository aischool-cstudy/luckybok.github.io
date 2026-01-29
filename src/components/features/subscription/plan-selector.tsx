'use client';

/**
 * 요금제 선택기 컴포넌트
 */

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { PricingCard } from '@/components/features/payment/pricing-card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { plans } from '@/config/pricing';
import type { PlanType, BillingCycle } from '@/types/payment.types';

interface PlanSelectorProps {
  currentPlan?: PlanType;
  isLoading?: boolean;
  onSelectPlan?: (plan: PlanType, cycle: BillingCycle) => void;
}

export function PlanSelector({
  currentPlan = 'starter',
  isLoading = false,
  onSelectPlan,
}: PlanSelectorProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  // enterprise 플랜 제외 (문의 전용)
  const displayPlans = ['starter', 'pro', 'team'] as const;
  const planList = displayPlans.map((id) => ({
    id: id as PlanType,
    name: plans[id].name,
    description: plans[id].description,
    price: plans[id].price,
    features: [...plans[id].features],
    isPopular: id === 'pro',
    isCurrent: id === currentPlan,
  }));

  return (
    <div className="space-y-8">
      {/* 할인 배너 */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          연간 결제 시 17% 할인 (2개월 무료)
        </div>
      </div>

      {/* 결제 주기 토글 - 버튼 그룹 */}
      <div className="flex justify-center">
        <div className="inline-flex items-center bg-muted p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
              billingCycle === 'monthly'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            월간 결제
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2',
              billingCycle === 'yearly'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            연간 결제
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px] px-1.5 py-0',
                billingCycle === 'yearly'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-primary/20 text-primary'
              )}
            >
              -17%
            </Badge>
          </button>
        </div>
      </div>

      {/* 요금제 카드 */}
      <div className="grid gap-6 md:grid-cols-3">
        {planList.map((plan) => (
          <PricingCard
            key={plan.id}
            id={plan.id}
            name={plan.name}
            description={plan.description}
            price={plan.price}
            features={plan.features}
            billingCycle={billingCycle}
            isPopular={plan.isPopular}
            isCurrent={plan.isCurrent}
            isLoading={isLoading}
            onSelect={onSelectPlan}
          />
        ))}
      </div>
    </div>
  );
}
