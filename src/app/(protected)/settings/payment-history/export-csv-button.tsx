'use client';

/**
 * 결제 내역 CSV 내보내기 버튼
 */

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Payment {
  id: string;
  order_id: string;
  type: string;
  status: string;
  amount: number;
  method: string | null;
  refunded_amount: number | null;
  created_at: string;
  metadata: {
    planId?: string;
    billingCycle?: string;
    credits?: number;
  } | null;
}

interface ExportCsvButtonProps {
  payments: Payment[];
}

// 결제 유형 라벨
const TYPE_LABELS: Record<string, string> = {
  subscription: '구독 결제',
  credit_purchase: '크레딧 구매',
};

// 결제 상태 라벨
const STATUS_LABELS: Record<string, string> = {
  pending: '대기 중',
  completed: '완료',
  failed: '실패',
  canceled: '취소',
  refunded: '환불',
  partial_refunded: '부분 환불',
};

// 결제 설명 생성
function getPaymentDescription(payment: Payment): string {
  if (payment.type === 'subscription' && payment.metadata?.planId) {
    const cycle = payment.metadata.billingCycle === 'yearly' ? '연간' : '월간';
    return `${payment.metadata.planId.toUpperCase()} ${cycle} 구독`;
  }
  if (payment.type === 'credit_purchase' && payment.metadata?.credits) {
    return `크레딧 ${payment.metadata.credits}개 구매`;
  }
  return TYPE_LABELS[payment.type] || payment.type;
}

// CSV 셀 이스케이프 처리
function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // 쉼표, 따옴표, 줄바꿈이 포함된 경우 따옴표로 감싸기
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function ExportCsvButton({ payments }: ExportCsvButtonProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (payments.length === 0) {
      toast({
        title: '내보내기 실패',
        description: '내보낼 결제 내역이 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);

    try {
      // CSV 헤더
      const headers = ['날짜', '주문번호', '결제유형', '내용', '금액', '환불금액', '결제수단', '상태'];

      // CSV 데이터 행
      const rows = payments.map((payment) => [
        new Date(payment.created_at).toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
        payment.order_id,
        TYPE_LABELS[payment.type] || payment.type,
        getPaymentDescription(payment),
        payment.amount,
        payment.refunded_amount || 0,
        payment.method || '-',
        STATUS_LABELS[payment.status] || payment.status,
      ]);

      // BOM + CSV 생성 (Excel 한글 호환)
      const BOM = '\uFEFF';
      const csvContent = BOM + [
        headers.map(escapeCsvCell).join(','),
        ...rows.map((row) => row.map(escapeCsvCell).join(',')),
      ].join('\n');

      // 파일 다운로드
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `결제내역_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: '내보내기 완료',
        description: `${payments.length}건의 결제 내역을 CSV로 내보냈습니다.`,
      });
    } catch {
      toast({
        title: '내보내기 실패',
        description: '파일 생성 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting || payments.length === 0}
      className="gap-2"
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      CSV 내보내기
    </Button>
  );
}
