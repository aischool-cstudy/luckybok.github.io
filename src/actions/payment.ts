'use server';

/**
 * 결제 관련 Server Actions
 * - 크레딧 구매 준비/승인
 * - 결제 이력 조회
 */

import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTossClient, PaymentError } from '@/lib/payment/toss';
import { generateOrderId } from '@/lib/payment/crypto';
import { creditPackages } from '@/config/pricing';
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
  PaymentHistoryItem,
} from '@/types/payment.types';

// ────────────────────────────────────────────────────────────
// 크레딧 구매 준비
// ────────────────────────────────────────────────────────────

export async function prepareCreditPurchase(
  input: PrepareCreditPurchaseInput
): Promise<ActionResponse<PreparePaymentResponse>> {
  try {
    // 입력값 검증
    const validated = prepareCreditPurchaseSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message || '입력값이 올바르지 않습니다',
      };
    }

    // 인증 확인
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: '로그인이 필요합니다' };
    }

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
      console.error('결제 레코드 생성 실패:', insertError);
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
    console.error('prepareCreditPurchase 오류:', error);
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
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: '로그인이 필요합니다' };
    }

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

    // 현재 크레딧 잔액 조회
    const { data: profile } = await adminClient
      .from('profiles')
      .select('credits_balance')
      .eq('id', user.id)
      .single();

    const currentBalance = profile?.credits_balance ?? 0;
    const creditsToAdd = metadata.credits ?? 0;
    const newBalance = currentBalance + creditsToAdd;

    // 패키지 정보로 만료일 계산
    const pkg = creditPackages.find((p) => p.id === metadata.creditPackageId);
    const expiresAt = pkg
      ? new Date(Date.now() + pkg.validityDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // 트랜잭션: 결제 완료 + 크레딧 추가
    // 1. 결제 상태 업데이트
    await adminClient
      .from('payments')
      .update({
        status: 'completed',
        payment_key: paymentKey,
        method: tossResponse.method,
        receipt_url: tossResponse.receipt?.url,
        paid_at: tossResponse.approvedAt,
      })
      .eq('id', payment.id);

    // 2. 크레딧 트랜잭션 생성
    await adminClient.from('credit_transactions').insert({
      user_id: user.id,
      type: 'purchase',
      amount: creditsToAdd,
      balance: newBalance,
      description: `크레딧 ${creditsToAdd}개 구매 (${pkg?.name || '패키지'})`,
      payment_id: payment.id,
      expires_at: expiresAt,
    });

    // 3. 프로필 크레딧 잔액 업데이트 (Critical: 이 단계가 누락되면 잔액이 반영되지 않음)
    await adminClient
      .from('profiles')
      .update({ credits_balance: newBalance })
      .eq('id', user.id);

    return {
      success: true,
      data: {
        credits: creditsToAdd,
        balance: newBalance,
      },
    };
  } catch (error) {
    console.error('confirmCreditPayment 오류:', error);
    return { success: false, error: '결제 승인 처리에 실패했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 결제 이력 조회
// ────────────────────────────────────────────────────────────

export async function getPaymentHistory(
  page = 1,
  limit = 10
): Promise<ActionResponse<{ items: PaymentHistoryItem[]; total: number }>> {
  try {
    // 인증 확인
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: '로그인이 필요합니다' };
    }

    const offset = (page - 1) * limit;

    // 결제 이력 조회
    const { data: payments, error: paymentsError, count } = await supabase
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (paymentsError) {
      console.error('결제 이력 조회 실패:', paymentsError);
      return { success: false, error: '결제 이력 조회에 실패했습니다' };
    }

    const items: PaymentHistoryItem[] = (payments ?? []).map((payment) => {
      const metadata = payment.metadata as Record<string, unknown>;
      let description = '';

      if (payment.type === 'credit_purchase') {
        const credits = metadata?.credits as number;
        description = `크레딧 ${credits || 0}개 구매`;
      } else if (payment.type === 'subscription') {
        const plan = metadata?.planId as string;
        const cycle = metadata?.billingCycle as string;
        description = `${plan?.toUpperCase() || '플랜'} 구독 (${cycle === 'yearly' ? '연간' : '월간'})`;
      }

      return {
        id: payment.id,
        date: new Date(payment.created_at),
        type: payment.type as 'subscription' | 'credit_purchase',
        description,
        amount: payment.amount,
        status: payment.status as 'pending' | 'completed' | 'failed' | 'canceled' | 'refunded' | 'partial_refunded',
        receiptUrl: payment.receipt_url,
      };
    });

    return {
      success: true,
      data: {
        items,
        total: count ?? 0,
      },
    };
  } catch (error) {
    console.error('getPaymentHistory 오류:', error);
    return { success: false, error: '결제 이력 조회에 실패했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 크레딧 잔액 조회
// ────────────────────────────────────────────────────────────

export async function getCreditBalance(): Promise<
  ActionResponse<{ balance: number; expiringCredits: number; expiringDate: Date | null }>
> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: '로그인이 필요합니다' };
    }

    // 잔액 조회
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_balance')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return { success: false, error: '잔액 조회에 실패했습니다' };
    }

    // 곧 만료되는 크레딧 조회 (30일 이내)
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiringTransactions } = await supabase
      .from('credit_transactions')
      .select('amount, expires_at')
      .eq('user_id', user.id)
      .eq('type', 'purchase')
      .gt('amount', 0)
      .lte('expires_at', thirtyDaysLater)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true });

    let expiringCredits = 0;
    let expiringDate: Date | null = null;

    if (expiringTransactions && expiringTransactions.length > 0) {
      expiringCredits = expiringTransactions.reduce((sum, t) => sum + t.amount, 0);
      const firstExpiringDate = expiringTransactions[0]?.expires_at;
      expiringDate = firstExpiringDate ? new Date(firstExpiringDate) : null;
    }

    return {
      success: true,
      data: {
        balance: profile?.credits_balance ?? 0,
        expiringCredits,
        expiringDate,
      },
    };
  } catch (error) {
    console.error('getCreditBalance 오류:', error);
    return { success: false, error: '잔액 조회에 실패했습니다' };
  }
}
