import { Suspense } from 'react';
import { ArrowLeft, Coins } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getCreditHistory, getCreditBalance } from '@/actions/credits';
import { CreditHistoryTable } from './credit-history-table';
import { CreditHistoryPagination } from './pagination';

interface CreditHistoryPageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export const metadata = {
  title: '크레딧 내역 | CodeGen AI',
  description: '크레딧 사용 및 충전 내역을 확인하세요.',
};

export default async function CreditHistoryPage({ searchParams }: CreditHistoryPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = 20;

  const [historyResult, balanceResult] = await Promise.all([
    getCreditHistory(page, limit),
    getCreditBalance(),
  ]);

  if (!balanceResult) {
    redirect('/login');
  }

  const { transactions, total } = historyResult;
  const totalPages = Math.ceil(total / limit);

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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
            <Coins className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">크레딧 내역</h1>
            <p className="text-sm text-muted-foreground">
              크레딧 충전 및 사용 내역
            </p>
          </div>
        </div>
      </div>

      {/* 잔액 카드 */}
      <Card>
        <CardHeader>
          <CardTitle>현재 잔액</CardTitle>
          <CardDescription>보유 중인 크레딧</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-yellow-500">
              {balanceResult.balance.toLocaleString()}
            </span>
            <span className="text-muted-foreground">크레딧</span>
          </div>
          {balanceResult.expiringCredits > 0 && balanceResult.expiringDate && (
            <p className="mt-2 text-sm text-orange-500">
              {balanceResult.expiringCredits.toLocaleString()} 크레딧이{' '}
              {new Date(balanceResult.expiringDate).toLocaleDateString('ko-KR')}에 만료 예정
            </p>
          )}
        </CardContent>
      </Card>

      {/* 내역 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>거래 내역</CardTitle>
          <CardDescription>총 {total}건의 거래 내역</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">로딩 중...</div>}>
            <CreditHistoryTable transactions={transactions} />
          </Suspense>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="mt-6">
              <CreditHistoryPagination
                currentPage={page}
                totalPages={totalPages}
                total={total}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
