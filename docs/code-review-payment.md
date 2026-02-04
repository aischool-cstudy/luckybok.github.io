# 결제 시스템 코드 리뷰 보고서

> **Version**: 1.0.0
> **Review Date**: 2026-01-29
> **Reviewer**: 터미널 5 (문서 & 리뷰)
> **Scope**: 결제 관련 코드 (toss.ts, payment.ts, subscription.ts, webhooks)

---

## 목차

1. [리뷰 대상](#리뷰-대상)
2. [리뷰 요약](#리뷰-요약)
3. [보안 검토](#보안-검토)
4. [코드 품질](#코드-품질)
5. [에러 처리](#에러-처리)
6. [성능](#성능)
7. [개선 제안](#개선-제안)
8. [우선순위별 액션 아이템](#우선순위별-액션-아이템)

---

## 리뷰 대상

| 파일 | 위치 | 역할 |
|------|------|------|
| `toss.ts` | `src/lib/payment/` | 토스페이먼츠 API 클라이언트 |
| `plans.ts` | `src/lib/payment/` | 요금제/크레딧 패키지 정의 |
| `payment.ts` | `src/actions/` | 크레딧 구매 Server Actions |
| `subscription.ts` | `src/actions/` | 구독 관리 Server Actions |
| `route.ts` | `src/app/api/webhooks/toss/` | 웹훅 핸들러 |

---

## 리뷰 요약

### 전체 평가: ⭐⭐⭐⭐ (4/5)

| 영역 | 점수 | 상태 |
|------|------|------|
| 보안 | 4/5 | ✅ 양호 |
| 코드 품질 | 4/5 | ✅ 양호 |
| 에러 처리 | 3.5/5 | ⚠️ 개선 필요 |
| 성능 | 4/5 | ✅ 양호 |
| 테스트 가능성 | 3/5 | ⚠️ 개선 필요 |

### 주요 발견 사항

```
✅ 강점
├── 시크릿 키 환경변수 관리
├── Zod 기반 입력 검증
├── 금액 서버 사이드 검증
├── 웹훅 서명 검증 구현 (HMAC-SHA256 + timing-safe)
├── 빌링키 AES-256-GCM 암호화 저장
└── sanitizeForLogging 유틸리티 구현

✅ 수정 완료 (2026-01-29)
├── 웹훅 secret 로깅 제거 (route.ts:268)
├── 구독 트랜잭션 원자적 처리 (subscription.ts)
├── 구독 갱신 트랜잭션 원자적 처리 (subscription.ts)
├── Rate Limiting 구현 (rate-limit.ts, payment.ts, subscription.ts)
├── 재시도 로직 확인 (toss.ts - 기존 구현)
└── 보안 로거 구현 및 민감정보 필터링 (logger.ts, 결제 관련 actions)
```

---

## 보안 검토

### ✅ 양호한 항목

#### 1. 시크릿 키 관리

**파일**: `src/lib/payment/toss.ts:170-179`

```typescript
export function getTossClient(): TossPaymentsClient {
  if (!tossClient) {
    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      throw new Error('TOSS_SECRET_KEY 환경 변수가 설정되지 않았습니다.');
    }
    tossClient = new TossPaymentsClient(secretKey);
  }
  return tossClient;
}
```

**평가**: ✅ 환경변수에서만 시크릿 키를 로드하며, 싱글톤 패턴으로 인스턴스 재사용.

#### 2. 금액 검증

**파일**: `src/actions/payment.ts:163-169`

```typescript
const amountValidation = validateCreditPackageAmount(
  metadata.creditPackageId,
  amount
);
if (!amountValidation.valid) {
  return { success: false, error: amountValidation.error };
}
```

**평가**: ✅ 서버 사이드에서 금액을 검증하여 클라이언트 조작 방지.

#### 3. 빌링키 암호화

**파일**: `src/actions/subscription.ts:210`

```typescript
const encryptedBillingKey = encryptBillingKey(billingKeyResponse.billingKey);
```

**평가**: ✅ 빌링키를 암호화하여 저장.

#### 4. 웹훅 서명 검증

**파일**: `src/app/api/webhooks/toss/route.ts:40-48`

```typescript
const isValidSignature = verifyWebhookSignature(rawBody, signature);

if (!isValidSignature) {
  console.error('웹훅 서명 검증 실패');
  return NextResponse.json(
    { error: '서명 검증 실패' },
    { status: 401 }
  );
}
```

**평가**: ✅ 웹훅 요청의 서명을 검증하여 위조 요청 방지.

### ✅ 수정 완료 항목

#### 1. 웹훅 secret 로깅 제거 (2026-01-29 수정)

**파일**: `src/app/api/webhooks/toss/route.ts:268`

**이전 코드**:
```typescript
console.log(`가상계좌 입금 완료: ${orderId}, secret: ${secret}`);
```

**수정 후**:
```typescript
console.log(`가상계좌 입금 완료: ${orderId}`);
```

**평가**: ✅ 민감한 secret 정보가 로그에 노출되지 않도록 수정됨.

#### 2. 구독 트랜잭션 롤백 구현 (2026-01-29 수정)

**파일**: `src/actions/subscription.ts`

**이전 코드**: 결제 완료, 구독 생성, 프로필 업데이트가 개별 쿼리로 실행 (롤백 불가)

**수정 후**: `confirm_subscription_atomic` RPC 함수로 원자적 트랜잭션 처리

```typescript
const { data: rpcResult, error: rpcError } = await adminClient.rpc(
  'confirm_subscription_atomic',
  {
    p_payment_id: payment.id,
    p_payment_key: chargeResponse.paymentKey,
    // ... 원자적 처리
  }
);
```

**평가**: ✅ 결제 완료 → 구독 생성 → 프로필 업데이트가 단일 트랜잭션으로 처리되어 데이터 일관성 보장.

#### 3. 구독 갱신 트랜잭션 롤백 구현 (2026-01-29 수정)

**파일**: `src/actions/subscription.ts:renewSubscription`

**수정 내용**: `renew_subscription_atomic` RPC 함수로 원자적 트랜잭션 처리

**평가**: ✅ 갱신 결제 완료 → 구독 기간 연장 → 프로필 업데이트가 단일 트랜잭션으로 처리됨.

#### 4. Rate Limiting 구현 (2026-01-29 수정)

**파일**: `src/lib/rate-limit.ts` (신규), `src/actions/payment.ts`, `src/actions/subscription.ts`

**구현 내용**:
- 메모리 기반 슬라이딩 윈도우 Rate Limiter
- 액션별 프리셋 정의 (PAYMENT_PREPARE, PAYMENT_CONFIRM, SUBSCRIPTION_CREATE 등)
- IP 기반 요청 제한

**적용 범위**:
```typescript
// 결제 준비: 분당 10회
prepareCreditPurchase → RATE_LIMIT_PRESETS.PAYMENT_PREPARE

// 결제 확인: 분당 5회
confirmCreditPayment → RATE_LIMIT_PRESETS.PAYMENT_CONFIRM

// 구독 생성: 분당 3회
prepareSubscription → RATE_LIMIT_PRESETS.SUBSCRIPTION_CREATE

// 구독 확인: 분당 5회
confirmSubscription → RATE_LIMIT_PRESETS.PAYMENT_CONFIRM
```

**평가**: ✅ DDoS 및 무차별 대입 공격 방지. 프로덕션에서는 Redis 기반으로 마이그레이션 권장.

### ✅ 수정 완료 항목 (추가)

#### 5. 로그에 민감 정보 노출 방지 (2026-01-29 수정 완료)

**파일**: `src/lib/logger.ts` (신규), 결제 관련 actions

**구현 내용**:
```typescript
// 보안 로거 - 민감 필드 자동 마스킹
import { logError } from '@/lib/logger';

logError('결제 처리 오류', error, {
  userId: user.id,
  orderId,
  action: 'confirmPayment'
});
// 출력: billingKey, customerKey 등 민감 필드는 [REDACTED]로 마스킹
```

**주요 기능**:
- `SENSITIVE_FIELDS`: 민감 필드 목록 (billingKey, customerKey, paymentKey 등) 자동 마스킹
- `sanitizeError()`: Error 객체 안전한 직렬화 (프로덕션에서 stack trace 제외)
- 구조화된 로그 출력 (프로덕션 JSON, 개발 가독성 포맷)

**적용 범위**: `payment.ts`, `subscription.ts`, `billing.ts`, `admin/webhook.ts`

#### ~~2. Rate Limiting 부재~~ (2026-01-29 수정 완료)

**파일**: 모든 Server Actions

**위험도**: Medium

**문제점**: API 호출 횟수 제한이 없어 DDoS 또는 무차별 대입 공격에 취약.

**권장 수정**:
```typescript
// 미들웨어 또는 Server Action에 rate limiting 추가
import { rateLimit } from '@/lib/rate-limit';

export async function prepareCreditPurchase(input) {
  await rateLimit({ userId: user.id, action: 'credit_purchase', limit: 10, window: '1m' });
  // ...
}
```

---

## 코드 품질

### ✅ 양호한 항목

#### 1. 타입 안전성

**평가**: 전체적으로 TypeScript 타입이 잘 정의되어 있음.

```typescript
// 명확한 타입 정의
export interface TossPaymentResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  // ...
}
```

#### 2. 입력 검증

**평가**: Zod 스키마를 사용한 체계적인 검증.

```typescript
const validated = prepareCreditPurchaseSchema.safeParse(input);
if (!validated.success) {
  return {
    success: false,
    error: validated.error.errors[0]?.message || '입력값이 올바르지 않습니다',
  };
}
```

#### 3. 코드 구조

**평가**: 관심사 분리가 잘 되어 있음.
- `lib/payment/`: 외부 API 클라이언트
- `actions/`: 비즈니스 로직
- `api/webhooks/`: 웹훅 처리

### ⚠️ 개선 필요 항목

#### 1. 매직 넘버 사용

**파일**: `src/actions/payment.ts:356`

```typescript
const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
```

**권장 수정**:
```typescript
const DAYS_BEFORE_EXPIRY_WARNING = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const expiryWarningDate = new Date(
  Date.now() + DAYS_BEFORE_EXPIRY_WARNING * MS_PER_DAY
).toISOString();
```

#### 2. 함수 길이

**파일**: `src/actions/subscription.ts:138-331` (confirmSubscription)

**문제점**: 함수가 200줄 이상으로 너무 김.

**권장 수정**: 단계별로 분리
```typescript
async function confirmSubscription(input) {
  const validated = await validateInput(input);
  const user = await authenticateUser();
  const payment = await getPaymentRecord(validated.orderId, user.id);
  const billingKey = await issueBillingKey(validated);
  await saveBillingKey(billingKey, user.id);
  const chargeResult = await executeFirstCharge(billingKey, payment);
  await createSubscription(user.id, chargeResult);
}
```

#### 3. 중복 코드

**파일**: `payment.ts`, `subscription.ts`

**문제점**: 인증 확인 코드가 모든 함수에 반복됨.

```typescript
// 반복되는 패턴
const supabase = await createServerClient();
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return { success: false, error: '로그인이 필요합니다' };
}
```

**권장 수정**: 헬퍼 함수로 추출
```typescript
// lib/auth.ts
export async function requireAuth() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError('로그인이 필요합니다');
  }

  return { user, supabase };
}

// 사용
const { user, supabase } = await requireAuth();
```

---

## 에러 처리

### ✅ 양호한 항목

#### 1. 커스텀 에러 클래스

```typescript
export class PaymentError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}
```

#### 2. 에러 상태 저장

```typescript
await adminClient
  .from('payments')
  .update({
    status: 'failed',
    failure_code: error instanceof PaymentError ? error.code : 'UNKNOWN',
    failure_reason: error instanceof Error ? error.message : '결제 승인 실패',
  })
  .eq('id', payment.id);
```

### ⚠️ 개선 필요 항목

#### 1. 트랜잭션 롤백 없음 (Critical)

**파일**: `src/actions/payment.ts:211-239`

```typescript
// 1. 결제 상태 업데이트
await adminClient.from('payments').update({...}).eq('id', payment.id);

// 2. 크레딧 트랜잭션 생성
await adminClient.from('credit_transactions').insert({...});

// 3. 프로필 크레딧 잔액 업데이트
await adminClient.from('profiles').update({...}).eq('id', user.id);
```

**문제점**: 2번 또는 3번에서 실패하면 데이터 불일치 발생.

**권장 수정**:
```typescript
// Supabase RPC 함수로 트랜잭션 처리
const { error } = await adminClient.rpc('confirm_credit_payment', {
  p_payment_id: payment.id,
  p_user_id: user.id,
  p_credits: creditsToAdd,
  p_expires_at: expiresAt,
  // ...
});
```

#### 2. 구독 생성 실패 시 롤백 없음 (Critical)

**파일**: `src/actions/subscription.ts:292-308`

**문제점**: 구독 레코드 생성 실패 시 이미 처리된 결제와 빌링키가 롤백되지 않음.

#### ~~3. 재시도 로직 없음~~ (기존 구현 확인)

**파일**: `src/lib/payment/toss.ts`

**상태**: ✅ 이미 구현됨

**구현 내용**:
```typescript
// RETRY_CONFIG 설정
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  timeoutMs: 15000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

// fetchWithRetry 함수로 지수 백오프 + 지터 적용
async function fetchWithRetry(url, options, retryCount = 0) {
  // AbortController로 타임아웃 처리
  // NetworkError 클래스로 재시도 가능 여부 판단
  // calculateBackoffDelay로 지수 백오프 계산
}
```

**평가**: ✅ 모든 API 메서드 (`confirmPayment`, `cancelPayment`, `issueBillingKey`, `chargeBilling`)가 `fetchWithRetry`를 사용하여 재시도 로직 적용됨.

---

## 성능

### ✅ 양호한 항목

#### 1. 싱글톤 클라이언트

```typescript
let tossClient: TossPaymentsClient | null = null;

export function getTossClient(): TossPaymentsClient {
  if (!tossClient) {
    // ...
  }
  return tossClient;
}
```

**평가**: API 클라이언트 재생성 방지.

#### 2. 페이지네이션

```typescript
const offset = (page - 1) * limit;
const { data, count } = await supabase
  .from('payments')
  .select('*', { count: 'exact' })
  .range(offset, offset + limit - 1);
```

### ⚠️ 개선 필요 항목

#### 1. N+1 쿼리 가능성

**파일**: `src/actions/subscription.ts:449-456`

```typescript
const { data: subscription } = await supabase
  .from('subscriptions')
  .select('*, billing_keys!billing_key_id(card_company, card_number)')
  // ...
```

**평가**: ✅ JOIN으로 N+1 방지됨. 다만 필요한 컬럼만 선택하면 더 효율적.

#### 2. 웹훅 처리 동기화

**파일**: `src/app/api/webhooks/toss/route.ts`

**문제점**: 무거운 처리가 웹훅 응답 전에 실행됨.

**권장 수정**: 백그라운드 처리
```typescript
// 빠른 응답 반환 후 백그라운드 처리
const response = NextResponse.json({ success: true });

// Edge Function 또는 Queue로 비동기 처리
await queueWebhookProcessing(webhookLogId, eventType, data);

return response;
```

---

## 개선 제안

### Architecture

```
현재 구조:
┌─────────────────────────────────────────────────────────────┐
│  Server Action → DB 직접 호출 → 토스 API                      │
└─────────────────────────────────────────────────────────────┘

권장 구조:
┌─────────────────────────────────────────────────────────────┐
│  Server Action → Service Layer → Repository → DB           │
│                           ↓                                 │
│                    TossPayments Client                      │
└─────────────────────────────────────────────────────────────┘
```

### 서비스 레이어 도입

```typescript
// src/services/payment.service.ts
export class PaymentService {
  constructor(
    private readonly db: Database,
    private readonly tossClient: TossPaymentsClient
  ) {}

  async purchaseCredits(userId: string, packageId: string) {
    // 비즈니스 로직
  }
}

// src/actions/payment.ts
export async function prepareCreditPurchase(input) {
  const service = new PaymentService(db, getTossClient());
  return service.purchaseCredits(user.id, input.packageId);
}
```

### 테스트 용이성 개선

```typescript
// 의존성 주입으로 테스트 가능하게
export async function confirmCreditPayment(
  input: ConfirmCreditPaymentInput,
  deps = { tossClient: getTossClient(), db: createAdminClient() }
) {
  // deps를 통해 모킹 가능
}
```

---

## 우선순위별 액션 아이템

### Critical (즉시 수정 필요)

| # | 항목 | 파일 | 상태 |
|---|------|------|------|
| 1 | ~~트랜잭션 롤백 구현~~ | `payment.ts`, `subscription.ts` | ✅ 완료 |
| 2 | ~~구독 생성 실패 시 롤백~~ | `subscription.ts` | ✅ 완료 |

> **Note**: Critical 항목 모두 2026-01-29 수정 완료. RPC 함수 (`confirm_credit_payment_atomic`, `confirm_subscription_atomic`, `renew_subscription_atomic`) 적용.

### High (이번 스프린트 내)

| # | 항목 | 파일 | 상태 |
|---|------|------|------|
| 3 | ~~Rate Limiting 추가~~ | `rate-limit.ts`, `payment.ts`, `subscription.ts` | ✅ 완료 |
| 4 | ~~재시도 로직 구현~~ | `toss.ts` | ✅ 기존 구현 확인 |
| 5 | ~~로그 민감정보 필터링~~ | `logger.ts`, 결제 관련 actions | ✅ 완료 |

> **Note**:
> - 항목 #4 재시도 로직은 `toss.ts`에 이미 구현되어 있음 확인 (2026-01-29). `fetchWithRetry` 함수로 지수 백오프, 재시도 가능 상태 코드 처리, 타임아웃 등 완비.
> - 항목 #5 보안 로거 (`src/lib/logger.ts`) 구현 및 `payment.ts`, `subscription.ts`, `billing.ts`, `admin/webhook.ts`에 적용 완료 (2026-01-29). 민감 필드 마스킹, 에러 직렬화, 구조화된 로그 출력 지원.

### Medium (다음 스프린트)

| # | 항목 | 파일 | 담당 |
|---|------|------|------|
| 6 | 인증 헬퍼 함수 추출 | `lib/auth.ts` 생성 | 터미널 1 |
| 7 | 함수 분리 리팩토링 | `subscription.ts` | 터미널 1 |
| 8 | 매직 넘버 상수화 | 전체 | 터미널 1 |

### Low (개선 사항)

| # | 항목 | 파일 | 담당 |
|---|------|------|------|
| 9 | 서비스 레이어 도입 | 새 구조 | 터미널 1 |
| 10 | 웹훅 비동기 처리 | `webhooks/toss/route.ts` | 터미널 1 |
| 11 | 테스트 코드 작성 | `tests/` | 터미널 4 |

---

## 결론

전체적으로 결제 시스템의 기본 구조는 잘 설계되어 있습니다. 보안 측면에서 시크릿 키 관리, 금액 검증, 웹훅 서명 검증 등 핵심 요소가 구현되어 있습니다.

**가장 시급한 개선점**은 트랜잭션 롤백 처리입니다. 현재 구조에서는 결제 완료 후 크레딧 지급이 실패하거나, 빌링키 저장 후 첫 결제가 실패하는 경우 데이터 불일치가 발생할 수 있습니다.

터미널 1 (백엔드)에서 Critical 항목을 우선적으로 수정하고, 터미널 4 (테스트)에서 수정 사항에 대한 테스트를 작성하는 것을 권장합니다.

---

*리뷰 완료: 2026-01-29*
*다음 리뷰 예정: 주요 변경사항 반영 후*
