'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui';
import { FileDown, Lock, Loader2 } from 'lucide-react';
import { exportContentToPDF } from '@/actions/export';
import { useToast } from '@/hooks/use-toast';
import type { Plan } from '@/types/domain.types';

interface ExportPDFButtonProps {
  contentId: string;
  plan: Plan;
  variant?: 'icon' | 'full';
}

// PDF 내보내기 허용 플랜
const ALLOWED_PLANS: Plan[] = ['pro', 'team', 'enterprise'];

export function ExportPDFButton({
  contentId,
  plan,
  variant = 'full',
}: ExportPDFButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const isAllowed = ALLOWED_PLANS.includes(plan);

  const handleExport = () => {
    if (!isAllowed) {
      toast({
        title: 'Pro 플랜 필요',
        description: 'PDF 내보내기는 Pro 플랜 이상에서 사용 가능합니다.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await exportContentToPDF({ contentId });

      if (result.success && result.pdf) {
        // Blob 생성 및 다운로드
        const blob = new Blob([new Uint8Array(result.pdf)], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);

        toast({
          title: 'PDF 내보내기 완료',
          description: `${result.filename} 파일이 다운로드되었습니다.`,
        });
      } else if (!result.success) {
        toast({
          title: 'PDF 내보내기 실패',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleExport();
        }}
        disabled={isPending}
        className={`rounded-md p-1.5 transition-colors ${
          isAllowed
            ? 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
            : 'text-muted-foreground/50 cursor-not-allowed'
        }`}
        aria-label={isAllowed ? 'PDF 내보내기' : 'PDF 내보내기 (Pro 플랜 필요)'}
        title={isAllowed ? 'PDF 내보내기' : 'Pro 플랜 이상에서 사용 가능'}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isAllowed ? (
          <FileDown className="h-4 w-4" />
        ) : (
          <Lock className="h-4 w-4" />
        )}
      </button>
    );
  }

  return (
    <Button
      variant={isAllowed ? 'outline' : 'ghost'}
      onClick={(e) => {
        e.preventDefault();
        handleExport();
      }}
      disabled={isPending || !isAllowed}
    >
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : isAllowed ? (
        <FileDown className="mr-2 h-4 w-4" />
      ) : (
        <Lock className="mr-2 h-4 w-4" />
      )}
      {isAllowed ? 'PDF 내보내기' : 'Pro 플랜 필요'}
    </Button>
  );
}
