/**
 * 관리자 알림 시스템
 *
 * 중요한 시스템 이벤트 발생 시 관리자에게 알림을 전송합니다.
 * 현재 지원: 콘솔 로그 (프로덕션에서 Slack/이메일 연동 예정)
 */

import { logError, logWarn } from '@/lib/logger';

export interface AdminAlertPayload {
  title: string;
  severity: 'critical' | 'warning' | 'info';
  details: Record<string, unknown>;
  action?: string;
  userId?: string;
}

/**
 * 관리자에게 알림 전송
 *
 * TODO: 프로덕션 환경에서 Slack Webhook 또는 이메일 연동
 *
 * @example
 * ```typescript
 * await sendAdminAlert({
 *   title: '환불 DB 동기화 실패',
 *   severity: 'critical',
 *   details: { paymentId, refundAmount, error },
 *   action: 'manual_db_sync_required',
 *   userId: user.id,
 * });
 * ```
 */
export async function sendAdminAlert(payload: AdminAlertPayload): Promise<void> {
  const { title, severity, details, action, userId } = payload;

  const alertMessage = {
    timestamp: new Date().toISOString(),
    title,
    severity,
    action,
    userId,
    details,
    environment: process.env.NODE_ENV,
  };

  // 현재: 로그 기록만 (프로덕션에서는 Slack/이메일 연동)
  if (severity === 'critical') {
    logError(`[ADMIN ALERT] ${title}`, new Error(JSON.stringify(details)), {
      action: action || 'admin_alert',
      alertPayload: alertMessage,
    });

    // TODO: Slack Webhook 연동
    // await sendSlackAlert(alertMessage);

    // TODO: 이메일 알림 연동
    // await sendEmailAlert(alertMessage);
  } else if (severity === 'warning') {
    logWarn(`[ADMIN ALERT] ${title}`, {
      action: action || 'admin_alert',
      alertPayload: alertMessage,
    });
  }

  // 프로덕션 환경에서 Slack 웹훅 호출 (환경 변수 설정 시)
  const slackWebhookUrl = process.env.SLACK_ADMIN_WEBHOOK_URL;
  if (slackWebhookUrl && process.env.NODE_ENV === 'production') {
    try {
      await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `*[${severity.toUpperCase()}]* ${title}`,
          attachments: [
            {
              color: severity === 'critical' ? 'danger' : severity === 'warning' ? 'warning' : 'good',
              fields: [
                { title: 'Action', value: action || 'N/A', short: true },
                { title: 'User ID', value: userId || 'N/A', short: true },
                { title: 'Details', value: JSON.stringify(details, null, 2), short: false },
              ],
              ts: Math.floor(Date.now() / 1000),
            },
          ],
        }),
      });
    } catch (error) {
      logError('Slack 알림 전송 실패', error, { action: 'slack_alert_failed' });
    }
  }
}

/**
 * 환불 DB 동기화 실패 알림
 */
export async function alertRefundSyncFailed(params: {
  paymentId: string;
  userId: string;
  orderId: string;
  refundAmount: number;
  error: string;
}): Promise<void> {
  await sendAdminAlert({
    title: '환불 DB 동기화 실패 - 수동 처리 필요',
    severity: 'critical',
    action: 'refund_db_sync_failed',
    userId: params.userId,
    details: {
      paymentId: params.paymentId,
      orderId: params.orderId,
      refundAmount: params.refundAmount,
      error: params.error,
      instructions: 'webhook_logs 테이블에서 REFUND_DB_SYNC_FAILED 이벤트 확인 후 수동 처리 필요',
    },
  });
}

/**
 * 결제 불일치 알림
 */
export async function alertPaymentMismatch(params: {
  paymentId: string;
  userId: string;
  expectedAmount: number;
  actualAmount: number;
}): Promise<void> {
  await sendAdminAlert({
    title: '결제 금액 불일치 감지',
    severity: 'critical',
    action: 'payment_amount_mismatch',
    userId: params.userId,
    details: {
      paymentId: params.paymentId,
      expectedAmount: params.expectedAmount,
      actualAmount: params.actualAmount,
      difference: params.actualAmount - params.expectedAmount,
    },
  });
}
