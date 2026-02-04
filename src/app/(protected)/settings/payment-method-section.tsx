'use client';

/**
 * 결제 수단 관리 섹션
 * - 카드 목록 표시 (카드사별 스타일링)
 * - 기본 결제 수단 설정
 * - 삭제 기능 (Dialog 사용)
 */

import { useState } from 'react';
import { CreditCard, Plus, Trash2, Check, AlertCircle, Loader2, Star, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { deletePaymentMethod, setDefaultPaymentMethod, type PaymentMethodInfo } from '@/actions/billing';
import { cn } from '@/lib/cn';

interface PaymentMethodSectionProps {
  paymentMethods: PaymentMethodInfo[];
  hasActiveSubscription: boolean;
}

// 카드사 정보 (표시명, 색상)
const CARD_COMPANY_INFO: Record<string, { short: string; color: string; bgColor: string }> = {
  '삼성카드': { short: '삼성', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  '신한카드': { short: '신한', color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  '현대카드': { short: '현대', color: 'text-slate-700', bgColor: 'bg-slate-100 dark:bg-slate-800' },
  'KB국민카드': { short: 'KB', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950' },
  '롯데카드': { short: '롯데', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950' },
  '하나카드': { short: '하나', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950' },
  '우리카드': { short: '우리', color: 'text-sky-600', bgColor: 'bg-sky-50 dark:bg-sky-950' },
  'NH농협카드': { short: 'NH', color: 'text-green-700', bgColor: 'bg-green-50 dark:bg-green-950' },
  'BC카드': { short: 'BC', color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-950' },
  '카카오뱅크': { short: '카카오', color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-950' },
  '토스뱅크': { short: '토스', color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  '케이뱅크': { short: 'K뱅크', color: 'text-pink-600', bgColor: 'bg-pink-50 dark:bg-pink-950' },
};

const getCardInfo = (cardCompany: string) => {
  return CARD_COMPANY_INFO[cardCompany] || {
    short: cardCompany.slice(0, 2),
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  };
};

export function PaymentMethodSection({ paymentMethods, hasActiveSubscription }: PaymentMethodSectionProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethodInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSetDefault = async (billingKeyId: string) => {
    setIsLoading(billingKeyId);
    setError(null);

    const result = await setDefaultPaymentMethod(billingKeyId);

    if (!result.success) {
      setError(result.error || '기본 결제 수단 변경에 실패했습니다');
    }

    setIsLoading(null);
  };

  const openDeleteDialog = (method: PaymentMethodInfo) => {
    if (method.isDefault && hasActiveSubscription) {
      setError('활성 구독이 있는 상태에서 기본 결제 수단을 삭제할 수 없습니다');
      return;
    }
    setDeleteTarget(method);
    setError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setError(null);

    const result = await deletePaymentMethod(deleteTarget.id);

    if (!result.success) {
      setError(result.error || '결제 수단 삭제에 실패했습니다');
    }

    setIsDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <Card className="overflow-hidden">
      {/* 상단 그라데이션 바 */}
      <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />

      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50">
              <CreditCard className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-lg">결제 수단</CardTitle>
              <CardDescription>등록된 카드 및 결제 수단 관리</CardDescription>
            </div>
          </div>
          {paymentMethods.length > 0 && (
            <Badge variant="secondary" className="hidden sm:flex px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {paymentMethods.length}개 등록
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {paymentMethods.length === 0 ? (
          // 빈 상태 - 개선된 디자인
          <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/20 p-10">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5" />
            <div className="relative text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30">
                <CreditCard className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">등록된 결제 수단이 없습니다</h3>
              <p className="text-sm text-muted-foreground mb-8 max-w-xs mx-auto">
                카드를 등록하면 구독 결제와 크레딧 구매에 바로 사용할 수 있어요
              </p>
              <Link href="/settings/payment-methods/add">
                <Button size="lg" className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25">
                  <Plus className="h-4 w-4 mr-2" />
                  결제 수단 추가
                </Button>
              </Link>
              <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>토스페이먼츠를 통한 안전한 결제</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 카드 목록 */}
            <div className="space-y-3">
              {paymentMethods.map((method) => {
                const cardInfo = getCardInfo(method.cardCompany);
                const isCurrentLoading = isLoading === method.id;

                return (
                  <div
                    key={method.id}
                    className={cn(
                      'group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-xl transition-all',
                      method.isDefault
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'hover:border-muted-foreground/50 hover:shadow-sm'
                    )}
                  >
                    {/* 기본 카드 표시 */}
                    {method.isDefault && (
                      <div className="absolute -top-2 -right-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                          <Star className="h-3 w-3 fill-current" />
                        </div>
                      </div>
                    )}

                    {/* 카드 정보 */}
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-12 w-16 items-center justify-center rounded-lg font-bold text-sm',
                          cardInfo.bgColor,
                          cardInfo.color
                        )}
                      >
                        {cardInfo.short}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{method.cardCompany}</span>
                          {method.isDefault && (
                            <Badge variant="default" className="hidden sm:inline-flex text-xs px-1.5 py-0">
                              기본
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground font-mono">
                          •••• •••• •••• {method.cardNumber}
                        </p>
                        {method.isDefault && (
                          <Badge variant="default" className="sm:hidden mt-1 text-xs">
                            기본 결제 수단
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {!method.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(method.id)}
                          disabled={isCurrentLoading}
                          className="flex-1 sm:flex-none"
                        >
                          {isCurrentLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              기본 설정
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(method)}
                        disabled={isCurrentLoading}
                        className="text-muted-foreground hover:text-destructive hover:border-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sm:hidden ml-1">삭제</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 추가 버튼 */}
            <Link href="/settings/payment-methods/add" className="block">
              <Button variant="outline" className="w-full gap-2 border-dashed">
                <Plus className="h-4 w-4" />
                결제 수단 추가
              </Button>
            </Link>

            {/* 보안 안내 */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
              <ShieldCheck className="h-4 w-4" />
              <span>카드 정보는 토스페이먼츠에서 안전하게 관리됩니다</span>
            </div>
          </>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* 삭제 확인 다이얼로그 */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                결제 수단 삭제
              </DialogTitle>
              <DialogDescription>
                이 결제 수단을 삭제하시겠습니까?
              </DialogDescription>
            </DialogHeader>

            {deleteTarget && (
              <div className="py-4">
                {/* 삭제할 카드 정보 */}
                <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
                  <div
                    className={cn(
                      'flex h-12 w-16 items-center justify-center rounded-lg font-bold text-sm',
                      getCardInfo(deleteTarget.cardCompany).bgColor,
                      getCardInfo(deleteTarget.cardCompany).color
                    )}
                  >
                    {getCardInfo(deleteTarget.cardCompany).short}
                  </div>
                  <div>
                    <p className="font-medium">{deleteTarget.cardCompany}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      •••• •••• •••• {deleteTarget.cardNumber}
                    </p>
                  </div>
                </div>

                {/* 주의사항 */}
                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-start gap-3 text-sm">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">주의사항</p>
                      <ul className="mt-2 space-y-1.5 text-amber-700 dark:text-amber-300">
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500">•</span>
                          삭제된 결제 수단은 복구할 수 없습니다.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500">•</span>
                          구독 결제에 사용 중인 경우, 다른 결제 수단을 먼저 등록해주세요.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="flex-1 sm:flex-none"
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 sm:flex-none"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    삭제 중...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    삭제
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
