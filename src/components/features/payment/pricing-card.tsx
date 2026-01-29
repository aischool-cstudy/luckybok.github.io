'use client';

/**
 * 요금제 카드 컴포넌트
 */

import { Check, Zap, Crown, Users, type LucideIcon } from 'lucide-react';
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

// 플랜별 아이콘 매핑
const PLAN_ICONS: Record<PlanType, LucideIcon> = {
  starter: Zap,
  pro: Crown,
  team: Users,
  enterprise: Users,
};

// 플랜별 색상 매핑
const PLAN_COLORS: Record<PlanType, string> = {
  starter: 'text-blue-500',
  pro: 'text-amber-500',
  team: 'text-purple-500',
  enterprise: 'text-emerald-500',
};

// Pro 이상 전용 기능 키워드
const PRO_FEATURE_KEYWORDS = ['PDF', '전체 언어', '히스토리', 'API'];

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

  const PlanIcon = PLAN_ICONS[id];
  const planColor = PLAN_COLORS[id];

  // 기능이 Pro+ 전용인지 체크
  const isProFeature = (feature: string) =>
    PRO_FEATURE_KEYWORDS.some((keyword) => feature.includes(keyword));

  return (
    <Card
      className={cn(
        'relative flex flex-col transition-all duration-300 ease-out',
        isPopular && 'border-primary shadow-lg scale-105 ring-4 ring-primary/10',
        isCurrent && 'border-green-500',
        !isPopular && !isCurrent && 'hover:shadow-xl hover:-translate-y-1 hover:border-primary/50 hover:ring-2 hover:ring-primary/5'
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
        {/* 플랜 아이콘 */}
        <div className="flex justify-center mb-3">
          <div className={cn(
            'p-3 rounded-full bg-gradient-to-br from-muted to-muted/50',
            isPopular && 'from-primary/10 to-primary/5'
          )}>
            <PlanIcon className={cn('h-6 w-6', planColor)} />
          </div>
        </div>
        <CardTitle className="text-2xl">{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="text-center mb-6">
          {/* 가격 애니메이션 적용 */}
          <div key={billingCycle} className="text-4xl font-bold animate-price-change">
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
            <p className="text-sm text-muted-foreground mt-1 animate-price-change">
              연 {formatPrice(currentPrice)} ({discount}% 할인)
            </p>
          )}
        </div>

        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span className="text-sm">
                {feature}
                {/* Pro 이상 전용 기능 하이라이트 */}
                {id !== 'starter' && isProFeature(feature) && (
                  <Badge
                    variant="secondary"
                    className="ml-2 text-[10px] px-1.5 py-0 bg-primary/10 text-primary"
                  >
                    Pro+
                  </Badge>
                )}
              </span>
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
