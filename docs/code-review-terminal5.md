# CodeGen AI 결제 시스템 코드 리뷰

**검토자**: 터미널 5 (문서 & 리뷰)
**검토일**: 2026-01-30
**검토 범위**: 결제/구독 서비스 코드
**검토 기준**: 보안, 에러 처리, 성능, 코드 품질

---

## 📋 요약

| 카테고리 | 등급 | 주요 발견 |
|---------|------|----------|
| 보안 | ⭐⭐⭐⭐⭐ | 매우 우수 - 업계 표준 준수 |
| 에러 처리 | ⭐⭐⭐⭐ | 우수 - 원자적 트랜잭션 적용 |
| 성능 | ⭐⭐⭐⭐ | 우수 - 재시도 로직 구현 |
| 코드 품질 | ⭐⭐⭐⭐ | 우수 - 일관된 패턴 적용 |

### 전체 평가: **A (Very Good)**

결제 시스템 코드는 전반적으로 높은 품질을 보여주고 있습니다. 보안 측면에서 업계 표준을 충실히 준수하고 있으며, 원자적 트랜잭션을 통한 데이터 일관성 보장이 잘 구현되어 있습니다.

---

## ✅ 우수 사항 (Best Practices)

### 1. 보안 구현 - 매우 우수

#### 빌링키 암호화 (`src/lib/payment/crypto.ts:34-46`)
```typescript
// AES-256-GCM 암호화 - 업계 최고 수준의 암호화 알고리즘
const ALGORITHM = 'aes-256-gcm';
export function encryptBillingKey(billingKey: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);  // 매번 새로운 IV 생성 ✅
  const cipher = createCipheriv(ALGORITHM, key, iv);
  // ...
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}
```
- ✅ AES-256-GCM 사용 (인증된 암호화)
- ✅ 매번 새로운 IV 생성
- ✅ 인증 태그(authTag) 포함으로 무결성 보장

#### 웹훅 서명 검증 (`src/lib/payment/crypto.ts:84-102`)
```typescript
// 타이밍 공격 방지를 위한 상수 시간 비교 ✅
let result = 0;
for (let i = 0; i < signature.length; i++) {
  result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
}
return result === 0;
```
- ✅ HMAC-SHA256 서명 검증
- ✅ 타이밍 공격 방지 구현 (constant-time comparison)

#### 민감 정보 보호 (`src/lib/payment/crypto.ts:197-210`)
```typescript
export function sanitizeForLogging<T extends Record<string, unknown>>(
  data: T,
  sensitiveFields: string[] = ['billingKey', 'encryptedBillingKey', 'secretKey']
): T {
  // 민감 필드를 '[REDACTED]'로 마스킹
}
```
- ✅ 로깅 시 민감 정보 자동 마스킹
- ✅ 카드 번호 마스킹 함수 제공

---

### 2. Rate Limiting 적용 - 우수

모든 결제 관련 액션에 Rate Limiting 적용됨:

| 액션 | 제한 | 위치 |
|------|------|------|
| `prepareCreditPurchase` | IP 기반 | `payment.ts:44-58` |
| `confirmCreditPayment` | IP 기반 | `payment.ts:143-157` |
| `prepareSubscription` | IP 기반 | `subscription.ts:47-61` |
| `confirmSubscription` | IP 기반 | `subscription.ts:166-180` |
| `requestRefund` | IP 기반 | `billing.ts:533-547` |

---

### 3. 원자적 트랜잭션 - 매우 우수

RPC 함수를 통한 원자적 트랜잭션으로 데이터 일관성 보장:

```typescript
// subscription.ts:320-335
const { data: rpcResult, error: rpcError } = await adminClient.rpc(
  'confirm_subscription_atomic',
  {
    p_payment_id: payment.id,
    p_payment_key: chargeResponse.paymentKey,
    // ... 모든 관련 데이터를 한 트랜잭션으로 처리
  }
);
```

구현된 RPC 함수:
- `confirm_credit_payment_atomic` - 크레딧 결제 완료
- `confirm_subscription_atomic` - 구독 생성
- `renew_subscription_atomic` - 구독 갱신
- `process_credit_refund_atomic` - 크레딧 환불
- `process_subscription_refund_atomic` - 구독 환불
- `process_simple_refund_atomic` - 일반 환불

---

### 4. 재시도 로직 - 우수

지수 백오프(Exponential Backoff) 구현:

```typescript
// toss.ts:91-95
function calculateBackoffDelay(attempt: number): number {
  const baseDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * baseDelay; // 최대 30% 지터 ✅
  return Math.min(baseDelay + jitter, RETRY_CONFIG.maxDelayMs);
}
```
- ✅ 지수 백오프 적용
- ✅ 지터(Jitter)로 thundering herd 방지
- ✅ 최대 딜레이 제한

---

### 5. 입력 검증 - 우수

Zod 스키마를 통한 철저한 입력 검증:

```typescript
// payment.ts:61-67
const validated = prepareCreditPurchaseSchema.safeParse(input);
if (!validated.success) {
  return {
    success: false,
    error: validated.error.errors[0]?.message || '입력값이 올바르지 않습니다',
  };
}
```

---

## ⚠️ 개선 권장 사항

### 1. Warning: 환불 실패 시 보상 트랜잭션 부재

**위치**: `billing.ts:596-601`

**문제점**:
토스페이먼츠 환불 API 호출 성공 후 DB 업데이트 실패 시 보상 처리 부재

```typescript
// 현재 코드
await tossClient.cancelPayment(
  payment.payment_key,
  validated.data.reason || '고객 요청',
  refundAmount
);
// 토스 환불 성공 후 RPC 실패 시 → 토스는 환불됨, DB는 미반영
```

**영향도**: 🔴 높음 (결제 불일치 발생 가능)

**권장 해결책**:
```typescript
// 개선안
try {
  await tossClient.cancelPayment(...);

  const { error: rpcError } = await adminClient.rpc('process_refund_atomic', {...});

  if (rpcError) {
    // 보상 트랜잭션: 토스 환불 취소 시도
    logError('DB 업데이트 실패, 환불 취소 시도 필요', rpcError, {
      paymentId: payment.id,
      refundAmount,
      requiresManualIntervention: true,
    });
    // 관리자 알림 발송 등
  }
} catch (error) {
  // ...
}
```

---

### 2. Warning: 웹훅 중복 처리 방지 로직 부재

**위치**: `route.ts:21-128`

**문제점**:
동일한 웹훅이 중복 수신될 경우 중복 처리 가능

```typescript
// 현재 코드 - 멱등성(idempotency) 체크 없음
export async function POST(request: NextRequest) {
  // 바로 처리 진행
}
```

**영향도**: 🟡 중간 (크레딧 중복 지급 등 발생 가능)

**권장 해결책**:
```typescript
// 개선안
const idempotencyKey = request.headers.get('X-Idempotency-Key') ||
                       createHash('sha256').update(rawBody).digest('hex');

// 기존 처리 여부 확인
const { data: existingLog } = await adminClient
  .from('webhook_logs')
  .select('id, status')
  .eq('idempotency_key', idempotencyKey)
  .single();

if (existingLog?.status === 'processed') {
  return NextResponse.json({ success: true, message: 'Already processed' });
}
```

---

### 3. Suggestion: 구독 갱신 시 결제 실패 재시도 로직

**위치**: `subscription.ts:663-683`

**문제점**:
구독 갱신 결제 실패 시 즉시 `past_due` 상태로 변경, 재시도 기회 없음

**영향도**: 🟢 낮음 (기능적 이슈는 아님)

**권장 해결책**:
```typescript
// 개선안 - 재시도 횟수 기록 및 점진적 처리
const retryCount = (subscription.metadata?.renewal_retry_count ?? 0) + 1;

if (retryCount < 3) {
  // 재시도 예약
  await adminClient
    .from('subscriptions')
    .update({
      metadata: { ...subscription.metadata, renewal_retry_count: retryCount },
      next_retry_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24시간 후
    })
    .eq('id', subscriptionId);
} else {
  // 최종 실패 - past_due로 변경
  await adminClient
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('id', subscriptionId);
}
```

---

### 4. Suggestion: 함수 크기 분리

**위치**:
- `subscription.ts:confirmSubscription` (208줄)
- `billing.ts:requestRefund` (200줄)

**문제점**:
단일 함수가 너무 많은 책임을 가짐 (Single Responsibility 위반)

**권장 해결책**:
```typescript
// 개선안 - 기능별 분리
export async function confirmSubscription(input: ConfirmSubscriptionInput) {
  const validated = await validateConfirmInput(input);
  if (!validated.success) return validated;

  const payment = await getPaymentRecord(validated.data);
  if (!payment.success) return payment;

  const billingKey = await issueBillingKey(validated.data);
  if (!billingKey.success) return billingKey;

  const charge = await processFirstCharge(billingKey.data, payment.data);
  if (!charge.success) return charge;

  return await finalizeSubscription(charge.data, payment.data);
}
```

---

### 5. Suggestion: 환경 변수 검증 강화

**위치**: `toss.ts:286-291`

**문제점**:
`getTossClient()` 호출 시 환경 변수 미설정 검증이 `env.ts`에 의존

```typescript
// 현재 코드
export function getTossClient(): TossPaymentsClient {
  if (!tossClient) {
    tossClient = new TossPaymentsClient(serverEnv.TOSS_SECRET_KEY);
  }
  return tossClient;
}
```

**권장 해결책**:
```typescript
// 개선안 - 초기화 시 명시적 검증
export function getTossClient(): TossPaymentsClient {
  if (!tossClient) {
    const secretKey = serverEnv.TOSS_SECRET_KEY;
    if (!secretKey || secretKey.startsWith('test_') && process.env.NODE_ENV === 'production') {
      throw new Error('프로덕션 환경에서 테스트 키 사용 불가');
    }
    tossClient = new TossPaymentsClient(secretKey);
  }
  return tossClient;
}
```

---

## 📊 보안 체크리스트 검증 결과

| 항목 | 상태 | 위치 |
|------|------|------|
| 시크릿 키 환경변수 저장 | ✅ | `env.ts` |
| 클라이언트 시크릿 키 노출 방지 | ✅ | Server Actions만 사용 |
| 서버 사이드 금액 검증 | ✅ | `payment.ts:198-211` |
| 빌링키 AES-256 암호화 | ✅ | `crypto.ts:34-46` |
| 웹훅 서명 검증 | ✅ | `route.ts:31-49` |
| SQL Injection 방지 | ✅ | Supabase ORM 사용 |
| Rate Limiting | ✅ | 모든 결제 액션 |
| 로그 민감정보 마스킹 | ✅ | `logger.ts`, `crypto.ts` |

---

## 📈 우선순위별 개선 계획

### 즉시 (1주 내)
1. ⚠️ 환불 실패 시 보상 트랜잭션 구현
2. ⚠️ 웹훅 멱등성 처리 추가

### 단기 (2-4주 내)
3. 🔄 구독 갱신 재시도 로직 추가
4. 📝 함수 분리 리팩토링

### 중장기 (1-2개월)
5. 🧪 환불 플로우 통합 테스트 강화
6. 📊 결제 모니터링 대시보드 구축

---

## 🔍 테스트 커버리지 현황

| 모듈 | 테스트 파일 | 테스트 수 | 커버리지 |
|------|------------|----------|----------|
| TossPaymentsClient | `toss.test.ts` | 16 | 높음 |
| 결제 에러 케이스 | `payment-errors.test.ts` | 32 | 높음 |
| 구독 RPC | `subscription-rpc.test.ts` | 19 | 높음 |
| 결제 통합 | `payment-integration.test.ts` | 20 | 높음 |
| 웹훅 처리 | - | 0 | ⚠️ 필요 |

**권장 추가 테스트**:
1. 웹훅 Unit 테스트 (서명 검증, 이벤트별 처리)
2. 환불 통합 테스트 (부분 환불, 크레딧 차감)
3. 동시성 테스트 (중복 요청 처리)

---

## 결론

CodeGen AI의 결제 시스템은 **전반적으로 높은 품질**을 보여주고 있습니다.

### 강점
- 업계 표준 보안 구현 (AES-256-GCM, HMAC-SHA256)
- 원자적 트랜잭션으로 데이터 일관성 보장
- 철저한 입력 검증 및 Rate Limiting
- 구조화된 에러 처리 및 로깅

### 개선 필요
- 환불/웹훅 처리의 보상 트랜잭션 추가
- 일부 함수의 책임 분리
- 웹훅 멱등성 처리 강화

위 개선사항들을 단계적으로 적용하면 더욱 견고한 결제 시스템이 될 것입니다.

---

*작성: 터미널 5 (문서 & 리뷰)*
*날짜: 2026-01-30*
