'use client';

/**
 * 크레딧 내역 테이블 컴포넌트
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description: string | null;
  created_at: string;
  expires_at: string | null;
}

interface CreditHistoryTableProps {
  transactions: CreditTransaction[];
}

// 트랜잭션 타입별 표시 정보
const TRANSACTION_TYPE_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  purchase: { label: '구매', variant: 'default' },
  subscription_grant: { label: '구독 지급', variant: 'default' },
  usage: { label: '사용', variant: 'secondary' },
  refund: { label: '환불', variant: 'outline' },
  expiry: { label: '만료', variant: 'destructive' },
  admin_adjustment: { label: '관리자 조정', variant: 'outline' },
};

export function CreditHistoryTable({ transactions }: CreditHistoryTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        크레딧 내역이 없습니다.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>날짜</TableHead>
          <TableHead>유형</TableHead>
          <TableHead>설명</TableHead>
          <TableHead className="text-right">변동</TableHead>
          <TableHead className="text-right">잔액</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => {
          const typeConfig = TRANSACTION_TYPE_CONFIG[transaction.type] || {
            label: transaction.type,
            variant: 'secondary' as const,
          };

          return (
            <TableRow key={transaction.id}>
              <TableCell className="whitespace-nowrap">
                {new Date(transaction.created_at).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </TableCell>
              <TableCell>
                <Badge variant={typeConfig.variant}>{typeConfig.label}</Badge>
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {transaction.description || '-'}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <span
                  className={
                    transaction.amount > 0
                      ? 'text-green-500 font-semibold'
                      : 'text-muted-foreground'
                  }
                >
                  {transaction.amount > 0 ? '+' : ''}
                  {transaction.amount.toLocaleString()}
                </span>
              </TableCell>
              <TableCell className="text-right whitespace-nowrap font-medium">
                {transaction.balance.toLocaleString()}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
