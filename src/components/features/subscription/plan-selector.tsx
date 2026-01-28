'use client';

/**
 * 요금제 선택기 컴포넌트
 */

import { useState } from 'react';
import { PricingCard } from '@/components/features/payment/pricing-card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
      {/* 결제 주기 토글 */}
      <div className="flex items-center justify-center gap-4">
        <Label
          htmlFor="billing-cycle"
          className={billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}
        >
          월간 결제
        </Label>
        <Switch
          id="billing-cycle"
          checked={billingCycle === 'yearly'}
          onCheckedChange={(checked: boolean) =>
            setBillingCycle(checked ? 'yearly' : 'monthly')
          }
        />
        <Label
          htmlFor="billing-cycle"
          className={billingCycle === 'yearly' ? 'text-foreground' : 'text-muted-foreground'}
        >
          연간 결제
          <span className="ml-1 text-xs text-primary">(17% 할인)</span>
        </Label>
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
