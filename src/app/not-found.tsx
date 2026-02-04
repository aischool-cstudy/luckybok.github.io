import Link from 'next/link';
import { FileQuestion, Home, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
      <div className="relative">
        {/* Background Effects */}
        <div className="absolute -inset-20 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-3xl rounded-full" />

        <div className="relative text-center max-w-md mx-auto">
          {/* 404 Icon */}
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-purple-600 shadow-xl shadow-primary/30">
                <FileQuestion className="h-12 w-12 text-white" />
              </div>
            </div>
          </div>

          {/* 404 Number */}
          <div className="mb-4">
            <span className="text-8xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              404
            </span>
          </div>

          {/* Error Message */}
          <h2 className="text-2xl font-bold mb-3">페이지를 찾을 수 없습니다</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            요청하신 페이지가 존재하지 않거나<br />
            이동되었을 수 있습니다.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild className="w-full sm:w-auto bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                홈으로 이동
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                대시보드로 이동
              </Link>
            </Button>
          </div>

          {/* Suggested Links */}
          <div className="mt-10 p-4 rounded-2xl bg-muted/30 border">
            <p className="text-sm font-medium mb-3 flex items-center justify-center gap-2">
              <Search className="h-4 w-4" />
              이런 페이지를 찾으셨나요?
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/generate" className="text-sm text-primary hover:underline px-3 py-1 rounded-full bg-primary/10">
                콘텐츠 생성
              </Link>
              <Link href="/history" className="text-sm text-primary hover:underline px-3 py-1 rounded-full bg-primary/10">
                히스토리
              </Link>
              <Link href="/pricing" className="text-sm text-primary hover:underline px-3 py-1 rounded-full bg-primary/10">
                요금제
              </Link>
              <Link href="/settings" className="text-sm text-primary hover:underline px-3 py-1 rounded-full bg-primary/10">
                설정
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
