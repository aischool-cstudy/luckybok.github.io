'use client';

/**
 * 요금제 선택기 컴포넌트
 * - 향상된 결제 주기 토글 (Zustand 상태 관리)
 * - 할인 배너 강조
 * - 반응형 그리드
 * - 플랜 비교 테이블 토글
 */

import { useState } from 'react';
import { Sparkles, Gift, Zap, Table2, LayoutGrid, ChevronDown } from 'lucide-react';
import { PricingCard } from '@/components/features/payment/pricing-card';
import { PlanComparisonTable } from './plan-comparison-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { plans, formatPrice } from '@/config/pricing';
import { usePaymentStore } from '@/stores';
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
  // Zustand 스토어에서 결제 주기 상태 관리 (전역 동기화)
  const { billingCycle, setBillingCycle } = usePaymentStore();
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showComparison, setShowComparison] = useState(false);

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

  // 연간 결제 시 절약 금액 계산 (Pro 기준)
  const yearlySavings = plans.pro.price.monthly * 12 - plans.pro.price.yearly;

  return (
    <div className="space-y-10">
      {/* 할인 배너 - 더 눈에 띄게 */}
      <div className="flex justify-center">
        <div className={cn(
          'relative inline-flex items-center gap-3 px-6 py-3 rounded-full',
          'bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10',
          'border border-green-500/20',
          'shadow-lg shadow-green-500/5',
          'animate-in fade-in slide-in-from-bottom-2 duration-500'
        )}>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
            <Gift className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-green-700 dark:text-green-300">
              연간 결제 시 17% 할인
            </p>
            <p className="text-xs text-green-600/80 dark:text-green-400/80">
              Pro 플랜 기준 연 {formatPrice(yearlySavings)} 절약
            </p>
          </div>
          <Sparkles className="h-4 w-4 text-green-500 animate-pulse" />
        </div>
      </div>

      {/* 결제 주기 토글 + 뷰 모드 토글 */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        {/* 결제 주기 토글 */}
        <div
          className={cn(
            'relative inline-flex items-center p-1.5 rounded-xl',
            'bg-muted/80 backdrop-blur-sm',
            'border shadow-inner'
          )}
          role="tablist"
          aria-label="결제 주기 선택"
        >
          {/* 슬라이딩 배경 */}
          <div
            className={cn(
              'absolute top-1.5 h-[calc(100%-12px)] w-[calc(50%-6px)] rounded-lg',
              'bg-background shadow-md',
              'transition-all duration-300 ease-out',
              billingCycle === 'monthly' ? 'left-1.5' : 'left-[calc(50%+2px)]'
            )}
            aria-hidden="true"
          />

          <button
            type="button"
            role="tab"
            aria-selected={billingCycle === 'monthly'}
            aria-controls="plan-cards"
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-lg',
              'text-sm font-medium transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              billingCycle === 'monthly'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Zap className={cn(
              'h-4 w-4 transition-colors',
              billingCycle === 'monthly' ? 'text-primary' : ''
            )} aria-hidden="true" />
            월간 결제
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={billingCycle === 'yearly'}
            aria-controls="plan-cards"
            onClick={() => setBillingCycle('yearly')}
            className={cn(
              'relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-lg',
              'text-sm font-medium transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              billingCycle === 'yearly'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Gift className={cn(
              'h-4 w-4 transition-colors',
              billingCycle === 'yearly' ? 'text-green-500' : ''
            )} aria-hidden="true" />
            연간 결제
            <Badge
              className={cn(
                'text-[10px] px-2 py-0.5 font-semibold border-0',
                billingCycle === 'yearly'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-500/20 text-green-600 dark:text-green-400'
              )}
              aria-label="17% 할인"
            >
              -17%
            </Badge>
          </button>
        </div>

        {/* 뷰 모드 토글 (데스크탑만) */}
        <div className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-muted/50 border">
          <Button
            variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-3"
            onClick={() => setViewMode('cards')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-3"
            onClick={() => setViewMode('table')}
          >
            <Table2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 요금제 카드 뷰 */}
      {viewMode === 'cards' && (
        <div
          id="plan-cards"
          role="tabpanel"
          aria-label={`${billingCycle === 'monthly' ? '월간' : '연간'} 결제 플랜 목록`}
          className="grid gap-6 lg:gap-8 md:grid-cols-3 items-start animate-in fade-in duration-300"
        >
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
      )}

      {/* 요금제 테이블 뷰 */}
      {viewMode === 'table' && (
        <div className="animate-in fade-in duration-300">
          <PlanComparisonTable currentPlan={currentPlan} className="border rounded-xl" />
        </div>
      )}

      {/* 플랜 비교 토글 (카드 뷰에서만) */}
      {viewMode === 'cards' && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowComparison(!showComparison)}
          >
            <Table2 className="h-4 w-4" />
            플랜 상세 비교
            <ChevronDown className={cn(
              'h-4 w-4 transition-transform duration-200',
              showComparison && 'rotate-180'
            )} />
          </Button>
        </div>
      )}

      {/* 플랜 비교 테이블 (펼침) */}
      {viewMode === 'cards' && showComparison && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <PlanComparisonTable currentPlan={currentPlan} className="border rounded-xl" />
        </div>
      )}

      {/* 하단 안내 */}
      <div className="text-center space-y-2 pt-4">
        <p className="text-sm text-muted-foreground">
          모든 플랜은 언제든지 변경하거나 취소할 수 있습니다
        </p>
        <p className="text-xs text-muted-foreground/70">
          VAT 포함 가격 • 카드 결제만 가능
        </p>
      </div>
    </div>
  );
}
