# DB 통합 가이드 - RPC 함수 사용

> **Version**: 1.1.0
> **Date**: 2026-01-29
> **From**: 터미널 3 (데이터베이스)
> **To**: 터미널 1 (백엔드)
> **Status**: ✅ 완료

---

## 목차

1. [현황 분석](#현황-분석)
2. [RPC 함수 사용 패턴](#rpc-함수-사용-패턴)
3. [구현 완료 사항](#구현-완료-사항)
4. [참고 자료](#참고-자료)

---

## 현황 분석

### RPC 함수 사용 현황

| Server Action | RPC 함수 | 현재 상태 | 트랜잭션 보장 |
|---------------|----------|----------|--------------|
| `confirmCreditPayment` | `confirm_credit_payment_atomic` | ✅ 사용 중 | ✅ 보장 |
| `confirmSubscription` | `confirm_subscription_atomic` | ✅ 사용 중 | ✅ 보장 |
| `renewSubscription` | `renew_subscription_atomic` | ✅ 사용 중 | ✅ 보장 |

> **Note**: 2026-01-29 기준 모든 결제 관련 Server Action이 원자적 RPC 함수를 사용하도록 구현 완료됨.

---

## RPC 함수 사용 패턴

### 올바른 사용 예시 (payment.ts:201-227)

```typescript
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
    p_description: `크레딧 ${creditsToAdd}개 구매`,
    p_expires_at: expiresAt,
  }
);

if (rpcError) {
  console.error('RPC 오류:', rpcError);
  return { success: false, error: '결제 처리 중 오류가 발생했습니다' };
}

// RPC 결과 확인 (배열로 반환됨)
const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
if (!result?.success) {
  console.error('트랜잭션 실패:', result?.error_message);
  return { success: false, error: result?.error_message || '결제 처리에 실패했습니다' };
}
```

---

## 구현 완료 사항

### 1. confirmSubscription (subscription.ts:280-318)

```typescript
// 토스 결제 완료 후 원자적 처리
const { data: rpcResult, error: rpcError } = await adminClient.rpc(
  'confirm_subscription_atomic',
  {
    p_payment_id: payment.id,
    p_payment_key: chargeResponse.paymentKey,
    p_method: chargeResponse.method,
    p_receipt_url: chargeResponse.receipt?.url ?? null,
    p_paid_at: chargeResponse.approvedAt,
    p_user_id: user.id,
    p_plan: plan,
    p_billing_cycle: billingCycle,
    p_billing_key_id: billingKeyRecord.id,
    p_period_start: now.toISOString(),
    p_period_end: periodEnd.toISOString(),
  }
);

if (rpcError) {
  console.error('RPC 오류:', rpcError);
  // 빌링키 정리 (이미 저장된 경우)
  await adminClient.from('billing_keys').delete().eq('id', billingKeyRecord.id);
  return { success: false, error: '구독 처리 중 오류가 발생했습니다' };
}

const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
if (!result?.success) {
  console.error('트랜잭션 실패:', result?.error_message);
  await adminClient.from('billing_keys').delete().eq('id', billingKeyRecord.id);
  return { success: false, error: result?.error_message || '구독 처리에 실패했습니다' };
}

return {
  success: true,
  data: {
    subscriptionId: result.subscription_id,
  },
};
```

### 2. renewSubscription (subscription.ts:597-620)

```typescript
// 토스 결제 완료 후 원자적 처리
const { data: rpcResult, error: rpcError } = await adminClient.rpc(
  'renew_subscription_atomic',
  {
    p_payment_id: payment.id,
    p_payment_key: chargeResponse.paymentKey,
    p_method: chargeResponse.method,
    p_receipt_url: chargeResponse.receipt?.url ?? null,
    p_paid_at: chargeResponse.approvedAt,
    p_subscription_id: subscriptionId,
    p_new_period_start: newPeriodStart.toISOString(),
    p_new_period_end: newPeriodEnd.toISOString(),
  }
);

if (rpcError) {
  console.error('갱신 RPC 오류:', rpcError);
  return { success: false, error: '구독 갱신 처리 중 오류가 발생했습니다' };
}

const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
if (!result?.success) {
  console.error('갱신 트랜잭션 실패:', result?.error_message);
  return { success: false, error: result?.error_message || '구독 갱신에 실패했습니다' };
}

return { success: true, data: { paymentId: payment.id } };
```

---

## 참고 자료

### RPC 함수 정의 위치

```
supabase/migrations/006_transaction_functions.sql
```

### RPC 함수 시그니처

```sql
-- confirm_subscription_atomic
CREATE FUNCTION confirm_subscription_atomic(
    p_payment_id UUID,
    p_payment_key VARCHAR(200),
    p_method VARCHAR(50),
    p_receipt_url TEXT,
    p_paid_at TIMESTAMP WITH TIME ZONE,
    p_user_id UUID,
    p_plan VARCHAR(20),
    p_billing_cycle VARCHAR(10),
    p_billing_key_id UUID,
    p_period_start TIMESTAMP WITH TIME ZONE,
    p_period_end TIMESTAMP WITH TIME ZONE
) RETURNS TABLE (
    success BOOLEAN,
    subscription_id UUID,
    error_message TEXT
)

-- renew_subscription_atomic
CREATE FUNCTION renew_subscription_atomic(
    p_payment_id UUID,
    p_payment_key VARCHAR(200),
    p_method VARCHAR(50),
    p_receipt_url TEXT,
    p_paid_at TIMESTAMP WITH TIME ZONE,
    p_subscription_id UUID,
    p_new_period_start TIMESTAMP WITH TIME ZONE,
    p_new_period_end TIMESTAMP WITH TIME ZONE
) RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT
)
```

---

## 결론

모든 결제 관련 Server Action이 DB 레벨에서 트랜잭션 원자성을 보장하는 RPC 함수를 사용하도록 구현되었습니다.

| 함수 | RPC 함수 | 처리 내용 |
|------|----------|----------|
| `confirmCreditPayment` | `confirm_credit_payment_atomic` | 결제 완료 + 크레딧 추가 + 잔액 업데이트 |
| `confirmSubscription` | `confirm_subscription_atomic` | 결제 완료 + 구독 생성 + 프로필 업데이트 |
| `renewSubscription` | `renew_subscription_atomic` | 결제 완료 + 구독 기간 연장 |

이를 통해 중간 단계 실패 시 데이터 불일치 문제가 방지됩니다.

---

*작성: 터미널 3 (데이터베이스)*
*최종 업데이트: 2026-01-29*
*상태: ✅ 구현 완료*
