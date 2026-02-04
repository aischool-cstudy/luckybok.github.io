'use client';

/**
 * 구독 관리 섹션
 * - 현재 플랜 정보 및 혜택 표시
 * - 구독 상태 시각화 (활성, 취소 예정 등)
 * - 다음 결제일까지 남은 일수
 * - 플랜 변경/취소 기능
 * - 예약된 플랜 변경 표시
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  AlertCircle,
  Crown,
  Loader2,
  CheckCircle2,
  ArrowUpRight,
  Zap,
  Clock,
  RefreshCw,
  Sparkles,
  ArrowDown,
  X,
} from 'lucide-react';
import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@/components/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  cancelSubscription,
  reactivateSubscription,
  type SubscriptionInfo,
} from '@/actions/billing';
import { cancelScheduledPlanChange } from '@/actions/subscription';
import { PlanChangeDialog } from '@/components/features/payment/plan-change-dialog';
import { PLANS, getPlanPrice, getYearlyDiscount } from '@/lib/payment/plans';
import type { PlanType, BillingCycle, ScheduledPlanChange } from '@/types/payment.types';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/config/pricing';

interface SubscriptionSectionProps {
  subscription: SubscriptionInfo | null;
  currentPlan: PlanType;
  scheduledChange?: ScheduledPlanChange | null;
}

// 플랜별 테마 - 개선된 색상 시스템
const PLAN_COLORS: Record<PlanType, {
  bg: string;
  border: string;
  text: string;
  icon: string;
  gradient: string;
  iconBg: string;
}> = {
  starter: {
    bg: 'bg-slate-50 dark:bg-slate-900/50',
    border: 'border-slate-200 dark:border-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    icon: 'text-slate-500',
    gradient: 'from-slate-400 to-slate-500',
    iconBg: 'bg-slate-100 dark:bg-slate-800',
  },
  pro: {
    bg: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-600 dark:text-blue-400',
    icon: 'text-blue-500',
    gradient: 'from-blue-500 to-indigo-500',
    iconBg: 'bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50',
  },
  team: {
    bg: 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-600 dark:text-purple-400',
    icon: 'text-purple-500',
    gradient: 'from-purple-500 to-pink-500',
    iconBg: 'bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50',
  },
  enterprise: {
    bg: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-600 dark:text-amber-400',
    icon: 'text-amber-500',
    gradient: 'from-amber-500 to-orange-500',
    iconBg: 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50',
  },
};

// 남은 일수 계산
function getDaysRemaining(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// 날짜 포맷
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function SubscriptionSection({ subscription, currentPlan, scheduledChange }: SubscriptionSectionProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isPlanChangeDialogOpen, setIsPlanChangeDialogOpen] = useState(false);
  const [cancelType, setCancelType] = useState<'end_of_period' | 'immediate'>('end_of_period');

  const planInfo = PLANS[currentPlan];
  const planColors = PLAN_COLORS[currentPlan];
  const daysRemaining = subscription ? getDaysRemaining(subscription.currentPeriodEnd) : 0;

  // 예약된 플랜 변경 취소 핸들러
  const handleCancelScheduledChange = async () => {
    setIsLoading(true);
    setError(null);

    const result = await cancelScheduledPlanChange();

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error || '예약 취소에 실패했습니다');
    }

    setIsLoading(false);
  };

  // 플랜 변경 성공 핸들러
  const handlePlanChangeSuccess = () => {
    router.refresh();
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    setIsLoading(true);
    setError(null);

    const result = await cancelSubscription(subscription.id);

    if (!result.success) {
      setError(result.error || '구독 취소에 실패했습니다');
    }

    setIsLoading(false);
    setIsCancelDialogOpen(false);
  };

  const handleReactivate = async () => {
    if (!subscription) return;

    setIsLoading(true);
    setError(null);

    const result = await reactivateSubscription(subscription.id);

    if (!result.success) {
      setError(result.error || '구독 취소 철회에 실패했습니다');
    }

    setIsLoading(false);
  };

  return (
    <Card className="overflow-hidden">
      {/* 상단 그라데이션 바 */}
      <div className={cn('h-1.5 bg-gradient-to-r', planColors.gradient)} />

      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl',
              planColors.iconBg
            )}>
              <Crown className={cn('h-6 w-6', planColors.icon)} />
            </div>
            <div>
              <CardTitle className="text-lg">구독 관리</CardTitle>
              <CardDescription>현재 구독 상태 및 플랜 정보</CardDescription>
            </div>
          </div>
          {/* 상태 배지 - 개선된 스타일 */}
          {subscription && (
            <Badge
              variant={subscription.cancelAtPeriodEnd ? 'outline' : 'default'}
              className={cn(
                'px-3 py-1',
                subscription.cancelAtPeriodEnd
                  ? 'border-orange-500 text-orange-500 bg-orange-500/10'
                  : subscription.status === 'active'
                    ? 'bg-green-500 shadow-sm'
                    : ''
              )}
            >
              {subscription.cancelAtPeriodEnd
                ? '취소 예정'
                : subscription.status === 'active'
                  ? '활성'
                  : subscription.status}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 현재 플랜 카드 */}
        <div
          className={cn(
            'relative overflow-hidden rounded-xl border-2 p-6',
            planColors.border,
            planColors.bg
          )}
        >
          {/* 배경 장식 */}
          <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-gradient-to-br from-white/20 to-transparent blur-2xl" />

          <div className="relative">
            {/* 플랜명 및 가격 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold">{planInfo.name}</h3>
                  {currentPlan === 'pro' && (
                    <Badge className="bg-gradient-to-r from-blue-500 to-purple-500">인기</Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-1">{planInfo.description}</p>
              </div>

              {currentPlan !== 'starter' && subscription && (
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {formatPrice(getPlanPrice(currentPlan, subscription.billingCycle))}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    / {subscription.billingCycle === 'monthly' ? '월' : '년'}
                    {subscription.billingCycle === 'yearly' && (
                      <span className="ml-1 text-green-500">
                        ({getYearlyDiscount(currentPlan)}% 할인)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 주요 혜택 미리보기 */}
            <div className="mt-4 flex flex-wrap gap-2">
              {planInfo.features.slice(0, 4).map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 text-sm bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-full"
                >
                  <CheckCircle2 className={cn('h-3.5 w-3.5', planColors.text)} />
                  <span>{feature}</span>
                </div>
              ))}
              {planInfo.features.length > 4 && (
                <div className="text-sm text-muted-foreground px-3 py-1.5">
                  +{planInfo.features.length - 4}개 더
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 구독 상세 정보 (유료 플랜) */}
        {subscription && currentPlan !== 'starter' && (
          <div className="space-y-4">
            {/* 기간 정보 */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* 현재 기간 */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">현재 결제 기간</p>
                  <p className="font-medium truncate">
                    {formatDate(subscription.currentPeriodStart)} ~
                  </p>
                  <p className="font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
                </div>
              </div>

              {/* 다음 결제일 / 남은 기간 */}
              <div
                className={cn(
                  'flex items-start gap-3 p-4 rounded-lg border',
                  subscription.cancelAtPeriodEnd
                    ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800'
                    : 'bg-muted/30'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    subscription.cancelAtPeriodEnd
                      ? 'bg-orange-100 dark:bg-orange-900'
                      : 'bg-background'
                  )}
                >
                  <Clock
                    className={cn(
                      'h-5 w-5',
                      subscription.cancelAtPeriodEnd
                        ? 'text-orange-500'
                        : 'text-muted-foreground'
                    )}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    {subscription.cancelAtPeriodEnd ? '서비스 종료까지' : '다음 결제까지'}
                  </p>
                  <p className="text-2xl font-bold">
                    {daysRemaining}
                    <span className="text-base font-normal text-muted-foreground ml-1">일</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 예약된 플랜 변경 알림 */}
            {scheduledChange?.hasScheduledChange && scheduledChange.scheduledPlan && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <ArrowDown className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-blue-700 dark:text-blue-300">
                    플랜 변경 예약됨
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    {scheduledChange.scheduledChangeAt &&
                      formatDate(new Date(scheduledChange.scheduledChangeAt).toISOString())}
                    에 {PLANS[scheduledChange.scheduledPlan]?.name || scheduledChange.scheduledPlan} 플랜(
                    {scheduledChange.scheduledBillingCycle === 'yearly' ? '연간' : '월간'})으로 변경됩니다.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelScheduledChange}
                    disabled={isLoading}
                    className="mt-3 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    예약 취소
                  </Button>
                </div>
              </div>
            )}

            {/* 취소 예정 경고 */}
            {subscription.cancelAtPeriodEnd && (
              <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
                <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-orange-700 dark:text-orange-300">
                    구독 취소 예정
                  </p>
                  <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                    {formatDate(subscription.currentPeriodEnd)}에 구독이 종료됩니다. 그 전까지는
                    모든 기능을 계속 이용할 수 있습니다.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReactivate}
                    disabled={isLoading}
                    className="mt-3 border-orange-300 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    구독 취소 철회
                  </Button>
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {currentPlan !== 'enterprise' && !scheduledChange?.hasScheduledChange && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => setIsPlanChangeDialogOpen(true)}
                  disabled={isLoading || subscription.cancelAtPeriodEnd}
                >
                  <Zap className="h-4 w-4" />
                  {currentPlan === 'pro' ? '플랜 업그레이드' : '플랜 변경'}
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              )}
              {scheduledChange?.hasScheduledChange && (
                <Link href="/pricing" className="flex-1">
                  <Button variant="outline" className="w-full gap-2">
                    <Zap className="h-4 w-4" />
                    다른 플랜 보기
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              {!subscription.cancelAtPeriodEnd && (
                <Button
                  variant="ghost"
                  onClick={() => setIsCancelDialogOpen(true)}
                  disabled={isLoading}
                  className="text-muted-foreground hover:text-destructive"
                >
                  구독 취소
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Starter 플랜 업그레이드 안내 */}
        {currentPlan === 'starter' && (
          <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-primary/30 p-6 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="absolute top-0 right-0 -mt-8 -mr-8">
              <Sparkles className="h-32 w-32 text-primary/10" />
            </div>
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Pro로 업그레이드하세요</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                모든 프로그래밍 언어 지원, PDF 내보내기, 일일 100회 생성 등 더 많은 기능을
                이용하세요.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {PLANS.pro.features.slice(0, 3).map((feature, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {feature}
                  </Badge>
                ))}
              </div>
              <Link href="/pricing">
                <Button className="gap-2">
                  <Zap className="h-4 w-4" />
                  업그레이드
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* 플랜 변경 다이얼로그 */}
        {subscription && currentPlan !== 'starter' && currentPlan !== 'enterprise' && (
          <PlanChangeDialog
            open={isPlanChangeDialogOpen}
            onOpenChange={setIsPlanChangeDialogOpen}
            currentPlan={currentPlan}
            currentBillingCycle={subscription.billingCycle as BillingCycle}
            onSuccess={handlePlanChangeSuccess}
          />
        )}

        {/* 구독 취소 다이얼로그 */}
        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                </div>
                구독을 취소하시겠습니까?
              </DialogTitle>
              <DialogDescription>
                현재 {planInfo.name} 플랜을 구독 중입니다.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <RadioGroup
                value={cancelType}
                onValueChange={(value) =>
                  setCancelType(value as 'end_of_period' | 'immediate')
                }
              >
                {/* 기간 종료 시 취소 */}
                <div
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                    cancelType === 'end_of_period'
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent bg-muted/30 hover:bg-muted/50'
                  )}
                  onClick={() => setCancelType('end_of_period')}
                >
                  <RadioGroupItem value="end_of_period" id="end_of_period" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="end_of_period" className="cursor-pointer">
                      <div className="font-medium flex items-center gap-2">
                        기간 종료 시 취소
                        <Badge variant="secondary">권장</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {subscription &&
                          `${formatDate(subscription.currentPeriodEnd)}까지 계속 사용할 수 있습니다.`}
                      </div>
                    </Label>
                  </div>
                </div>

                {/* 즉시 취소 */}
                <div
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all mt-3',
                    cancelType === 'immediate'
                      ? 'border-destructive bg-destructive/5'
                      : 'border-transparent bg-muted/30 hover:bg-muted/50'
                  )}
                  onClick={() => setCancelType('immediate')}
                >
                  <RadioGroupItem value="immediate" id="immediate" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="immediate" className="cursor-pointer">
                      <div className="font-medium text-destructive">즉시 취소</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        지금 바로 무료 플랜으로 변경됩니다. 환불은 불가합니다.
                      </div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>

              {/* 안내 사항 */}
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>참고:</strong> 취소 후에도 언제든 다시 구독할 수 있습니다.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setIsCancelDialogOpen(false)}
                disabled={isLoading}
                className="flex-1 sm:flex-none"
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelSubscription}
                disabled={isLoading}
                className="flex-1 sm:flex-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  '구독 취소'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
