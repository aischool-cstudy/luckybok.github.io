'use client';

import { useState } from 'react';
import { CreditCard, Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { deletePaymentMethod, setDefaultPaymentMethod, type PaymentMethodInfo } from '@/actions/billing';
import { cn } from '@/lib/cn';

interface PaymentMethodSectionProps {
  paymentMethods: PaymentMethodInfo[];
  hasActiveSubscription: boolean;
}

// 카드사 로고/이름 매핑
const CARD_COMPANY_DISPLAY: Record<string, string> = {
  '삼성카드': '삼성',
  '신한카드': '신한',
  '현대카드': '현대',
  'KB국민카드': 'KB',
  '롯데카드': '롯데',
  '하나카드': '하나',
  '우리카드': '우리',
  'NH농협카드': 'NH',
  'BC카드': 'BC',
  '카카오뱅크': '카카오뱅크',
  '토스뱅크': '토스뱅크',
  '케이뱅크': '케이뱅크',
};

export function PaymentMethodSection({ paymentMethods, hasActiveSubscription }: PaymentMethodSectionProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSetDefault = async (billingKeyId: string) => {
    setIsLoading(billingKeyId);
    setError(null);

    const result = await setDefaultPaymentMethod(billingKeyId);

    if (!result.success) {
      setError(result.error || '기본 결제 수단 변경에 실패했습니다');
    }

    setIsLoading(null);
  };

  const handleDelete = async (billingKeyId: string, isDefault: boolean) => {
    if (isDefault && hasActiveSubscription) {
      setError('활성 구독이 있는 상태에서 기본 결제 수단을 삭제할 수 없습니다');
      return;
    }

    const confirmed = confirm('결제 수단을 삭제하시겠습니까?');
    if (!confirmed) return;

    setIsLoading(billingKeyId);
    setError(null);

    const result = await deletePaymentMethod(billingKeyId);

    if (!result.success) {
      setError(result.error || '결제 수단 삭제에 실패했습니다');
    }

    setIsLoading(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          결제 수단
        </CardTitle>
        <CardDescription>등록된 카드 및 결제 수단 관리</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {paymentMethods.length === 0 ? (
          <div className="text-center py-6">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-4">등록된 결제 수단이 없습니다</p>
            <Link href="/payment/subscribe">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                결제 수단 추가
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className={cn(
                    'flex items-center justify-between p-3 border rounded-lg',
                    method.isDefault && 'border-primary bg-primary/5'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 bg-muted rounded flex items-center justify-center text-xs font-bold">
                      {CARD_COMPANY_DISPLAY[method.cardCompany] || method.cardCompany.slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{method.cardCompany}</span>
                        {method.isDefault && (
                          <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                            기본
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        •••• {method.cardNumber}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                        disabled={isLoading === method.id}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        기본 설정
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(method.id, method.isDefault)}
                      disabled={isLoading === method.id}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/payment/subscribe" className="block">
              <Button variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                결제 수단 추가
              </Button>
            </Link>
          </>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
