import { Card, CardContent, CardHeader } from '@/components/ui';
import { Loader2 } from 'lucide-react';

export default function GenerateLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="h-9 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-5 w-96 animate-pulse rounded bg-muted" />
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* 생성 폼 스켈레톤 */}
        <div className="lg:w-1/3">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="h-6 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-64 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 필드 스켈레톤 */}
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-10 w-full animate-pulse rounded bg-muted" />
                </div>
              ))}
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        </div>

        {/* 콘텐츠 영역 스켈레톤 */}
        <div className="lg:w-2/3">
          <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-muted">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-lg font-medium">로딩 중...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
