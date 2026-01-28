'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';
import { deleteAccount } from '@/actions/settings';
import { toast } from 'sonner';

export function AccountSection() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleDelete = () => {
    if (confirmText !== '계정 삭제') {
      toast.error('"계정 삭제"를 정확히 입력해주세요');
      return;
    }

    startTransition(async () => {
      const result = await deleteAccount();
      if (result.success) {
        toast.success('계정이 삭제되었습니다');
        router.push('/');
      } else {
        toast.error(result.error);
      }
    });
  };

  if (showConfirm) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-destructive">정말 삭제하시겠습니까?</p>
            <p className="text-sm text-muted-foreground">
              이 작업은 되돌릴 수 없습니다. 모든 생성된 콘텐츠와 계정 정보가 영구적으로 삭제됩니다.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmText" className="text-sm font-medium">
            확인을 위해 &quot;계정 삭제&quot;를 입력하세요
          </label>
          <input
            id="confirmText"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="계정 삭제"
            className="w-full px-3 py-2 border rounded-md text-sm"
            disabled={isPending}
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending || confirmText !== '계정 삭제'}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            영구 삭제
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowConfirm(false);
              setConfirmText('');
            }}
            disabled={isPending}
          >
            취소
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">계정 삭제</p>
        <p className="text-sm text-muted-foreground">
          모든 데이터가 영구적으로 삭제됩니다
        </p>
      </div>
      <Button variant="destructive" onClick={() => setShowConfirm(true)}>
        계정 삭제
      </Button>
    </div>
  );
}
