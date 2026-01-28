'use client';

/**
 * 요금제 카드 컴포넌트
 */

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/config/pricing';
import type { PlanType, BillingCycle } from '@/types/payment.types';

interface PricingCardProps {
  id: PlanType;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: string[];
  billingCycle: BillingCycle;
  isPopular?: boolean;
  isCurrent?: boolean;
  isLoading?: boolean;
  onSelect?: (plan: PlanType, cycle: BillingCycle) => void;
}

export function PricingCard({
  id,
  name,
  description,
  price,
  features,
  billingCycle,
  isPopular = false,
  isCurrent = false,
  isLoading = false,
  onSelect,
}: PricingCardProps) {
  const currentPrice = price[billingCycle];
  const isFreePlan = id === 'starter';

  // 연간 결제 시 월간 대비 할인율 계산
  const monthlyEquivalent =
    billingCycle === 'yearly' ? Math.round(price.yearly / 12) : price.monthly;
  const discount =
    billingCycle === 'yearly' && price.monthly > 0
      ? Math.round((1 - price.yearly / (price.monthly * 12)) * 100)
      : 0;

  const handleClick = () => {
    if (onSelect && !isFreePlan && !isCurrent) {
      onSelect(id, billingCycle);
    }
  };

  return (
    <Card
      className={cn(
        'relative flex flex-col',
        isPopular && 'border-primary shadow-lg scale-105',
        isCurrent && 'border-green-500'
      )}
    >
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
          인기
        </Badge>
      )}
      {isCurrent && (
        <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2">
          현재 플랜
        </Badge>
      )}

      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="text-center mb-6">
          <div className="text-4xl font-bold">
            {isFreePlan ? (
              '무료'
            ) : (
              <>
                {formatPrice(monthlyEquivalent)}
                <span className="text-sm font-normal text-muted-foreground">
                  /월
                </span>
              </>
            )}
          </div>
          {!isFreePlan && billingCycle === 'yearly' && (
            <p className="text-sm text-muted-foreground mt-1">
              연 {formatPrice(currentPrice)} ({discount}% 할인)
            </p>
          )}
        </div>

        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          variant={isPopular ? 'default' : 'outline'}
          disabled={isFreePlan || isCurrent || isLoading}
          onClick={handleClick}
        >
          {isLoading
            ? '처리 중...'
            : isCurrent
              ? '현재 사용 중'
              : isFreePlan
                ? '기본 플랜'
                : '구독하기'}
        </Button>
      </CardFooter>
    </Card>
  );
}
