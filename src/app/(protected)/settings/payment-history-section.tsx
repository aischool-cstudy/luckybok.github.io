'use client';

/**
 * 결제 내역 섹션 컴포넌트
 */

import { useState } from 'react';
import { Receipt, ExternalLink, AlertCircle, RefreshCcw } from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatPrice } from '@/config/pricing';
import { requestRefund, checkRefundEligibility } from '@/actions/billing';
import { useToast } from '@/hooks/use-toast';

// Supabase의 Json 타입과 호환되는 Payment 인터페이스
interface Payment {
  id: string;
  order_id: string;
  type: string;
  status: string;
  amount: number;
  method: string | null;
  receipt_url: string | null;
  refund_amount: number | null;
  created_at: string;
  metadata: unknown; // Json 타입 호환
}

// 메타데이터 타입 캐스팅 헬퍼
interface PaymentMetadata {
  planId?: string;
  billingCycle?: string;
  credits?: number;
  creditPackageId?: string;
  [key: string]: unknown;
}

function getPaymentMetadata(metadata: unknown): PaymentMetadata | null {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as PaymentMetadata;
  }
  return null;
}

interface PaymentHistorySectionProps {
  payments: Payment[];
  totalPayments: number;
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

export function PaymentHistorySection({
  payments,
  totalPayments,
}: PaymentHistorySectionProps) {
  const { toast } = useToast();
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundEligibility, setRefundEligibility] = useState<{
    eligible: boolean;
    reason?: string;
    maxRefundAmount?: number;
  } | null>(null);

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
    const metadata = getPaymentMetadata(payment.metadata);
    if (payment.type === 'subscription' && metadata?.planId) {
      const cycle = metadata.billingCycle === 'yearly' ? '연간' : '월간';
      return `${metadata.planId.toUpperCase()} ${cycle} 구독`;
    }
    if (payment.type === 'credit_purchase' && metadata?.credits) {
      return `크레딧 ${metadata.credits}개 구매`;
    }
    return TYPE_LABELS[payment.type] || payment.type;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                결제 내역
              </CardTitle>
              <CardDescription>총 {totalPayments}건의 결제 내역</CardDescription>
            </div>
            {totalPayments > 5 && (
              <Link href="/settings/payment-history">
                <Button variant="outline" size="sm">
                  전체 보기
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>결제 내역이 없습니다.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>날짜</TableHead>
                  <TableHead>내용</TableHead>
                  <TableHead>금액</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">영수증</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.slice(0, 5).map((payment) => {
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
                        })}
                      </TableCell>
                      <TableCell>{getPaymentDescription(payment)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatPrice(payment.amount)}
                        {payment.refund_amount && payment.refund_amount > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (환불: {formatPrice(payment.refund_amount)})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
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
          )}
        </CardContent>
      </Card>

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
