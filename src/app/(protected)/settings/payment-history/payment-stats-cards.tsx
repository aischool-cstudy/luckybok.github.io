'use client';

/**
 * 결제 통계 요약 카드 컴포넌트
 */

import { CreditCard, TrendingUp, RefreshCcw, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatPrice } from '@/config/pricing';
import { cn } from '@/lib/utils';

interface PaymentStatsCardsProps {
  stats: {
    totalAmount: number;
    refundedAmount: number;
    thisMonthAmount: number;
    completedCount: number;
    refundedCount: number;
  };
}

export function PaymentStatsCards({ stats }: PaymentStatsCardsProps) {
  const statItems = [
    {
      label: '총 결제 금액',
      value: formatPrice(stats.totalAmount),
      subtext: `${stats.completedCount}건 결제`,
      icon: CreditCard,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: '이번 달 결제',
      value: formatPrice(stats.thisMonthAmount),
      subtext: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' }),
      icon: Calendar,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: '환불 금액',
      value: formatPrice(stats.refundedAmount),
      subtext: `${stats.refundedCount}건 환불`,
      icon: RefreshCcw,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      label: '순 결제 금액',
      value: formatPrice(stats.totalAmount - stats.refundedAmount),
      subtext: '총 결제 - 환불',
      icon: TrendingUp,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statItems.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-bold tracking-tight">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.subtext}</p>
              </div>
              <div className={cn('p-2 rounded-lg', item.bgColor)}>
                <item.icon className={cn('h-5 w-5', item.iconColor)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
