'use client';

/**
 * 결제 수단 추가 성공 페이지
 */

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, CreditCard, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { confirmAddPaymentMethod } from '@/actions/billing';
import { useToast } from '@/hooks/use-toast';

function AddPaymentMethodSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);
  const [result, setResult] = useState<{
    success: boolean;
    cardCompany?: string;
    cardNumber?: string;
    error?: string;
  } | null>(null);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const processAdd = async () => {
      const authKey = searchParams.get('authKey');
      const customerKey = searchParams.get('customerKey');

      if (!authKey || !customerKey) {
        setResult({
          success: false,
          error: '필수 정보가 누락되었습니다',
        });
        setIsProcessing(false);
        return;
      }

      const response = await confirmAddPaymentMethod({
        authKey,
        customerKey,
      });

      if (response.success && response.data) {
        setResult({
          success: true,
          cardCompany: response.data.cardCompany,
          cardNumber: response.data.cardNumber,
        });
      } else {
        setResult({
          success: false,
          error: response.error || '카드 등록에 실패했습니다',
        });
        toast({
          title: '오류',
          description: response.error || '카드 등록에 실패했습니다',
          variant: 'destructive',
        });
      }

      setIsProcessing(false);
    };

    processAdd();
  }, [searchParams, toast]);

  // 성공 시 자동 리다이렉트
  useEffect(() => {
    if (!result?.success || isProcessing) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/settings');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [result?.success, isProcessing, router]);

  // 처리 중 화면
  if (isProcessing) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
            <p className="text-xl font-medium">카드를 등록하고 있습니다...</p>
            <p className="text-muted-foreground mt-2">잠시만 기다려주세요.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 결과 화면
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-md overflow-hidden">
        {result?.success && <div className="h-2 bg-green-500" />}

        <CardHeader className="text-center pt-8">
          {result?.success ? (
            <div className="relative">
              <div className="absolute inset-0 blur-2xl opacity-30 -z-10 bg-green-500" />
              <div className="relative mx-auto mb-6">
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CreditCard className="h-10 w-10 text-green-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4">
                <Sparkles className="h-6 w-6 text-yellow-400 animate-pulse" />
              </div>
              <CardTitle className="text-2xl">카드 등록 완료!</CardTitle>
            </div>
          ) : (
            <>
              <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <CreditCard className="h-10 w-10 text-destructive" />
              </div>
              <CardTitle className="text-2xl">카드 등록 실패</CardTitle>
            </>
          )}
        </CardHeader>

        <CardContent className="text-center space-y-6 pb-8">
          {result?.success ? (
            <>
              <div className="p-4 rounded-lg bg-green-500/5">
                <p className="text-muted-foreground text-sm">등록된 카드</p>
                <p className="text-lg font-semibold mt-1">
                  {result.cardCompany} •••• {result.cardNumber?.slice(-4)}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {countdown}초 후 설정 페이지로 이동합니다...
              </p>
            </>
          ) : (
            <p className="text-destructive font-medium">{result?.error}</p>
          )}

          <div className="space-y-2">
            <Button asChild className="w-full" size="lg">
              <Link href="/settings">설정으로 돌아가기</Link>
            </Button>
            {!result?.success && (
              <Button asChild variant="outline" className="w-full">
                <Link href="/settings/payment-methods/add">다시 시도</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AddPaymentMethodSuccessPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Suspense
        fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <Card className="w-full max-w-md">
              <CardContent className="pt-8 pb-8 text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
                <p className="text-lg font-medium">로딩 중...</p>
              </CardContent>
            </Card>
          </div>
        }
      >
        <AddPaymentMethodSuccessContent />
      </Suspense>
    </div>
  );
}
