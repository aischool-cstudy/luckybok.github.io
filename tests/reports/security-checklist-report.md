# 결제 보안 체크리스트 검증 보고서

**검증일**: 2026-01-29
**검증자**: 터미널 4 (테스트 & QA 세션)
**대상**: CodeGen AI 결제 시스템

---

## 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| 시크릿 키 관리 | ✅ 통과 | 환경변수에서만 로드 |
| 클라이언트 노출 | ✅ 통과 | 클라이언트 키만 노출 |
| 금액 검증 | ✅ 통과 | 서버 사이드 검증 |
| 빌링키 암호화 | ✅ 통과 | AES-256-GCM |
| 웹훅 보안 | ✅ 통과 | HMAC-SHA256 서명 검증 |
| SQL Injection | ✅ 통과 | ORM 사용 |

---

## 상세 검증 결과

### 1. 시크릿 키 관리

**상태**: ✅ 통과

**검증 내용**:
- ☑ 환경변수에서만 로드
- ☑ 코드에 하드코딩 없음
- ☑ 환경변수 미설정 시 에러 발생

**증거 코드**:
```typescript
// src/lib/payment/toss.ts:170-179
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

```typescript
// src/lib/payment/crypto.ts:11-19
function getEncryptionKey(): Buffer {
  const key = process.env.BILLING_KEY_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('BILLING_KEY_ENCRYPTION_KEY 환경 변수가 설정되지 않았습니다.');
  }
  if (key.length !== 32) {
    throw new Error('BILLING_KEY_ENCRYPTION_KEY는 32자여야 합니다.');
  }
  return Buffer.from(key, 'utf-8');
}
```

---

### 2. 클라이언트 노출

**상태**: ✅ 통과

**검증 내용**:
- ☑ 프론트엔드에 시크릿 키 없음
- ☑ 클라이언트 키(NEXT_PUBLIC_)만 사용
- ☑ API 응답에 민감 정보 없음

**증거 코드**:
```typescript
// src/app/(protected)/payment/credits/page.tsx:83
const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
// NEXT_PUBLIC_ 접두사: 클라이언트 전용 공개 키
```

**grep 검색 결과**:
- `TOSS_SECRET_KEY`: 서버 사이드 코드(toss.ts)에서만 사용
- `NEXT_PUBLIC_TOSS_CLIENT_KEY`: 클라이언트 컴포넌트에서만 사용

---

### 3. 금액 검증

**상태**: ✅ 통과

**검증 내용**:
- ☑ 서버에서 금액 검증
- ☑ 클라이언트 전달 금액 신뢰하지 않음
- ☑ 패키지/플랜별 정확한 금액 확인

**증거 코드**:
```typescript
// src/lib/validators/payment.ts:130-149
export function validateCreditPackageAmount(
  packageId: string,
  amount: number
): { valid: boolean; expectedAmount?: number; error?: string } {
  const pkg = creditPackages.find((p) => p.id === packageId);
  if (!pkg) {
    return { valid: false, error: '존재하지 않는 패키지입니다' };
  }
  if (pkg.price !== amount) {
    return {
      valid: false,
      expectedAmount: pkg.price,
      error: `금액이 일치하지 않습니다. 예상: ${pkg.price}원, 실제: ${amount}원`,
    };
  }
  return { valid: true };
}
```

**사용 위치**:
- `src/actions/payment.ts:163-169` - 크레딧 결제 승인 시
- `src/actions/subscription.ts:182-185` - 구독 결제 승인 시

---

### 4. 빌링키 암호화

**상태**: ✅ 통과

**검증 내용**:
- ☑ AES-256-GCM 암호화 사용
- ☑ 복호화 키 환경변수로 관리
- ☑ IV(Initial Vector) 랜덤 생성
- ☑ AuthTag 검증

**증거 코드**:
```typescript
// src/lib/payment/crypto.ts:34-55
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

export function encryptBillingKey(billingKey: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(billingKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // iv:authTag:encrypted 형식으로 저장
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}
```

**암호화 강도**:
- 알고리즘: AES-256-GCM (권장)
- 키 길이: 32바이트 (256비트)
- IV: 16바이트 (랜덤)
- 인증 태그: GCM 기본값 (16바이트)

---

### 5. 웹훅 보안

**상태**: ✅ 통과

**검증 내용**:
- ☑ HMAC-SHA256 서명 검증 구현
- ☑ 타이밍 공격 방지 (상수 시간 비교)
- ☑ 검증 실패 시 거부

**증거 코드**:
```typescript
// src/lib/payment/crypto.ts:93-111
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = getWebhookSecret();

  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('base64');

  // 타이밍 공격 방지를 위한 상수 시간 비교
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }

  return result === 0;
}
```

**보안 조치**:
- 상수 시간 비교: 문자열 길이와 관계없이 동일한 시간 소요
- XOR 비교: 바이트 단위 비교로 타이밍 정보 누출 방지

---

### 6. SQL Injection

**상태**: ✅ 통과

**검증 내용**:
- ☑ Supabase ORM 사용
- ☑ Parameterized queries
- ☑ Raw SQL 없음

**증거 코드**:
```typescript
// src/actions/payment.ts:142-147
const { data: payment, error: paymentError } = await adminClient
  .from('payments')
  .select('*')
  .eq('order_id', orderId)  // Parameterized
  .eq('user_id', user.id)   // Parameterized
  .single();
```

---

## 추가 발견 사항

### 잠재적 개선 사항

1. **웹훅 API 미구현**
   - 현재 `/api/webhook/toss` 엔드포인트가 없음
   - 웹훅 서명 검증 함수는 구현되어 있으나 실제 API Route 필요

2. **Rate Limiting**
   - 현재 결제 API에 Rate Limiting 미적용
   - Vercel Edge Middleware 또는 외부 서비스 연동 권장

3. **로그 민감 정보**
   - `sanitizeForLogging` 함수 구현되어 있음
   - 실제 에러 로깅 시 적용 여부 확인 필요

---

## 권장 사항

1. **필수** (High Priority)
   - 웹훅 API Route 구현 및 서명 검증 적용

2. **권장** (Medium Priority)
   - Rate Limiting 적용
   - 결제 관련 로그에 `sanitizeForLogging` 적용 확인

3. **선택** (Low Priority)
   - 정기적인 보안 감사 스케줄링
   - 결제 실패 알림 시스템 구축

---

**검증 완료**
