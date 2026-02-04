'use client';

/**
 * 결제 내역 테이블 (전체 페이지용)
 * - 결제 목록 표시
 * - 결제 상세 정보 모달
 * - 환불 요청 기능
 */

import { useState } from 'react';
import { ExternalLink, RefreshCcw, AlertCircle, Eye, CreditCard, Coins, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

interface PaymentHistoryTableProps {
  payments: Payment[];
}

// 결제 상태 표시
const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: '대기 중', variant: 'secondary' },
  completed: { label: '완료', variant: 'default' },
  failed: { label: '실패', variant: 'destructive' },
  canceled: { label: '취소', variant: 'outline' },
  refunded: { label: '환불', variant: 'outline' },
  partial_refunded: { label: '부분 환불', variant: 'outline' },
};

// 결제 유형 표시
const TYPE_LABELS: Record<string, string> = {
  subscription: '구독 결제',
  credit_purchase: '크레딧 구매',
};

export function PaymentHistoryTable({ payments }: PaymentHistoryTableProps) {
  const { toast } = useToast();
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundEligibility, setRefundEligibility] = useState<{
    eligible: boolean;
    reason?: string;
    maxRefundAmount?: number;
  } | null>(null);

  // 결제 상세 보기
  const handleDetailClick = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsDetailDialogOpen(true);
  };

  const handleRefundClick = async (payment: Payment) => {
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
    return TYPE_LABELS[payment.type] || payment.type;
  };

  if (payments.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        결제 내역이 없습니다.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>날짜</TableHead>
            <TableHead>주문 번호</TableHead>
            <TableHead>내용</TableHead>
            <TableHead>결제 수단</TableHead>
            <TableHead className="text-right">금액</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="text-right">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => {
            const status = STATUS_CONFIG[payment.status] || {
              label: payment.status,
              variant: 'secondary' as const,
            };

            return (
              <TableRow key={payment.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(payment.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {payment.order_id.slice(0, 20)}...
                </TableCell>
                <TableCell>{getPaymentDescription(payment)}</TableCell>
                <TableCell>{payment.method || '-'}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {formatPrice(payment.amount)}
                  {payment.refunded_amount && payment.refunded_amount > 0 && (
                    <div className="text-xs text-muted-foreground">
                      환불: {formatPrice(payment.refunded_amount)}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* 상세 보기 */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDetailClick(payment)}
                      title="상세 보기"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {/* 영수증 */}
                    {payment.receipt_url && (
                      <Button variant="ghost" size="icon" asChild>
                        <a
                          href={payment.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="영수증 보기"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {/* 환불 */}
                    {payment.status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRefundClick(payment)}
                        title="환불 요청"
                      >
                        <RefreshCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* 결제 상세 다이얼로그 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPayment?.type === 'subscription' ? (
                <CreditCard className="h-5 w-5 text-blue-500" />
              ) : (
                <Coins className="h-5 w-5 text-yellow-500" />
              )}
              결제 상세 정보
            </DialogTitle>
            <DialogDescription>
              {selectedPayment && getPaymentDescription(selectedPayment)}
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              {/* 결제 금액 */}
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">결제 금액</p>
                <p className="text-3xl font-bold">{formatPrice(selectedPayment.amount)}</p>
                {selectedPayment.refunded_amount && selectedPayment.refunded_amount > 0 && (
                  <p className="text-sm text-orange-500 mt-1">
                    환불: {formatPrice(selectedPayment.refunded_amount)}
                  </p>
                )}
              </div>

              {/* 상세 정보 */}
              <div className="space-y-3">
                <DetailRow
                  label="주문 번호"
                  value={selectedPayment.order_id}
                  mono
                />
                <DetailRow
                  label="결제 일시"
                  value={new Date(selectedPayment.created_at).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                />
                <DetailRow
                  label="결제 유형"
                  value={TYPE_LABELS[selectedPayment.type] || selectedPayment.type}
                />
                <DetailRow
                  label="결제 상태"
                  value={
                    <Badge variant={STATUS_CONFIG[selectedPayment.status]?.variant || 'secondary'}>
                      {STATUS_CONFIG[selectedPayment.status]?.label || selectedPayment.status}
                    </Badge>
                  }
                />
                {selectedPayment.method && (
                  <DetailRow label="결제 수단" value={selectedPayment.method} />
                )}
                {selectedPayment.metadata?.credits && (
                  <DetailRow
                    label="충전 크레딧"
                    value={`${selectedPayment.metadata.credits}개`}
                  />
                )}
                {selectedPayment.metadata?.planId && (
                  <DetailRow
                    label="구독 플랜"
                    value={`${selectedPayment.metadata.planId.toUpperCase()} (${
                      selectedPayment.metadata.billingCycle === 'yearly' ? '연간' : '월간'
                    })`}
                  />
                )}
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2 pt-2 border-t">
                {selectedPayment.receipt_url && (
                  <Button variant="outline" className="flex-1" asChild>
                    <a
                      href={selectedPayment.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Receipt className="h-4 w-4 mr-2" />
                      영수증 보기
                    </a>
                  </Button>
                )}
                {selectedPayment.status === 'completed' && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsDetailDialogOpen(false);
                      handleRefundClick(selectedPayment);
                    }}
                  >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    환불 요청
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

// 상세 정보 행 컴포넌트
function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('text-right', mono && 'font-mono text-xs truncate max-w-[200px]')}>
        {value}
      </span>
    </div>
  );
}
