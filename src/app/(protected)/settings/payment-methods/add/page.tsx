'use client';

/**
 * 결제 수단 추가 페이지
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Loader2, ShieldCheck, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { prepareAddPaymentMethod } from '@/actions/billing';
import { useToast } from '@/hooks/use-toast';
import { useTossPayments } from '@/hooks/use-toss-payments';

export default function AddPaymentMethodPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isReady: isTossReady, requestBillingAuth, error: tossError } = useTossPayments();
  const [isLoading, setIsLoading] = useState(false);
  const [customerKey, setCustomerKey] = useState<string | null>(null);

  // customerKey 조회
  useEffect(() => {
    const fetchCustomerKey = async () => {
      const result = await prepareAddPaymentMethod();
      if (result.success && result.data) {
        setCustomerKey(result.data.customerKey);
      } else {
        toast({
          title: '오류',
          description: result.error || '사용자 정보를 불러올 수 없습니다',
          variant: 'destructive',
        });
        router.push('/settings');
      }
    };
    fetchCustomerKey();
  }, [router, toast]);

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

  const handleAddCard = async () => {
    if (!isTossReady || !customerKey) {
      toast({
        title: '오류',
        description: '결제 시스템을 불러오는 중입니다. 잠시 후 다시 시도해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const successUrl = new URL(`${window.location.origin}/settings/payment-methods/add/success`);
      const failUrl = new URL(`${window.location.origin}/settings/payment-methods/add/fail`);

      await requestBillingAuth({
        customerKey,
        successUrl: successUrl.toString(),
        failUrl: failUrl.toString(),
      });
    } catch (error) {
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '카드 등록 처리 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">결제 수단 추가</h1>
            <p className="text-sm text-muted-foreground">
              새로운 카드를 등록합니다
            </p>
          </div>
        </div>
      </div>

      {/* 카드 등록 안내 */}
      <Card>
        <CardHeader>
          <CardTitle>카드 등록</CardTitle>
          <CardDescription>
            토스페이먼츠를 통해 안전하게 카드를 등록합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 보안 안내 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <ShieldCheck className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">안전한 결제</p>
                <p className="text-xs text-muted-foreground">
                  카드 정보는 토스페이먼츠에서 안전하게 관리됩니다
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <Lock className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">암호화 저장</p>
                <p className="text-xs text-muted-foreground">
                  모든 결제 정보는 암호화되어 저장됩니다
                </p>
              </div>
            </div>
          </div>

          {/* 지원 카드사 */}
          <div className="space-y-2">
            <p className="text-sm font-medium">지원 카드사</p>
            <div className="flex flex-wrap gap-2">
              {['삼성', '신한', '현대', 'KB', '롯데', '하나', '우리', 'NH', 'BC', '카카오뱅크', '토스뱅크'].map(
                (company) => (
                  <span
                    key={company}
                    className="px-3 py-1 text-xs rounded-full bg-muted text-muted-foreground"
                  >
                    {company}
                  </span>
                )
              )}
            </div>
          </div>

          {/* 등록 버튼 */}
          <Button
            onClick={handleAddCard}
            disabled={isLoading || !isTossReady || !customerKey}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                카드 등록하기
              </>
            )}
          </Button>

          {/* 안내 문구 */}
          <p className="text-xs text-center text-muted-foreground">
            카드 등록 버튼을 클릭하면 토스페이먼츠 결제창이 열립니다.
            <br />
            카드 정보 입력 후 본인 인증을 완료해주세요.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
