# CodeGen AI 개발 가이드

> **Version**: 1.2.0
> **Last Updated**: 2026-01-31
> **대상**: 프로젝트에 참여하는 개발자

---

## 목차

1. [시작하기](#시작하기)
2. [프로젝트 구조](#프로젝트-구조)
3. [개발 환경](#개발-환경)
4. [코딩 컨벤션](#코딩-컨벤션)
5. [주요 패턴](#주요-패턴)
6. [결제 시스템 개발](#결제-시스템-개발)
7. [보안 패턴](#보안-패턴)
8. [테스트](#테스트)
9. [Git 워크플로우](#git-워크플로우)
10. [트러블슈팅](#트러블슈팅)
11. [로깅](#로깅)
12. [유틸리티 함수](#유틸리티-함수)

---

## 시작하기

### 사전 요구사항

```bash
# Node.js 20 이상 필수
node -v  # v20.x.x

# 패키지 매니저
npm -v   # v10.x.x
```

### 초기 설정

```bash
# 1. 저장소 클론
git clone https://github.com/your-org/codegen-ai.git
cd codegen-ai

# 2. 의존성 설치
npm ci

# 3. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 열어 필요한 값 입력

# 4. Supabase 로컬 시작 (선택)
supabase start

# 5. 개발 서버 실행
npm run dev
```

### 환경 변수

```bash
# .env.local 필수 항목

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI API
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx  # 백업용

# TossPayments
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxx
TOSS_SECRET_KEY=test_sk_xxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 프로젝트 구조

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/              # 인증 라우트 그룹
│   │   ├── login/
│   │   └── register/
│   ├── (marketing)/         # 마케팅 페이지 (랜딩 등)
│   ├── (protected)/         # 인증 필요 페이지
│   │   ├── dashboard/
│   │   ├── generate/
│   │   ├── history/
│   │   ├── payment/
│   │   └── settings/
│   ├── api/                 # API Routes
│   │   ├── ai/             # AI 스트리밍
│   │   ├── auth/           # OAuth 콜백
│   │   └── webhooks/       # 외부 웹훅
│   ├── layout.tsx          # 루트 레이아웃
│   ├── providers.tsx       # 전역 프로바이더
│   └── globals.css         # 전역 스타일
│
├── actions/                  # Server Actions
│   ├── auth.ts             # 인증
│   ├── generate.ts         # 콘텐츠 생성
│   ├── payment.ts          # 크레딧 결제
│   ├── subscription.ts     # 구독 관리
│   └── ...
│
├── components/
│   ├── ui/                  # shadcn/ui 컴포넌트
│   ├── layout/              # 레이아웃 컴포넌트
│   ├── features/            # 기능별 컴포넌트
│   │   ├── auth/
│   │   ├── generate/
│   │   ├── payment/
│   │   └── ...
│   └── shared/              # 공통 컴포넌트
│
├── hooks/
│   ├── queries/             # TanStack Query 훅
│   └── use-*.ts             # 커스텀 훅
│
├── lib/
│   ├── ai/                  # AI 유틸리티
│   │   ├── providers.ts
│   │   ├── prompts.ts
│   │   └── schemas.ts
│   ├── payment/             # 결제 유틸리티
│   │   ├── toss.ts
│   │   ├── plans.ts
│   │   └── crypto.ts
│   ├── supabase/            # Supabase 클라이언트
│   │   ├── client.ts       # 브라우저용
│   │   ├── server.ts       # 서버용
│   │   └── admin.ts        # 관리자용
│   ├── validators/          # Zod 스키마
│   └── utils.ts             # 공통 유틸리티
│
├── stores/                   # Zustand 스토어
│   ├── user-store.ts
│   ├── generate-store.ts
│   └── ui-store.ts
│
├── config/                   # 설정 파일
│   ├── site.ts              # 사이트 메타데이터
│   ├── pricing.ts           # 요금제 설정
│   └── languages.ts         # 지원 언어
│
└── types/                    # TypeScript 타입
    ├── database.types.ts    # Supabase 자동 생성
    ├── payment.types.ts
    ├── domain.types.ts
    └── index.ts
```

### 주요 디렉토리 설명

| 디렉토리 | 역할 | 비고 |
|----------|------|------|
| `app/` | 라우팅 및 페이지 | App Router 사용 |
| `actions/` | Server Actions | 서버 사이드 로직 |
| `components/ui/` | UI 기본 컴포넌트 | shadcn/ui |
| `components/features/` | 기능별 컴포넌트 | 도메인 분리 |
| `lib/` | 유틸리티 | 외부 API 클라이언트 등 |
| `hooks/queries/` | 데이터 페칭 | TanStack Query |
| `stores/` | 클라이언트 상태 | Zustand |

---

## 개발 환경

### 사용 가능한 스크립트

```bash
# 개발
npm run dev              # Turbopack 개발 서버 (빠름)
npm run dev:standard     # 표준 개발 서버

# 빌드
npm run build            # 프로덕션 빌드
npm run start            # 프로덕션 서버

# 코드 품질
npm run lint             # ESLint 검사
npm run lint:fix         # ESLint 자동 수정
npm run type-check       # TypeScript 검사
npm run format           # Prettier 포맷
npm run format:check     # 포맷 검사

# 테스트
npm run test             # 단위 테스트
npm run test:watch       # 테스트 감시 모드
npm run test:coverage    # 커버리지 리포트
npm run test:e2e         # E2E 테스트 (Playwright)

# 데이터베이스
npm run db:generate      # Supabase 타입 생성
npm run db:migrate       # 마이그레이션 적용
npm run db:reset         # DB 리셋

# 기타
npm run clean            # 캐시 정리
```

### 개발 서버 접속

- **앱**: http://localhost:3000
- **Supabase Studio**: http://localhost:54323 (로컬 실행 시)

### IDE 권장 설정 (VS Code)

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

### 권장 확장 프로그램

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- ES7+ React/Redux/React-Native snippets

---

## 코딩 컨벤션

### 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 변수/함수 | camelCase | `getUserById`, `creditsRemaining` |
| 상수 | SCREAMING_SNAKE_CASE | `MAX_CREDITS_PER_DAY` |
| 컴포넌트 | PascalCase | `ContentGenerator`, `PricingCard` |
| 타입/인터페이스 | PascalCase | `User`, `GenerateContentInput` |
| 파일 (컴포넌트) | kebab-case | `content-generator.tsx` |
| 폴더 | kebab-case | `credit-transactions/` |
| Server Actions | camelCase + 동사 | `generateContent`, `purchaseCredits` |

### 파일 구조

```typescript
// 1. 외부 import
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. 내부 import (경로 별칭 사용)
import { Button } from '@/components/ui';
import { generateContent } from '@/actions/generate';
import type { ContentInput } from '@/types';

// 3. 타입 정의
interface Props {
  userId: string;
}

// 4. 컴포넌트
export function MyComponent({ userId }: Props) {
  // ...
}

// 5. 헬퍼 함수 (필요시 분리)
function formatDate(date: Date) {
  // ...
}
```

### TypeScript 규칙

```typescript
// ✅ 좋은 예
interface User {
  id: string;
  email: string;
  plan: 'starter' | 'pro' | 'team';
}

function getUser(id: string): Promise<User | null> {
  // ...
}

// ❌ 나쁜 예
function getUser(id: any): any {
  // ...
}
```

### 컴포넌트 규칙

```tsx
// ✅ Server Component (기본)
export default async function DashboardPage() {
  const data = await getData();
  return <Dashboard data={data} />;
}

// ✅ Client Component (필요시에만)
'use client';

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  // ...
}
```

### 에러 처리

```typescript
// Server Action에서
export async function myAction(input: Input): Promise<ActionResponse<Output>> {
  try {
    // 1. 입력 검증
    const validated = schema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: '입력값이 올바르지 않습니다' };
    }

    // 2. 인증 확인
    const { user } = await requireAuth();

    // 3. 비즈니스 로직
    const result = await doSomething(validated.data);

    return { success: true, data: result };
  } catch (error) {
    console.error('myAction 오류:', error);
    return { success: false, error: '처리에 실패했습니다' };
  }
}
```

---

## 주요 패턴

### Server Actions 사용

```typescript
// src/actions/example.ts
'use server';

import { createServerClient } from '@/lib/supabase/server';
import { mySchema } from '@/lib/validators/example';
import type { ActionResponse } from '@/types';

export async function myAction(
  input: unknown
): Promise<ActionResponse<{ result: string }>> {
  // 1. 입력 검증 (Zod)
  const validated = mySchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.errors[0]?.message };
  }

  // 2. 인증 확인
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: '로그인이 필요합니다' };
  }

  // 3. 비즈니스 로직
  // ...

  return { success: true, data: { result: 'ok' } };
}
```

### TanStack Query 사용

```typescript
// src/hooks/queries/use-credits.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCreditBalance, purchaseCredits } from '@/actions/credits';

export function useCredits() {
  return useQuery({
    queryKey: ['credits'],
    queryFn: async () => {
      const result = await getCreditBalance();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function usePurchaseCredits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: purchaseCredits,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
  });
}
```

### Zustand 스토어

```typescript
// src/stores/user-store.ts
import { create } from 'zustand';

interface UserState {
  plan: string;
  credits: number;
  setPlan: (plan: string) => void;
  setCredits: (credits: number) => void;
}

export const useUserStore = create<UserState>((set) => ({
  plan: 'starter',
  credits: 0,
  setPlan: (plan) => set({ plan }),
  setCredits: (credits) => set({ credits }),
}));
```

### Supabase 클라이언트 선택

```typescript
// 클라이언트 컴포넌트에서
import { createBrowserClient } from '@/lib/supabase/client';
const supabase = createBrowserClient();

// Server Actions / API Routes에서
import { createServerClient } from '@/lib/supabase/server';
const supabase = await createServerClient();

// 관리자 권한 필요시 (RLS 우회)
import { createAdminClient } from '@/lib/supabase/admin';
const adminClient = createAdminClient();
```

---

## 결제 시스템 개발

### RPC 함수를 통한 원자적 트랜잭션

결제 처리는 반드시 PostgreSQL RPC 함수를 사용하여 원자성을 보장합니다.

> **참고**: 자세한 내용은 [DB 통합 가이드](./db-integration-guide.md) 참조

```typescript
// ✅ 올바른 패턴: RPC 함수 사용
const { data: rpcResult, error: rpcError } = await adminClient.rpc(
  'confirm_credit_payment_atomic',
  {
    p_payment_id: payment.id,
    p_payment_key: paymentKey,
    p_user_id: user.id,
    p_credits_to_add: creditsToAdd,
    // ... 기타 파라미터
  }
);

// RPC 결과 확인 (배열로 반환됨)
const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
if (!result?.success) {
  return { success: false, error: result?.error_message };
}

// ❌ 잘못된 패턴: 개별 쿼리 사용 (트랜잭션 보장 안됨)
await supabase.from('payments').update({ status: 'completed' });
await supabase.from('credit_transactions').insert({ ... }); // 여기서 실패하면?
```

### 사용 가능한 RPC 함수

| 함수 | 용도 | 처리 내용 |
|------|------|----------|
| `confirm_credit_payment_atomic` | 크레딧 결제 | 결제 완료 + 크레딧 추가 + 잔액 업데이트 |
| `confirm_subscription_atomic` | 구독 결제 | 결제 완료 + 구독 생성 + 프로필 업데이트 |
| `renew_subscription_atomic` | 구독 갱신 | 결제 완료 + 구독 기간 연장 |
| `process_refund_atomic` | 환불 처리 | 결제 환불 + 크레딧 차감 + 상태 업데이트 |
| `execute_plan_change_atomic` | 플랜 변경 | 프로레이션 계산 + 구독 업데이트 |

### 웹훅 멱등성 처리

토스페이먼츠 웹훅은 중복 호출될 수 있으므로 멱등성 키로 처리합니다.

```typescript
// 멱등성 키 생성 (SHA-256)
function generateIdempotencyKey(paymentKey: string, eventType: string): string {
  const data = `${paymentKey}:${eventType}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// INSERT ON CONFLICT DO NOTHING 패턴
const { data: idempotencyRecord, error: insertError } = await adminClient
  .from('webhook_idempotency')
  .insert({
    idempotency_key: idempotencyKey,
    webhook_type: eventType,
    payment_key: paymentKey,
    processed_at: new Date().toISOString(),
  })
  .select()
  .single();

// 이미 처리된 웹훅이면 중복 코드 반환
if (insertError?.code === '23505') {
  return new Response(JSON.stringify({ resultCode: 'DUPLICATE' }), {
    status: 200,
  });
}
```

### Rate Limiting

API 호출 시 Rate Limit 에러 처리:

```typescript
// Rate Limit 에러 확인
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('RATE_LIMIT') ||
           error.message.includes('Too many requests');
  }
  return false;
}

// Exponential Backoff with Jitter
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRateLimitError(error) || i === maxRetries - 1) throw error;
      const delay = Math.min(1000 * 2 ** i, 10000) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 프로레이션 계산

플랜 변경 시 일할 계산:

```typescript
// 남은 기간에 대한 크레딧 계산
const remainingDays = Math.ceil(
  (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
);
const totalDays = Math.ceil(
  (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
);
const unusedRatio = remainingDays / totalDays;
const currentPlanCredit = currentPrice * unusedRatio;

// 새 플랜 비용에서 크레딧 차감
const amountDue = Math.max(0, newPrice - currentPlanCredit);
```

---

## 보안 패턴

### 웹훅 서명 검증

```typescript
// 토스페이먼츠 웹훅 서명 검증
function verifyTossWebhookSignature(
  payload: string,
  signature: string,
  secretKey: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// 웹훅 핸들러에서 사용
const signature = request.headers.get('Toss-Signature');
if (!verifyTossWebhookSignature(body, signature, TOSS_WEBHOOK_SECRET)) {
  return new Response('Invalid signature', { status: 401 });
}
```

### 빌링키 암호화

빌링키는 AES-256-GCM으로 암호화하여 저장합니다.

```typescript
// 암호화 (저장 시)
import { encryptBillingKey } from '@/lib/payment/crypto';

const encryptedBillingKey = encryptBillingKey(billingKey);
await adminClient.from('billing_keys').insert({
  encrypted_billing_key: encryptedBillingKey,
  // ...
});

// 복호화 (사용 시)
import { decryptBillingKey } from '@/lib/payment/crypto';

const decryptedBillingKey = decryptBillingKey(encryptedBillingKey);
```

> **주의**: `BILLING_KEY_ENCRYPTION_KEY` 환경 변수는 반드시 32자 이상의 무작위 문자열이어야 합니다.

### CSRF 보호

결제 요청에는 CSRF 토큰 검증을 적용합니다.

```typescript
// CSRF 토큰 생성 (서버)
import { generateCsrfToken, verifyCsrfToken } from '@/lib/csrf';

// API 엔드포인트
export async function GET() {
  const token = generateCsrfToken();
  return Response.json({ csrfToken: token });
}

// Server Action에서 검증
export async function paymentAction(formData: FormData) {
  const csrfToken = formData.get('csrfToken') as string;
  if (!verifyCsrfToken(csrfToken)) {
    return { success: false, error: '유효하지 않은 요청입니다' };
  }
  // ...
}
```

### 입력 검증

모든 사용자 입력은 Zod 스키마로 검증합니다.

```typescript
// src/lib/validators/payment.ts
import { z } from 'zod';

export const purchaseCreditsSchema = z.object({
  packageType: z.enum(['BASIC', 'STANDARD', 'PREMIUM']),
  paymentKey: z.string().min(1, '결제 키가 필요합니다'),
  orderId: z.string().min(1, '주문 ID가 필요합니다'),
  amount: z.number().positive('금액은 양수여야 합니다'),
});

// Server Action에서 사용
const validated = purchaseCreditsSchema.safeParse(input);
if (!validated.success) {
  return {
    success: false,
    error: validated.error.errors[0]?.message || '입력값이 올바르지 않습니다'
  };
}
```

---

## 테스트

### 단위 테스트 (Vitest)

```bash
# 테스트 실행
npm run test

# 특정 파일 테스트
npm run test -- src/lib/payment/plans.test.ts

# 감시 모드
npm run test:watch
```

```typescript
// src/lib/payment/plans.test.ts
import { describe, it, expect } from 'vitest';
import { getPlanPrice, getDailyLimitByPlan } from './plans';

describe('getPlanPrice', () => {
  it('pro 월간 요금을 반환한다', () => {
    expect(getPlanPrice('pro', 'monthly')).toBe(29900);
  });

  it('starter는 0원이다', () => {
    expect(getPlanPrice('starter', 'monthly')).toBe(0);
  });
});
```

### E2E 테스트 (Playwright)

```bash
# E2E 테스트 실행
npm run test:e2e

# 특정 테스트 파일
npx playwright test tests/e2e/auth.spec.ts

# UI 모드
npx playwright test --ui
```

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('로그인 성공', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/dashboard');
});
```

### 테스트 구조

```
tests/
├── unit/                    # 단위 테스트
│   ├── lib/
│   └── components/
├── e2e/                     # E2E 테스트
│   ├── auth.spec.ts
│   ├── generate.spec.ts
│   └── payment.spec.ts
└── fixtures/                # 테스트 데이터
```

---

## Git 워크플로우

### 브랜치 전략

```
main                        # 프로덕션
├── develop                  # 개발 통합
│   ├── feature/xxx         # 기능 개발
│   ├── fix/xxx             # 버그 수정
│   └── refactor/xxx        # 리팩토링
└── release/x.x.x           # 릴리스 준비
```

### 커밋 메시지

```bash
# 형식
<type>(<scope>): <subject>

# 타입
feat:     새 기능
fix:      버그 수정
docs:     문서 변경
style:    코드 포맷팅 (동작 변경 없음)
refactor: 리팩토링 (기능 변경 없음)
test:     테스트 추가/수정
chore:    빌드, 설정 등

# 예시
feat(payment): 구독 취소 기능 추가
fix(auth): 로그인 실패 시 에러 메시지 미표시 수정
docs: 개발 가이드 문서 추가
```

### Pull Request

1. **브랜치 생성**: `git checkout -b feature/my-feature`
2. **작업 및 커밋**: 작은 단위로 자주 커밋
3. **푸시**: `git push origin feature/my-feature`
4. **PR 생성**: GitHub에서 PR 생성
5. **리뷰**: 최소 1명 승인 필요
6. **머지**: Squash and merge 권장

### CI/CD

PR 생성 시 자동 실행:
- ESLint
- TypeScript 검사
- 단위 테스트
- 빌드 검증

---

## 트러블슈팅

### 일반적인 문제

#### 캐시 문제

```bash
# Next.js 캐시 정리
npm run clean
# 또는
rm -rf .next node_modules/.cache
```

#### 타입 에러

```bash
# TypeScript 검사
npm run type-check

# Supabase 타입 재생성
npm run db:generate
```

#### 의존성 문제

```bash
# 완전 재설치
rm -rf node_modules package-lock.json
npm install
```

### Supabase 관련

```bash
# Supabase 상태 확인
supabase status

# 로컬 DB 리셋
supabase db reset

# 마이그레이션 적용
npm run db:migrate
```

### 환경 변수 문제

```bash
# 환경 변수 확인 (개발 서버 재시작 필요)
echo $NEXT_PUBLIC_SUPABASE_URL

# Vercel 환경 변수 동기화
vercel env pull .env.local
```

### 포트 충돌

```bash
# 사용 중인 포트 확인 (Windows)
netstat -ano | findstr :3000

# 다른 포트로 실행
npm run dev -- -p 3001
```

---

## 로깅

### 보안 로거 사용

프로젝트에서는 민감 정보를 자동으로 마스킹하는 보안 로거를 사용합니다.

```typescript
// src/lib/logger.ts
import { logInfo, logWarn, logError, sanitizeForLogging } from '@/lib/logger';

// 정보 로깅
logInfo('결제 처리 시작', { userId: user.id, action: 'payment_start' });

// 경고 로깅
logWarn('Rate limit 임계값 도달', { userId: user.id, action: 'rate_limit' });

// 에러 로깅 (error 객체와 함께)
logError('결제 실패', error, { userId: user.id, orderId: 'ORD_xxx' });
```

### 자동 민감 정보 마스킹

로거는 다음 필드를 자동으로 `[REDACTED]`로 마스킹합니다:

- 인증 정보: `password`, `secret`, `token`, `apiKey`
- 결제 정보: `billingKey`, `paymentKey`, `cardNumber`, `cvv`
- 사용자 식별: `customerKey`, `authKey`

```typescript
// 입력
logInfo('웹훅 수신', {
  paymentKey: 'pk_live_xxx123',
  customerKey: 'ck_user_456',
  amount: 29900,
});

// 출력
// [2026-01-31T...] INFO: 웹훅 수신 | context: {"paymentKey":"[REDACTED]","customerKey":"[REDACTED]","amount":29900}
```

### 환경별 출력 형식

| 환경 | 형식 | 예시 |
|------|------|------|
| development | 가독성 있는 텍스트 | `[timestamp] LEVEL: message \| context: {...}` |
| production | JSON (Vercel 로그 호환) | `{"timestamp":"...","level":"info","message":"..."}` |

### 로깅 컨텍스트 표준

```typescript
interface LogContext {
  userId?: string;        // 사용자 ID
  action?: string;        // 액션 식별자 (예: 'payment_confirm', 'webhook_toss')
  orderId?: string;       // 주문 ID
  paymentId?: string;     // 결제 ID
  subscriptionId?: string; // 구독 ID
  [key: string]: unknown; // 추가 컨텍스트
}

// 사용 예시
logInfo('구독 생성 완료', {
  action: 'subscription_create',
  userId: user.id,
  subscriptionId: subscription.id,
  plan: 'pro',
});
```

### 웹훅 페이로드 로깅

웹훅 페이로드를 로깅할 때는 `sanitizeForLogging`을 사용합니다:

```typescript
import { sanitizeForLogging } from '@/lib/logger';

// 원본 페이로드의 민감 정보를 마스킹하여 로깅
const safePayload = sanitizeForLogging(webhookPayload);
logInfo('웹훅 페이로드', { action: 'webhook_received', payload: safePayload });
```

---

## 유틸리티 함수

### parseRpcResult - RPC 결과 파싱

PostgreSQL RPC 함수의 결과를 일관되게 파싱하는 유틸리티입니다.

```typescript
// src/lib/supabase/helpers.ts
import { parseRpcResult, type RpcResultBase } from '@/lib/supabase/helpers';

// RPC 결과 확장 타입 정의
interface CreditRpcResult extends RpcResultBase {
  new_balance: number;
}

// 사용 예시
const { data: rpcResult, error: rpcError } = await adminClient.rpc(
  'use_credit_atomic',
  { p_user_id: userId, p_amount: 1 }
);

if (rpcError) {
  logError('RPC 오류', rpcError, { action: 'use_credit' });
  return { success: false, error: 'DB 처리에 실패했습니다' };
}

// RPC 결과 파싱 (배열/단일 객체 모두 처리)
const parsed = parseRpcResult<CreditRpcResult>(rpcResult);
if (!parsed.success) {
  return { success: false, error: parsed.error };
}

return { success: true, newBalance: parsed.data.new_balance };
```

### mapTossErrorToUserMessage - 토스 에러 메시지 변환

토스페이먼츠 API 에러 코드를 사용자 친화적인 한국어 메시지로 변환합니다.

```typescript
// src/lib/payment/toss.ts
import { mapTossErrorToUserMessage, PaymentError } from '@/lib/payment/toss';

try {
  await tossClient.confirmPayment(paymentKey, orderId, amount);
} catch (error) {
  if (error instanceof PaymentError) {
    // 내부 에러 코드를 사용자 메시지로 변환
    const userMessage = mapTossErrorToUserMessage(error.code);
    return { success: false, error: userMessage };
  }
  throw error;
}
```

### 지원하는 에러 코드

| 에러 코드 | 사용자 메시지 |
|----------|-------------|
| `INVALID_CARD_NUMBER` | 카드 번호가 올바르지 않습니다. |
| `CARD_LIMIT_EXCEEDED` | 카드 한도가 초과되었습니다. |
| `CARD_EXPIRED` | 카드가 만료되었습니다. |
| `INVALID_CARD_EXPIRY` | 카드 유효기간이 올바르지 않습니다. |
| `INVALID_CARD_CVV` | 카드 보안 코드가 올바르지 않습니다. |
| `NOT_ENOUGH_BALANCE` | 잔액이 부족합니다. |
| `CARD_INSTALLMENT_NOT_ALLOWED` | 할부가 지원되지 않는 카드입니다. |
| `PAYMENT_CANCELED` | 결제가 취소되었습니다. |
| `ALREADY_CANCELED_PAYMENT` | 이미 취소된 결제입니다. |
| `ALREADY_REFUNDED_PAYMENT` | 이미 환불된 결제입니다. |
| `INVALID_AMOUNT` | 결제 금액이 올바르지 않습니다. |
| `EXCEED_MAX_AMOUNT` | 최대 결제 금액을 초과했습니다. |
| `BELOW_MIN_AMOUNT` | 최소 결제 금액보다 작습니다. |
| `CARD_RESTRICTED` | 사용이 제한된 카드입니다. |
| `CARD_LOST_OR_STOLEN` | 분실 또는 도난 신고된 카드입니다. |
| `INVALID_PASSWORD` | 비밀번호가 올바르지 않습니다. |
| `NETWORK_ERROR` | 네트워크 오류가 발생했습니다. |
| `BILLING_KEY_EXPIRED` | 등록된 결제 수단이 만료되었습니다. |
| `BILLING_KEY_NOT_FOUND` | 등록된 결제 수단을 찾을 수 없습니다. |
| (기타) | 결제 처리 중 오류가 발생했습니다. |

### normalizeJoinResult - 조인 결과 정규화

Supabase의 `!inner` 조인 결과가 배열 또는 단일 객체로 반환될 때 일관되게 처리합니다.

```typescript
// src/lib/supabase/helpers.ts
import { normalizeJoinResult } from '@/lib/supabase/helpers';

// Supabase 조인 쿼리
const { data, error } = await supabase
  .from('subscriptions')
  .select('*, profiles!inner(*)')
  .eq('id', subscriptionId)
  .single();

// 조인 결과 정규화 (배열이면 첫 번째 요소, 아니면 그대로)
const profile = normalizeJoinResult<Profile>(data?.profiles);
if (!profile) {
  return { success: false, error: '프로필을 찾을 수 없습니다' };
}
```

### 관리자 알림 - Admin Alert

결제 실패, 환불 동기화 오류 등 중요 이벤트 발생 시 관리자에게 알림을 보냅니다.

```typescript
// src/lib/notification/admin-alert.ts
import { alertAdminAsync, alertRefundSyncFailed } from '@/lib/notification/admin-alert';

// 일반 관리자 알림 (비동기, 블로킹하지 않음)
alertAdminAsync({
  title: '결제 실패',
  message: '빌링키 결제가 3회 연속 실패했습니다.',
  severity: 'high',
  context: { userId, subscriptionId },
});

// 환불 동기화 실패 알림 (편의 함수)
alertRefundSyncFailed(paymentId, userId, error);
```

> **설정**: `SLACK_ADMIN_WEBHOOK_URL` 환경 변수를 설정하면 Slack으로 알림이 전송됩니다.

---

## 추가 리소스

### 공식 문서

- [Next.js 16](https://nextjs.org/docs)
- [React 19](https://react.dev)
- [Supabase](https://supabase.com/docs)
- [TanStack Query](https://tanstack.com/query/latest)
- [Zustand](https://zustand-demo.pmnd.rs)
- [TossPayments](https://docs.tosspayments.com)

### 프로젝트 문서

- [CLAUDE.md](../CLAUDE.md) - 프로젝트 컨텍스트
- [배포 가이드](./deployment.md)
- [결제 API 문서](./api/payment.md)
- [환불 정책](./refund-policy.md)
- [DB 통합 가이드](./db-integration-guide.md) - RPC 함수 사용법
- [코드 리뷰](./code-review-payment-system-2026-01-30.md) - 결제 시스템 리뷰

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.2.0 | 2026-01-31 | 로깅 섹션 추가, 유틸리티 함수(parseRpcResult, mapTossErrorToUserMessage, normalizeJoinResult) 문서화, 관리자 알림 문서 추가 |
| 1.1.0 | 2026-01-30 | 결제 시스템 개발 섹션 추가, 보안 패턴 섹션 추가 |
| 1.0.0 | 2026-01-29 | 최초 작성 |

---

*마지막 업데이트: 2026-01-31*
