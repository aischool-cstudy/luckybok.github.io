# 결제 서비스 코드 리뷰

> **리뷰 일시**: 2026-01-29
> **리뷰 대상**: `src/actions/payment.ts`, `src/actions/subscription.ts`
> **리뷰어**: Claude Code (가이드 터미널 5 역할)

---

## 요약

| 카테고리 | 심각도 | 항목 수 |
|---------|-------|--------|
| Critical | 🔴 | 0 |
| Warning | 🟡 | 2 |
| Suggestion | 🟢 | 4 |

**전체 평가**: 코드 품질이 우수함. 보안 및 에러 처리가 잘 되어 있으며, RPC 함수를 통한 원자적 트랜잭션 처리가 적절히 구현됨.

---

## 보안 검토

### ✅ 잘 된 점

1. **Rate Limiting 적용**
   - 모든 결제 액션에 IP 기반 Rate Limiting 적용
   - `RATE_LIMIT_PRESETS.PAYMENT_PREPARE`, `PAYMENT_CONFIRM` 등 적절한 프리셋 사용

2. **서버 사이드 금액 검증**
   - `validateCreditPackageAmount()` 함수로 금액 검증
   - 클라이언트에서 받은 금액을 서버의 패키지 정보와 비교

3. **인증 확인**
   - 모든 액션에서 `supabase.auth.getUser()` 호출
   - 인증 실패 시 즉시 반환

4. **입력값 검증**
   - Zod 스키마를 사용한 입력값 검증
   - `prepareCreditPurchaseSchema`, `confirmCreditPaymentSchema` 등

5. **Admin Client 분리**
   - 민감한 작업은 `createAdminClient()` 사용
   - 일반 조회는 `createServerClient()` 사용

---

## Warning 항목

### 🟡 1. 에러 로깅 시 민감 정보 노출 가능성

**위치**: `payment.ts:128`, `subscription.ts:152`

```typescript
console.error('prepareCreditPurchase 오류:', error);
```

**문제점**: `error` 객체를 그대로 로깅하면 민감한 정보(스택 트레이스, 내부 상태)가 노출될 수 있음.

**권장 수정**:
```typescript
console.error('prepareCreditPurchase 오류:', {
  message: error instanceof Error ? error.message : 'Unknown error',
  code: error instanceof PaymentError ? error.code : undefined,
});
```

---

### 🟡 2. 결제 상태 확인 후 경쟁 조건 가능성

**위치**: `payment.ts:192-194`

```typescript
if (payment.status !== 'pending') {
  return { success: false, error: '이미 처리된 결제입니다' };
}
```

**문제점**: 상태 확인과 업데이트 사이에 다른 요청이 처리될 수 있음.

**현재 완화책**: RPC 함수 `confirm_credit_payment_atomic`에서 원자적 처리로 해결됨.

**추가 권장**: RPC 함수 내에서 `SELECT FOR UPDATE` 사용 확인 필요.

---

## Suggestion 항목

### 🟢 1. 응답 타입 일관성

**위치**: `payment.ts:357-359`

```typescript
export async function getCreditBalance(): Promise<
  ActionResponse<{ balance: number; expiringCredits: number; expiringDate: Date | null }>
>
```

**제안**: 별도 타입으로 추출하여 재사용성 향상

```typescript
// types/payment.types.ts
interface CreditBalanceResponse {
  balance: number;
  expiringCredits: number;
  expiringDate: Date | null;
}

// payment.ts
export async function getCreditBalance(): Promise<ActionResponse<CreditBalanceResponse>>
```

---

### 🟢 2. 매직 넘버 상수화

**위치**: `payment.ts:383`

```typescript
const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
```

**제안**:
```typescript
const EXPIRING_CREDITS_WARNING_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const thirtyDaysLater = new Date(Date.now() + EXPIRING_CREDITS_WARNING_DAYS * MS_PER_DAY).toISOString();
```

---

### 🟢 3. 에러 메시지 상수화

**위치**: 전체

**제안**: 에러 메시지를 상수로 관리하여 일관성 확보

```typescript
// lib/constants/error-messages.ts
export const PAYMENT_ERRORS = {
  AUTH_REQUIRED: '로그인이 필요합니다',
  INVALID_INPUT: '입력값이 올바르지 않습니다',
  PAYMENT_NOT_FOUND: '결제 정보를 찾을 수 없습니다',
  ALREADY_PROCESSED: '이미 처리된 결제입니다',
  // ...
} as const;
```

---

### 🟢 4. 함수 크기 최적화

**위치**: `confirmCreditPayment()` (약 140줄)

**제안**: 헬퍼 함수로 분리

```typescript
// 제안 구조
async function confirmCreditPayment(input) {
  const validation = await validateAndAuthenticate(input);
  if (!validation.success) return validation;

  const payment = await getPaymentRecord(validation.orderId, validation.userId);
  if (!payment.success) return payment;

  const tossResult = await processTossPayment(payment.data, input);
  if (!tossResult.success) return tossResult;

  return await finalizePayment(payment.data, tossResult.data);
}
```

---

## 성능 검토

### ✅ 잘 된 점

1. **필요한 필드만 조회**
   ```typescript
   .select('customer_key')  // 전체 레코드가 아닌 필요한 필드만
   ```

2. **Admin Client 재사용**
   - 함수 내에서 한 번만 생성

3. **RPC 함수 활용**
   - `confirm_credit_payment_atomic`으로 다중 쿼리를 단일 호출로 처리
   - 네트워크 왕복 횟수 감소

### 💡 개선 가능 영역

1. **결제 이력 조회 캐싱**
   - `getPaymentHistory()` 결과를 짧은 TTL로 캐싱 고려
   - React Query/SWR과 조합하여 클라이언트 캐싱 활용

---

## 코드 품질

### ✅ 잘 된 점

1. **TypeScript 타입 안전성**
   - 제네릭 `ActionResponse<T>` 패턴 일관 적용
   - Zod 스키마와 TypeScript 타입 연동

2. **일관된 에러 처리**
   - 모든 함수에서 try-catch 사용
   - 일관된 에러 응답 형식

3. **명확한 함수 구조**
   - 각 함수의 역할이 명확
   - 단계별 주석 포함

4. **코드 문서화**
   - 파일 상단에 모듈 설명
   - 섹션 구분 주석

---

## 결론

### 강점
- ✅ 보안 기본기가 잘 갖춰짐 (인증, 검증, Rate Limiting)
- ✅ RPC 함수로 트랜잭션 원자성 보장
- ✅ 타입 안전성 확보
- ✅ 일관된 에러 처리

### 개선 권장 (우선순위순)
1. 🟡 에러 로깅 시 민감 정보 필터링
2. 🟢 에러 메시지 상수화
3. 🟢 함수 크기 최적화 (150줄 이상)
4. 🟢 매직 넘버 상수화

---

*코드 리뷰 완료 - 2026-01-29*
