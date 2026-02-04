'use client';

/**
 * 크레딧 구매 페이지
 * - 향상된 헤더 및 배경 효과
 * - 크레딧 사용량 시뮬레이터
 * - FAQ 섹션
 * - 신뢰 요소
 * - 접근성 개선 (ARIA, 키보드 탐색, 스켈레톤 로더)
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Coins,
  ArrowLeft,
  Sparkles,
  Shield,
  Check,
  Calculator,
  HelpCircle,
  ChevronDown,
  Clock,
  CreditCard,
  Lock,
  RefreshCw,
  Zap,
  TrendingDown,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { CreditBalanceSkeleton } from '@/components/ui/skeleton';
import { CreditPackageCard } from '@/components/features/payment/credit-package-card';
import { PaymentErrorBoundary } from '@/components/features/payment/payment-error-boundary';
import { creditPackages } from '@/config/pricing';
import { prepareCreditPurchase } from '@/actions/payment';
import { getCreditBalance } from '@/actions/credits';
import { useToast } from '@/hooks/use-toast';
import { useTossPayments } from '@/hooks/use-toss-payments';
import { clientLogger } from '@/lib/client-logger';
import { cn } from '@/lib/utils';

function CreditPurchaseContent() {
  const { toast } = useToast();
  const { isReady: isTossReady, requestPayment, error: tossError } = useTossPayments();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const [dailyUsage, setDailyUsage] = useState<number>(5);

  // 패키지 분석: 최저가, 절약율 계산
  const packageAnalysis = useMemo(() => {
    const basePrice = creditPackages[0].pricePerCredit; // Basic 패키지 기준
    const lowestPricePerCredit = Math.min(...creditPackages.map(p => p.pricePerCredit));

    return creditPackages.map(pkg => ({
      ...pkg,
      isBestValue: pkg.pricePerCredit === lowestPricePerCredit,
      savingsPercent: Math.round((1 - pkg.pricePerCredit / basePrice) * 100),
      estimatedDays: Math.floor(pkg.credits / dailyUsage),
    }));
  }, [dailyUsage]);

  // 추천 패키지 계산
  const recommendedPackage = useMemo(() => {
    const dailyCreditsNeeded = dailyUsage;
    const monthlyCreditsNeeded = dailyCreditsNeeded * 30;

    // 월간 사용량 기준으로 추천
    if (monthlyCreditsNeeded <= 50) return 'basic';
    if (monthlyCreditsNeeded <= 150) return 'standard';
    return 'premium';
  }, [dailyUsage]);

  useEffect(() => {
    // 크레딧 잔액 조회
    const fetchBalance = async () => {
      setIsBalanceLoading(true);
      try {
        const result = await getCreditBalance();
        if (result) {
          setCreditBalance(result.balance);
        }
      } catch (error) {
        clientLogger.error('크레딧 잔액 조회 실패', error);
        toast({
          title: '오류',
          description: '크레딧 잔액을 불러오는데 실패했습니다.',
          variant: 'destructive',
        });
      } finally {
        setIsBalanceLoading(false);
      }
    };
    fetchBalance();
  }, [toast]);

  // SDK 로드 에러 처리
  useEffect(() => {
    if (tossError) {
      toast({
        title: '오류',
        description: tossError.message,
        variant: 'destructive',
      });
    }
  }, [tossError, toast]);

  const handlePurchase = async (packageId: string) => {
    if (!isTossReady) {
      toast({
        title: '오류',
        description: '결제 시스템을 불러오는 중입니다. 잠시 후 다시 시도해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setSelectedPackage(packageId);

    try {
      const result = await prepareCreditPurchase({ packageId });

      if (!result.success || !result.data) {
        toast({
          title: '오류',
          description: result.error || '결제 준비에 실패했습니다',
          variant: 'destructive',
        });
        return;
      }

      const { orderId, amount, orderName, customerKey } = result.data;

      // 토스페이먼츠 결제 위젯 호출
      await requestPayment({
        amount,
        orderId,
        orderName,
        customerKey,
        successUrl: `${window.location.origin}/payment/success?type=credit`,
        failUrl: `${window.location.origin}/payment/fail?type=credit`,
      });
    } catch (error) {
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '결제 처리 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setSelectedPackage(null);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-orange-500/5" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 container mx-auto py-8 px-4 max-w-5xl">
        {/* 헤더 */}
        <div className="mb-10 text-center">
          <Button variant="ghost" size="sm" asChild className="mb-6">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              대시보드로 돌아가기
            </Link>
          </Button>

          {/* 아이콘 */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-xl">
                <Coins className="h-10 w-10 text-white" />
              </div>
            </div>
          </div>

          <Badge className="mb-4 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-0">
            <Sparkles className="h-3 w-3 mr-1" />
            크레딧 충전
          </Badge>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
            크레딧 구매
          </h1>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto">
            필요한 만큼 크레딧을 구매하세요. 대용량 패키지일수록 더 저렴합니다.
          </p>

          {/* 혜택 뱃지 */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <Shield className="h-3.5 w-3.5 text-green-500" />
              안전한 결제
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <Clock className="h-3.5 w-3.5 text-blue-500" />
              즉시 충전
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <TrendingDown className="h-3.5 w-3.5 text-orange-500" />
              최대 28% 절약
            </div>
          </div>
        </div>

        {/* 현재 잔액 */}
        <Card
          className="mb-10 overflow-hidden border-2 max-w-2xl mx-auto"
          role="region"
          aria-label="현재 크레딧 잔액"
        >
          <div className="h-2 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500" aria-hidden="true" />
          <CardContent className="pt-6">
            {isBalanceLoading ? (
              <CreditBalanceSkeleton />
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/40 dark:to-amber-900/40"
                    aria-hidden="true"
                  >
                    <Coins className="h-7 w-7 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium" id="credit-balance-label">
                      현재 보유 크레딧
                    </p>
                    <div className="flex items-baseline gap-2" aria-labelledby="credit-balance-label">
                      <span
                        className="text-4xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent"
                        aria-live="polite"
                      >
                        {(creditBalance ?? 0).toLocaleString()}
                      </span>
                      <span className="text-lg text-muted-foreground">크레딧</span>
                    </div>
                  </div>
                </div>
                <div
                  className="text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg"
                  aria-label="크레딧 사용 안내: 1 크레딧으로 1회 콘텐츠 생성 가능"
                >
                  1 크레딧 = 1회 콘텐츠 생성
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 사용량 시뮬레이터 */}
        <Card
          className="mb-10 overflow-hidden max-w-2xl mx-auto"
          role="region"
          aria-label="패키지 추천 계산기"
        >
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10" aria-hidden="true">
                <Calculator className="h-4 w-4 text-blue-500" />
              </div>
              나에게 맞는 패키지 찾기
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label htmlFor="daily-usage-slider" className="text-sm text-muted-foreground">
                  일일 예상 사용량
                </label>
                <Badge variant="secondary" className="font-bold" aria-live="polite">
                  {dailyUsage}회/일
                </Badge>
              </div>
              <Slider
                id="daily-usage-slider"
                value={[dailyUsage]}
                onValueChange={(values) => setDailyUsage(values[0] ?? dailyUsage)}
                min={1}
                max={20}
                step={1}
                className="w-full"
                aria-label={`일일 예상 사용량: ${dailyUsage}회`}
                aria-valuemin={1}
                aria-valuemax={20}
                aria-valuenow={dailyUsage}
                aria-valuetext={`하루 ${dailyUsage}회 사용`}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2" aria-hidden="true">
                <span>1회</span>
                <span>20회</span>
              </div>
            </div>

            {/* 패키지별 예상 사용 기간 */}
            <div
              className="grid grid-cols-3 gap-3"
              role="list"
              aria-label="패키지별 예상 사용 기간"
            >
              {packageAnalysis.map((pkg) => (
                <div
                  key={pkg.id}
                  role="listitem"
                  aria-label={`${pkg.name} 패키지: 약 ${pkg.estimatedDays}일 사용 가능${recommendedPackage === pkg.id ? ' (추천)' : ''}`}
                  className={cn(
                    'p-3 rounded-xl border text-center transition-all',
                    recommendedPackage === pkg.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-muted'
                  )}
                >
                  <p className="text-xs text-muted-foreground mb-1">{pkg.name}</p>
                  <p className="text-2xl font-bold" aria-hidden="true">{pkg.estimatedDays}</p>
                  <p className="text-xs text-muted-foreground">일 사용</p>
                  {recommendedPackage === pkg.id && (
                    <Badge className="mt-2 text-[10px] bg-primary/20 text-primary border-0" aria-hidden="true">
                      추천
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 할인 안내 배너 */}
        <div className="flex justify-center mb-10">
          <div className="relative inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 border border-green-500/20 shadow-lg shadow-green-500/5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
              <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                Premium 패키지 구매 시 최대 28% 절약
              </p>
              <p className="text-xs text-green-600/80 dark:text-green-400/80">
                대용량 패키지일수록 크레딧당 단가가 저렴해요
              </p>
            </div>
          </div>
        </div>

        {/* 패키지 목록 */}
        <div className="grid gap-6 md:grid-cols-3">
          {packageAnalysis.map((pkg, index) => (
            <CreditPackageCard
              key={pkg.id}
              id={pkg.id}
              name={pkg.name}
              credits={pkg.credits}
              price={pkg.price}
              pricePerCredit={pkg.pricePerCredit}
              validityDays={pkg.validityDays}
              isPopular={index === 1}
              isBestValue={pkg.isBestValue}
              savingsPercent={pkg.savingsPercent > 0 ? pkg.savingsPercent : undefined}
              isLoading={isLoading && selectedPackage === pkg.id}
              onPurchase={handlePurchase}
            />
          ))}
        </div>

        {/* 신뢰 배지 섹션 */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-full">
            <Shield className="h-4 w-4 text-green-500" />
            <span>SSL 보안 결제</span>
          </div>
          <div className="flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-full">
            <Check className="h-4 w-4 text-green-500" />
            <span>7일 환불 보장</span>
          </div>
          <div className="flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-full">
            <Zap className="h-4 w-4 text-green-500" />
            <span>즉시 충전</span>
          </div>
          <div className="flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-full">
            <Lock className="h-4 w-4 text-green-500" />
            <span>카드 정보 암호화</span>
          </div>
        </div>

        {/* FAQ 섹션 */}
        <section className="mt-16 max-w-3xl mx-auto" aria-labelledby="faq-heading">
          <div className="text-center mb-8">
            <Badge className="mb-3 bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0">
              <HelpCircle className="h-3 w-3 mr-1" aria-hidden="true" />
              자주 묻는 질문
            </Badge>
            <h2 id="faq-heading" className="text-2xl font-bold">크레딧 관련 FAQ</h2>
          </div>

          <div className="space-y-3" role="list" aria-label="자주 묻는 질문 목록">
            {[
              {
                q: '크레딧의 유효기간은 어떻게 되나요?',
                a: 'Basic/Standard 패키지는 90일, Premium 패키지는 180일 동안 사용할 수 있습니다. 유효기간이 지난 크레딧은 자동으로 소멸됩니다.',
                icon: Clock,
                color: 'text-blue-500',
                bg: 'bg-blue-500/10',
              },
              {
                q: '크레딧은 어떻게 사용되나요?',
                a: 'AI 콘텐츠를 1회 생성할 때마다 1개의 크레딧이 차감됩니다. 생성 실패 시에는 크레딧이 차감되지 않습니다.',
                icon: Coins,
                color: 'text-yellow-500',
                bg: 'bg-yellow-500/10',
              },
              {
                q: '환불은 어떻게 하나요?',
                a: '구매 후 7일 이내, 사용하지 않은 크레딧에 한해 전액 환불이 가능합니다. 설정 > 결제 내역에서 환불을 요청할 수 있습니다.',
                icon: RefreshCw,
                color: 'text-green-500',
                bg: 'bg-green-500/10',
              },
              {
                q: '구독과 크레딧의 차이점은 무엇인가요?',
                a: '구독은 일일 생성 횟수가 자동 리셋되고, 크레딧은 구매한 만큼 사용합니다. 가끔 사용하신다면 크레딧이, 매일 사용하신다면 구독이 경제적입니다.',
                icon: Calculator,
                color: 'text-purple-500',
                bg: 'bg-purple-500/10',
              },
            ].map((faq, index) => (
              <details
                key={index}
                className="group p-4 rounded-xl border hover:border-primary/30 hover:shadow-md transition-all focus-within:ring-2 focus-within:ring-primary/50"
                role="listitem"
              >
                <summary
                  className="flex items-center gap-3 cursor-pointer list-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
                  aria-label={faq.q}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      (e.target as HTMLElement).click();
                    }
                  }}
                >
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', faq.bg)} aria-hidden="true">
                    <faq.icon className={cn('h-4 w-4', faq.color)} />
                  </div>
                  <span className="flex-1 font-medium">{faq.q}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-3 ml-12 text-sm text-muted-foreground leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* 크레딧 이용 안내 */}
        <Card className="mt-12 border-dashed max-w-2xl mx-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                <span className="text-primary text-xs">i</span>
              </div>
              크레딧 이용 안내
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                  1
                </div>
                <p className="text-sm text-muted-foreground">
                  AI 콘텐츠 생성 시 <strong className="text-foreground">1회당 1개</strong>가 차감됩니다
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                  2
                </div>
                <p className="text-sm text-muted-foreground">
                  구매한 크레딧은 <strong className="text-foreground">유효기간 내</strong>에 사용해야 합니다
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                  3
                </div>
                <p className="text-sm text-muted-foreground">
                  환불은 구매 후 <strong className="text-foreground">7일 이내</strong>, 미사용분에 한해 가능합니다
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-600 dark:text-green-400 text-xs">
                  ✓
                </div>
                <p className="text-sm text-green-700 dark:text-green-300">
                  대용량 패키지일수록 <strong>크레딧당 단가가 저렴</strong>합니다
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 결제 수단 안내 */}
        <footer className="mt-8 text-center" role="contentinfo">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
            <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
            신용카드 / 체크카드 결제 지원 • 토스페이먼츠 안전 결제
          </p>
        </footer>
      </div>
    </div>
  );
}

/**
 * 크레딧 구매 페이지 (Error Boundary 적용)
 */
export default function CreditPurchasePage() {
  return (
    <PaymentErrorBoundary
      title="크레딧 구매 페이지를 불러올 수 없습니다"
      description="일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
    >
      <CreditPurchaseContent />
    </PaymentErrorBoundary>
  );
}
