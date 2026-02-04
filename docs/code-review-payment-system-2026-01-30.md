# 결제 시스템 코드 리뷰 리포트

> **리뷰 일시**: 2026-01-30
> **리뷰 대상**: 결제/구독/환불 Server Actions 및 관련 모듈
> **리뷰어**: 터미널 5 (문서 & 리뷰)

---

## 개요

결제 시스템 핵심 파일 6개에 대한 종합 코드 리뷰입니다.

### 리뷰 대상 파일

| 파일 | LOC | 역할 |
|------|-----|------|
| `src/actions/payment.ts` | 285 | 크레딧 구매 준비/승인 |
| `src/actions/subscription.ts` | 1103 | 구독 관리 (시작/취소/갱신/플랜변경) |
| `src/actions/billing.ts` | 1268 | 결제 수단/결제 내역/환불 |
| `src/actions/credits.ts` | 295 | 크레딧 잔액/사용/추가 |
| `src/app/api/webhooks/toss/route.ts` | 633 | 토스 웹훅 처리 |
| `src/lib/payment/toss.ts` | 331 | 토스페이먼츠 API 클라이언트 |

---

## 심각도 범례

- **Critical**: 즉시 수정 필요 (보안 취약점, 데이터 무결성 위험)
- **Warning**: 조속한 수정 권장 (잠재적 버그, 성능 이슈)
- **Suggestion**: 개선 제안 (코드 품질, 유지보수성)

---

## 1. 보안 리뷰

### 1.1 [Critical] 웹훅 Race Condition 가능성

**파일**: `src/app/api/webhooks/toss/route.ts:93-141`

**문제**: 멱등성 키 확인과 웹훅 로그 생성 사이에 Race Condition 발생 가능

```typescript
// 현재 코드: SELECT → INSERT 사이에 다른 요청이 들어올 수 있음
const { data: existingLog } = await adminClient
  .from('webhook_logs')
  .select('id, status')
  .eq('idempotency_key', idempotencyKey)
  .single();

// ... 중간에 다른 웹훅 요청이 같은 키로 들어올 수 있음

if (!existingLog) {
  const { data: log } = await adminClient
    .from('webhook_logs')
    .insert({ ... })
```

**권장 해결책**:
```typescript
// INSERT ... ON CONFLICT 또는 RPC 함수로 원자적 처리
const { data: result, error } = await adminClient.rpc(
  'upsert_webhook_log_atomic',
  {
    p_idempotency_key: idempotencyKey,
    p_event_type: eventType,
    p_payload: payload,
  }
);
```

---

### 1.2 [Warning] 결제 실패 시 에러 메시지 민감 정보 노출 가능성

**파일**: `src/actions/subscription.ts:248-255`

**문제**: PaymentError의 원본 메시지를 사용자에게 직접 노출

```typescript
return {
  success: false,
  error: error instanceof PaymentError ? error.message : '빌링키 발급에 실패했습니다',
};
```

**권장 해결책**: 토스 에러 코드를 사용자 친화적 메시지로 매핑
```typescript
const errorMessage = error instanceof PaymentError
  ? mapTossErrorToUserMessage(error.code)
  : '빌링키 발급에 실패했습니다';
```

---

### 1.3 [Suggestion] 빌링키 복호화 동적 import 패턴 일관성

**파일**:
- `src/actions/subscription.ts:501` - 동적 import
- `src/actions/subscription.ts:14` - 정적 import

**문제**: 같은 파일 내에서 `decryptBillingKey`를 정적/동적 import 혼용

```typescript
// 상단: 정적 import
import { generateOrderId, encryptBillingKey, decryptBillingKey } from '@/lib/payment/crypto';

// 501행: 동적 import (불필요)
const { decryptBillingKey } = await import('@/lib/payment/crypto');
```

**권장**: 이미 정적 import 되어 있으므로 동적 import 제거

---

## 2. 에러 처리 리뷰

### 2.1 [Critical] 토스 환불 성공 후 DB 실패 시 불완전한 보상 처리

**파일**: `src/actions/billing.ts:866-909`

**문제**: 토스 환불 성공 → DB 업데이트 실패 시 사용자에게 성공 응답하지만, 실제로 DB에는 미반영

```typescript
// 토스 환불 성공 + DB 실패 시
if (tossRefundSucceeded && !rpcSucceeded) {
  // 웹훅 로그만 기록하고 성공 응답 반환
  return {
    success: true,
    data: { refundAmount, refundedAt: new Date().toISOString() },
  };
}
```

**현재 상태**: webhook_logs에 `REFUND_DB_SYNC_FAILED` 이벤트 기록은 좋은 접근
**추가 권장**:
1. 관리자 알림 시스템 연동 (Slack, 이메일 등)
2. 자동 재시도 cron job 구현
3. 사용자 응답에 "처리 완료 (시스템 반영 지연 가능)" 안내 추가

---

### 2.2 [Warning] 구독 갱신 결제 실패 시 재시도 로직 미흡

**파일**: `src/actions/subscription.ts:593-654`

**현재 상태**: 재시도 횟수와 다음 재시도 시간을 metadata에 저장하지만, 실제 재시도를 트리거하는 cron job이 필요

```typescript
// 재시도 예약: 메타데이터에만 기록
await adminClient
  .from('subscriptions')
  .update({
    metadata: {
      renewal_retry_count: newRetryCount,
      next_retry_at: nextRetryAt.toISOString(),
    },
  })
```

**권장**:
1. `src/app/api/cron/subscription-retry/route.ts` 구현 확인 필요
2. `next_retry_at` 기준으로 조회하는 cron job 존재 여부 확인

---

### 2.3 [Suggestion] 일관된 에러 응답 형식

**파일**: 여러 파일

**문제**: 에러 응답 형식이 파일마다 약간씩 다름

```typescript
// payment.ts
return { success: false, error: '로그인이 필요합니다' };

// billing.ts - 같은 에러지만 다른 형식
return { success: false, error: '로그인이 필요합니다' };
```

**권장**: 에러 응답 헬퍼 함수 도입
```typescript
// lib/api-response.ts
export const authRequiredError = () => ({ success: false, error: '로그인이 필요합니다' });
export const notFoundError = (entity: string) => ({ success: false, error: `${entity}을(를) 찾을 수 없습니다` });
```

---

## 3. 성능 리뷰

### 3.1 [Warning] 결제 통계 조회 시 클라이언트 사이드 집계 제거 확인

**파일**: `src/actions/billing.ts:592-636`

**현재 상태**: RPC 함수 `get_payment_stats`로 DB 레벨 집계 - **Good**

**확인 필요**: RPC 함수 내부에서 인덱스 활용 여부
```sql
-- 권장 인덱스
CREATE INDEX idx_payments_user_status_created ON payments(user_id, status, created_at);
```

---

### 3.2 [Suggestion] 구독 조회 시 불필요한 카드 정보 조회

**파일**: `src/actions/subscription.ts:401-409`

```typescript
const { data: subscription } = await supabase
  .from('subscriptions')
  .select('*, billing_keys!billing_key_id(card_company, card_number)')
  // ...
```

**문제**: `select('*')`로 모든 컬럼 조회 후 일부만 사용

**권장**: 필요한 컬럼만 명시적으로 조회
```typescript
.select('id, plan, status, current_period_end, cancel_at_period_end, billing_keys!billing_key_id(card_company, card_number)')
```

---

### 3.3 [Suggestion] 크레딧 만료 예정 조회 최적화

**파일**: `src/actions/credits.ts:55-64`

```typescript
const { data: expiringTransactions } = await supabase
  .from('credit_transactions')
  .select('amount, expires_at')
  .eq('user_id', targetUserId)
  .in('type', ['purchase', 'subscription_grant'])
  .gt('amount', 0)
  .not('expires_at', 'is', null)
  .lte('expires_at', thirtyDaysLater.toISOString())
  .gte('expires_at', new Date().toISOString())
```

**권장**: 복합 인덱스 생성
```sql
CREATE INDEX idx_credit_transactions_expiry ON credit_transactions(user_id, type, expires_at) WHERE amount > 0;
```

---

## 4. 코드 품질 리뷰

### 4.1 [Warning] subscription.ts 파일 크기 과다

**파일**: `src/actions/subscription.ts` (1103 LOC)

**문제**: 단일 파일에 10개 이상의 함수가 밀집

**권장 분리안**:
```
src/actions/subscription/
├── prepare.ts       # prepareSubscription
├── confirm.ts       # confirmSubscription
├── renew.ts         # renewSubscription
├── cancel.ts        # cancelSubscription (billing.ts에서 이동)
├── plan-change.ts   # preparePlanChange, confirmPlanChange, cancelScheduledPlanChange
└── queries.ts       # getCurrentSubscription, getScheduledPlanChange
```

---

### 4.2 [Warning] billing.ts 파일 크기 과다

**파일**: `src/actions/billing.ts` (1268 LOC)

**권장 분리안**:
```
src/actions/billing/
├── subscription.ts     # getSubscription, cancelSubscription, reactivateSubscription
├── payment-methods.ts  # get/add/set/delete PaymentMethod
├── history.ts          # getPaymentHistory, getPaymentStats
├── refund.ts           # requestRefund, checkRefundEligibility, createRefundRequest, cancelRefundRequest
└── index.ts            # re-export
```

---

### 4.3 [Suggestion] 타입 캐스팅 반복 패턴

**파일**: 여러 파일

**문제**: Supabase 조인 결과 타입 캐스팅이 반복됨

```typescript
// subscription.ts:420-422
const billingKeyData = subscription.billing_keys as unknown;
const billingKey = (Array.isArray(billingKeyData) ? billingKeyData[0] : billingKeyData) as { ... } | null;
```

**권장**: 유틸리티 함수 추출
```typescript
// lib/supabase/helpers.ts
export function normalizeJoinResult<T>(data: unknown): T | null {
  if (!data) return null;
  return (Array.isArray(data) ? data[0] : data) as T;
}

// 사용
const billingKey = normalizeJoinResult<BillingKeyInfo>(subscription.billing_keys);
```

---

### 4.4 [Suggestion] RPC 결과 처리 패턴 중복

**파일**: 여러 파일

**문제**: RPC 결과 배열 처리 코드가 반복됨

```typescript
// 이 패턴이 10+ 회 반복
const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
if (!result?.success) { ... }
```

**권장**: 유틸리티 함수 추출
```typescript
// lib/supabase/helpers.ts
export function parseRpcResult<T extends { success: boolean; error_message?: string }>(
  rpcResult: T[] | T | null
): { success: true; data: T } | { success: false; error: string } {
  const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
  if (!result?.success) {
    return { success: false, error: result?.error_message || '처리에 실패했습니다' };
  }
  return { success: true, data: result };
}
```

---

## 5. 웹훅 핸들러 리뷰

### 5.1 [Warning] 웹훅 헬퍼 함수 비원자적 크레딧 처리

**파일**: `src/app/api/webhooks/toss/route.ts:537-569`

**문제**: `handlePaymentCancellation`에서 크레딧 차감이 비원자적

```typescript
// 1. 잔액 조회
const { data: profile } = await adminClient.from('profiles').select('credits_balance')...

// 2. 트랜잭션 생성
await adminClient.from('credit_transactions').insert(...)

// 3. 잔액 업데이트 - Race Condition 가능!
await adminClient.from('profiles').update({ credits_balance: newBalance })...
```

**권장**: RPC 함수로 원자적 처리 (이미 credits.ts에 `use_credit_atomic` 있음)
```typescript
await adminClient.rpc('deduct_credit_atomic', {
  p_user_id: payment.user_id,
  p_amount: credits,
  p_description: '결제 취소로 인한 크레딧 차감',
  p_payment_id: payment.id,
});
```

---

### 5.2 [Suggestion] 웹훅 이벤트 핸들러 분리

**파일**: `src/app/api/webhooks/toss/route.ts`

**권장 구조**:
```
src/lib/payment/webhook-handler.ts  # 이벤트별 핸들러 (이미 존재하는지 확인 필요)
```

---

## 6. 토스 클라이언트 리뷰

### 6.1 [Suggestion] 토스 클라이언트 싱글톤 테스트 어려움

**파일**: `src/lib/payment/toss.ts:323-330`

```typescript
let tossClient: TossPaymentsClient | null = null;

export function getTossClient(): TossPaymentsClient {
  if (!tossClient) {
    tossClient = new TossPaymentsClient(serverEnv.TOSS_SECRET_KEY);
  }
  return tossClient;
}
```

**문제**: 테스트 시 싱글톤 인스턴스 교체 어려움

**권장**: 테스트용 리셋 함수 추가 (개발 환경 한정)
```typescript
// 테스트용 (NODE_ENV !== 'production')
export function __resetTossClient() {
  if (process.env.NODE_ENV !== 'production') {
    tossClient = null;
  }
}
```

---

## 7. 긍정적 평가 (Best Practices)

### 7.1 Rate Limiting 일관 적용

모든 결제 관련 Server Action에 Rate Limiting이 적용되어 있음.

```typescript
const rateLimitResult = await checkRateLimit(
  clientIP,
  'prepare_credit_purchase',
  RATE_LIMIT_PRESETS.PAYMENT_PREPARE
);
```

### 7.2 입력값 검증 (Zod)

모든 Server Action에서 Zod 스키마로 입력값 검증.

```typescript
const validated = prepareCreditPurchaseSchema.safeParse(input);
```

### 7.3 원자적 트랜잭션 (RPC 함수)

결제/크레딧 처리에 PostgreSQL RPC 함수로 원자성 보장.

```typescript
await adminClient.rpc('confirm_credit_payment_atomic', { ... });
```

### 7.4 멱등성 처리 (웹훅)

웹훅 핸들러에서 idempotency_key를 사용한 중복 처리 방지.

### 7.5 지수 백오프 재시도

토스 API 클라이언트에서 지수 백오프 + 지터로 네트워크 에러 처리.

### 7.6 로깅 일관성

`logError`, `logWarn`, `logInfo`로 일관된 로깅 패턴.

---

## 요약

| 심각도 | 건수 | 주요 내용 |
|--------|------|----------|
| **Critical** | 2 | 웹훅 Race Condition, 환불 DB 동기화 실패 처리 |
| **Warning** | 6 | 에러 메시지 노출, 재시도 로직, 파일 크기, 비원자적 크레딧 처리 |
| **Suggestion** | 8 | import 일관성, 에러 응답 헬퍼, 쿼리 최적화, 코드 중복 제거 |

### 우선순위 권장 사항

1. **즉시**: 웹훅 멱등성 처리를 RPC로 원자화
2. **1주 내**: 웹훅 헬퍼의 크레딧 처리를 RPC로 전환
3. **2주 내**: subscription.ts, billing.ts 파일 분리
4. **점진적**: 유틸리티 함수 추출 및 코드 중복 제거

---

## 부록: 관련 문서

- `docs/api/payment.md` - 결제 API 문서
- `docs/api/payment-security.md` - 결제 보안 문서
- `docs/refund-policy.md` - 환불 정책 문서

---

*CodeGen AI 터미널 5 (문서 & 리뷰) - 2026-01-30*
