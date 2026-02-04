# 결제 보안 API 문서

> **버전**: 1.0.0
> **최종 수정**: 2026-01-30
> **결제 서비스**: 토스페이먼츠

---

## 개요

CodeGen AI 결제 시스템은 다음 보안 계층을 구현합니다:

| 계층 | 보안 기능 | 구현 모듈 |
|------|----------|----------|
| **L1** | Rate Limiting | `src/lib/rate-limit.ts` |
| **L2** | CSRF Protection | `src/lib/csrf.ts` |
| **L3** | 빌링키 암호화 | `src/lib/payment/crypto.ts` |
| **L4** | 웹훅 서명 검증 | `src/lib/payment/crypto.ts` |
| **L5** | 금액 서버 검증 | `src/actions/payment.ts` |

---

## 보안 헤더

### CSP (Content Security Policy)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.tosspayments.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https://api.tosspayments.com https://*.supabase.co;
  frame-src 'self' https://js.tosspayments.com;
  upgrade-insecure-requests;
  block-all-mixed-content;
```

### 추가 보안 헤더

| 헤더 | 값 | 용도 |
|------|-----|------|
| `X-Frame-Options` | `SAMEORIGIN` | 클릭재킹 방지 |
| `X-Content-Type-Options` | `nosniff` | MIME 스니핑 방지 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 리퍼러 정보 제어 |
| `Cross-Origin-Opener-Policy` | `same-origin` | 크로스 오리진 격리 |
| `Cross-Origin-Resource-Policy` | `same-origin` | 리소스 공유 제한 |

---

## API 엔드포인트

### 1. CSRF 토큰 발급

```http
POST /api/csrf/token
```

**Rate Limit**: 30/min

**Headers**:
```
Content-Type: application/json
```

**Response** (200 OK):
```json
{
  "token": "eyJub25jZSI6Ii4uLiJ9.kJ9x2mN7pQ...",
  "expiresIn": 3600000
}
```

**쿠키 설정**:
```
Set-Cookie: __csrf_token=...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600
```

---

### 2. 크레딧 결제 준비

```http
POST /api/payment/credits/prepare
```

**Rate Limit**: 10/min (PAYMENT_PREPARE)

**Headers**:
```
Content-Type: application/json
Authorization: Bearer {access_token}
```

**Request Body**:
```json
{
  "packageId": "standard",
  "_csrf": "eyJub25jZSI6Ii4uLiJ9.kJ9x2mN7pQ..."
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "orderId": "CREDIT_20260130_ABC123",
    "orderName": "크레딧 150개",
    "amount": 24900,
    "customerKey": "cust_abc123..."
  }
}
```

**에러 응답**:
| 코드 | 메시지 | 원인 |
|------|--------|------|
| 400 | 유효하지 않은 패키지입니다 | 잘못된 packageId |
| 401 | 로그인이 필요합니다 | 미인증 |
| 429 | 요청이 너무 많습니다 | Rate Limit 초과 |

---

### 3. 결제 확인 (Confirm)

```http
POST /api/payment/confirm
```

**Rate Limit**: 5/min (PAYMENT_CONFIRM)

**Request Body**:
```json
{
  "paymentKey": "pk_test_xxx",
  "orderId": "CREDIT_20260130_ABC123",
  "amount": 24900
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_123",
    "credits": 150,
    "newBalance": 200
  }
}
```

**보안 검증**:
1. ✅ 서버에서 금액 재검증 (DB 조회)
2. ✅ 토스페이먼츠 API 호출로 결제 승인
3. ✅ 크레딧 추가 트랜잭션 처리

---

### 4. 구독 생성

```http
POST /api/subscription/create
```

**Rate Limit**: 3/min (SUBSCRIPTION_CREATE)

**Request Body**:
```json
{
  "plan": "pro",
  "billingCycle": "monthly",
  "_csrf": "eyJub25jZSI6Ii4uLiJ9.kJ9x2mN7pQ..."
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "customerKey": "cust_abc123...",
    "successUrl": "https://codegen.ai/payment/subscribe/success",
    "failUrl": "https://codegen.ai/payment/subscribe/fail"
  }
}
```

---

### 5. 환불 요청

```http
POST /api/payment/refund
```

**Rate Limit**: 3/min (REFUND_REQUEST)
**CSRF**: 필수

**Request Body**:
```json
{
  "paymentId": "pay_123",
  "reason": "고객 요청에 의한 환불",
  "_csrf": "eyJub25jZSI6Ii4uLiJ9.kJ9x2mN7pQ..."
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "refundId": "ref_123",
    "refundAmount": 24900,
    "status": "refunded"
  }
}
```

---

### 6. 웹훅 수신

```http
POST /api/webhooks/toss
```

**인증**: 웹훅 서명 검증 (CSRF 제외)

**Headers**:
```
Content-Type: application/json
X-Toss-Signature: {HMAC-SHA256 signature}
```

**Payload 예시**:
```json
{
  "eventType": "PAYMENT_STATUS_CHANGED",
  "data": {
    "paymentKey": "pk_test_xxx",
    "orderId": "CREDIT_20260130_ABC123",
    "status": "DONE"
  }
}
```

**서명 검증**:
```typescript
import { verifyWebhookSignature } from '@/lib/payment/crypto';

const isValid = verifyWebhookSignature(rawBody, signature);
if (!isValid) {
  return new Response('Invalid signature', { status: 401 });
}
```

---

## 빌링키 암호화

### 암호화 방식

- **알고리즘**: AES-256-GCM
- **키 길이**: 32바이트 (256비트)
- **IV**: 12바이트 랜덤
- **Auth Tag**: 16바이트

### 저장 형식

```
{iv}:{authTag}:{encryptedData}
```

### 코드 예시

```typescript
import { encryptBillingKey, decryptBillingKey } from '@/lib/payment/crypto';

// 암호화
const encrypted = encryptBillingKey('billing_key_xxx');
// => "a1b2c3...:d4e5f6...:g7h8i9..."

// 복호화
const decrypted = decryptBillingKey(encrypted);
// => "billing_key_xxx"
```

---

## 금액 검증 플로우

```
┌─────────────────────────────────────────────────────────────────┐
│                    금액 검증 플로우                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 클라이언트                                                   │
│     └─ 패키지 선택 (packageId: "standard")                      │
│                                                                 │
│  2. 서버 (preparePayment)                                       │
│     ├─ 패키지 ID로 금액 조회 (24,900원)                         │
│     ├─ 주문 ID 생성                                             │
│     └─ DB에 결제 레코드 저장 (status: pending)                  │
│                                                                 │
│  3. 토스페이먼츠                                                │
│     └─ 결제 진행 (amount: 24,900원)                             │
│                                                                 │
│  4. 서버 (confirmPayment)                                       │
│     ├─ ⚠️ 클라이언트 금액 vs DB 금액 검증                       │
│     │   └─ 불일치 시 결제 거부                                   │
│     ├─ 토스 API로 결제 승인 요청                                 │
│     └─ 크레딧 추가 트랜잭션                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 금액 검증 코드

```typescript
// src/actions/payment.ts
async function confirmPayment(input: ConfirmPaymentInput) {
  // DB에서 원본 금액 조회
  const { data: payment } = await supabase
    .from('payments')
    .select('amount')
    .eq('order_id', input.orderId)
    .single();

  // 금액 검증 (중요!)
  if (payment.amount !== input.amount) {
    logWarn('금액 불일치 감지', {
      expected: payment.amount,
      received: input.amount,
      orderId: input.orderId,
    });
    return { success: false, error: '결제 금액이 올바르지 않습니다.' };
  }

  // 토스 API 승인 요청
  await tossClient.confirmPayment(input.paymentKey, input.orderId, input.amount);
}
```

---

## 보안 체크리스트

### 시크릿 키 관리

| 항목 | 상태 | 확인 |
|------|------|------|
| 환경변수에서만 로드 | ✅ | `serverEnv.TOSS_SECRET_KEY` |
| 코드에 하드코딩 없음 | ✅ | Grep 검증 완료 |
| 로그에 출력 안 됨 | ✅ | `logger.ts` 민감 필드 마스킹 |
| 클라이언트 노출 없음 | ✅ | `NEXT_PUBLIC_` 접두사 없음 |

### Rate Limiting

| 엔드포인트 | 제한 | 상태 |
|-----------|------|------|
| 결제 준비 | 10/min | ✅ |
| 결제 확인 | 5/min | ✅ |
| 구독 생성 | 3/min | ✅ |
| 환불 요청 | 3/min | ✅ |
| AI 생성 | 20/min | ✅ |

### CSRF 보호

| 액션 | CSRF 적용 | 상태 |
|------|----------|------|
| 비밀번호 변경 | ✅ | 구현 완료 |
| 계정 삭제 | ✅ | 구현 완료 |
| 팀 삭제 | ✅ | 구현 완료 |
| API 키 생성/삭제 | ✅ | 구현 완료 |

### 암호화

| 데이터 | 암호화 방식 | 상태 |
|-------|-----------|------|
| 빌링키 | AES-256-GCM | ✅ |
| 웹훅 서명 | HMAC-SHA256 | ✅ |
| CSRF 토큰 | HMAC-SHA256 | ✅ |

---

## 테스트 카드 번호

| 카드 | 번호 | 용도 |
|------|------|------|
| 성공 | 4330000000000000 | 정상 결제 테스트 |
| 실패 | 4000000000000000 | 결제 실패 테스트 |
| 잔액 부족 | 4111111111111111 | 잔액 부족 테스트 |

### 테스트 환경 설정

```bash
# .env.local
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxx  # 테스트 클라이언트 키
TOSS_SECRET_KEY=test_sk_xxx              # 테스트 시크릿 키
```

---

## 에러 코드

| 코드 | HTTP | 메시지 | 원인 |
|------|------|--------|------|
| `AUTH_REQUIRED` | 401 | 로그인이 필요합니다 | 미인증 |
| `INVALID_INPUT` | 400 | 입력값이 올바르지 않습니다 | 잘못된 요청 |
| `RATE_LIMIT_EXCEEDED` | 429 | 요청이 너무 많습니다 | Rate Limit |
| `PAYMENT_FAILED` | 402 | 결제 처리에 실패했습니다 | 결제 오류 |
| `INSUFFICIENT_CREDITS` | 402 | 크레딧이 부족합니다 | 잔액 부족 |
| `FORBIDDEN` | 403 | 접근 권한이 없습니다 | 권한 없음 |

---

## 로깅 및 모니터링

### 민감 정보 마스킹

```typescript
// src/lib/logger.ts
const SENSITIVE_FIELDS = [
  'password', 'secret', 'token', 'apiKey',
  'billingKey', 'encryptedBillingKey',
  'cardNumber', 'cvv', 'customerKey',
  'paymentKey', 'authKey', 'authorization'
];

// 로그 출력 예시
logInfo('결제 완료', {
  userId: 'user_123',
  paymentKey: '[REDACTED]',  // 자동 마스킹
  amount: 24900
});
```

### 보안 이벤트 로깅

- Rate Limit 초과
- CSRF 검증 실패
- 웹훅 서명 검증 실패
- 금액 불일치 감지

---

## 참고 자료

- [토스페이먼츠 API 문서](https://docs.tosspayments.com/reference)
- [OWASP 결제 보안 가이드](https://owasp.org/www-project-web-security-testing-guide/)
- [PCI DSS 요구사항](https://www.pcisecuritystandards.org/)
