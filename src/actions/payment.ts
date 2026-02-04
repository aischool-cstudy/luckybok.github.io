'use server';

/**
 * 결제 관련 Server Actions
 * - 크레딧 구매 준비/승인
 * - 결제 이력 조회
 */

import { headers } from 'next/headers';
import { requireAuth, AuthError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTossClient, PaymentError } from '@/lib/payment/toss';
import { generateOrderId } from '@/lib/payment/crypto';
import { creditPackages } from '@/config/pricing';
import { logError } from '@/lib/logger';
import { parseRpcResult, type RpcResultBase } from '@/lib/supabase/helpers';

// RPC 결과 확장 타입
interface CreditPaymentRpcResult extends RpcResultBase {
  new_balance: number;
}
import {
  checkRateLimit,
  getClientIP,
  getRateLimitErrorMessage,
  RATE_LIMIT_PRESETS,
} from '@/lib/rate-limit';
import {
  prepareCreditPurchaseSchema,
  confirmCreditPaymentSchema,
  validateCreditPackageAmount,
  type PrepareCreditPurchaseInput,
  type ConfirmCreditPaymentInput,
} from '@/lib/validators/payment';
import type {
  ActionResponse,
  PreparePaymentResponse,
} from '@/types/payment.types';

// ────────────────────────────────────────────────────────────
// 크레딧 구매 준비
// ────────────────────────────────────────────────────────────

export async function prepareCreditPurchase(
  input: PrepareCreditPurchaseInput
): Promise<ActionResponse<PreparePaymentResponse>> {
  try {
    // Rate Limit 체크
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = await checkRateLimit(
      clientIP,
      'prepare_credit_purchase',
      RATE_LIMIT_PRESETS.PAYMENT_PREPARE
    );
    if (!rateLimitResult.allowed) {
      return { success: false, error: getRateLimitErrorMessage(rateLimitResult) };
    }

    // 입력값 검증
    const validated = prepareCreditPurchaseSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message || '입력값이 올바르지 않습니다',
      };
    }

    // 인증 확인
    const { user, supabase } = await requireAuth();

    // 사용자 프로필 조회 (customer_key 포함)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('customer_key')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, error: '사용자 정보를 찾을 수 없습니다' };
    }

    // 패키지 정보 조회
    const pkg = creditPackages.find((p) => p.id === validated.data.packageId);
    if (!pkg) {
      return { success: false, error: '존재하지 않는 패키지입니다' };
    }

    // 주문 ID 생성
    const orderId = generateOrderId('CRD');

    // 결제 레코드 생성 (pending 상태)
    const adminClient = createAdminClient();
    const { error: insertError } = await adminClient.from('payments').insert({
      user_id: user.id,
      order_id: orderId,
      type: 'credit_purchase',
      status: 'pending',
      amount: pkg.price,
      metadata: {
        creditPackageId: pkg.id,
        credits: pkg.credits,
        validityDays: pkg.validityDays,
      },
    });

    if (insertError) {
      logError('결제 레코드 생성 실패', insertError, { userId: user.id, action: 'prepareCreditPurchase' });
      return { success: false, error: '결제 준비에 실패했습니다' };
    }

    return {
      success: true,
      data: {
        orderId,
        amount: pkg.price,
        orderName: `CodeGen AI 크레딧 ${pkg.credits}개 (${pkg.name})`,
        customerKey: profile.customer_key,
      },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('prepareCreditPurchase 오류', error, { action: 'prepareCreditPurchase' });
    return { success: false, error: '크레딧 구매 준비에 실패했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 크레딧 결제 승인
// ────────────────────────────────────────────────────────────

export async function confirmCreditPayment(
  input: ConfirmCreditPaymentInput
): Promise<ActionResponse<{ credits: number; balance: number }>> {
  try {
    // Rate Limit 체크
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = await checkRateLimit(
      clientIP,
      'confirm_credit_payment',
      RATE_LIMIT_PRESETS.PAYMENT_CONFIRM
    );
    if (!rateLimitResult.allowed) {
      return { success: false, error: getRateLimitErrorMessage(rateLimitResult) };
    }

    // 입력값 검증
    const validated = confirmCreditPaymentSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message || '입력값이 올바르지 않습니다',
      };
    }

    const { paymentKey, orderId, amount } = validated.data;

    // 인증 확인
    const { user } = await requireAuth();

    // 기존 결제 레코드 조회
    const adminClient = createAdminClient();
    const { data: payment, error: paymentError } = await adminClient
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', user.id)
      .single();

    if (paymentError || !payment) {
      return { success: false, error: '결제 정보를 찾을 수 없습니다' };
    }

    if (payment.status !== 'pending') {
      return { success: false, error: '이미 처리된 결제입니다' };
    }

    // 금액 검증
    const metadata = payment.metadata as { creditPackageId?: string; credits?: number };
    if (!metadata.creditPackageId) {
      return { success: false, error: '잘못된 결제 정보입니다' };
    }

    const amountValidation = validateCreditPackageAmount(
      metadata.creditPackageId,
      amount
    );
    if (!amountValidation.valid) {
      return { success: false, error: amountValidation.error };
    }

    // 토스페이먼츠 결제 승인 요청
    const tossClient = getTossClient();
    let tossResponse;

    try {
      tossResponse = await tossClient.confirmPayment(paymentKey, orderId, amount);
    } catch (error) {
      // 결제 실패 처리
      await adminClient
        .from('payments')
        .update({
          status: 'failed',
          failure_code: error instanceof PaymentError ? error.code : 'UNKNOWN',
          failure_reason: error instanceof Error ? error.message : '결제 승인 실패',
        })
        .eq('id', payment.id);

      return {
        success: false,
        error: error instanceof PaymentError ? error.message : '결제 승인에 실패했습니다',
      };
    }

    // 토스 응답 금액 검증 (보안: 결제 금액 무결성 확인)
    if (tossResponse.totalAmount !== amount) {
      logError('토스 응답 금액 불일치', new Error('Amount mismatch'), {
        action: 'confirmCreditPayment',
        orderId,
        expectedAmount: amount,
        receivedAmount: tossResponse.totalAmount,
      });

      // 결제 상태를 failed로 업데이트
      await adminClient
        .from('payments')
        .update({
          status: 'failed',
          failure_code: 'AMOUNT_MISMATCH',
          failure_reason: '결제 금액이 일치하지 않습니다',
        })
        .eq('id', payment.id);

      return { success: false, error: '결제 금액 검증에 실패했습니다' };
    }

    // 패키지 정보로 만료일 계산
    const pkg = creditPackages.find((p) => p.id === metadata.creditPackageId);
    const creditsToAdd = metadata.credits ?? 0;
    const expiresAt = pkg
      ? new Date(Date.now() + pkg.validityDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // 원자적 트랜잭션: RPC 함수로 결제 완료 + 크레딧 추가 + 잔액 업데이트
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      'confirm_credit_payment_atomic',
      {
        p_payment_id: payment.id,
        p_payment_key: paymentKey,
        p_method: tossResponse.method,
        p_receipt_url: tossResponse.receipt?.url ?? null,
        p_paid_at: tossResponse.approvedAt,
        p_user_id: user.id,
        p_credits_to_add: creditsToAdd,
        p_description: `크레딧 ${creditsToAdd}개 구매 (${pkg?.name || '패키지'})`,
        p_expires_at: expiresAt,
      }
    );

    if (rpcError) {
      logError('결제 확인 RPC 오류', rpcError, { userId: user.id, orderId, action: 'confirmCreditPayment' });
      return { success: false, error: '결제 처리 중 오류가 발생했습니다' };
    }

    // RPC 결과 확인
    const parsed = parseRpcResult<CreditPaymentRpcResult>(rpcResult);
    if (!parsed.success) {
      logError('결제 트랜잭션 실패', new Error(parsed.error), { userId: user.id, orderId, action: 'confirmCreditPayment' });
      return { success: false, error: parsed.error };
    }

    return {
      success: true,
      data: {
        credits: creditsToAdd,
        balance: parsed.data.new_balance,
      },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('confirmCreditPayment 오류', error, { action: 'confirmCreditPayment' });
    return { success: false, error: '결제 승인 처리에 실패했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 참고: 결제 이력 조회는 @/actions/billing의 getPaymentHistory를 사용하세요.
// 참고: 크레딧 잔액 조회는 @/actions/credits의 getCreditBalance를 사용하세요.
// ────────────────────────────────────────────────────────────
