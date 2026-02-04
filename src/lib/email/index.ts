/**
 * 이메일 서비스 (Resend)
 * 팀 초대, 알림 등 트랜잭셔널 이메일 발송
 */

import { Resend } from 'resend';
import { logError, logInfo } from '@/lib/logger';

// Resend 클라이언트 (환경 변수가 없으면 null)
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// 발신자 이메일 주소
const EMAIL_FROM = process.env.EMAIL_FROM || 'CodeGen AI <noreply@codegen.ai>';

// 앱 URL
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * 이메일 발송
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  // Resend가 설정되지 않은 경우
  if (!resend) {
    logInfo('이메일 발송 스킵 (RESEND_API_KEY 미설정)', {
      to: options.to,
      subject: options.subject,
    });
    return {
      success: true,
      messageId: 'skipped-no-api-key',
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      logError('이메일 발송 실패', error, {
        to: options.to,
        subject: options.subject,
      });
      return {
        success: false,
        error: error.message,
      };
    }

    logInfo('이메일 발송 성공', {
      to: options.to,
      subject: options.subject,
      messageId: data?.id,
    });

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    logError('이메일 발송 예외', error, {
      to: options.to,
      subject: options.subject,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}

/**
 * 팀 초대 이메일 발송
 */
export async function sendTeamInvitationEmail(params: {
  to: string;
  inviterName: string;
  teamName: string;
  invitationToken: string;
  expiresAt: string;
}): Promise<SendEmailResult> {
  const { to, inviterName, teamName, invitationToken, expiresAt } = params;

  const inviteUrl = `${APP_URL}/team/invite?token=${invitationToken}`;
  const expiresDate = new Date(expiresAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const subject = `[CodeGen AI] ${inviterName}님이 ${teamName} 팀에 초대했습니다`;

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">CodeGen AI</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="margin: 0 0 24px; color: #1f2937; font-size: 20px; font-weight: 600;">
                팀 초대가 도착했습니다
              </h2>

              <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                안녕하세요,
              </p>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                <strong style="color: #1f2937;">${inviterName}</strong>님이
                <strong style="color: #6366f1;">${teamName}</strong> 팀에
                초대했습니다.
              </p>

              <p style="margin: 0 0 32px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                아래 버튼을 클릭하여 초대를 수락하고 팀에 참여하세요.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}"
                       style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      초대 수락하기
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 32px 0 0; color: #9ca3af; font-size: 14px; line-height: 1.6;">
                이 초대는 <strong>${expiresDate}</strong>까지 유효합니다.
              </p>

              <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;">

              <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣으세요:<br>
                <a href="${inviteUrl}" style="color: #6366f1; word-break: break-all;">${inviteUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                이 이메일은 CodeGen AI에서 발송되었습니다.<br>
                본인이 요청하지 않았다면 이 이메일을 무시해도 됩니다.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
CodeGen AI 팀 초대

${inviterName}님이 ${teamName} 팀에 초대했습니다.

아래 링크를 클릭하여 초대를 수락하세요:
${inviteUrl}

이 초대는 ${expiresDate}까지 유효합니다.

---
이 이메일은 CodeGen AI에서 발송되었습니다.
본인이 요청하지 않았다면 이 이메일을 무시해도 됩니다.
  `.trim();

  return sendEmail({
    to,
    subject,
    html,
    text,
  });
}

/**
 * 이메일 서비스 사용 가능 여부 확인
 */
export function isEmailServiceAvailable(): boolean {
  return !!process.env.RESEND_API_KEY;
}
