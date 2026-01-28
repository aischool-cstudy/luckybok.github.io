'use client';

/**
 * 크레딧 패키지 카드 컴포넌트
 */

import { Coins } from 'lucide-react';
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
        'relative flex flex-col',
        isPopular && 'border-primary shadow-lg'
      )}
    >
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
          인기
        </Badge>
      )}

      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Coins className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">{name}</CardTitle>
        <CardDescription>
          크레딧당 {formatPrice(pricePerCredit)}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 text-center">
        <div className="text-5xl font-bold text-primary mb-2">{credits}</div>
        <p className="text-muted-foreground">크레딧</p>

        <div className="mt-4 text-3xl font-bold">{formatPrice(price)}</div>

        <p className="mt-2 text-sm text-muted-foreground">
          유효기간 {validityDays}일
        </p>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          variant={isPopular ? 'default' : 'outline'}
          disabled={isLoading}
          onClick={handleClick}
        >
          {isLoading ? '처리 중...' : '구매하기'}
        </Button>
      </CardFooter>
    </Card>
  );
}
