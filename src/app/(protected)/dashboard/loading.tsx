import { Card, CardContent, CardHeader } from '@/components/ui';
import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 스켈레톤 */}
      <div className="mb-8">
        <div className="h-9 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-5 w-64 animate-pulse rounded bg-muted" />
      </div>

      {/* 통계 카드 스켈레톤 */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 animate-pulse rounded bg-muted" />
              <div className="mt-1 h-3 w-32 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 최근 활동 스켈레톤 */}
      <Card>
        <CardHeader>
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">로딩 중...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
