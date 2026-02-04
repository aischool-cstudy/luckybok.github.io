'use client';

/**
 * 크레딧 패키지 카드 컴포넌트
 * - 향상된 가치 제안 시각화
 * - 절약율 강조
 * - 호버 애니메이션
 */

import { memo } from 'react';
import { Coins, Sparkles, TrendingDown, Clock, Zap, Check } from 'lucide-react';
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

interface CreditPackageCardProps {
  id: string;
  name: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  validityDays: number;
  isPopular?: boolean;
  isBestValue?: boolean;
  savingsPercent?: number;
  isLoading?: boolean;
  onPurchase?: (packageId: string) => void;
}

// 패키지별 테마
const PACKAGE_THEMES: Record<string, {
  gradient: string;
  iconBg: string;
  iconColor: string;
  accentColor: string;
}> = {
  basic: {
    gradient: 'from-slate-500 to-slate-600',
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    iconColor: 'text-slate-500',
    accentColor: 'text-slate-600 dark:text-slate-400',
  },
  standard: {
    gradient: 'from-blue-500 to-indigo-500',
    iconBg: 'bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40',
    iconColor: 'text-blue-500',
    accentColor: 'text-blue-600 dark:text-blue-400',
  },
  premium: {
    gradient: 'from-amber-500 via-orange-500 to-yellow-500',
    iconBg: 'bg-gradient-to-br from-amber-100 via-orange-100 to-yellow-100 dark:from-amber-900/40 dark:via-orange-900/40 dark:to-yellow-900/40',
    iconColor: 'text-amber-500',
    accentColor: 'text-amber-600 dark:text-amber-400',
  },
};

export const CreditPackageCard = memo(function CreditPackageCard({
  id,
  name,
  credits,
  price,
  pricePerCredit,
  validityDays,
  isPopular = false,
  isBestValue = false,
  savingsPercent,
  isLoading = false,
  onPurchase,
}: CreditPackageCardProps) {
  const handleClick = () => {
    if (onPurchase) {
      onPurchase(id);
    }
  };

  const theme = PACKAGE_THEMES[id] ?? {
    gradient: 'from-slate-500 to-slate-600',
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    iconColor: 'text-slate-500',
    accentColor: 'text-slate-600 dark:text-slate-400',
  };

  return (
    <Card
      className={cn(
        'relative flex flex-col overflow-hidden transition-all duration-300 ease-out group',
        // 인기 패키지
        isPopular && [
          'border-2 border-primary shadow-xl scale-[1.02] z-10',
          'ring-4 ring-primary/20',
        ],
        // 최저가 패키지
        isBestValue && !isPopular && [
          'border-2 border-green-500',
          'ring-2 ring-green-500/20',
        ],
        // 기본 호버
        !isPopular && !isBestValue && [
          'hover:shadow-xl hover:-translate-y-2',
          'hover:border-primary/50 hover:ring-2 hover:ring-primary/10',
        ]
      )}
    >
      {/* 상단 그라데이션 바 */}
      <div className={cn(
        'h-1.5 w-full bg-gradient-to-r',
        isPopular ? 'from-primary via-purple-500 to-pink-500' :
        isBestValue ? 'from-green-400 via-green-500 to-emerald-500' :
        theme.gradient
      )} />

      {/* 배경 효과 */}
      <div className={cn(
        'absolute inset-0 opacity-0 transition-opacity duration-300',
        'bg-gradient-to-b from-primary/5 to-transparent',
        'group-hover:opacity-100'
      )} />

      {/* 뱃지들 */}
      {(isPopular || isBestValue) && (
        <div className="absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-2">
          {isPopular && (
            <Badge className="px-4 py-1 bg-gradient-to-r from-primary to-purple-600 text-white border-0 shadow-lg">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              가장 인기
            </Badge>
          )}
          {isBestValue && !isPopular && (
            <Badge className="px-4 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-lg">
              <TrendingDown className="h-3.5 w-3.5 mr-1.5" />
              최저가
            </Badge>
          )}
        </div>
      )}

      <CardHeader className={cn('relative text-center', (isPopular || isBestValue) && 'pt-8')}>
        {/* 아이콘 */}
        <div className={cn(
          'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl',
          'transition-transform duration-300 group-hover:scale-110',
          theme.iconBg
        )}>
          <Coins className={cn('h-8 w-8', theme.iconColor)} />
        </div>
        <CardTitle className="text-2xl font-bold">{name}</CardTitle>
        <CardDescription className="flex items-center justify-center gap-1.5 text-base">
          크레딧당
          <span className={cn(
            'font-bold text-lg',
            isBestValue ? 'text-green-600 dark:text-green-400' : theme.accentColor
          )}>
            {formatPrice(pricePerCredit)}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="relative flex-1 text-center">
        {/* 크레딧 수량 - 강조된 디자인 */}
        <div className="relative py-4">
          {/* 배경 원 */}
          <div className={cn(
            'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-28 h-28 rounded-full opacity-10',
            'bg-gradient-to-br',
            isPopular ? 'from-primary to-purple-500' :
            isBestValue ? 'from-green-400 to-emerald-500' :
            'from-yellow-400 to-orange-400'
          )} />

          <div className={cn(
            'relative text-6xl font-bold tracking-tight',
            isPopular ? 'text-primary' :
            isBestValue ? 'text-green-600 dark:text-green-400' :
            theme.accentColor
          )}>
            {credits}
          </div>
          <p className="text-muted-foreground font-medium">크레딧</p>
        </div>

        {/* 구분선 */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-dashed" />
          </div>
        </div>

        {/* 가격 */}
        <div className="space-y-2">
          <div className="text-3xl font-bold">{formatPrice(price)}</div>

          {/* 절약율 표시 */}
          {savingsPercent && savingsPercent > 0 ? (
            <div className="flex items-center justify-center gap-2">
              <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                <TrendingDown className="h-3 w-3 mr-1" />
                {savingsPercent}% 절약
              </Badge>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">기본 패키지</p>
          )}
        </div>

        {/* 유효기간 및 혜택 */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            유효기간 {validityDays}일
          </div>

          {/* 추가 혜택 표시 */}
          {(isPopular || isBestValue) && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <Check className={cn(
                'h-4 w-4',
                isBestValue ? 'text-green-500' : 'text-primary'
              )} />
              <span className={cn(
                isBestValue ? 'text-green-600 dark:text-green-400' : 'text-primary'
              )}>
                {isBestValue ? '가장 경제적인 선택' : '가장 많이 선택'}
              </span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="relative pt-4">
        <Button
          className={cn(
            'w-full h-12 text-base font-semibold transition-all duration-300',
            isPopular && 'bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25',
            isBestValue && !isPopular && 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-500/25',
            !isPopular && !isBestValue && 'hover:shadow-md'
          )}
          variant={isPopular || isBestValue ? 'default' : 'outline'}
          disabled={isLoading}
          onClick={handleClick}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              처리 중...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              구매하기
            </span>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
});

CreditPackageCard.displayName = 'CreditPackageCard';
