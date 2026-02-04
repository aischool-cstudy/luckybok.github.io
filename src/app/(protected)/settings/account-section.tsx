'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  AlertTriangle,
  Trash2,
  ShieldAlert,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { Button, Input, Label } from '@/components/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { deleteAccount } from '@/actions/settings';
import { useCSRF } from '@/hooks/use-csrf';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function AccountSection() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const { token: csrfToken } = useCSRF();

  const resetForm = () => {
    setConfirmText('');
    setPassword('');
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleDelete = () => {
    if (confirmText !== '계정 삭제') {
      toast.error('"계정 삭제"를 정확히 입력해주세요');
      return;
    }

    if (!password) {
      toast.error('비밀번호를 입력해주세요');
      return;
    }

    startTransition(async () => {
      const result = await deleteAccount({
        password,
        confirmText: '계정 삭제' as const,
        _csrf: csrfToken || undefined,
      });
      if (result.success) {
        toast.success('계정이 삭제되었습니다');
        setIsOpen(false);
        router.push('/');
      } else {
        toast.error(result.error);
      }
    });
  };

  const isDeleteEnabled = confirmText === '계정 삭제' && password.length > 0;

  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-destructive/5 border border-destructive/10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
          <Trash2 className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <p className="font-medium">계정 삭제</p>
          <p className="text-sm text-muted-foreground">
            모든 데이터가 영구적으로 삭제됩니다
          </p>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="destructive"
            className="shadow-lg shadow-red-500/20"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            계정 삭제
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-md">
          {/* 상단 그라데이션 바 */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 rounded-t-lg" />

          <DialogHeader className="pt-4">
            <div className="flex justify-center mb-4">
              <div className="relative">
                {/* 배경 글로우 효과 */}
                <div className="absolute inset-0 w-20 h-20 rounded-full blur-2xl opacity-30 bg-red-500" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/40 dark:to-orange-900/40 shadow-lg">
                  <ShieldAlert className="h-8 w-8 text-destructive" />
                </div>
              </div>
            </div>
            <DialogTitle className="text-center text-xl">
              계정을 삭제하시겠습니까?
            </DialogTitle>
            <DialogDescription className="text-center">
              이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 경고 메시지 */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-destructive/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-destructive">
                    삭제되는 데이터:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                    <li>모든 생성된 콘텐츠</li>
                    <li>결제 및 구독 기록</li>
                    <li>계정 정보 및 설정</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 비밀번호 입력 */}
            <div className="space-y-2">
              <Label
                htmlFor="delete-password"
                className="text-sm font-medium flex items-center gap-2"
              >
                <Lock className="h-4 w-4 text-muted-foreground" />
                비밀번호 확인
              </Label>
              <div className="relative">
                <Input
                  id="delete-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="현재 비밀번호"
                  disabled={isPending}
                  className="pl-10 h-11"
                  autoComplete="current-password"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* 확인 텍스트 입력 */}
            <div className="space-y-2">
              <Label
                htmlFor="confirm-text"
                className="text-sm font-medium flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                확인을 위해 &quot;계정 삭제&quot;를 입력하세요
              </Label>
              <div className="relative">
                <Input
                  id="confirm-text"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="계정 삭제"
                  disabled={isPending}
                  className={cn(
                    'pl-10 h-11',
                    confirmText &&
                      confirmText !== '계정 삭제' &&
                      'border-destructive focus-visible:ring-destructive'
                  )}
                  autoComplete="off"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <AlertTriangle
                    className={cn(
                      'h-4 w-4 transition-colors',
                      confirmText === '계정 삭제'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    )}
                  />
                </div>
              </div>
              {confirmText && confirmText !== '계정 삭제' && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  정확히 &quot;계정 삭제&quot;를 입력해주세요
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
              className="flex-1 sm:flex-none"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending || !isDeleteEnabled}
              className="flex-1 sm:flex-none bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/25"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              영구 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
