'use client';

/**
 * 결제 내역 모바일 리스트 컴포넌트
 */

import { useState } from 'react';
import { ExternalLink, RefreshCcw, AlertCircle, ChevronRight, Receipt, CreditCard, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatPrice } from '@/config/pricing';
import { requestRefund, checkRefundEligibility } from '@/actions/billing';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Payment {
  id: string;
  order_id: string;
  type: string;
  status: string;
  amount: number;
  method: string | null;
  receipt_url: string | null;
  refunded_amount: number | null;
  created_at: string;
  metadata: {
    planId?: string;
    billingCycle?: string;
    credits?: number;
    creditPackageId?: string;
    [key: string]: unknown;
  } | null;
}

interface PaymentHistoryMobileListProps {
  payments: Payment[];
}

// 결제 상태 설정
const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }
> = {
  pending: { label: '대기 중', variant: 'secondary', color: 'text-yellow-500' },
  completed: { label: '완료', variant: 'default', color: 'text-green-500' },
  failed: { label: '실패', variant: 'destructive', color: 'text-red-500' },
  canceled: { label: '취소', variant: 'outline', color: 'text-gray-500' },
  refunded: { label: '환불', variant: 'outline', color: 'text-orange-500' },
  partial_refunded: { label: '부분 환불', variant: 'outline', color: 'text-orange-500' },
};

// 결제 유형별 아이콘
const TYPE_ICONS: Record<string, typeof CreditCard> = {
  subscription: CreditCard,
  credit_purchase: Coins,
};

export function PaymentHistoryMobileList({ payments }: PaymentHistoryMobileListProps) {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundEligibility, setRefundEligibility] = useState<{
    eligible: boolean;
    reason?: string;
    maxRefundAmount?: number;
  } | null>(null);

  const handleRefundClick = async (payment: Payment, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPayment(payment);
    const eligibility = await checkRefundEligibility(payment.id);
    setRefundEligibility(eligibility);
    setIsRefundDialogOpen(true);
  };

  const handleRefund = async () => {
    if (!selectedPayment) return;

    setIsRefunding(true);
    const result = await requestRefund({
      paymentId: selectedPayment.id,
      reason: '고객 요청에 의한 환불',
    });

    if (result.success) {
      toast({
        title: '환불 완료',
        description: `${formatPrice(result.data?.refundAmount || 0)}이 환불되었습니다.`,
      });
      setIsRefundDialogOpen(false);
    } else {
      toast({
        title: '환불 실패',
        description: result.error || '환불 처리에 실패했습니다.',
        variant: 'destructive',
      });
    }

    setIsRefunding(false);
  };

  // 결제 설명 생성
  const getPaymentDescription = (payment: Payment) => {
    if (payment.type === 'subscription' && payment.metadata?.planId) {
      const cycle = payment.metadata.billingCycle === 'yearly' ? '연간' : '월간';
      return `${payment.metadata.planId.toUpperCase()} ${cycle} 구독`;
    }
    if (payment.type === 'credit_purchase' && payment.metadata?.credits) {
      return `크레딧 ${payment.metadata.credits}개 구매`;
    }
    return payment.type === 'subscription' ? '구독 결제' : '크레딧 구매';
  };

  if (payments.length === 0) {
    return (
      <div className="py-12 text-center">
        <Receipt className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">결제 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {payments.map((payment) => {
          const status = STATUS_CONFIG[payment.status] || {
            label: payment.status,
            variant: 'secondary' as const,
            color: 'text-gray-500',
          };
          const Icon = TYPE_ICONS[payment.type] || Receipt;
          const isExpanded = expandedId === payment.id;

          return (
            <Card
              key={payment.id}
              className={cn(
                'cursor-pointer transition-all',
                isExpanded && 'ring-2 ring-primary'
              )}
              onClick={() => setExpandedId(isExpanded ? null : payment.id)}
            >
              <CardContent className="p-4">
                {/* 메인 정보 */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn(
                      'p-2 rounded-lg shrink-0',
                      payment.type === 'subscription' ? 'bg-blue-500/10' : 'bg-yellow-500/10'
                    )}>
                      <Icon className={cn(
                        'h-5 w-5',
                        payment.type === 'subscription' ? 'text-blue-500' : 'text-yellow-500'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{getPaymentDescription(payment)}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.created_at).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{formatPrice(payment.amount)}</p>
                    <Badge variant={status.variant} className="mt-1">
                      {status.label}
                    </Badge>
                  </div>
                </div>

                {/* 확장된 상세 정보 */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    {/* 주문 번호 */}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">주문 번호</span>
                      <span className="font-mono text-xs truncate max-w-[180px]">
                        {payment.order_id}
                      </span>
                    </div>

                    {/* 결제 수단 */}
                    {payment.method && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">결제 수단</span>
                        <span>{payment.method}</span>
                      </div>
                    )}

                    {/* 환불 금액 */}
                    {payment.refunded_amount && payment.refunded_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">환불 금액</span>
                        <span className="text-orange-500">{formatPrice(payment.refunded_amount)}</span>
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    <div className="flex gap-2 pt-2">
                      {payment.receipt_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a
                            href={payment.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            영수증
                          </a>
                        </Button>
                      )}
                      {payment.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={(e) => handleRefundClick(payment, e)}
                        >
                          <RefreshCcw className="h-4 w-4 mr-2" />
                          환불 요청
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* 확장 표시 */}
                {!isExpanded && (
                  <div className="flex justify-center mt-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 환불 확인 다이얼로그 */}
      <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>환불 요청</DialogTitle>
            <DialogDescription>
              {selectedPayment && getPaymentDescription(selectedPayment)}에 대한 환불을
              요청합니다.
            </DialogDescription>
          </DialogHeader>

          {refundEligibility && !refundEligibility.eligible ? (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">환불 불가</p>
                <p className="text-muted-foreground">{refundEligibility.reason}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">환불 금액</p>
                <p className="text-2xl font-bold">
                  {formatPrice(refundEligibility?.maxRefundAmount || selectedPayment?.amount || 0)}
                </p>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• 환불 처리에 3-5 영업일이 소요될 수 있습니다.</p>
                <p>• 크레딧 구매 환불 시 해당 크레딧이 차감됩니다.</p>
                <p>• 구독 환불 시 구독이 즉시 취소됩니다.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRefundDialogOpen(false)}
              disabled={isRefunding}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleRefund}
              disabled={
                isRefunding || !!(refundEligibility && !refundEligibility.eligible)
              }
            >
              {isRefunding ? '처리 중...' : '환불 요청'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
