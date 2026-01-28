'use client';

import { Coins, Clock, History, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import type { CreditBalance } from '@/actions/credits';

interface CreditsSectionProps {
  creditBalance: CreditBalance | null;
  recentTransactions?: Array<{
    id: string;
    type: string;
    amount: number;
    description: string | null;
    created_at: string;
  }>;
}

// 트랜잭션 타입 표시명
const TRANSACTION_TYPE_DISPLAY: Record<string, string> = {
  purchase: '구매',
  subscription_grant: '구독 지급',
  usage: '사용',
  refund: '환불',
  expiry: '만료',
  admin_adjustment: '관리자 조정',
};

export function CreditsSection({ creditBalance, recentTransactions = [] }: CreditsSectionProps) {
  const balance = creditBalance?.balance ?? 0;
  const expiringCredits = creditBalance?.expiringCredits ?? 0;
  const expiringDate = creditBalance?.expiringDate;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          크레딧 현황
        </CardTitle>
        <CardDescription>일일 생성 횟수 소진 후 사용되는 크레딧</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 크레딧 잔액 */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center">
              <Coins className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">현재 잔액</p>
              <p className="text-2xl font-bold">{balance.toLocaleString()}</p>
            </div>
          </div>
          <Link href="/payment/credits">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              충전하기
            </Button>
          </Link>
        </div>

        {/* 만료 예정 크레딧 */}
        {expiringCredits > 0 && expiringDate && (
          <div className="flex items-start gap-3 p-3 bg-orange-500/10 rounded-lg">
            <Clock className="h-5 w-5 text-orange-500 mt-0.5" />
            <div>
              <p className="font-medium text-orange-500">
                {expiringCredits.toLocaleString()} 크레딧 만료 예정
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(expiringDate).toLocaleDateString('ko-KR')}까지 사용하지 않으면 소멸됩니다
              </p>
            </div>
          </div>
        )}

        {/* 최근 트랜잭션 */}
        {recentTransactions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium flex items-center gap-2">
                <History className="h-4 w-4" />
                최근 내역
              </p>
              <Link href="/settings/credits-history" className="text-xs text-primary hover:underline">
                전체 보기
              </Link>
            </div>
            <div className="space-y-1">
              {recentTransactions.slice(0, 5).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between py-2 text-sm border-b last:border-0"
                >
                  <div>
                    <span className="font-medium">
                      {TRANSACTION_TYPE_DISPLAY[transaction.type] || transaction.type}
                    </span>
                    {transaction.description && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {transaction.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        transaction.amount > 0
                          ? 'text-green-500 font-medium'
                          : 'text-muted-foreground'
                      }
                    >
                      {transaction.amount > 0 ? '+' : ''}
                      {transaction.amount}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(transaction.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 크레딧 안내 */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p>• 크레딧은 일일 생성 횟수를 모두 사용한 후 자동으로 차감됩니다</p>
          <p>• 구매한 크레딧은 유효기간 내에 사용해야 합니다</p>
          <p>• 환불은 고객센터로 문의해주세요</p>
        </div>
      </CardContent>
    </Card>
  );
}
