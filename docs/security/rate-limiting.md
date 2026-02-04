# Rate Limiting 설정 가이드

> **버전**: 1.0.0
> **최종 수정**: 2026-01-30
> **담당 모듈**: `src/lib/rate-limit.ts`

---

## 개요

CodeGen AI는 서비스 안정성과 보안을 위해 **슬라이딩 윈도우 기반 Rate Limiting**을 구현합니다:

- **분산 환경 지원**: Vercel KV (Redis) 사용
- **로컬 개발 지원**: 메모리 폴백
- **액션별 프리셋**: 민감도에 따른 차등 제한

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                   Rate Limiting 아키텍처                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                      ┌──────────────────┐                       │
│                      │   요청 수신      │                       │
│                      └────────┬─────────┘                       │
│                               │                                  │
│                               ▼                                  │
│                      ┌──────────────────┐                       │
│                      │ IP/사용자 식별   │                       │
│                      └────────┬─────────┘                       │
│                               │                                  │
│              ┌────────────────┴────────────────┐                │
│              ▼                                 ▼                │
│     ┌──────────────────┐              ┌──────────────────┐     │
│     │  Vercel KV       │              │  메모리 저장소    │     │
│     │  (프로덕션)       │              │  (개발/폴백)      │     │
│     └────────┬─────────┘              └────────┬─────────┘     │
│              │                                  │               │
│              └──────────────┬───────────────────┘               │
│                             ▼                                   │
│                    ┌──────────────────┐                        │
│                    │ 슬라이딩 윈도우   │                        │
│                    │ 카운트 체크       │                        │
│                    └────────┬─────────┘                        │
│                             │                                   │
│              ┌──────────────┴──────────────┐                   │
│              ▼                              ▼                   │
│     ┌──────────────┐              ┌──────────────┐             │
│     │ allowed=true │              │ allowed=false│             │
│     │ 요청 허용    │              │ 429 응답     │             │
│     └──────────────┘              └──────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 프리셋 목록

| 프리셋 | 윈도우 | 최대 요청 | 용도 |
|--------|--------|----------|------|
| `PAYMENT_PREPARE` | 1분 | 10회 | 결제 준비 |
| `PAYMENT_CONFIRM` | 1분 | 5회 | 결제 확인 |
| `SUBSCRIPTION_CREATE` | 1분 | 3회 | 구독 생성 |
| `REFUND_REQUEST` | 1분 | 3회 | 환불 요청 |
| `GENERAL_READ` | 1분 | 30회 | 일반 조회 |
| `AI_GENERATE` | 1분 | 20회 | AI 콘텐츠 생성 |
| `AUTH` | 1분 | 5회 | 로그인/회원가입 |

---

## 사용 방법

### 기본 사용

```typescript
import {
  checkRateLimit,
  getClientIP,
  getRateLimitErrorMessage,
  RATE_LIMIT_PRESETS
} from '@/lib/rate-limit';
import { headers } from 'next/headers';

export async function myServerAction() {
  const headersList = await headers();
  const clientIP = getClientIP(headersList);

  const rateLimitResult = await checkRateLimit(
    clientIP,
    'my_action',
    RATE_LIMIT_PRESETS.GENERAL_READ
  );

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: getRateLimitErrorMessage(rateLimitResult),
    };
  }

  // 실제 로직...
}
```

### 사용자 ID 기반 제한

```typescript
// IP 대신 사용자 ID로 제한 (로그인된 사용자)
const rateLimitResult = await checkRateLimit(
  user.id,  // 사용자 ID
  'ai_generate',
  RATE_LIMIT_PRESETS.AI_GENERATE
);
```

### 커스텀 설정

```typescript
// 커스텀 Rate Limit 설정
const customConfig = {
  windowMs: 30 * 1000,  // 30초
  max: 5,               // 최대 5회
};

const result = await checkRateLimit(identifier, 'custom_action', customConfig);
```

---

## 적용된 액션 목록

### 인증 관련

| 액션 | 파일 | 프리셋 |
|------|------|--------|
| `login` | `src/actions/auth.ts` | AUTH (5/min) |
| `register` | `src/actions/auth.ts` | AUTH (3/min) |

### 결제 관련

| 액션 | 파일 | 프리셋 |
|------|------|--------|
| `preparePayment` | `src/actions/payment.ts` | PAYMENT_PREPARE (10/min) |
| `confirmCreditPayment` | `src/actions/payment.ts` | PAYMENT_CONFIRM (5/min) |
| `prepareSubscription` | `src/actions/subscription.ts` | SUBSCRIPTION_CREATE (3/min) |
| `requestRefund` | `src/actions/billing.ts` | REFUND_REQUEST (3/min) |

### AI 생성 관련

| 액션 | 파일 | 프리셋 |
|------|------|--------|
| `generateContent` | `src/actions/generate.ts` | AI_GENERATE (20/min) |
| `generateContentStreaming` | `src/actions/generate.ts` | AI_GENERATE (20/min) |

### 팀 관리 관련

| 액션 | 파일 | 프리셋 |
|------|------|--------|
| `createTeamApiKey` | `src/actions/team.ts` | SUBSCRIPTION_CREATE (3/min) |
| `deleteTeamApiKey` | `src/actions/team.ts` | REFUND_REQUEST (3/min) |

---

## 응답 구조

```typescript
interface RateLimitResult {
  allowed: boolean;     // 허용 여부
  remaining: number;    // 남은 요청 수
  resetIn: number;      // 리셋까지 남은 시간 (ms)
  current: number;      // 현재 윈도우 내 요청 수
  limit: number;        // 최대 허용 요청 수
}
```

### 예시

```json
{
  "allowed": false,
  "remaining": 0,
  "resetIn": 45000,
  "current": 20,
  "limit": 20
}
```

---

## 환경 설정

### Vercel KV 설정 (프로덕션)

```bash
# .env.local
KV_REST_API_URL=https://xxx.kv.vercel-storage.com
KV_REST_API_TOKEN=AXxx...
```

### 메모리 폴백 (개발)

KV 환경 변수가 없으면 자동으로 메모리 저장소 사용:

```typescript
// 자동 감지
if (isKVConfigured()) {
  return checkRateLimitKV(key, config);
}
return checkRateLimitMemory(key, config);
```

---

## 슬라이딩 윈도우 알고리즘

### 작동 원리

```
시간축: ─────────────────────────────────────────────►
        │                    │                    │
        │◄── 1분 윈도우 ────►│                    │
        │                    │                    │
요청:   ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○
        ↑                    ↑                    ↑
      윈도우 시작         현재 시각            미래

카운트: 윈도우 내 요청만 카운트 (오래된 요청은 제외)
```

### Redis 저장 구조 (Sorted Set)

```
Key: ratelimit:ai_generate:192.168.1.1
Score: 1706600000000 (타임스탬프)
Member: "1706600000000-abc123" (고유 ID)
```

---

## 에러 메시지

사용자 친화적인 한국어 메시지 제공:

```typescript
function getRateLimitErrorMessage(result: RateLimitResult): string {
  const seconds = Math.ceil(result.resetIn / 1000);
  if (seconds > 60) {
    const minutes = Math.ceil(seconds / 60);
    return `요청이 너무 많습니다. ${minutes}분 후 다시 시도해주세요.`;
  }
  return `요청이 너무 많습니다. ${seconds}초 후 다시 시도해주세요.`;
}
```

---

## 테스트

### Rate Limit 동작 확인

```bash
# 21회 연속 요청으로 429 응답 확인 (AI_GENERATE: 20/min)
for i in {1..21}; do
  curl -X POST http://localhost:3000/api/generate \
    -H "Content-Type: application/json" \
    -d '{"topic":"test"}'
  echo " - Request $i"
done

# Expected: 21번째 요청에서 429 응답
```

### Rate Limit 초기화 (테스트용)

```typescript
import { clearRateLimitStore, clearRateLimit } from '@/lib/rate-limit';

// 전체 초기화
await clearRateLimitStore();

// 특정 키만 초기화
await clearRateLimit('192.168.1.1', 'ai_generate');
```

---

## 모니터링

### 로그 확인

Rate Limit 초과 시 경고 로그 출력:

```
[WARN] Rate limit exceeded | action: ai_generate | identifier: 192.168.1.1 | current: 21 | limit: 20
```

### 메트릭

Vercel Analytics 또는 커스텀 모니터링으로 추적 가능:

- Rate Limit 초과 횟수
- 액션별 요청 분포
- IP별 요청 패턴

---

## 트러블슈팅

### "Module not found: @vercel/kv" 경고

- **원인**: 로컬 개발 환경에서 @vercel/kv 미설치
- **영향**: 없음 (메모리 폴백 자동 사용)
- **해결**: 무시해도 됨, 또는 `npm install @vercel/kv` 설치

### 메모리 저장소 데이터 유실

- **원인**: 서버 재시작 시 메모리 초기화
- **영향**: 개발 환경에서만 발생
- **해결**: 프로덕션에서는 Vercel KV 사용

### 분산 환경에서 Rate Limit 불일치

- **원인**: 메모리 저장소는 인스턴스별로 분리
- **해결**: Vercel KV 사용으로 중앙 집중식 관리

---

## 참고 자료

- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
- [Sliding Window Algorithm](https://en.wikipedia.org/wiki/Sliding_window_protocol)
