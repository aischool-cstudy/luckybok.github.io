# CSRF 보호 구현 가이드

> **버전**: 1.0.0
> **최종 수정**: 2026-01-30
> **담당 모듈**: `src/lib/csrf.ts`

---

## 개요

CodeGen AI는 **CSRF (Cross-Site Request Forgery)** 공격을 방지하기 위해 다음 보안 메커니즘을 구현합니다:

- **HMAC-SHA256** 기반 토큰 생성/검증
- **더블 서브밋 쿠키 패턴** (Double Submit Cookie)
- **타이밍 공격 방지** (Constant-time Comparison)

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    CSRF 보호 플로우                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 토큰 발급 (GET /api/csrf/token)                             │
│     ┌──────────┐        ┌──────────┐        ┌──────────┐       │
│     │  Client  │ ────── │  Server  │ ────── │  Cookie  │       │
│     │          │ <───── │ (토큰생성)│ ────── │ (저장)   │       │
│     └──────────┘  JSON  └──────────┘        └──────────┘       │
│         │                                                       │
│         ▼                                                       │
│  2. 토큰 사용 (POST 요청)                                       │
│     ┌──────────┐        ┌──────────┐        ┌──────────┐       │
│     │  Client  │ ────── │  Server  │ ────── │  Cookie  │       │
│     │ (_csrf)  │        │ (검증)   │ <───── │ (비교)   │       │
│     └──────────┘        └──────────┘        └──────────┘       │
│                              │                                  │
│                              ▼                                  │
│                    ┌──────────────────┐                        │
│                    │ 토큰 일치 확인   │                        │
│                    │ - 서명 검증      │                        │
│                    │ - 만료 검증      │                        │
│                    │ - 사용자 바인딩  │                        │
│                    └──────────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 토큰 구조

CSRF 토큰은 다음 형식으로 구성됩니다:

```
{base64url(JSON 데이터)}.{HMAC-SHA256 서명}
```

### JSON 데이터 구조

```typescript
interface CSRFTokenData {
  nonce: string;      // 32바이트 랜덤 값 (hex)
  timestamp: number;  // 생성 시각 (Unix timestamp ms)
  userId?: string;    // 사용자 ID (선택적 바인딩)
}
```

### 예시

```
eyJub25jZSI6ImFiY2QxMjM0Li4uIiwidGltZXN0YW1wIjoxNzA2NjAwMDAwMDAwfQ.kJ9x2mN7pQ...
```

---

## 보안 특성

### 1. 키 분리 원칙

CSRF 시크릿 키는 기존 `BILLING_KEY_ENCRYPTION_KEY`에서 파생됩니다:

```typescript
function getCSRFSecret(): Buffer {
  const baseKey = serverEnv.BILLING_KEY_ENCRYPTION_KEY;
  return Buffer.from(
    createHmac('sha256', 'csrf-key-derivation')
      .update(baseKey)
      .digest('hex'),
    'hex'
  );
}
```

**장점**: 별도 환경 변수 불필요, 키 관리 단순화

### 2. 타이밍 공격 방지

서명 비교 시 `timingSafeEqual` 사용:

```typescript
if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
  return { valid: false, error: '서명이 유효하지 않습니다.' };
}
```

### 3. 쿠키 보안 설정

| 속성 | 값 | 설명 |
|------|-----|------|
| `httpOnly` | `true` | JavaScript 접근 차단 |
| `secure` | `true` (prod) | HTTPS에서만 전송 |
| `sameSite` | `strict` | 동일 사이트만 허용 |
| `maxAge` | 3600초 | 1시간 만료 |

---

## 사용 방법

### 1. API Route에서 토큰 발급

```typescript
// src/app/api/csrf/token/route.ts
import { generateCSRFToken, setCSRFCookie } from '@/lib/csrf';

export async function POST(request: Request) {
  const token = generateCSRFToken(userId);
  await setCSRFCookie(token);

  return Response.json({ token });
}
```

### 2. 클라이언트에서 토큰 사용

```typescript
// React 컴포넌트
import { useCSRF } from '@/hooks/use-csrf';

function DeleteAccountButton() {
  const { token, isLoading } = useCSRF();

  const handleDelete = async () => {
    await deleteAccount({ _csrf: token, ...data });
  };

  return (
    <button onClick={handleDelete} disabled={isLoading}>
      계정 삭제
    </button>
  );
}
```

### 3. Server Action에서 검증

```typescript
// src/actions/settings.ts
import { validateCSRFForAction } from '@/lib/csrf';

export async function deleteAccount(input: DeleteAccountInput) {
  const { _csrf, ...data } = input;

  // CSRF 검증
  const csrfResult = await validateCSRFForAction(_csrf, user.id);
  if (!csrfResult.success) {
    return { success: false, error: csrfResult.error };
  }

  // 실제 삭제 로직...
}
```

---

## 적용 대상 액션

CSRF 보호가 필수인 고위험 액션:

| 액션 | 파일 | 위험도 |
|------|------|--------|
| `changePassword` | `src/actions/settings.ts` | Critical |
| `deleteAccount` | `src/actions/settings.ts` | Critical |
| `deleteTeam` | `src/actions/team.ts` | Critical |
| `transferTeamOwnership` | `src/actions/team.ts` | Critical |
| `createTeamApiKey` | `src/actions/team.ts` | High |
| `deleteTeamApiKey` | `src/actions/team.ts` | High |
| `removeTeamMember` | `src/actions/team.ts` | High |
| `updateTeamMemberRole` | `src/actions/team.ts` | High |

---

## 토큰 갱신

토큰은 1시간 후 만료되며, 클라이언트 훅에서 자동 갱신합니다:

```typescript
// use-csrf.ts
useEffect(() => {
  // 50분마다 토큰 갱신
  const interval = setInterval(refreshToken, 50 * 60 * 1000);
  return () => clearInterval(interval);
}, []);
```

---

## 테스트

### 토큰 없이 요청 (실패 예상)

```bash
curl -X POST http://localhost:3000/api/settings/change-password \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"test123"}'

# Expected: 400 "보안 토큰이 필요합니다."
```

### 유효한 토큰으로 요청 (성공 예상)

```bash
# 1. 토큰 발급
TOKEN=$(curl -X POST http://localhost:3000/api/csrf/token \
  -c cookies.txt | jq -r '.token')

# 2. 토큰과 함께 요청
curl -X POST http://localhost:3000/api/settings/change-password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{\"_csrf\":\"$TOKEN\", \"currentPassword\":\"test123\"}"
```

---

## 트러블슈팅

### "보안 쿠키가 없습니다" 오류

- **원인**: 쿠키가 설정되지 않았거나 만료됨
- **해결**: `/api/csrf/token` 호출하여 새 토큰 발급

### "토큰이 만료되었습니다" 오류

- **원인**: 1시간 이상 경과
- **해결**: 클라이언트 훅의 자동 갱신 확인, 필요시 수동 갱신

### 개발 환경에서 쿠키 전송 안 됨

- **원인**: `secure: true`가 localhost에서 동작 안 함
- **해결**: 개발 환경에서는 `secure: false`로 자동 설정됨

---

## 참고 자료

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Double Submit Cookie Pattern](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie)
