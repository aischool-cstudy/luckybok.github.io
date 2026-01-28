'use client';

import { Coins, AlertCircle, Clock, Zap } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { useCreditBalance, useRemainingGenerations } from '@/hooks/queries';
import { cn } from '@/lib/cn';

interface CreditsDisplayProps {
  compact?: boolean;
  className?: string;
}

/**
 * 크레딧 및 생성 횟수 표시 컴포넌트
 */
export function CreditsDisplay({ compact = false, className }: CreditsDisplayProps) {
  const { data: creditBalance, isLoading: isLoadingCredits } = useCreditBalance();
  const { data: generations, isLoading: isLoadingGenerations } = useRemainingGenerations();

  if (isLoadingCredits || isLoadingGenerations) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="p-4">
          <div className="h-16 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const dailyRemaining = generations?.remaining ?? 0;
  const dailyLimit = generations?.limit ?? 10;
  const plan = generations?.plan ?? 'starter';
  const credits = creditBalance?.balance ?? 0;
  const expiringCredits = creditBalance?.expiringCredits ?? 0;
  const expiringDate = creditBalance?.expiringDate;

  // 전체 사용 가능한 생성 횟수 (일일 + 크레딧)
  const totalAvailable = dailyRemaining + credits;
  const hasLowResources = totalAvailable <= 5;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-4 text-sm', className)}>
        <div className="flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-primary" />
          <span>오늘 {dailyRemaining}회</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Coins className="h-4 w-4 text-yellow-500" />
          <span>{credits} 크레딧</span>
        </div>
        {hasLowResources && (
          <Link href="/payment/credits">
            <Button variant="outline" size="sm">
              충전
            </Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <Card className={cn(hasLowResources ? 'border-orange-500/50' : '', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Coins className="h-4 w-4" />
          생성 가능 횟수
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 일일 생성 횟수 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">오늘 남은 횟수</p>
              <p className="text-xs text-muted-foreground capitalize">{plan} 플랜</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">
              {dailyRemaining}
              <span className="text-sm text-muted-foreground font-normal">/{dailyLimit}</span>
            </p>
          </div>
        </div>

        {/* 크레딧 잔액 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-sm font-medium">크레딧 잔액</p>
              <p className="text-xs text-muted-foreground">일일 횟수 소진 후 사용</p>
            </div>
          </div>
          <p className="text-2xl font-bold">{credits}</p>
        </div>

        {/* 만료 예정 크레딧 경고 */}
        {expiringCredits > 0 && expiringDate && (
          <div className="flex items-start gap-2 p-2 bg-orange-500/10 rounded-md">
            <Clock className="h-4 w-4 text-orange-500 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-orange-500">
                {expiringCredits} 크레딧 만료 예정
              </p>
              <p className="text-muted-foreground">
                {new Date(expiringDate).toLocaleDateString('ko-KR')}까지
              </p>
            </div>
          </div>
        )}

        {/* 부족 경고 */}
        {hasLowResources && (
          <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-md">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-destructive">
                생성 가능 횟수가 부족합니다
              </p>
              <p className="text-muted-foreground">
                크레딧을 충전하거나 플랜을 업그레이드하세요
              </p>
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          <Link href="/payment/credits" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              크레딧 충전
            </Button>
          </Link>
          {plan === 'starter' && (
            <Link href="/pricing" className="flex-1">
              <Button variant="default" size="sm" className="w-full">
                업그레이드
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
