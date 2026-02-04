'use client';

/**
 * 요금제 카드 컴포넌트
 * - 플랜별 그라데이션 테마
 * - 향상된 호버 효과
 * - 가격 애니메이션
 */

import { memo } from 'react';
import { Check, Zap, Crown, Users, Sparkles, type LucideIcon } from 'lucide-react';
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

// 플랜별 테마 설정
const PLAN_THEMES: Record<PlanType, {
  iconColor: string;
  iconBg: string;
  gradientFrom: string;
  gradientTo: string;
  ringColor: string;
  badgeBg: string;
}> = {
  starter: {
    iconColor: 'text-slate-500',
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    gradientFrom: 'from-slate-50',
    gradientTo: 'to-slate-100/50',
    ringColor: 'ring-slate-200',
    badgeBg: 'bg-slate-500',
  },
  pro: {
    iconColor: 'text-amber-500',
    iconBg: 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50',
    gradientFrom: 'from-amber-50',
    gradientTo: 'to-orange-50/50',
    ringColor: 'ring-amber-200',
    badgeBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
  },
  team: {
    iconColor: 'text-purple-500',
    iconBg: 'bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50',
    gradientFrom: 'from-purple-50',
    gradientTo: 'to-pink-50/50',
    ringColor: 'ring-purple-200',
    badgeBg: 'bg-gradient-to-r from-purple-500 to-pink-500',
  },
  enterprise: {
    iconColor: 'text-emerald-500',
    iconBg: 'bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50',
    gradientFrom: 'from-emerald-50',
    gradientTo: 'to-teal-50/50',
    ringColor: 'ring-emerald-200',
    badgeBg: 'bg-gradient-to-r from-emerald-500 to-teal-500',
  },
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

export const PricingCard = memo(function PricingCard({
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
  const theme = PLAN_THEMES[id];

  // 기능이 Pro+ 전용인지 체크
  const isProFeature = (feature: string) =>
    PRO_FEATURE_KEYWORDS.some((keyword) => feature.includes(keyword));

  return (
    <Card
      className={cn(
        'relative flex flex-col overflow-hidden transition-all duration-300 ease-out group',
        // 인기 플랜 스타일
        isPopular && [
          'border-2 border-primary shadow-xl scale-[1.02] z-10',
          'ring-4 ring-primary/20',
          'dark:shadow-primary/20',
        ],
        // 현재 플랜 스타일
        isCurrent && 'border-2 border-green-500 ring-2 ring-green-500/20',
        // 기본 호버 스타일
        !isPopular && !isCurrent && [
          'hover:shadow-xl hover:-translate-y-2 hover:border-primary/50',
          'hover:ring-2 hover:ring-primary/10',
        ]
      )}
    >
      {/* 상단 그라데이션 바 */}
      <div className={cn(
        'h-1.5 w-full',
        isPopular ? 'bg-gradient-to-r from-primary via-purple-500 to-pink-500' :
        isCurrent ? 'bg-green-500' :
        `bg-gradient-to-r ${theme.gradientFrom} ${theme.gradientTo}`
      )} />

      {/* 배경 그라데이션 */}
      <div className={cn(
        'absolute inset-0 opacity-0 transition-opacity duration-300',
        'bg-gradient-to-b',
        theme.gradientFrom,
        theme.gradientTo,
        'dark:from-transparent dark:to-transparent',
        'group-hover:opacity-100',
        isPopular && 'opacity-50 group-hover:opacity-70'
      )} />

      {/* 인기 뱃지 */}
      {isPopular && (
        <div className="absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Badge className={cn(
            'px-4 py-1 text-sm font-semibold shadow-lg',
            theme.badgeBg, 'text-white border-0'
          )}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            가장 인기
          </Badge>
        </div>
      )}

      {/* 현재 플랜 뱃지 */}
      {isCurrent && !isPopular && (
        <div className="absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Badge className="px-4 py-1 text-sm font-semibold bg-green-500 text-white border-0 shadow-lg">
            <Check className="h-3.5 w-3.5 mr-1.5" />
            현재 플랜
          </Badge>
        </div>
      )}

      <CardHeader className={cn('relative text-center', (isPopular || isCurrent) && 'pt-8')}>
        {/* 플랜 아이콘 */}
        <div className="flex justify-center mb-4">
          <div className={cn(
            'p-4 rounded-2xl transition-transform duration-300 group-hover:scale-110',
            theme.iconBg
          )}>
            <PlanIcon className={cn('h-8 w-8', theme.iconColor)} />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">{name}</CardTitle>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardHeader>

      <CardContent className="relative flex-1">
        {/* 가격 섹션 */}
        <div className="text-center mb-8">
          <div key={billingCycle} className="relative">
            {/* 연간 할인 배지 */}
            {!isFreePlan && billingCycle === 'yearly' && discount > 0 && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-green-500 text-white text-xs px-2 py-0.5 shadow-sm">
                  {discount}% 절약
                </Badge>
              </div>
            )}

            <div className="text-5xl font-bold tracking-tight">
              {isFreePlan ? (
                <span className="text-muted-foreground">무료</span>
              ) : (
                <>
                  <span className={cn(isPopular && 'text-primary')}>
                    {formatPrice(monthlyEquivalent)}
                  </span>
                  <span className="text-lg font-normal text-muted-foreground ml-1">
                    /월
                  </span>
                </>
              )}
            </div>

            {!isFreePlan && billingCycle === 'yearly' && (
              <p className="text-sm text-muted-foreground mt-2">
                연간 결제 시 <span className="font-medium text-foreground">{formatPrice(currentPrice)}</span>
              </p>
            )}
            {!isFreePlan && billingCycle === 'monthly' && (
              <p className="text-sm text-muted-foreground mt-2">
                연간 결제 시 17% 할인
              </p>
            )}
          </div>
        </div>

        {/* 구분선 */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-dashed" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-3 text-xs text-muted-foreground">포함 기능</span>
          </div>
        </div>

        {/* 기능 목록 */}
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3 group/item">
              <div className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5',
                'bg-primary/10 text-primary',
                'group-hover/item:bg-primary group-hover/item:text-primary-foreground',
                'transition-colors duration-200'
              )}>
                <Check className="h-3 w-3" />
              </div>
              <span className="text-sm leading-relaxed">
                {feature}
                {/* Pro 이상 전용 기능 하이라이트 */}
                {id !== 'starter' && isProFeature(feature) && (
                  <Badge
                    variant="secondary"
                    className="ml-2 text-[10px] px-1.5 py-0 bg-primary/10 text-primary font-medium"
                  >
                    Pro+
                  </Badge>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="relative pt-4">
        <Button
          className={cn(
            'w-full h-12 text-base font-semibold transition-all duration-300',
            isPopular && 'bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25',
            !isPopular && !isFreePlan && !isCurrent && 'hover:shadow-md'
          )}
          variant={isPopular ? 'default' : isCurrent ? 'secondary' : 'outline'}
          disabled={isFreePlan || isCurrent || isLoading}
          onClick={handleClick}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              처리 중...
            </span>
          ) : isCurrent ? (
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              현재 사용 중
            </span>
          ) : isFreePlan ? (
            '기본 플랜'
          ) : (
            <span className="flex items-center gap-2">
              시작하기
              <span className="text-xs opacity-75">→</span>
            </span>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
});

PricingCard.displayName = 'PricingCard';
