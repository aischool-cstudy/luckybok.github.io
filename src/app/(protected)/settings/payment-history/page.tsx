import { Suspense } from 'react';
import { ArrowLeft, Receipt } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getPaymentHistory, getPaymentStats } from '@/actions/billing';
import { PaymentHistoryTable } from './payment-history-table';
import { PaymentHistoryPagination } from './pagination';
import { PaymentHistoryFilters } from './payment-history-filters';
import { PaymentStatsCards } from './payment-stats-cards';
import { ExportCsvButton } from './export-csv-button';
import { PaymentHistoryMobileList } from './payment-history-mobile';

// Supabase에서 반환된 결제 데이터를 컴포넌트 타입으로 변환
interface PaymentForComponent {
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

interface PaymentHistoryPageProps {
  searchParams: Promise<{
    page?: string;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export const metadata = {
  title: '결제 내역 | CodeGen AI',
  description: '결제 및 환불 내역을 확인하세요.',
};

export default async function PaymentHistoryPage({ searchParams }: PaymentHistoryPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = 20;

  // 필터 파라미터
  const filters = {
    type: params.type as 'subscription' | 'credit_purchase' | 'all' | undefined,
    status: params.status as 'completed' | 'refunded' | 'failed' | 'all' | undefined,
    startDate: params.startDate,
    endDate: params.endDate,
  };

  // 병렬로 데이터 조회
  const [{ payments, total }, stats] = await Promise.all([
    getPaymentHistory(page, limit, filters),
    getPaymentStats(),
  ]);

  if (!payments) {
    redirect('/login');
  }

  // Supabase Json 타입을 컴포넌트에서 사용하는 타입으로 변환
  const typedPayments = payments as unknown as PaymentForComponent[];
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">결제 내역</h1>
              <p className="text-sm text-muted-foreground">
                결제 및 환불 내역
              </p>
            </div>
          </div>
        </div>

        {/* CSV 내보내기 버튼 */}
        <div className="flex justify-end">
          <ExportCsvButton payments={typedPayments} />
        </div>
      </div>

      {/* 통계 카드 */}
      {stats && <PaymentStatsCards stats={stats} />}

      {/* 내역 테이블 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>전체 결제 내역</CardTitle>
              <CardDescription>총 {total}건의 결제 내역</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 필터 */}
          <Suspense fallback={null}>
            <PaymentHistoryFilters currentFilters={filters} />
          </Suspense>

          {/* 데스크톱 테이블 */}
          <div className="hidden md:block">
            <Suspense fallback={<div className="py-8 text-center text-muted-foreground">로딩 중...</div>}>
              <PaymentHistoryTable payments={typedPayments} />
            </Suspense>
          </div>

          {/* 모바일 리스트 */}
          <div className="md:hidden">
            <Suspense fallback={<div className="py-8 text-center text-muted-foreground">로딩 중...</div>}>
              <PaymentHistoryMobileList payments={typedPayments} />
            </Suspense>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="mt-6">
              <PaymentHistoryPagination
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
