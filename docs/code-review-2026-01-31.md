# 코드 리뷰 리포트 - 2026-01-31

> **리뷰 대상**: 최신 변경사항 (git status 기준)
> **리뷰 범위**: 결제, 인증, AI 생성, 웹훅 관련 핵심 파일
> **리뷰 관점**: 보안, 코드 품질, 성능, 에러 처리

---

## 목차

1. [종합 평가](#1-종합-평가)
2. [보안 분석](#2-보안-분석)
3. [코드 품질 분석](#3-코드-품질-분석)
4. [성능 분석](#4-성능-분석)
5. [개선 권장사항](#5-개선-권장사항)

---

## 1. 종합 평가

### 전체 점수: ★★★★☆ (4.2/5)

| 항목 | 점수 | 평가 |
|------|------|------|
| **보안** | ★★★★★ | 우수 - 철저한 검증 및 암호화 |
| **코드 품질** | ★★★★☆ | 양호 - 일관된 패턴, 타입 안정성 |
| **성능** | ★★★★☆ | 양호 - 재시도 로직, Rate Limiting |
| **에러 처리** | ★★★★★ | 우수 - 상세한 로깅 및 복구 전략 |
| **유지보수성** | ★★★★☆ | 양호 - 모듈화, 관심사 분리 |

### 주요 강점

1. **원자적 트랜잭션 처리**: RPC 함수를 통한 원자적 DB 트랜잭션
2. **멱등성 보장**: 웹훅 중복 처리 방지 (idempotency_key)
3. **보안 우선 설계**: 빌링키 암호화, 서명 검증, Rate Limiting
4. **사용자 친화적 에러 메시지**: 한국어 에러 매핑

---

## 2. 보안 분석

### 2.1 인증 및 권한 (✅ 우수)

**src/actions/auth.ts**

```typescript
// ✅ Rate Limiting 적용
const rateLimitResult = await checkRateLimit(clientIP, 'auth_login', RATE_LIMIT_PRESETS.AUTH);

// ✅ 입력 검증 (Zod 스키마)
const validated = loginSchema.safeParse(input);

// ✅ 에러 메시지 추상화 (내부 정보 노출 방지)
function getAuthErrorMessage(errorMessage: string): string {
  const errorMap: Record<string, string> = {
    'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    // ...
  };
}
```

**평가**:
- 로그인/회원가입에 분당 5회/3회 Rate Limit 적용 ✅
- Supabase 에러 메시지를 사용자 친화적으로 변환 ✅
- 세션 정보 반환 시 민감 정보 최소화 ✅

### 2.2 결제 보안 (✅ 우수)

**src/actions/payment.ts, subscription.ts**

```typescript
// ✅ 서버 사이드 금액 검증
const amountValidation = validateCreditPackageAmount(
  metadata.creditPackageId,
  amount
);

// ✅ 결제 상태 검증
if (payment.status !== 'pending') {
  return { success: false, error: '이미 처리된 결제입니다' };
}

// ✅ 빌링키 암호화 저장
const encryptedBillingKey = encryptBillingKey(billingKeyResponse.billingKey);
```

**평가**:
- 결제 금액 서버 사이드 검증 필수 ✅
- 결제 상태 중복 처리 방지 ✅
- 빌링키 AES-256 암호화 저장 ✅
- 시크릿 키 환경변수 관리 ✅

### 2.3 웹훅 보안 (✅ 우수)

**src/app/api/webhooks/toss/route.ts**

```typescript
// ✅ 서명 검증 필수
const isValidSignature = verifyWebhookSignature(rawBody, signature);
if (!isValidSignature) {
  logWarn('웹훅 서명 검증 실패', { action: 'webhook_toss' });
  return NextResponse.json({ error: '서명 검증 실패' }, { status: 401 });
}

// ✅ 멱등성 키 생성
idempotencyKey = generateIdempotencyKey(rawBody, request.headers);

// ✅ 원자적 upsert (Race Condition 방지)
const { data: upsertResult } = await adminClient.rpc(
  'upsert_webhook_log_atomic',
  { p_idempotency_key: idempotencyKey, ... }
);
```

**평가**:
- 웹훅 서명 검증 구현 ✅
- 페이로드 해시 기반 멱등성 보장 ✅
- RPC 원자적 upsert로 Race Condition 방지 ✅
- 민감 정보 로그 마스킹 ✅

### 2.4 Rate Limiting (✅ 우수)

**src/lib/rate-limit.ts**

```typescript
export const RATE_LIMIT_PRESETS = {
  PAYMENT_PREPARE: { windowMs: 60 * 1000, max: 10 },   // 결제 준비
  PAYMENT_CONFIRM: { windowMs: 60 * 1000, max: 5 },    // 결제 확인
  SUBSCRIPTION_CREATE: { windowMs: 60 * 1000, max: 3 }, // 구독 생성
  REFUND_REQUEST: { windowMs: 60 * 1000, max: 3 },     // 환불 요청
  AI_GENERATE: { windowMs: 60 * 1000, max: 20 },       // AI 생성
  AUTH: { windowMs: 60 * 1000, max: 5 },               // 인증
};
```

**평가**:
- 작업별 세분화된 Rate Limit 설정 ✅
- Vercel KV (Redis) 지원 + 메모리 폴백 ✅
- 슬라이딩 윈도우 알고리즘 적용 ✅

---

## 3. 코드 품질 분석

### 3.1 타입 안정성 (✅ 우수)

```typescript
// ✅ 명시적 타입 정의
interface CreditPaymentRpcResult extends RpcResultBase {
  new_balance: number;
}

// ✅ 타입 가드
if (error instanceof PaymentError) {
  // ...
}

// ✅ Result 패턴
type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};
```

**평가**:
- 모든 액션에 명시적 반환 타입 정의 ✅
- RPC 결과 타입 확장 패턴 일관적 ✅
- 에러 타입 가드 적절히 사용 ✅

### 3.2 코드 구조 (✅ 양호)

**모듈화 및 관심사 분리**:

```
src/actions/
├── payment.ts       # 크레딧 결제
├── subscription.ts  # 구독 관리
├── billing.ts       # 결제 이력
├── auth.ts          # 인증
└── generate.ts      # AI 생성

src/lib/
├── payment/
│   ├── toss.ts      # 토스 클라이언트
│   ├── crypto.ts    # 암호화
│   └── proration.ts # 비례 배분
├── rate-limit.ts    # Rate Limiting
└── logger.ts        # 로깅
```

**평가**:
- 도메인별 액션 파일 분리 ✅
- 공통 유틸리티 모듈화 ✅
- 단일 책임 원칙 준수 ✅

### 3.3 에러 처리 패턴 (✅ 우수)

**src/actions/subscription.ts**

```typescript
// ✅ 계층별 에러 처리
try {
  chargeResponse = await tossClient.chargeBilling(...);
} catch (error) {
  // 1. 결제 실패 기록
  await adminClient.from('payments').update({ status: 'failed', ... });

  // 2. 빌링키 정리
  await adminClient.from('billing_keys').delete().eq('id', billingKeyRecord.id);

  // 3. 사용자 친화적 에러 반환
  return {
    success: false,
    error: error instanceof PaymentError
      ? mapTossErrorToUserMessage(error.code)
      : '결제에 실패했습니다',
  };
}
```

**src/actions/generate.ts**

```typescript
// ✅ 에러 시 크레딧/횟수 복구
const restoreResult = await restoreGenerationCredit(
  supabase, user.id, useCredits, validated.data.topic
);

if (!restoreResult.success) {
  logWarn('크레딧/횟수 복구 실패', { ... });
}
```

**평가**:
- 실패 시 리소스 정리 로직 구현 ✅
- 에러 시 크레딧 복구 로직 ✅
- 상세한 에러 로깅 ✅

### 3.4 로깅 품질 (✅ 우수)

```typescript
// ✅ 구조화된 로깅
logError('결제 확인 RPC 오류', rpcError, {
  userId: user.id,
  orderId,
  action: 'confirmCreditPayment'
});

// ✅ 민감 정보 마스킹
logWarn('결제 레코드 찾을 수 없음', {
  action: 'webhook_payment_status',
  paymentKey: '[REDACTED]', // 민감 정보 마스킹
});
```

**평가**:
- 컨텍스트 정보 포함 로깅 ✅
- 민감 정보 마스킹 ✅
- 액션별 로그 구분 ✅

---

## 4. 성능 분석

### 4.1 재시도 로직 (✅ 우수)

**src/lib/payment/toss.ts**

```typescript
// ✅ 지수 백오프 + 지터
function calculateBackoffDelay(attempt: number): number {
  const baseDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * baseDelay; // 최대 30% 지터
  return Math.min(baseDelay + jitter, RETRY_CONFIG.maxDelayMs);
}

// ✅ 재시도 가능한 에러 판별
const isRetryable =
  lastError.name === 'AbortError' ||
  lastError.message.includes('fetch failed') ||
  lastError.message.includes('ECONNRESET');
```

**평가**:
- 지수 백오프 + 지터 적용 ✅
- 재시도 가능 에러 판별 ✅
- 타임아웃 설정 ✅

### 4.2 구독 갱신 재시도 (✅ 우수)

**src/actions/subscription.ts**

```typescript
// ✅ 3회 재시도, 24시간 간격
const MAX_RETRY_COUNT = 3;
const RETRY_INTERVAL_MS = 24 * 60 * 60 * 1000;

if (newRetryCount < MAX_RETRY_COUNT) {
  await adminClient.from('subscriptions').update({
    metadata: {
      renewal_retry_count: newRetryCount,
      next_retry_at: nextRetryAt.toISOString(),
      last_failure_reason: error.message,
    },
  });
}
```

**평가**:
- 결제 실패 시 자동 재시도 ✅
- 재시도 횟수 및 시간 메타데이터 저장 ✅
- 최대 재시도 초과 시 past_due 전환 ✅

### 4.3 AI 생성 타임아웃 (✅ 양호)

**src/actions/generate.ts**

```typescript
// ✅ AbortController 기반 타임아웃
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.TIMEOUT.GENERATION);

try {
  const result = await generateObject({
    model: models.standard,
    abortSignal: controller.signal,
    // ...
  });
} finally {
  clearTimeout(timeoutId);
}
```

**평가**:
- AbortController 타임아웃 적용 ✅
- 스트리밍 모드 지원 ✅

---

## 5. 개선 권장사항

### 5.1 Critical (즉시 조치 필요)

> 현재 Critical 이슈 없음 ✅

### 5.2 Warning (검토 권장)

#### W-1: 웹훅 크레딧 지급 트랜잭션

**파일**: `src/app/api/webhooks/toss/route.ts:631-672`

**현재 상태**:
```typescript
async function grantCredits(payment: PaymentRecord, adminClient) {
  // 개별 쿼리로 크레딧 지급
  await adminClient.from('credit_transactions').insert({ ... });
  await adminClient.from('profiles').update({ credits_balance: newBalance });
}
```

**문제**: 두 쿼리 사이 실패 시 불일치 가능

**권장**: RPC 원자적 함수 사용 (이미 `confirm_credit_payment_atomic` 존재)

---

#### W-2: 스트리밍 생성 에러 복구 시 차감 누락

**파일**: `src/actions/generate.ts:370-375`

**현재 상태**:
```typescript
// 스트리밍 시작 전 차감 없음, 완료 후 차감
if (useCredits) {
  await deductCredit(supabase, user.id, creditsBalance, validated.data.topic);
}
```

**문제**: 스트리밍 중간에 실패하면 이미 차감이 안 됐으므로 복구 불필요

**권장**: 현재 로직 맞음. 다만 restoreGenerationCredit 호출 시 실제로 차감되지 않은 상태에서 복구 시도될 수 있음. 복구 함수에서 실제 차감 여부 확인 필요.

---

### 5.3 Suggestion (개선 제안)

#### S-1: Rate Limit 응답 헤더 추가

**현재 상태**: Rate Limit 정보를 에러 메시지로만 전달

**제안**: 표준 헤더 추가로 클라이언트 대응 용이
```typescript
headers: {
  'X-RateLimit-Limit': result.limit,
  'X-RateLimit-Remaining': result.remaining,
  'X-RateLimit-Reset': Date.now() + result.resetIn
}
```

---

#### S-2: 플랜 변경 검증 강화

**파일**: `src/actions/subscription.ts:872-884`

**현재 상태**: 비례 배분 재계산으로 검증

**제안**: 서버에서 초기 계산 결과를 서명하여 변조 방지
```typescript
// 준비 단계에서 서명된 토큰 생성
const changeToken = signPlanChangeData({ newPlan, amount, expiresAt });

// 확정 단계에서 토큰 검증
const isValid = verifyPlanChangeToken(changeToken);
```

---

#### S-3: 웹훅 처리 비동기화

**파일**: `src/app/api/webhooks/toss/route.ts`

**현재 상태**: 동기적 처리 후 응답

**제안**: 무거운 처리는 백그라운드 큐로 분리 (Vercel Background Functions 또는 외부 큐)
```typescript
// 빠른 응답 후 백그라운드 처리
await queueWebhookProcessing(eventType, data);
return NextResponse.json({ success: true });
```

---

## 리뷰 대상 파일 목록

| 파일 | 분석 결과 |
|------|----------|
| `src/actions/payment.ts` | ✅ 양호 |
| `src/actions/subscription.ts` | ✅ 양호 |
| `src/actions/auth.ts` | ✅ 양호 |
| `src/actions/generate.ts` | ✅ 양호 |
| `src/app/api/webhooks/toss/route.ts` | ⚠️ W-1 개선 권장 |
| `src/lib/payment/toss.ts` | ✅ 우수 |
| `src/lib/rate-limit.ts` | ✅ 우수 |

---

## 결론

전반적으로 보안과 안정성이 잘 갖춰진 코드입니다. 특히:

1. **결제 보안**: 서버 사이드 검증, 빌링키 암호화, 멱등성 처리 모두 구현
2. **에러 복구**: 실패 시 리소스 정리 및 사용자 복구 로직 존재
3. **Rate Limiting**: 작업별 세분화된 제한으로 남용 방지

개선이 필요한 영역:
- 웹훅 크레딧 지급의 트랜잭션 원자성 보장
- 플랜 변경 검증 강화

---

*리뷰어: 터미널 5 (문서 & 리뷰)*
*작성일: 2026-01-31*
