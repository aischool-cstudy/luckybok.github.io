'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireAuth, AuthError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTossClient, PaymentError, mapTossErrorToUserMessage } from '@/lib/payment/toss';
import { logError } from '@/lib/logger';
import {
  checkRateLimit,
  getClientIP,
  getRateLimitErrorMessage,
  RATE_LIMIT_PRESETS,
} from '@/lib/rate-limit';
import type { BillingKey } from '@/types/database.types';

// ────────────────────────────────────────────────────────────
// 내부 타입 정의
// ────────────────────────────────────────────────────────────

type PartialBillingKey = Pick<BillingKey, 'id' | 'card_company' | 'card_number' | 'card_type' | 'is_default'>;
type BillingKeyWithOwner = Pick<BillingKey, 'id' | 'user_id'>;
type BillingKeyWithDefault = Pick<BillingKey, 'id' | 'user_id' | 'is_default'>;

// ────────────────────────────────────────────────────────────
// 외부 타입 정의
// ────────────────────────────────────────────────────────────

export interface PaymentMethodInfo {
  id: string;
  cardCompany: string;
  cardNumber: string; // 마스킹된 번호 (끝 4자리만)
  cardType: string | null;
  isDefault: boolean;
}

// ────────────────────────────────────────────────────────────
// 결제 수단 조회
// ────────────────────────────────────────────────────────────

/**
 * 현재 사용자의 결제 수단 목록 조회
 */
export async function getPaymentMethods(): Promise<{
  success: boolean;
  data?: PaymentMethodInfo[];
  error?: string;
}> {
  try {
    const { user, supabase } = await requireAuth();

    const { data, error } = await supabase
      .from('billing_keys')
      .select('id, card_company, card_number, card_type, is_default')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      logError('결제 수단 조회 오류', error, { userId: user.id, action: 'getPaymentMethods' });
      return { success: false, error: '결제 수단을 조회할 수 없습니다' };
    }

    const billingKeys = data as PartialBillingKey[] | null;
    return {
      success: true,
      data: billingKeys?.map(key => ({
        id: key.id,
        cardCompany: key.card_company,
        cardNumber: key.card_number,
        cardType: key.card_type,
        isDefault: key.is_default,
      })) ?? [],
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

// ────────────────────────────────────────────────────────────
// 결제 수단 추가 준비
// ────────────────────────────────────────────────────────────

/**
 * 결제 수단 추가 준비 (customerKey 반환)
 */
export async function prepareAddPaymentMethod(): Promise<{
  success: boolean;
  data?: { customerKey: string };
  error?: string;
}> {
  try {
    const { user, supabase } = await requireAuth();

    const { data: profile } = await supabase
      .from('profiles')
      .select('customer_key')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return { success: false, error: '사용자 정보를 찾을 수 없습니다' };
    }

    return {
      success: true,
      data: { customerKey: profile.customer_key },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

// ────────────────────────────────────────────────────────────
// 결제 수단 추가 확정
// ────────────────────────────────────────────────────────────

/**
 * 결제 수단 추가 확정 (빌링키 발급)
 */
export async function confirmAddPaymentMethod(input: {
  authKey: string;
  customerKey: string;
}): Promise<{
  success: boolean;
  data?: { id: string; cardCompany: string; cardNumber: string };
  error?: string;
}> {
  try {
    // Rate Limiting
    const headersList = await headers();
    const clientIP = getClientIP(headersList);
    const rateLimitResult = await checkRateLimit(
      clientIP,
      'add_payment_method',
      RATE_LIMIT_PRESETS.PAYMENT_CONFIRM
    );

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: getRateLimitErrorMessage(rateLimitResult),
      };
    }

    const { user } = await requireAuth();

    // 빌링키 발급
    const tossClient = getTossClient();
    let billingKeyResponse;
    try {
      billingKeyResponse = await tossClient.issueBillingKey(input.authKey, input.customerKey);
    } catch (error) {
      return {
        success: false,
        error: error instanceof PaymentError ? mapTossErrorToUserMessage(error.code) : '카드 등록에 실패했습니다',
      };
    }

    // 빌링키 암호화 및 저장
    const { encryptBillingKey } = await import('@/lib/payment/crypto');
    const encryptedBillingKey = encryptBillingKey(billingKeyResponse.billingKey);

    const adminClient = createAdminClient();

    // 기존 결제 수단이 없으면 기본으로 설정
    const { data: existingKeys } = await adminClient
      .from('billing_keys')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    const isFirst = !existingKeys || existingKeys.length === 0;

    const { data: billingKeyRecord, error: insertError } = await adminClient
      .from('billing_keys')
      .insert({
        user_id: user.id,
        customer_key: input.customerKey,
        encrypted_billing_key: encryptedBillingKey,
        card_company: billingKeyResponse.card.company,
        card_number: billingKeyResponse.card.number,
        card_type: billingKeyResponse.card.cardType,
        is_default: isFirst,
      })
      .select('id, card_company, card_number')
      .single();

    if (insertError || !billingKeyRecord) {
      logError('빌링키 저장 실패', insertError, { userId: user.id, action: 'confirmAddPaymentMethod' });
      return { success: false, error: '결제 수단 등록에 실패했습니다' };
    }

    revalidatePath('/settings');

    return {
      success: true,
      data: {
        id: billingKeyRecord.id,
        cardCompany: billingKeyRecord.card_company,
        cardNumber: billingKeyRecord.card_number,
      },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logError('confirmAddPaymentMethod 오류', error, { action: 'confirmAddPaymentMethod' });
    return { success: false, error: '결제 수단 등록에 실패했습니다' };
  }
}

// ────────────────────────────────────────────────────────────
// 기본 결제 수단 변경
// ────────────────────────────────────────────────────────────

/**
 * 기본 결제 수단 변경
 */
export async function setDefaultPaymentMethod(billingKeyId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { user, supabase } = await requireAuth();

    // 소유권 확인
    const { data: keyData } = await supabase
      .from('billing_keys')
      .select('id, user_id')
      .eq('id', billingKeyId)
      .single();

    const billingKey = keyData as BillingKeyWithOwner | null;
    if (!billingKey || billingKey.user_id !== user.id) {
      return { success: false, error: '결제 수단을 찾을 수 없습니다' };
    }

    // 모든 결제 수단의 기본 설정 해제
    await supabase
      .from('billing_keys')
      .update({ is_default: false })
      .eq('user_id', user.id);

    // 선택된 결제 수단을 기본으로 설정
    const { error } = await supabase
      .from('billing_keys')
      .update({ is_default: true })
      .eq('id', billingKeyId);

    if (error) {
      logError('기본 결제 수단 변경 오류', error, { userId: user.id, billingKeyId, action: 'setDefaultPaymentMethod' });
      return { success: false, error: '기본 결제 수단 변경에 실패했습니다' };
    }

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

// ────────────────────────────────────────────────────────────
// 결제 수단 삭제
// ────────────────────────────────────────────────────────────

/**
 * 결제 수단 삭제
 */
export async function deletePaymentMethod(billingKeyId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { user, supabase } = await requireAuth();

    // 소유권 확인
    const { data: keyData } = await supabase
      .from('billing_keys')
      .select('id, user_id, is_default')
      .eq('id', billingKeyId)
      .single();

    const billingKey = keyData as BillingKeyWithDefault | null;
    if (!billingKey || billingKey.user_id !== user.id) {
      return { success: false, error: '결제 수단을 찾을 수 없습니다' };
    }

    // 기본 결제 수단인 경우 삭제 방지
    if (billingKey.is_default) {
      // 활성 구독이 있는지 확인
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      const subscription = subData as { id: string } | null;
      if (subscription) {
        return {
          success: false,
          error: '활성 구독이 있는 상태에서 기본 결제 수단을 삭제할 수 없습니다',
        };
      }
    }

    const { error } = await supabase
      .from('billing_keys')
      .delete()
      .eq('id', billingKeyId);

    if (error) {
      logError('결제 수단 삭제 오류', error, { userId: user.id, billingKeyId, action: 'deletePaymentMethod' });
      return { success: false, error: '결제 수단 삭제에 실패했습니다' };
    }

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}
