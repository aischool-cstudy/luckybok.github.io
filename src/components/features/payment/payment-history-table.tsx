'use client';

/**
 * 결제 이력 테이블 컴포넌트
 *
 * 상태 표시에 config/constants.ts의 중앙 관리 상수를 사용합니다.
 */

import { ExternalLink } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PaymentStatusBadge } from '@/components/ui/status-badge';
import { formatPrice } from '@/config/pricing';
import type { PaymentHistoryItem } from '@/types/payment.types';
import type { PaymentStatusType } from '@/config/constants';

interface PaymentHistoryTableProps {
  items: PaymentHistoryItem[];
  isLoading?: boolean;
}

export function PaymentHistoryTable({
  items,
  isLoading = false,
}: PaymentHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        결제 내역이 없습니다.
      </div>
    );
  }

  return (
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
        {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {new Date(item.date).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </TableCell>
              <TableCell>{item.description}</TableCell>
              <TableCell>{formatPrice(item.amount)}</TableCell>
              <TableCell>
                <PaymentStatusBadge status={item.status as PaymentStatusType} />
              </TableCell>
              <TableCell className="text-right">
                {item.receiptUrl ? (
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={item.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  '-'
                )}
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
