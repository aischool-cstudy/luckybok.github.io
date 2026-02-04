# CodeGen AI 결제 API 문서

> **Version**: 1.3.0
> **Last Updated**: 2026-01-30
> **기술 스택**: Next.js Server Actions + TossPayments

---

## 목차

1. [개요](#개요)
2. [인증](#인증)
3. [크레딧 구매](#크레딧-구매)
4. [구독 관리](#구독-관리)
5. [플랜 변경](#플랜-변경)
6. [결제 수단 관리](#결제-수단-관리)
7. [결제 이력](#결제-이력)
8. [환불](#환불)
9. [환불 요청 관리](#환불-요청-관리)
10. [웹훅](#웹훅)
11. [에러 코드](#에러-코드)
12. [테스트 가이드](#테스트-가이드)
13. [내부 API (서버 전용)](#내부-api-서버-전용) *(신규)*
14. [성능 최적화](#성능-최적화) *(신규)*

---

## 개요

CodeGen AI는 **Next.js Server Actions**와 **TossPayments**를 사용하여 결제를 처리합니다.

### 지원 결제 방식

| 결제 유형 | 설명 | 사용처 |
|-----------|------|--------|
| **단건 결제** | 1회성 카드 결제 | 크레딧 패키지 구매 |
| **정기 결제 (빌링)** | 빌링키 기반 자동 결제 | 구독 (Pro, Team) |

### 결제 플로우

```
┌─────────────────────────────────────────────────────────────────┐
│                    단건 결제 플로우 (크레딧)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. prepareCreditPurchase()                                     │
│     └─ orderId, amount, customerKey 반환                        │
│                                                                 │
│  2. 토스페이먼츠 SDK (클라이언트)                                  │
│     └─ requestPayment() → 결제창 → 리다이렉트                     │
│                                                                 │
│  3. confirmCreditPayment()                                      │
│     └─ paymentKey, orderId, amount 검증 → 크레딧 지급             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    정기 결제 플로우 (구독)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. prepareSubscription()                                       │
│     └─ orderId, customerKey, plan 정보 반환                      │
│                                                                 │
│  2. 토스페이먼츠 SDK (클라이언트)                                  │
│     └─ requestBillingAuth() → 카드 등록 → 리다이렉트              │
│                                                                 │
│  3. confirmSubscription()                                       │
│     └─ 빌링키 발급 → 첫 결제 → 구독 활성화                         │
│                                                                 │
│  4. renewSubscription() (자동)                                  │
│     └─ 매월/매년 자동 결제 (cron job)                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 인증

모든 Server Actions는 Supabase Auth를 통해 인증됩니다.

### 인증 방식

- **세션 기반**: Supabase Auth 세션 쿠키 사용
- **자동 검증**: Server Action 호출 시 자동으로 사용자 검증

### 인증 실패 응답

```typescript
{
  success: false,
  error: '로그인이 필요합니다'
}
```

---

## 크레딧 구매

### 크레딧 패키지

| 패키지 | 크레딧 수 | 가격 | 단가 | 유효 기간 |
|--------|----------|------|------|----------|
| Basic | 50개 | ₩9,900 | ₩198/개 | 90일 |
| Standard | 150개 | ₩24,900 | ₩166/개 | 90일 |
| Premium | 350개 | ₩49,900 | ₩143/개 | 180일 |

### prepareCreditPurchase

크레딧 구매를 준비합니다.

```typescript
// 사용 예시
import { prepareCreditPurchase } from '@/actions/payment';

const result = await prepareCreditPurchase({
  packageId: 'standard'  // 'basic' | 'standard' | 'premium'
});

if (result.success) {
  const { orderId, amount, orderName, customerKey } = result.data;
  // 토스페이먼츠 결제창 호출
}
```

#### 입력

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `packageId` | `'basic' \| 'standard' \| 'premium'` | O | 크레딧 패키지 ID |

#### 출력 (성공)

```typescript
{
  success: true,
  data: {
    orderId: string,      // 주문 ID (예: "CRD-20260129-ABC123")
    amount: number,       // 결제 금액
    orderName: string,    // 주문명 (예: "CodeGen AI 크레딧 150개 (표준 패키지)")
    customerKey: string   // 토스 고객 키
  }
}
```

### confirmCreditPayment

결제를 승인하고 크레딧을 지급합니다.

```typescript
// 사용 예시 (결제 성공 페이지)
import { confirmCreditPayment } from '@/actions/payment';

const result = await confirmCreditPayment({
  paymentKey: searchParams.get('paymentKey'),
  orderId: searchParams.get('orderId'),
  amount: Number(searchParams.get('amount'))
});

if (result.success) {
  const { credits, balance } = result.data;
  // 성공 UI 표시
}
```

#### 입력

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `paymentKey` | `string` | O | 토스 결제 키 |
| `orderId` | `string` | O | 주문 ID |
| `amount` | `number` | O | 결제 금액 (검증용) |

#### 출력 (성공)

```typescript
{
  success: true,
  data: {
    credits: number,  // 추가된 크레딧 수
    balance: number   // 현재 총 크레딧 잔액
  }
}
```

### getCreditBalance

현재 크레딧 잔액을 조회합니다.

```typescript
// 사용 예시
import { getCreditBalance } from '@/actions/credits';

const result = await getCreditBalance();

if (result) {
  const { balance, expiringCredits, expiringDate } = result;
  // 잔액 및 만료 예정 크레딧 표시
}
```

#### 출력 (성공)

```typescript
{
  balance: number,            // 현재 크레딧 잔액
  expiringCredits: number,    // 30일 내 만료 예정 크레딧
  expiringDate: Date | null   // 가장 빨리 만료되는 날짜
} | null
```

### checkGenerationAvailability

콘텐츠 생성 가능 여부를 확인합니다. 일일 생성 횟수와 크레딧 잔액을 모두 확인합니다.

```typescript
// 사용 예시
import { checkGenerationAvailability } from '@/actions/credits';

const result = await checkGenerationAvailability();

if (result.canGenerate) {
  if (result.useCredits) {
    console.log('크레딧을 사용하여 생성합니다');
  } else {
    console.log('일일 생성 횟수로 생성합니다');
  }
} else {
  console.log('생성 불가:', result.reason);
}
```

#### 출력

```typescript
{
  canGenerate: boolean,       // 생성 가능 여부
  reason?: string,            // 생성 불가 사유 (canGenerate=false일 때)
  dailyRemaining: number,     // 남은 일일 생성 횟수
  creditBalance: number,      // 크레딧 잔액
  useCredits: boolean         // 크레딧 사용 여부 (true: 크레딧 사용, false: 일일 횟수 사용)
}
```

#### 생성 가능 조건

| 우선순위 | 조건 | 결과 |
|---------|------|------|
| 1 | 일일 생성 횟수 > 0 | ✅ 일일 횟수 사용 |
| 2 | 일일 횟수 = 0 & 크레딧 > 0 | ✅ 크레딧 사용 |
| 3 | 일일 횟수 = 0 & 크레딧 = 0 | ❌ 생성 불가 |

### getCreditHistory

크레딧 트랜잭션 히스토리를 조회합니다.

```typescript
// 사용 예시
import { getCreditHistory } from '@/actions/credits';

const { transactions, total } = await getCreditHistory(1, 10);

transactions.forEach(tx => {
  console.log(`${tx.type}: ${tx.amount} 크레딧 (${tx.description})`);
});
```

#### 입력

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `page` | `number` | 1 | 페이지 번호 |
| `limit` | `number` | 10 | 페이지당 항목 수 |

#### 출력

```typescript
{
  transactions: [
    {
      id: string,
      type: 'purchase' | 'usage' | 'subscription_grant' | 'refund' | 'admin_adjustment' | 'expiry',
      amount: number,           // 양수: 지급/충전, 음수: 사용/차감
      description: string,
      payment_id: string | null,
      expires_at: string | null,
      created_at: string
    }
  ],
  total: number
}
```

#### 트랜잭션 타입

| 타입 | 설명 | 금액 부호 |
|------|------|----------|
| `purchase` | 크레딧 구매 | 양수 (+) |
| `usage` | 콘텐츠 생성에 사용 | 음수 (-) |
| `subscription_grant` | 구독 플랜 크레딧 지급 | 양수 (+) |
| `refund` | 환불로 인한 차감 | 음수 (-) |
| `admin_adjustment` | 관리자 조정 | 양수/음수 |
| `expiry` | 만료로 인한 차감 | 음수 (-) |

---

## 구독 관리

### 요금제

| 플랜 | 월간 가격 | 연간 가격 | 일일 생성 | 주요 기능 |
|------|----------|----------|----------|----------|
| Starter | 무료 | - | 10회 | Python만 지원 |
| Pro | ₩29,900 | ₩299,000 (17% 할인) | 100회 | 전체 언어, PDF |
| Team | ₩99,000 | ₩990,000 (17% 할인) | 500회 | API, 5명 계정 |
| Enterprise | 문의 | 문의 | 무제한 | 온프레미스 |

### prepareSubscription

구독을 시작합니다.

```typescript
// 사용 예시
import { prepareSubscription } from '@/actions/subscription';

const result = await prepareSubscription({
  plan: 'pro',
  billingCycle: 'monthly'
});

if (result.success) {
  const { orderId, customerKey, amount } = result.data;
  // 토스페이먼츠 빌링키 등록창 호출
}
```

#### 입력

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `plan` | `'pro' \| 'team'` | O | 구독 플랜 |
| `billingCycle` | `'monthly' \| 'yearly'` | O | 결제 주기 |

#### 출력 (성공)

```typescript
{
  success: true,
  data: {
    orderId: string,
    amount: number,
    orderName: string,
    customerKey: string,
    plan: string,
    billingCycle: string
  }
}
```

### confirmSubscription

빌링키를 발급하고 첫 결제를 진행합니다.

```typescript
// 사용 예시 (빌링 성공 페이지)
import { confirmSubscription } from '@/actions/subscription';

const result = await confirmSubscription({
  authKey: searchParams.get('authKey'),
  customerKey: searchParams.get('customerKey'),
  orderId: 'SUB-20260129-XYZ789',
  plan: 'pro',
  billingCycle: 'monthly'
});

if (result.success) {
  // 구독 활성화 완료
}
```

#### 입력

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `authKey` | `string` | O | 토스 인증 키 |
| `customerKey` | `string` | O | 고객 키 |
| `orderId` | `string` | O | 주문 ID |
| `plan` | `'pro' \| 'team'` | O | 구독 플랜 |
| `billingCycle` | `'monthly' \| 'yearly'` | O | 결제 주기 |

#### 출력 (성공)

```typescript
{
  success: true,
  data: {
    subscriptionId: string  // 생성된 구독 ID
  }
}
```

### getCurrentSubscription

현재 구독 상태를 조회합니다.

```typescript
// 사용 예시
import { getCurrentSubscription } from '@/actions/subscription';

const result = await getCurrentSubscription();

if (result.success && result.data) {
  const { plan, status, currentPeriodEnd, cancelAtPeriodEnd, cardInfo } = result.data;
}
```

#### 출력 (성공)

```typescript
{
  success: true,
  data: {
    plan: 'pro' | 'team' | 'enterprise',
    status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused',
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: boolean,
    cardInfo: {
      company: string,        // 카드사 (예: "신한")
      lastFourDigits: string  // 마지막 4자리 (예: "1234")
    } | null
  } | null  // 구독 없으면 null
}
```

### cancelSubscription

구독을 취소합니다.

```typescript
// 사용 예시
import { cancelSubscription } from '@/actions/billing';

const result = await cancelSubscription('subscription_id_xxx');

if (result.success) {
  // 취소 예약 완료 (기간 종료 시 취소됨)
}
```

#### 입력

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `subscriptionId` | `string` | O | 구독 ID |

#### 출력 (성공)

```typescript
{
  success: true
}
```

### reactivateSubscription

취소 예약된 구독을 철회합니다.

```typescript
// 사용 예시
import { reactivateSubscription } from '@/actions/billing';

const result = await reactivateSubscription('subscription_id_xxx');

if (result.success) {
  // 취소 철회 완료 - 구독 계속 유지
}
```

#### 입력

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `subscriptionId` | `string` | O | 구독 ID |

#### 출력 (성공)

```typescript
{
  success: true
}
```

---

## 플랜 변경

구독 중인 플랜을 변경합니다. 업그레이드는 즉시 적용되고 다운그레이드는 기간 종료 시 적용됩니다.

### 플랜 변경 플로우

```
┌─────────────────────────────────────────────────────────────────┐
│                    플랜 변경 플로우                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [업그레이드] Pro → Team                                         │
│  ├─ preparePlanChange(): 비례 배분 금액 계산                     │
│  ├─ 사용자 확인 후 confirmPlanChange()                          │
│  ├─ 차액 즉시 결제                                               │
│  └─ 플랜 즉시 적용                                               │
│                                                                 │
│  [다운그레이드] Team → Pro                                       │
│  ├─ preparePlanChange(): 변경 예약                              │
│  ├─ confirmPlanChange(): 예약 확정                              │
│  └─ 기간 종료 시 자동 변경                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### preparePlanChange

플랜 변경을 준비하고 비례 배분(proration) 금액을 계산합니다.

```typescript
// 사용 예시
import { preparePlanChange } from '@/actions/subscription';

const result = await preparePlanChange({
  newPlan: 'team',
  newBillingCycle: 'monthly'
});

if (result.success) {
  const {
    changeType,        // 'upgrade' | 'downgrade' | 'same'
    proratedAmount,    // 비례 배분 금액
    effectiveDate,     // 적용 예정일
    requiresPayment,   // 결제 필요 여부
    summary            // 사용자용 요약 텍스트
  } = result.data;
}
```

#### 입력

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `newPlan` | `'pro' \| 'team'` | O | 변경할 플랜 |
| `newBillingCycle` | `'monthly' \| 'yearly'` | O | 변경할 결제 주기 |

#### 출력 (성공)

```typescript
{
  success: true,
  data: {
    changeType: 'upgrade' | 'downgrade' | 'same',
    currentPlan: string,
    currentBillingCycle: string,
    newPlan: string,
    newBillingCycle: string,
    proratedAmount: number,      // 비례 배분 결제 금액
    newPlanAmount: number,       // 새 플랜 정가
    effectiveDate: Date,         // 적용 예정일
    requiresPayment: boolean,    // 결제 필요 여부
    daysRemaining: number,       // 남은 기간 (일)
    summary: string,             // 사용자용 요약 텍스트
    orderId?: string,            // 결제 필요 시 주문 ID
    orderName?: string,          // 결제 필요 시 주문명
    customerKey?: string         // 결제 필요 시 고객 키
  }
}
```

### confirmPlanChange

플랜 변경을 확정합니다.

```typescript
// 사용 예시
import { confirmPlanChange } from '@/actions/subscription';

const result = await confirmPlanChange({
  newPlan: 'team',
  newBillingCycle: 'monthly',
  orderId: 'CHG-20260130-ABC123'  // 업그레이드 시 필수
});

if (result.success) {
  const { effectiveDate } = result.data;
  // 업그레이드: 즉시 적용
  // 다운그레이드: effectiveDate에 적용 예정
}
```

#### 입력

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `newPlan` | `'pro' \| 'team'` | O | 변경할 플랜 |
| `newBillingCycle` | `'monthly' \| 'yearly'` | O | 변경할 결제 주기 |
| `orderId` | `string` | 조건부 | 업그레이드 시 필수 (preparePlanChange에서 반환) |

#### 출력 (성공)

```typescript
{
  success: true,
  data: {
    effectiveDate: Date  // 적용 일시
  }
}
```

### getScheduledPlanChange

예약된 플랜 변경 정보를 조회합니다.

```typescript
// 사용 예시
import { getScheduledPlanChange } from '@/actions/subscription';

const result = await getScheduledPlanChange();

if (result.success && result.data?.hasScheduledChange) {
  const {
    scheduledPlan,
    scheduledBillingCycle,
    scheduledChangeAt
  } = result.data;
}
```

#### 출력 (성공)

```typescript
{
  success: true,
  data: {
    hasScheduledChange: boolean,
    currentPlan: string,
    currentBillingCycle: string,
    scheduledPlan: string | null,
    scheduledBillingCycle: string | null,
    scheduledChangeAt: Date | null
  } | null
}
```

### cancelScheduledPlanChange

예약된 플랜 변경을 취소합니다.

```typescript
// 사용 예시
import { cancelScheduledPlanChange } from '@/actions/subscription';

const result = await cancelScheduledPlanChange();

if (result.success) {
  // 예약 취소 완료 - 현재 플랜 유지
}
```

#### 출력 (성공)

```typescript
{
  success: true
}
```

---

## 결제 수단 관리

### getPaymentMethods

등록된 결제 수단 목록을 조회합니다.

```typescript
// 사용 예시
import { getPaymentMethods } from '@/actions/billing';

const result = await getPaymentMethods();

if (result.success) {
  result.data?.forEach(method => {
    console.log(`${method.cardCompany} ${method.cardNumber}`);
  });
}
```

#### 출력 (성공)

```typescript
{
  success: true,
  data: [
    {
      id: string,
      cardCompany: string,     // 카드사 (예: "신한")
      cardNumber: string,      // 마스킹된 번호 (예: "****-****-****-1234")
      cardType: string | null, // 카드 타입 (신용/체크)
      isDefault: boolean       // 기본 결제 수단 여부
    }
  ]
}
```

### prepareAddPaymentMethod

새 결제 수단 등록을 준비합니다.

```typescript
// 사용 예시
import { prepareAddPaymentMethod } from '@/actions/billing';

const result = await prepareAddPaymentMethod();

if (result.success) {
  const { customerKey } = result.data;
  // 토스페이먼츠 빌링키 등록창 호출
}
```

#### 출력 (성공)

```typescript
{
  success: true,
  data: {
    customerKey: string
  }
}
```

### confirmAddPaymentMethod

결제 수단 등록을 확정합니다.

```typescript
// 사용 예시 (빌링 성공 리다이렉트 후)
import { confirmAddPaymentMethod } from '@/actions/billing';

const result = await confirmAddPaymentMethod({
  authKey: searchParams.get('authKey'),
  customerKey: customerKey
});

if (result.success) {
  const { id, cardCompany, cardNumber } = result.data;
}
```

#### 입력

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `authKey` | `string` | O | 토스 인증 키 |
| `customerKey` | `string` | O | 고객 키 |

#### 출력 (성공)

```typescript
{
  success: true,
  data: {
    id: string,
    cardCompany: string,
    cardNumber: string
  }
}
```

### setDefaultPaymentMethod

기본 결제 수단을 변경합니다.

```typescript
// 사용 예시
import { setDefaultPaymentMethod } from '@/actions/billing';

const result = await setDefaultPaymentMethod('billing_key_id_xxx');

if (result.success) {
  // 기본 결제 수단 변경 완료
}
```

#### 입력

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `billingKeyId` | `string` | O | 빌링키 ID |

#### 출력 (성공)

```typescript
{
  success: true
}
```

### deletePaymentMethod

결제 수단을 삭제합니다.

```typescript
// 사용 예시
import { deletePaymentMethod } from '@/actions/billing';

const result = await deletePaymentMethod('billing_key_id_xxx');

if (result.success) {
  // 결제 수단 삭제 완료
}
```

#### 입력

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `billingKeyId` | `string` | O | 빌링키 ID |

#### 삭제 제한

| 조건 | 삭제 가능 여부 |
|------|---------------|
| 기본 결제 수단 + 활성 구독 있음 | ❌ 삭제 불가 |
| 기본 결제 수단 + 활성 구독 없음 | ✅ 삭제 가능 |
| 기본 결제 수단 아님 | ✅ 삭제 가능 |

#### 출력 (성공)

```typescript
{
  success: true
}
```

---

## 결제 이력

### getPaymentHistory

결제 이력을 조회합니다. 필터링을 지원합니다.

```typescript
// 사용 예시
import { getPaymentHistory } from '@/actions/billing';

// 기본 조회
const { payments, total } = await getPaymentHistory(1, 10);

// 필터링 조회
const filtered = await getPaymentHistory(1, 10, {
  type: 'credit_purchase',      // 'subscription' | 'credit_purchase' | 'all'
  status: 'completed',          // 'completed' | 'refunded' | 'failed' | 'all'
  startDate: '2026-01-01',      // 시작일
  endDate: '2026-01-31'         // 종료일
});
```

#### 입력

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `page` | `number` | 1 | 페이지 번호 |
| `limit` | `number` | 10 | 페이지당 항목 수 |
| `filters.type` | `string` | `'all'` | 결제 유형 필터 |
| `filters.status` | `string` | `'all'` | 결제 상태 필터 |
| `filters.startDate` | `string` | - | 시작일 (YYYY-MM-DD) |
| `filters.endDate` | `string` | - | 종료일 (YYYY-MM-DD) |

#### 출력

```typescript
{
  payments: Payment[],  // 결제 내역 배열
  total: number         // 전체 항목 수
}
```

### getPaymentStats

결제 통계를 조회합니다. DB 레벨에서 집계되어 성능이 최적화되어 있습니다.

```typescript
// 사용 예시
import { getPaymentStats } from '@/actions/billing';

const stats = await getPaymentStats();

if (stats) {
  console.log('총 결제 금액:', stats.totalAmount);
  console.log('이번 달 결제:', stats.thisMonthAmount);
  console.log('환불 금액:', stats.refundedAmount);
}
```

#### 출력

```typescript
{
  totalAmount: number,      // 전체 결제 금액 합계
  refundedAmount: number,   // 환불 금액 합계
  thisMonthAmount: number,  // 이번 달 결제 금액
  completedCount: number,   // 완료된 결제 건수
  refundedCount: number     // 환불된 결제 건수
} | null
```

---

## 환불

### 환불 정책

| 조건 | 환불 가능 여부 |
|------|---------------|
| 결제 후 7일 이내 | ✅ 전액/부분 환불 가능 |
| 결제 후 7일 초과 | ❌ 환불 불가 |
| 이미 환불된 결제 | ❌ 중복 환불 불가 |
| 결제 상태가 completed가 아님 | ❌ 환불 불가 |

### checkRefundEligibility

환불 가능 여부를 확인합니다.

```typescript
// 사용 예시
import { checkRefundEligibility } from '@/actions/billing';

const result = await checkRefundEligibility('payment_123');

if (result.eligible) {
  console.log('최대 환불 가능 금액:', result.maxRefundAmount);
} else {
  console.log('환불 불가 사유:', result.reason);
}
```

#### 입력

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `paymentId` | `string` | O | 결제 ID |

#### 출력

```typescript
{
  eligible: boolean,           // 환불 가능 여부
  reason?: string,             // 환불 불가 사유 (eligible=false일 때)
  maxRefundAmount?: number     // 최대 환불 가능 금액 (eligible=true일 때)
}
```

### requestRefund

환불을 요청합니다.

```typescript
// 사용 예시 (전액 환불)
import { requestRefund } from '@/actions/billing';

const result = await requestRefund({
  paymentId: 'payment_123',
  reason: '단순 변심'
});

// 부분 환불
const partialResult = await requestRefund({
  paymentId: 'payment_123',
  reason: '일부 서비스 미사용',
  refundAmount: 10000  // 부분 환불 금액
});
```

#### 입력

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `paymentId` | `string` | O | 결제 ID |
| `reason` | `string` | X | 환불 사유 (기본값: "고객 요청") |
| `refundAmount` | `number` | X | 부분 환불 금액 (미지정 시 전액 환불) |

#### 출력 (성공)

```typescript
{
  success: true,
  data: {
    refundAmount: number,   // 환불된 금액
    refundedAt: string      // 환불 처리 시각 (ISO 8601)
  }
}
```

#### 출력 (실패)

```typescript
{
  success: false,
  error: string  // 에러 메시지
}
```

### 환불 처리 로직

```
┌─────────────────────────────────────────────────────────────────┐
│                        환불 처리 플로우                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 결제 정보 조회 및 검증                                         │
│     └─ 소유권 확인, 상태 확인, 기간 확인                            │
│                                                                 │
│  2. 토스페이먼츠 환불 API 호출                                     │
│     └─ cancelPayment(paymentKey, reason, amount)                │
│                                                                 │
│  3. 결제 상태 업데이트                                             │
│     └─ status: 'refunded' | 'partial_refunded'                  │
│     └─ refunded_amount, refunded_at, refund_reason              │
│                                                                 │
│  4. 부가 처리 (결제 유형에 따라)                                    │
│     ├─ 크레딧 구매: 크레딧 차감 + 트랜잭션 기록                      │
│     └─ 구독 결제: 구독 취소 + 플랜 다운그레이드                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 환불 에러

| 에러 메시지 | 원인 | 해결 방법 |
|------------|------|----------|
| `결제 정보를 찾을 수 없습니다` | 잘못된 paymentId | 올바른 결제 ID 사용 |
| `이미 환불된 결제입니다` | 중복 환불 요청 | - |
| `환불 가능한 상태가 아닙니다` | 결제 상태가 completed가 아님 | - |
| `환불 금액이 결제 금액을 초과합니다` | 부분 환불 금액 오류 | 금액 확인 |
| `환불 가능 기간(7일)이 지났습니다` | 7일 초과 | 고객센터 문의 |
| `환불 실패: [토스 에러 메시지]` | 토스페이먼츠 오류 | 에러 메시지 확인 |

---

## 환불 요청 관리

7일 초과 또는 대용량 환불의 경우 관리자 승인이 필요한 환불 요청을 생성할 수 있습니다.

### 환불 요청 플로우

```
┌─────────────────────────────────────────────────────────────────┐
│                    환불 요청 관리 플로우                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [즉시 환불] 7일 이내                                            │
│  └─ requestRefund() → 토스 환불 API → 즉시 처리                  │
│                                                                 │
│  [관리자 승인 필요] 7일 초과 또는 특수 케이스                       │
│  ├─ createRefundRequest() → 환불 요청 생성 (pending)            │
│  ├─ 관리자 검토 및 승인                                          │
│  └─ 승인 시 환불 처리 / 거절 시 사유 안내                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### createRefundRequest

관리자 승인이 필요한 환불 요청을 생성합니다.

```typescript
// 사용 예시
import { createRefundRequest } from '@/actions/billing';

const result = await createRefundRequest({
  paymentId: 'payment_123',
  reason: '서비스 불만족으로 인한 환불 요청',
  requestedAmount: 24900  // 선택: 미지정 시 전액 요청
});

if (result.success) {
  const { requestId, status } = result.data;
  // status: 'pending' - 관리자 검토 대기 중
}
```

#### 입력

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `paymentId` | `string` | O | 결제 ID |
| `reason` | `string` | O | 환불 사유 |
| `requestedAmount` | `number` | X | 요청 금액 (미지정 시 전액) |

#### 출력 (성공)

```typescript
{
  success: true,
  data: {
    requestId: string,
    status: 'pending'
  }
}
```

### getUserRefundRequests

사용자의 환불 요청 목록을 조회합니다.

```typescript
// 사용 예시
import { getUserRefundRequests } from '@/actions/billing';

const result = await getUserRefundRequests(1, 10);

if (result.success) {
  result.data?.requests.forEach(request => {
    console.log(`${request.status}: ${request.requestedAmount}원`);
  });
}
```

#### 입력

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `page` | `number` | 1 | 페이지 번호 |
| `limit` | `number` | 10 | 페이지당 항목 수 |

#### 출력 (성공)

```typescript
{
  success: true,
  data: {
    requests: [
      {
        id: string,
        paymentId: string,
        requestedAmount: number,
        approvedAmount: number | null,   // 승인된 금액 (null: 미처리)
        status: 'pending' | 'approved' | 'rejected' | 'canceled',
        reason: string,
        rejectionReason: string | null,  // 거절 사유
        createdAt: string,
        processedAt: string | null       // 처리 일시
      }
    ],
    total: number
  }
}
```

### cancelRefundRequest

대기 중인 환불 요청을 취소합니다.

```typescript
// 사용 예시
import { cancelRefundRequest } from '@/actions/billing';

const result = await cancelRefundRequest('request_id_xxx');

if (result.success) {
  // 환불 요청 취소 완료
}
```

#### 입력

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `requestId` | `string` | O | 환불 요청 ID |

#### 취소 가능 조건

| 상태 | 취소 가능 여부 |
|------|---------------|
| `pending` | ✅ 취소 가능 |
| `approved` | ❌ 이미 승인됨 |
| `rejected` | ❌ 이미 거절됨 |
| `canceled` | ❌ 이미 취소됨 |

#### 출력 (성공)

```typescript
{
  success: true
}
```

---

## 웹훅

토스페이먼츠 웹훅은 `/api/webhooks/toss`에서 처리됩니다.

### 엔드포인트

```
POST https://your-domain.com/api/webhooks/toss
```

### 지원 이벤트

| 이벤트 타입 | 설명 | 처리 내용 |
|------------|------|----------|
| `PAYMENT_STATUS_CHANGED` | 결제 상태 변경 | 결제 상태 업데이트, 취소/환불 처리 |
| `BILLING_STATUS_CHANGED` | 빌링키 상태 변경 | 구독 상태 업데이트 |
| `VIRTUAL_ACCOUNT_DEPOSITED` | 가상계좌 입금 | 크레딧 지급 |
| `DEPOSIT_CALLBACK` | 입금 콜백 | 로깅 |

### 서명 검증

모든 웹훅 요청은 `Toss-Signature` 헤더로 서명 검증됩니다.

```typescript
// 내부 구현
const isValidSignature = verifyWebhookSignature(rawBody, signature);
```

### 페이로드 예시

```json
{
  "eventType": "PAYMENT_STATUS_CHANGED",
  "data": {
    "paymentKey": "payment_key_xxx",
    "status": "DONE",
    "orderId": "CRD-20260129-ABC123"
  }
}
```

### 멱등성 (Idempotency) 처리

동일한 웹훅이 여러 번 수신되어도 중복 처리되지 않습니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    웹훅 멱등성 처리 플로우                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 멱등성 키 생성                                               │
│     └─ X-Toss-Idempotency-Key 헤더 또는 페이로드 SHA-256 해시    │
│                                                                 │
│  2. 중복 확인                                                    │
│     ├─ webhook_logs 테이블에서 idempotency_key 조회             │
│     └─ 이미 processed 상태면 → 200 OK 즉시 반환                 │
│                                                                 │
│  3. 처리                                                        │
│     ├─ 로그 저장 (status: pending)                              │
│     ├─ 이벤트 핸들러 실행                                        │
│     └─ 로그 업데이트 (status: processed)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 재시도 정책

- 토스페이먼츠는 2xx 응답이 아니면 자동 재시도
- 복구 불가능한 에러도 200 응답 (로그에 에러 기록)
- 수동 재처리를 위해 `webhook_logs` 테이블에 저장
- **재시도 가능 에러**: network, timeout, database, transaction 오류 → 500 반환
- **재시도 불필요 에러**: 파싱 오류, 유효성 검증 실패 → 200 반환

---

## 에러 코드

### 공통 에러

| 에러 메시지 | 원인 | 해결 방법 |
|------------|------|----------|
| `로그인이 필요합니다` | 인증 실패 | 로그인 후 재시도 |
| `입력값이 올바르지 않습니다` | 유효성 검증 실패 | 입력값 확인 |
| `사용자 정보를 찾을 수 없습니다` | 프로필 없음 | 회원가입 확인 |

### 결제 에러

| 에러 메시지 | 원인 | 해결 방법 |
|------------|------|----------|
| `존재하지 않는 패키지입니다` | 잘못된 packageId | 올바른 패키지 ID 사용 |
| `결제 정보를 찾을 수 없습니다` | 만료된 orderId | 결제 재시도 |
| `이미 처리된 결제입니다` | 중복 승인 요청 | - |
| `결제 승인에 실패했습니다` | 토스 결제 오류 | 카드 확인 후 재시도 |

### 구독 에러

| 에러 메시지 | 원인 | 해결 방법 |
|------------|------|----------|
| `이미 해당 플랜을 구독 중입니다` | 동일 플랜 재구독 | - |
| `이미 활성 구독이 있습니다` | 기존 구독 존재 | 기존 구독 취소 후 재시도 |
| `빌링키 발급에 실패했습니다` | 카드 등록 실패 | 다른 카드 시도 |
| `활성 구독을 찾을 수 없습니다` | 구독 없음 | - |

### 토스페이먼츠 에러 코드

| 코드 | 설명 |
|------|------|
| `INVALID_CARD_NUMBER` | 잘못된 카드 번호 |
| `EXPIRED_CARD` | 만료된 카드 |
| `EXCEED_MAX_CARD_INSTALLMENT_PLAN` | 할부 개월 수 초과 |
| `NOT_ALLOWED_POINT_USE` | 포인트 사용 불가 |
| `INVALID_STOPPED_CARD` | 정지된 카드 |
| `EXCEED_MAX_DAILY_PAYMENT_COUNT` | 일일 결제 횟수 초과 |
| `EXCEED_MAX_PAYMENT_AMOUNT` | 결제 한도 초과 |

---

## 테스트 가이드

### 테스트 환경 설정

```bash
# .env.local
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxx  # 테스트 클라이언트 키
TOSS_SECRET_KEY=test_sk_xxx               # 테스트 시크릿 키
```

### 테스트 카드 번호

| 시나리오 | 카드 번호 | 결과 |
|----------|----------|------|
| 결제 성공 | 4330-0000-0000-0000 | 승인 성공 |
| 결제 실패 | 4000-0000-0000-0000 | 승인 거절 |
| 잔액 부족 | 4111-1111-1111-1111 | 잔액 부족 오류 |

### 테스트 플로우

1. **크레딧 구매 테스트**
   ```
   /payment/credits → 패키지 선택 → 테스트 카드 입력 → /payment/credits/success
   ```

2. **구독 테스트**
   ```
   /payment/subscribe → 플랜 선택 → 테스트 카드 입력 → /payment/subscribe/success
   ```

3. **웹훅 테스트**
   ```bash
   # ngrok 터널링
   ngrok http 3000

   # 토스페이먼츠 대시보드에서 웹훅 URL 설정
   https://xxx.ngrok.io/api/webhooks/toss
   ```

---

## 내부 API (서버 전용)

다음 함수들은 Server Actions 내부에서만 사용되며, 클라이언트에서 직접 호출하면 안 됩니다.

### useCredit

크레딧을 차감합니다. 원자적 RPC 함수를 사용하여 트랜잭션 안정성을 보장합니다.

```typescript
// 내부 사용 예시 (Server Action에서만)
import { useCredit } from '@/actions/credits';

const result = await useCredit(
  userId,           // 사용자 ID
  1,                // 차감할 크레딧 양
  '콘텐츠 생성'      // 설명
);

if (result.success) {
  console.log('새 잔액:', result.newBalance);
}
```

### addCredit

크레딧을 지급합니다. 결제 완료 후 또는 구독 갱신 시 사용됩니다.

```typescript
// 내부 사용 예시 (Server Action에서만)
import { addCredit } from '@/actions/credits';

const result = await addCredit(
  userId,                     // 사용자 ID
  150,                        // 지급할 크레딧 양
  'purchase',                 // 타입: purchase | subscription_grant | refund | admin_adjustment
  'Standard 패키지 구매',      // 설명
  paymentId,                  // 결제 ID (옵션)
  expiresAt                   // 만료일 (옵션)
);
```

---

## 성능 최적화

### 원자적 트랜잭션 (RPC 함수)

모든 크레딧 관련 작업은 PostgreSQL RPC 함수를 사용하여 원자성을 보장합니다.

| RPC 함수 | 용도 | 트랜잭션 내용 |
|----------|------|-------------|
| `use_credit_atomic` | 크레딧 차감 | 잔액 확인 → 차감 → 트랜잭션 기록 |
| `add_credit_atomic` | 크레딧 지급 | 잔액 증가 → 트랜잭션 기록 |
| `process_refund_transaction` | 환불 처리 | 결제 상태 변경 → 크레딧 차감 → 기록 |

### Rate Limiting 설정

| 작업 | 제한 | Window |
|------|------|--------|
| 결제 준비 | 10회 | 1분 |
| 결제 확인 | 5회 | 1분 |
| 구독 생성 | 3회 | 1분 |
| 환불 요청 | 3회 | 1분 |
| AI 콘텐츠 생성 | 20회 | 1분 |

### 웹훅 멱등성

동일한 웹훅이 여러 번 수신되어도 중복 처리를 방지합니다.

```
멱등성 키 생성:
1. X-Toss-Idempotency-Key 헤더 (있는 경우)
2. 페이로드의 SHA-256 해시 (fallback)

중복 확인:
- webhook_logs 테이블에서 idempotency_key 조회
- 이미 processed 상태면 즉시 200 OK 반환
```

### 데이터베이스 인덱스

결제 관련 주요 인덱스:

| 테이블 | 인덱스 | 용도 |
|--------|--------|------|
| `payments` | `idx_payments_user_id` | 사용자별 결제 조회 |
| `payments` | `idx_payments_order_id` | 주문 ID 조회 |
| `payments` | `idx_payments_status` | 상태별 필터링 |
| `credit_transactions` | `idx_credit_transactions_user_id` | 사용자별 트랜잭션 조회 |
| `credit_transactions` | `idx_credit_transactions_expires_at` | 만료 예정 크레딧 조회 |
| `webhook_logs` | `idx_webhook_logs_idempotency_key` | 멱등성 확인 |

---

## 관련 문서

- [TossPayments 개발자 문서](https://docs.tosspayments.com)
- [TossPayments API Reference](https://docs.tosspayments.com/reference)
- [배포 가이드](../deployment.md)
- [환불 정책](../refund-policy.md)
- [보안 가이드](./payment-security.md)

---

*마지막 업데이트: 2026-01-30*
