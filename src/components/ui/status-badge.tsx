'use client';

/**
 * 상태 표시 배지 컴포넌트
 * 결제, 구독, 웹훅 등의 상태를 일관된 스타일로 표시합니다.
 */

import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  PAYMENT_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  WEBHOOK_STATUS_LABELS,
  type PaymentStatusType,
  type SubscriptionStatusType,
  type WebhookStatus,
} from '@/config/constants';

// 상태별 배지 variant 매핑
const PAYMENT_STATUS_VARIANTS: Record<PaymentStatusType, BadgeProps['variant']> = {
  pending: 'secondary',
  completed: 'default',
  failed: 'destructive',
  canceled: 'outline',
  refunded: 'outline',
  partial_refunded: 'outline',
};

const SUBSCRIPTION_STATUS_VARIANTS: Record<SubscriptionStatusType, BadgeProps['variant']> = {
  active: 'default',
  canceled: 'outline',
  past_due: 'destructive',
  trialing: 'secondary',
  paused: 'secondary',
};

const WEBHOOK_STATUS_VARIANTS: Record<WebhookStatus, BadgeProps['variant']> = {
  pending: 'secondary',
  processed: 'default',
  failed: 'destructive',
  retrying: 'secondary',
};

// ─────────────────────────────────────────────────────────
// PaymentStatusBadge
// ─────────────────────────────────────────────────────────

interface PaymentStatusBadgeProps {
  status: PaymentStatusType;
  className?: string;
}

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  return (
    <Badge variant={PAYMENT_STATUS_VARIANTS[status]} className={className}>
      {PAYMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────
// SubscriptionStatusBadge
// ─────────────────────────────────────────────────────────

interface SubscriptionStatusBadgeProps {
  status: SubscriptionStatusType;
  className?: string;
}

export function SubscriptionStatusBadge({ status, className }: SubscriptionStatusBadgeProps) {
  return (
    <Badge variant={SUBSCRIPTION_STATUS_VARIANTS[status]} className={className}>
      {SUBSCRIPTION_STATUS_LABELS[status]}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────
// WebhookStatusBadge
// ─────────────────────────────────────────────────────────

interface WebhookStatusBadgeProps {
  status: WebhookStatus;
  className?: string;
}

export function WebhookStatusBadge({ status, className }: WebhookStatusBadgeProps) {
  return (
    <Badge variant={WEBHOOK_STATUS_VARIANTS[status]} className={className}>
      {WEBHOOK_STATUS_LABELS[status]}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────
// GenericStatusBadge (유연한 사용을 위한 범용 컴포넌트)
// ─────────────────────────────────────────────────────────

type StatusType = 'payment' | 'subscription' | 'webhook';

interface GenericStatusBadgeProps {
  type: StatusType;
  status: string;
  className?: string;
}

export function StatusBadge({ type, status, className }: GenericStatusBadgeProps) {
  switch (type) {
    case 'payment':
      return <PaymentStatusBadge status={status as PaymentStatusType} className={className} />;
    case 'subscription':
      return <SubscriptionStatusBadge status={status as SubscriptionStatusType} className={className} />;
    case 'webhook':
      return <WebhookStatusBadge status={status as WebhookStatus} className={className} />;
    default:
      return <Badge variant="secondary" className={className}>{status}</Badge>;
  }
}
