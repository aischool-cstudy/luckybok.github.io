'use client';

/**
 * 구독 취소 다이얼로그 컴포넌트
 */

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { SubscriptionSummary } from '@/types/payment.types';

interface CancelSubscriptionDialogProps {
  subscription: SubscriptionSummary;
  isLoading?: boolean;
  onCancel: (cancelImmediately: boolean) => void;
  trigger?: React.ReactNode;
}

export function CancelSubscriptionDialog({
  subscription,
  isLoading = false,
  onCancel,
  trigger,
}: CancelSubscriptionDialogProps) {
  const [cancelType, setCancelType] = useState<'end_of_period' | 'immediate'>(
    'end_of_period'
  );
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    onCancel(cancelType === 'immediate');
    setOpen(false);
  };

  const periodEndDate = new Date(subscription.currentPeriodEnd).toLocaleDateString(
    'ko-KR',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="text-destructive">
            구독 취소
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            구독을 취소하시겠습니까?
          </AlertDialogTitle>
          <AlertDialogDescription>
            현재 {subscription.plan.toUpperCase()} 플랜을 구독 중입니다.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <RadioGroup
            value={cancelType}
            onValueChange={(value: string) =>
              setCancelType(value as 'end_of_period' | 'immediate')
            }
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50">
              <RadioGroupItem value="end_of_period" id="end_of_period" />
              <div className="flex-1">
                <Label htmlFor="end_of_period" className="cursor-pointer">
                  <div className="font-medium">기간 종료 시 취소</div>
                  <div className="text-sm text-muted-foreground">
                    {periodEndDate}까지 계속 사용할 수 있습니다.
                  </div>
                </Label>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 mt-2">
              <RadioGroupItem value="immediate" id="immediate" />
              <div className="flex-1">
                <Label htmlFor="immediate" className="cursor-pointer">
                  <div className="font-medium">즉시 취소</div>
                  <div className="text-sm text-muted-foreground">
                    지금 바로 무료 플랜으로 변경됩니다. 환불은 불가합니다.
                  </div>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? '처리 중...' : '구독 취소'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
