'use client';

/**
 * 크레딧 구매 페이지
 */

import { useState, useEffect, useMemo } from 'react';
import { Coins, ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditPackageCard } from '@/components/features/payment/credit-package-card';
import { creditPackages } from '@/config/pricing';
import { prepareCreditPurchase } from '@/actions/payment';
import { getCreditBalance } from '@/actions/credits';
import { useToast } from '@/hooks/use-toast';
import { useTossPayments } from '@/hooks/use-toss-payments';

export default function CreditPurchasePage() {
  const { toast } = useToast();
  const { isReady: isTossReady, requestPayment, error: tossError } = useTossPayments();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number>(0);

  // 패키지 분석: 최저가, 절약율 계산
  const packageAnalysis = useMemo(() => {
    const basePrice = creditPackages[0].pricePerCredit; // Basic 패키지 기준
    const lowestPricePerCredit = Math.min(...creditPackages.map(p => p.pricePerCredit));

    return creditPackages.map(pkg => ({
      ...pkg,
      isBestValue: pkg.pricePerCredit === lowestPricePerCredit,
      savingsPercent: Math.round((1 - pkg.pricePerCredit / basePrice) * 100),
    }));
  }, []);

  useEffect(() => {
    // 크레딧 잔액 조회
    const fetchBalance = async () => {
      const result = await getCreditBalance();
      if (result) {
        setCreditBalance(result.balance);
      }
    };
    fetchBalance();
  }, []);

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
    <div className="container mx-auto py-8 px-4">
      {/* 헤더 */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            대시보드로 돌아가기
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">크레딧 충전</h1>
        <p className="text-muted-foreground mt-2">
          크레딧을 구매하여 콘텐츠를 생성하세요.
        </p>
      </div>

      {/* 현재 잔액 */}
      <Card className="mb-8 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <Coins className="h-5 w-5 text-yellow-500" />
            </div>
            현재 크레딧 잔액
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-yellow-500">
              {creditBalance.toLocaleString()}
            </span>
            <span className="text-lg text-muted-foreground">크레딧</span>
          </div>
        </CardContent>
      </Card>

      {/* 할인 안내 배너 */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          Premium 패키지 구매 시 크레딧당 최대 28% 절약!
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

      {/* 안내 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">크레딧 이용 안내</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              크레딧은 AI 콘텐츠 생성 시 1회당 1개가 차감됩니다.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              구매한 크레딧은 유효기간 내에 사용해야 합니다.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              환불은 구매 후 7일 이내, 미사용 크레딧에 한해 가능합니다.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">•</span>
              <span className="text-green-600 dark:text-green-400">대용량 패키지일수록 크레딧당 단가가 저렴합니다!</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
