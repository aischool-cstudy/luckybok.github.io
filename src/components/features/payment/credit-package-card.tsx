'use client';

/**
 * 크레딧 패키지 카드 컴포넌트
 */

import { Coins, Sparkles, TrendingDown, Clock } from 'lucide-react';
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

export function CreditPackageCard({
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

  return (
    <Card
      className={cn(
        'relative flex flex-col transition-all duration-300 ease-out',
        isPopular && 'border-primary shadow-lg scale-105 ring-4 ring-primary/10',
        isBestValue && !isPopular && 'border-green-500 ring-2 ring-green-500/20',
        !isPopular && !isBestValue && 'hover:shadow-xl hover:-translate-y-1 hover:border-primary/50'
      )}
    >
      {/* 뱃지들 */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-2">
        {isPopular && (
          <Badge className="bg-primary">
            <Sparkles className="h-3 w-3 mr-1" />
            인기
          </Badge>
        )}
        {isBestValue && (
          <Badge className="bg-green-500 hover:bg-green-600">
            <TrendingDown className="h-3 w-3 mr-1" />
            최저가
          </Badge>
        )}
      </div>

      <CardHeader className="text-center pt-8">
        {/* 아이콘 */}
        <div className={cn(
          'mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full',
          'bg-gradient-to-br from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-800/20'
        )}>
          <Coins className="h-7 w-7 text-yellow-500" />
        </div>
        <CardTitle className="text-xl">{name}</CardTitle>
        <CardDescription className="flex items-center justify-center gap-1">
          크레딧당
          <span className={cn(
            'font-semibold',
            isBestValue ? 'text-green-600 dark:text-green-400' : 'text-foreground'
          )}>
            {formatPrice(pricePerCredit)}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 text-center">
        {/* 크레딧 수량 */}
        <div className="relative">
          <div className={cn(
            'text-5xl font-bold mb-1',
            isPopular ? 'text-primary' : isBestValue ? 'text-green-600 dark:text-green-400' : 'text-yellow-500'
          )}>
            {credits}
          </div>
          <p className="text-muted-foreground">크레딧</p>
        </div>

        {/* 가격 */}
        <div className="mt-4">
          <div className="text-3xl font-bold">{formatPrice(price)}</div>
          {savingsPercent && savingsPercent > 0 && (
            <Badge variant="secondary" className="mt-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {savingsPercent}% 절약
            </Badge>
          )}
        </div>

        {/* 유효기간 */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          유효기간 {validityDays}일
        </div>
      </CardContent>

      <CardFooter>
        <Button
          className={cn(
            'w-full',
            isBestValue && !isPopular && 'bg-green-500 hover:bg-green-600'
          )}
          variant={isPopular ? 'default' : isBestValue ? 'default' : 'outline'}
          disabled={isLoading}
          onClick={handleClick}
        >
          {isLoading ? '처리 중...' : '구매하기'}
        </Button>
      </CardFooter>
    </Card>
  );
}
