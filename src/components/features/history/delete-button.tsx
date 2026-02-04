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
      <div
        className="flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-label="삭제 확인"
        aria-describedby="delete-confirm-text"
      >
        <span id="delete-confirm-text" className="text-xs text-muted-foreground">
          삭제할까요?
        </span>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleDelete}
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : '확인'}
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
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowConfirm(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setShowConfirm(true);
          }
        }}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
        aria-label="삭제"
        aria-haspopup="dialog"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
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
