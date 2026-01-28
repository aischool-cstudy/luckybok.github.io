import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <FileQuestion className="h-16 w-16 text-muted-foreground" />
      <h2 className="text-2xl font-bold">콘텐츠를 찾을 수 없습니다</h2>
      <p className="text-muted-foreground text-center max-w-md">
        요청하신 콘텐츠가 존재하지 않거나 삭제되었습니다.
      </p>
      <Button asChild>
        <Link href="/history">히스토리로 돌아가기</Link>
      </Button>
    </div>
  );
}
