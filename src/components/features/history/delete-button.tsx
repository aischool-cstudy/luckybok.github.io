'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { Trash2, Loader2 } from 'lucide-react';
import { deleteContent } from '@/actions/history';

interface DeleteButtonProps {
  contentId: string;
  onDeleted?: () => void;
  variant?: 'icon' | 'full';
  redirectTo?: string;
}

export function DeleteButton({
  contentId,
  onDeleted,
  variant = 'icon',
  redirectTo,
}: DeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteContent(contentId);
      if (result.success) {
        onDeleted?.();
        if (redirectTo) {
          router.push(redirectTo);
        }
      } else {
        alert(result.error);
      }
      setShowConfirm(false);
    });
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs text-muted-foreground">삭제할까요?</span>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleDelete}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '확인'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowConfirm(false)}
          disabled={isPending}
        >
          취소
        </Button>
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowConfirm(true);
        }}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        aria-label="삭제"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );
  }

  return (
    <Button
      variant="destructive"
      onClick={(e) => {
        e.preventDefault();
        setShowConfirm(true);
      }}
    >
      <Trash2 className="mr-2 h-4 w-4" />
      삭제
    </Button>
  );
}
