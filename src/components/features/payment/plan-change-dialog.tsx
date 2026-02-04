'use client';

/**
 * 플랜 변경 다이얼로그
 * - 업그레이드: 즉시 적용, 비례 배분 결제
 * - 다운그레이드: 기간 종료 후 적용
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Calendar,
  CheckCircle2,
  Crown,
  Loader2,
  AlertCircle,
  Zap,
  Info,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button, Badge } from '@/components/ui';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { preparePlanChange, confirmPlanChange } from '@/actions/subscription';
import { PLANS, getPlanPrice, getYearlyDiscount } from '@/lib/payment/plans';
import { formatPrice } from '@/config/pricing';
import { cn } from '@/lib/cn';
import type { PlanType, BillingCycle, PreparePlanChangeResponse } from '@/types/payment.types';

interface PlanChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: Exclude<PlanType, 'starter'>;
  currentBillingCycle: BillingCycle;
  onSuccess?: () => void;
}

type Step = 'select' | 'confirm' | 'processing' | 'success';

const AVAILABLE_PLANS: Exclude<PlanType, 'starter' | 'enterprise'>[] = ['pro', 'team'];

export function PlanChangeDialog({
  open,
  onOpenChange,
  currentPlan,
  currentBillingCycle,
  onSuccess,
}: PlanChangeDialogProps) {
  const getInitialPlan = useCallback(
    () => (currentPlan === 'enterprise' ? 'team' : currentPlan) as Exclude<PlanType, 'starter' | 'enterprise'>,
    [currentPlan]
  );

  const [step, setStep] = useState<Step>('select');
  const [selectedPlan, setSelectedPlan] = useState<Exclude<PlanType, 'starter' | 'enterprise'>>(getInitialPlan);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>(currentBillingCycle);
  const [prorationData, setProrationData] = useState<PreparePlanChangeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 다이얼로그가 열릴 때 초기화 - 단일 상태 객체로 배치 업데이트
  useEffect(() => {
    if (open) {
      // React 18+ 자동 배치 활용
      const initialPlan = getInitialPlan();
      Promise.resolve().then(() => {
        setStep('select');
        setSelectedPlan(initialPlan);
        setSelectedCycle(currentBillingCycle);
        setProrationData(null);
        setError(null);
      });
    }
  }, [open, getInitialPlan, currentBillingCycle]);

  // 플랜/주기 변경 시 비례 배분 계산
  const calculateProration = useCallback(async () => {
    if (selectedPlan === currentPlan && selectedCycle === currentBillingCycle) {
      setProrationData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await preparePlanChange({
      newPlan: selectedPlan,
      newBillingCycle: selectedCycle,
    });

    if (result.success && result.data) {
      setProrationData(result.data);
    } else {
      setError(result.error || '플랜 변경 정보를 가져오는데 실패했습니다');
    }

    setIsLoading(false);
  }, [selectedPlan, selectedCycle, currentPlan, currentBillingCycle]);

  useEffect(() => {
    if (open && step === 'select') {
      const timer = setTimeout(calculateProration, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open, step, calculateProration]);

  // 플랜 변경 확정
  const handleConfirmChange = async () => {
    if (!prorationData) return;

    setStep('processing');
    setError(null);

    const result = await confirmPlanChange({
      newPlan: selectedPlan,
      newBillingCycle: selectedCycle,
      orderId: prorationData.orderId,
    });

    if (result.success) {
      setStep('success');
      setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
      }, 2000);
    } else {
      setError(result.error || '플랜 변경에 실패했습니다');
      setStep('confirm');
    }
  };

  const isSamePlan = selectedPlan === currentPlan && selectedCycle === currentBillingCycle;
  const changeType = prorationData?.changeType;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            플랜 변경
          </DialogTitle>
          <DialogDescription>새로운 플랜을 선택하고 변경 내용을 확인하세요.</DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-6 py-4">
            {/* 플랜 선택 */}
            <div>
              <Label className="text-sm font-medium mb-3 block">플랜 선택</Label>
              <RadioGroup
                value={selectedPlan}
                onValueChange={(value) => setSelectedPlan(value as typeof selectedPlan)}
                className="grid gap-3"
              >
                {AVAILABLE_PLANS.map((planId) => {
                  const plan = PLANS[planId];
                  const isCurrentPlan = planId === currentPlan;
                  const monthlyPrice = plan.price.monthly;

                  return (
                    <div
                      key={planId}
                      className={cn(
                        'flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
                        selectedPlan === planId
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-muted-foreground/30'
                      )}
                      onClick={() => setSelectedPlan(planId)}
                    >
                      <RadioGroupItem value={planId} id={planId} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={planId} className="font-semibold cursor-pointer">
                            {plan.name}
                          </Label>
                          {'isPopular' in plan && plan.isPopular && (
                            <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-xs">
                              인기
                            </Badge>
                          )}
                          {isCurrentPlan && (
                            <Badge variant="outline" className="text-xs">
                              현재
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{formatPrice(monthlyPrice)}</div>
                        <div className="text-xs text-muted-foreground">/월</div>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            {/* 결제 주기 선택 */}
            <div>
              <Label className="text-sm font-medium mb-3 block">결제 주기</Label>
              <div className="grid grid-cols-2 gap-3">
                {(['monthly', 'yearly'] as const).map((cycle) => {
                  const price = getPlanPrice(selectedPlan, cycle);
                  const isYearly = cycle === 'yearly';
                  const discount = isYearly ? getYearlyDiscount(selectedPlan) : 0;

                  return (
                    <button
                      key={cycle}
                      type="button"
                      onClick={() => setSelectedCycle(cycle)}
                      className={cn(
                        'relative p-4 rounded-xl border-2 text-left transition-all',
                        selectedCycle === cycle
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-muted-foreground/30'
                      )}
                    >
                      {isYearly && discount > 0 && (
                        <Badge className="absolute -top-2 right-2 bg-green-500">
                          {discount}% 할인
                        </Badge>
                      )}
                      <div className="font-medium">{isYearly ? '연간 결제' : '월간 결제'}</div>
                      <div className="text-lg font-bold mt-1">{formatPrice(price)}</div>
                      <div className="text-xs text-muted-foreground">
                        {isYearly ? '/ 년' : '/ 월'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 비례 배분 미리보기 */}
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">계산 중...</span>
              </div>
            )}

            {prorationData && !isLoading && (
              <div
                className={cn(
                  'p-4 rounded-xl border',
                  changeType === 'upgrade'
                    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                    : changeType === 'downgrade'
                      ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800'
                      : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                )}
              >
                <div className="flex items-start gap-3">
                  {changeType === 'upgrade' ? (
                    <ArrowUp className="h-5 w-5 text-green-500 mt-0.5" />
                  ) : changeType === 'downgrade' ? (
                    <ArrowDown className="h-5 w-5 text-orange-500 mt-0.5" />
                  ) : (
                    <ArrowRight className="h-5 w-5 text-blue-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">
                      {changeType === 'upgrade'
                        ? '업그레이드'
                        : changeType === 'downgrade'
                          ? '다운그레이드'
                          : '결제 주기 변경'}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{prorationData.summary}</p>

                    {prorationData.requiresPayment && prorationData.proratedAmount > 0 && (
                      <div className="mt-3 p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">추가 결제 금액</span>
                          <span className="font-bold text-lg">
                            {formatPrice(prorationData.proratedAmount)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          남은 {prorationData.daysRemaining}일에 대한 비례 배분
                        </div>
                      </div>
                    )}

                    {!prorationData.requiresPayment && changeType === 'downgrade' && (
                      <div className="flex items-center gap-2 mt-3 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {new Date(prorationData.effectiveDate).toLocaleDateString('ko-KR')}에 변경
                          적용
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isSamePlan && (
              <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                <Info className="h-4 w-4" />
                현재 플랜과 동일합니다. 다른 플랜이나 결제 주기를 선택하세요.
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'confirm' && prorationData && (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <div className="inline-flex items-center gap-3 mb-4">
                <div className="p-3 bg-muted rounded-xl">
                  <Crown className="h-6 w-6" />
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Crown className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-lg font-semibold">
                {PLANS[currentPlan].name} → {PLANS[selectedPlan].name}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedCycle === 'yearly' ? '연간' : '월간'} 결제
              </p>
            </div>

            <div className="space-y-3">
              {prorationData.requiresPayment && (
                <div className="flex justify-between items-center p-4 bg-muted/30 rounded-lg">
                  <span>결제 금액</span>
                  <span className="font-bold text-xl">
                    {formatPrice(prorationData.proratedAmount)}
                  </span>
                </div>
              )}

              <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                {changeType === 'upgrade' && (
                  <div className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>즉시 새 플랜의 모든 혜택을 이용할 수 있습니다</span>
                  </div>
                )}
                {changeType === 'downgrade' && (
                  <>
                    <div className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>
                        현재 기간 종료 시({new Date(prorationData.effectiveDate).toLocaleDateString('ko-KR')}) 변경됩니다
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>그 전까지 현재 플랜을 계속 사용할 수 있습니다</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'processing' && (
          <div className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="mt-4 text-muted-foreground">플랜 변경 처리 중...</p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">플랜 변경 완료!</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {changeType === 'upgrade'
                ? '새 플랜이 즉시 적용되었습니다.'
                : '플랜 변경이 예약되었습니다.'}
            </p>
          </div>
        )}

        {(step === 'select' || step === 'confirm') && (
          <DialogFooter className="gap-2 sm:gap-0">
            {step === 'select' && (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  취소
                </Button>
                <Button
                  onClick={() => setStep('confirm')}
                  disabled={isSamePlan || !prorationData || isLoading}
                >
                  다음
                </Button>
              </>
            )}

            {step === 'confirm' && (
              <>
                <Button variant="outline" onClick={() => setStep('select')}>
                  이전
                </Button>
                <Button onClick={handleConfirmChange}>
                  {prorationData?.requiresPayment
                    ? `${formatPrice(prorationData.proratedAmount)} 결제`
                    : '변경 예약'}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
