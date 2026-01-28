'use client';

/**
 * 크레딧 구매 페이지
 */

import { useState, useEffect } from 'react';
import { Coins, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditPackageCard } from '@/components/features/payment/credit-package-card';
import { creditPackages } from '@/config/pricing';
import { prepareCreditPurchase, getCreditBalance } from '@/actions/payment';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    TossPayments?: {
      (clientKey: string): {
        requestPayment(
          method: string,
          options: {
            amount: number;
            orderId: string;
            orderName: string;
            customerKey: string;
            successUrl: string;
            failUrl: string;
          }
        ): Promise<void>;
      };
    };
  }
}

export default function CreditPurchasePage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number>(0);

  useEffect(() => {
    // 크레딧 잔액 조회
    const fetchBalance = async () => {
      const result = await getCreditBalance();
      if (result.success && result.data) {
        setCreditBalance(result.data.balance);
      }
    };
    fetchBalance();

    // 토스페이먼츠 SDK 로드
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v1/payment';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePurchase = async (packageId: string) => {
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
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey || !window.TossPayments) {
        toast({
          title: '오류',
          description: '결제 시스템을 불러오는 데 실패했습니다',
          variant: 'destructive',
        });
        return;
      }

      const tossPayments = window.TossPayments(clientKey);
      await tossPayments.requestPayment('카드', {
        amount,
        orderId,
        orderName,
        customerKey,
        successUrl: `${window.location.origin}/payment/success?type=credit`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
    } catch (error) {
      console.error('결제 오류:', error);
      toast({
        title: '오류',
        description: '결제 처리 중 오류가 발생했습니다',
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
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            현재 크레딧 잔액
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-primary">
            {creditBalance.toLocaleString()} 크레딧
          </div>
        </CardContent>
      </Card>

      {/* 패키지 목록 */}
      <div className="grid gap-6 md:grid-cols-3">
        {creditPackages.map((pkg, index) => (
          <CreditPackageCard
            key={pkg.id}
            id={pkg.id}
            name={pkg.name}
            credits={pkg.credits}
            price={pkg.price}
            pricePerCredit={pkg.pricePerCredit}
            validityDays={pkg.validityDays}
            isPopular={index === 1}
            isLoading={isLoading && selectedPackage === pkg.id}
            onPurchase={handlePurchase}
          />
        ))}
      </div>

      {/* 안내 */}
      <div className="mt-8 p-4 rounded-lg bg-muted">
        <h3 className="font-semibold mb-2">안내</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>- 크레딧은 AI 콘텐츠 생성 시 1회당 1개가 차감됩니다.</li>
          <li>- 구매한 크레딧은 유효기간 내에 사용해야 합니다.</li>
          <li>- 환불은 구매 후 7일 이내, 미사용 크레딧에 한해 가능합니다.</li>
        </ul>
      </div>
    </div>
  );
}
