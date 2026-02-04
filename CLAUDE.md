# CLAUDE.md

> **Version**: 1.1.0
> **Last Updated**: 2026-01-28
> **Compatibility**: Claude Code CLI (Opus 4.5) + SuperClaude Framework

이 문서는 Claude Code가 CodeGen AI 프로젝트에서 최적의 성능을 발휘하도록 설계된 종합 가이드입니다.

---

## 2026 최신 기능 및 트렌드

### Next.js 16 + React 19 핵심 변경사항

```yaml
Next.js 16 주요 기능:
  - Partial Prerendering (PPR): 정적/동적 콘텐츠 하이브리드 렌더링
  - Enhanced Caching: fetch() 기본 no-store, 명시적 캐싱 전략
  - Turbopack 안정화: 개발 서버 속도 10x 향상
  - Server Actions 강화: 'use server' 최적화
  - Instrumentation Hook: 앱 라이프사이클 제어

React 19 주요 기능:
  - use() Hook: 프로미스/컨텍스트 직접 읽기
  - Server Components (RSC): 기본 렌더링 방식
  - Actions: 폼 처리 혁신 (useFormStatus, useActionState, useOptimistic)
  - Document Metadata: title, meta 컴포넌트 내 직접 선언
  - Asset Loading: 이미지/스크립트 프리로딩 내장

마이그레이션 참고:
  - params/searchParams: Promise로 변경 (async 필수)
  - cookies(): await 필수
  - fetch 캐싱: 기본값 no-store (명시적 cache 설정 권장)
```

### Claude Code + SuperClaude 통합

```yaml
Plan Mode (계획 모드):
  진입: EnterPlanMode
  작업: 코드베이스 탐색 (Glob, Grep, Read만 허용)
  승인: ExitPlanMode → 사용자 승인 후 실행

Task 관리 시스템:
  TaskCreate: 새 작업 생성 (subject, description, activeForm)
  TaskUpdate: 상태 변경 (pending → in_progress → completed)
  TaskList: 전체 작업 목록 조회
  TaskGet: 작업 상세 조회

Skill 시스템 (슬래시 명령어):
  sc:analyze   - 코드 품질/보안/성능 분석
  sc:build     - 프로젝트 빌드 및 패키징
  sc:implement - 기능 구현 (MCP 통합)
  sc:improve   - 코드 품질/성능 개선
  sc:test      - 테스트 실행 및 커버리지
  sc:git       - Git 작업 관리
  sc:document  - 문서화
  sc:cleanup   - 데드 코드 제거
  sc:troubleshoot - 문제 진단

SuperClaude 플래그 활용:
  --think: 모듈 수준 분석 (~4K tokens)
  --think-hard: 시스템 수준 분석 (~10K tokens)
  --ultrathink: 전체 아키텍처 분석 (~32K tokens)
  --uc: 토큰 최적화 압축 모드
  --validate: 사전 검증 및 리스크 평가
  --safe-mode: 보수적 실행 (프로덕션 권장)
```

---

## Table of Contents

1. [Core Directives](#core-directives)
2. [Project Context](#project-context)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Database Schema](#database-schema)
6. [Development Standards](#development-standards)
7. [AI Content Generation](#ai-content-generation)
8. [Payment System (TossPayments)](#payment-system-tosspayments)
9. [Security Guidelines](#security-guidelines)
10. [Troubleshooting](#troubleshooting)
11. [Multi-Terminal Session Strategy](#multi-terminal-session-strategy-병렬-작업-전략)

---

## Core Directives

### Immutable Rules (절대 규칙)

```yaml
MUST:
  - 모든 응답과 설명은 한국어로 작성
  - 복잡한 작업 전 EnterPlanMode로 계획 수립 → 사용자 승인 → 실행
  - 파일 수정 전 반드시 Read 도구로 내용 확인
  - 단일 책임 원칙: 한 번에 하나의 작업만 수행 (in_progress 1개)
  - 변경 전 기존 코드 컨텍스트 완전 파악
  - 모든 새 기능에 타입 정의 선행
  - 3개 이상 단계 작업 시 TaskCreate로 작업 목록 생성
  - Next.js 16 패턴 준수 (async params, 명시적 캐싱)
  - React 19 Server Components 우선 사용
  - 에러 발생 시 사용자 친화적 한국어 메시지 제공
  - AI API 호출 시 반드시 폴백 전략 구현
  - 결제 관련 코드는 보안 검증 필수

MUST_NOT:
  - any 타입 사용 금지 (unknown 또는 명시적 타입 사용)
  - Read 없이 Edit/Write 수행 금지
  - 사용자 요청 없이 자동 커밋 금지
  - 테스트 없는 프로덕션 배포 금지
  - 하드코딩된 시크릿/API 키 금지
  - console.log 프로덕션 코드 잔류 금지
  - 파괴적 Git 명령어 (--force, --hard) 무단 사용 금지
  - 'use client' 불필요한 남용 금지 (RSC 우선)
  - 결제 금액 클라이언트 사이드 검증만 의존 금지
  - 빌링키/시크릿키 클라이언트 노출 금지

SHOULD:
  - 복잡한 로직에 주석 작성 (한국어 허용)
  - 재사용 가능한 유틸리티 함수 추출
  - 성능 임계점 초과 시 최적화 제안
  - 병렬 가능한 독립 작업은 동시 실행
  - Server Actions 활용으로 API Route 최소화
  - SuperClaude 플래그 적극 활용 (--think, --validate)
```

### Response Protocol (응답 프로토콜)

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: UNDERSTAND (이해)                                  │
│  ├── 요청사항 명확화 (AskUserQuestion 활용)                     │
│  ├── 영향 범위 분석 (Task/Explore 에이전트)                     │
│  └── 필요 리소스 파악                                          │
├─────────────────────────────────────────────────────────────┤
│  Phase 2: PLAN (계획) - 복잡한 작업 시                          │
│  ├── EnterPlanMode 진입                                       │
│  ├── 코드베이스 탐색 (Glob, Grep, Read)                         │
│  ├── 단계별 실행 계획 수립                                      │
│  └── ExitPlanMode로 사용자 승인 요청                           │
├─────────────────────────────────────────────────────────────┤
│  Phase 3: EXECUTE (실행)                                     │
│  ├── TaskCreate로 작업 목록 생성 (3+ 단계 시)                   │
│  ├── TaskUpdate로 진행 상태 추적                               │
│  ├── Server Actions 패턴 우선 적용                             │
│  └── 예상치 못한 상황 발생 시 즉시 보고                          │
├─────────────────────────────────────────────────────────────┤
│  Phase 4: VERIFY (검증)                                      │
│  ├── 결과물 품질 확인 (타입 체크, 린트)                          │
│  ├── TaskUpdate로 완료 상태 표시                               │
│  └── 다음 단계 안내                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Context

### Project Identity

```yaml
Name: CodeGen AI
Purpose: AI 기반 코딩 교육 콘텐츠 자동 생성기
Domain: Education, AI Content Generation, SaaS
Stage: Development (Phase 1)
Version: 0.1.0

Tagline: "10분 안에 실무형 코딩 교육 콘텐츠 완성"

Target Users:
  Primary:
    - 성인 학습자 대상 코딩 강사
    - 기업 개발 교육 담당자 (HRD)
    - 부트캠프 운영자
  Secondary:
    - 개인 콘텐츠 크리에이터
    - 기업 내 기술 문서 작성자
```

### User Personas

```
┌─────────────────────────────────────────────────────────────────────┐
│                    성인 코딩 학습자 4대 페르소나                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [A: 비전공 직장인]        [B: 주니어 개발자]                          │
│  ├─ 마케팅, 기획, 영업     ├─ 전공자/부트캠프 수료                     │
│  ├─ 업무 자동화, 분석 목표  ├─ 신기술 습득, 실무 강화                   │
│  └─ 비유: 엑셀, 업무 도구   └─ 비유: 언어 비교, 아키텍처                │
│                                                                     │
│  [C: 관리자/임원]          [D: 커리어 전환자]                          │
│  ├─ PM, CTO, 창업자        ├─ 타 업종 경력자                          │
│  ├─ 기술 이해, 팀 소통     ├─ 개발자 취업, 포트폴리오                  │
│  └─ 비유: 조직, 경영       └─ 비유: 범용 (요리, 건축)                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Supported Programming Languages

| 우선순위 | 언어 | 타겟 | 비유 도메인 |
|---------|------|------|-----------|
| **P0** | Python | 비전공자, 데이터 분석 | 엑셀, 업무 자동화 |
| **P0** | JavaScript | 웹 개발 입문 | 웹페이지, 인터랙션 |
| **P1** | SQL | 기획자, 마케터 | 엑셀 필터, 피벗 |
| **P1** | Java | 기업 개발자 | 설계도, 공장 |
| **P2** | TypeScript | 주니어 개발자 | JS + 계약서 |
| **P2** | Go | 백엔드 개발자 | 효율적 공장 |

### Pricing Plans

```yaml
Starter (무료):
  - 10회/일 생성
  - Python만 지원
  - 기본 기능

Pro (₩29,900/월 | 연 ₩299,000):
  - 100회/일 생성
  - 전체 언어 지원
  - PDF 내보내기
  - 히스토리 30일

Team (₩99,000/월 | 연 ₩990,000):
  - 500회/일 생성
  - API 제공
  - 히스토리 무제한
  - 5명 계정

Enterprise (문의):
  - 무제한 생성
  - 온프레미스 배포
  - 전용 지원
```

---

## Tech Stack

```yaml
Layer: Frontend
  Runtime: Next.js 16.x (App Router + PPR)
  Language: TypeScript 5.x (strict mode)
  Styling: Tailwind CSS 4.x
  Components: shadcn/ui + Radix UI
  State: Zustand (클라이언트) / TanStack Query v5 (서버)
  Forms: React Hook Form + Zod
  React: v19 (RSC, Actions, use())

Layer: Backend
  Framework: Next.js Server Actions (주) + API Routes (웹훅용)
  Database: Supabase (PostgreSQL + Auth + Storage)
  Auth: Supabase Auth (Email/Password + OAuth)
  Storage: Supabase Storage

Layer: AI Integration
  SDK: Vercel AI SDK 4.x
  Primary: Anthropic Claude (claude-sonnet-4)
  Secondary: OpenAI (gpt-4o-mini)
  Patterns: Streaming, Structured Output (Zod schema)

Layer: Payment
  PG: TossPayments (토스페이먼츠)
  Types: 단건결제 (크레딧), 정기결제 (구독)
  SDK: @tosspayments/payment-sdk

Layer: Infrastructure
  Hosting: Vercel
  Database: Supabase (PostgreSQL)
  Monitoring: Vercel Analytics
  Error Tracking: Sentry
  CI/CD: GitHub Actions
```

---

## Architecture

### Directory Structure

```
project-root/
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── public/
│   └── images/
│
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (protected)/
│   │   │   ├── dashboard/
│   │   │   ├── generate/          # 콘텐츠 생성 페이지
│   │   │   ├── history/           # 생성 히스토리
│   │   │   ├── settings/
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (marketing)/
│   │   │   ├── page.tsx           # 랜딩 페이지
│   │   │   ├── pricing/
│   │   │   └── layout.tsx
│   │   │
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/route.ts
│   │   │   ├── webhook/
│   │   │   │   └── toss/route.ts
│   │   │   └── ai/
│   │   │       └── stream/route.ts
│   │   │
│   │   ├── payment/
│   │   │   ├── subscribe/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── success/page.tsx
│   │   │   │   └── fail/page.tsx
│   │   │   └── credits/
│   │   │       └── page.tsx
│   │   │
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── error.tsx
│   │   └── not-found.tsx
│   │
│   ├── actions/
│   │   ├── auth.ts
│   │   ├── content.ts            # AI 콘텐츠 생성
│   │   ├── payment.ts
│   │   ├── subscription.ts
│   │   └── user.ts
│   │
│   ├── components/
│   │   ├── ui/                   # shadcn/ui
│   │   ├── layout/
│   │   ├── features/
│   │   │   ├── generator/        # 콘텐츠 생성 UI
│   │   │   ├── payment/
│   │   │   └── dashboard/
│   │   └── shared/
│   │
│   ├── hooks/
│   │   ├── use-credits.ts
│   │   └── use-subscription.ts
│   │
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── providers.ts
│   │   │   ├── prompts.ts        # 프롬프트 템플릿
│   │   │   └── schemas.ts        # Zod 스키마
│   │   ├── supabase/
│   │   │   ├── client.ts         # 브라우저 클라이언트
│   │   │   ├── server.ts         # 서버 클라이언트
│   │   │   ├── admin.ts          # 관리자 클라이언트
│   │   │   └── middleware.ts
│   │   ├── payment/
│   │   │   ├── toss.ts           # 토스페이먼츠 클라이언트
│   │   │   └── plans.ts
│   │   ├── cn.ts                 # Tailwind 클래스 병합
│   │   └── validators/
│   │
│   ├── types/
│   │   ├── content.ts
│   │   ├── payment.ts
│   │   └── index.ts
│   │
│   └── styles/
│       └── globals.css
│
├── .env.example
├── .env.local
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── CLAUDE.md
```

---

## Database Schema

### Core Tables (Supabase)

```sql
-- Supabase 타입 정의는 src/types/database.types.ts에서 관리

-- ─────────────────────────────────────────────────────────
-- profiles (사용자 프로필)
-- ─────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'team', 'enterprise')),
  daily_generations_remaining INTEGER DEFAULT 10,
  daily_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- generated_contents (생성된 콘텐츠)
-- ─────────────────────────────────────────────────────────
CREATE TABLE generated_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  code_examples JSONB,
  quiz JSONB,
  model_used TEXT,
  tokens_used INTEGER,
  generation_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- TypeScript 타입 (src/types/database.types.ts)
-- ─────────────────────────────────────────────────────────
-- Profile: id, email, name, plan, daily_generations_remaining, daily_reset_at
-- GeneratedContent: id, user_id, language, topic, difficulty, target_audience,
--                   title, content, code_examples, quiz, model_used, tokens_used,
--                   generation_time_ms, created_at
```

---

## Development Standards

### Naming Conventions

| 대상 | 규칙 | 예시 |
|------|------|------|
| **변수/함수** | camelCase | `getUserById`, `creditsRemaining` |
| **상수** | SCREAMING_SNAKE_CASE | `MAX_CREDITS_PER_DAY` |
| **컴포넌트** | PascalCase | `ContentGenerator`, `PricingCard` |
| **타입/인터페이스** | PascalCase | `User`, `GenerateContentInput` |
| **파일 (컴포넌트)** | kebab-case | `content-generator.tsx` |
| **폴더** | kebab-case | `credit-transactions/` |
| **Server Actions** | camelCase + 동사 | `generateContent`, `purchaseCredits` |
| **DB 테이블** | snake_case | `generated_contents` |
| **DB 컬럼** | snake_case | `credits_remaining` |

### TypeScript Patterns

```typescript
// 1. 브랜드 타입
type Brand<T, B> = T & { readonly __brand: B };
type UserId = Brand<string, 'UserId'>;
type ContentId = Brand<string, 'ContentId'>;

// 2. Result 패턴
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// 3. Server Action 반환 타입
type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};
```

---

## AI Content Generation

### Prompt System

```typescript
// src/lib/ai/prompts.ts

export const CONTENT_SYSTEM_PROMPT = `당신은 성인 학습자를 위한 전문 코딩 교육 콘텐츠 작성자입니다.

## 핵심 원칙
1. **비유 활용**: 타겟 학습자의 경험 도메인과 연결
   - 비전공자 → 엑셀, 업무 자동화
   - 관리자 → 조직, 프로세스
   - 커리어 전환자 → 요리, 건축 등 범용 비유

2. **실무 중심**: 현업에서 바로 쓸 수 있는 예제
3. **단계적 설명**: 개념 → 비유 → 코드 → 실습
4. **코드 검증**: 모든 코드는 실행 가능해야 함

## 출력 형식
- 마크다운 형식
- 코드 블록에 언어 명시
- 한국어 설명, 영어 코드/주석
`;

export const createContentPrompt = (params: {
  language: string;
  topic: string;
  difficulty: string;
  targetLevel: string;
}) => `
## 요청
${params.language}로 "${params.topic}" 주제의 교육 콘텐츠를 작성해주세요.

**난이도**: ${params.difficulty}
**대상**: ${params.targetLevel}

## 출력
1. 제목 (SEO 최적화)
2. 학습 목표 (3-5개)
3. 핵심 개념 설명 (비유 포함)
4. 예제 코드 (주석 포함)
5. 연습 문제 (3개)
6. 핵심 요약
`;
```

### Content Generation Action

```typescript
// src/actions/content.ts

'use server';

import { streamText, generateObject } from 'ai';
import { createStreamableValue } from 'ai/rsc';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { CONTENT_SYSTEM_PROMPT, createContentPrompt } from '@/lib/ai/prompts';

const generateContentSchema = z.object({
  language: z.enum(['PYTHON', 'JAVASCRIPT', 'SQL', 'JAVA', 'TYPESCRIPT', 'GO']),
  topic: z.string().min(2).max(200),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  targetLevel: z.enum(['NON_DEVELOPER', 'JUNIOR', 'MANAGER', 'CAREER_CHANGER']),
});

export async function generateContent(
  input: z.infer<typeof generateContentSchema>
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: '로그인이 필요합니다' };
  }

  // 크레딧 확인
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { creditsRemaining: true },
  });

  if (!user || user.creditsRemaining <= 0) {
    return { success: false, error: '크레딧이 부족합니다' };
  }

  const prompt = createContentPrompt(input);
  const stream = createStreamableValue('');

  (async () => {
    try {
      const { textStream } = streamText({
        model: anthropic('claude-sonnet-4-20250514'),
        system: CONTENT_SYSTEM_PROMPT,
        prompt,
        maxTokens: 4000,
        temperature: 0.7,
      });

      for await (const chunk of textStream) {
        stream.update(chunk);
      }

      // 크레딧 차감
      await db.user.update({
        where: { id: session.user.id },
        data: { creditsRemaining: { decrement: 1 } },
      });
    } catch (error) {
      stream.error('콘텐츠 생성에 실패했습니다');
    } finally {
      stream.done();
    }
  })();

  return { success: true, output: stream.value };
}
```

---

## Payment System (TossPayments)

### Environment Variables

```bash
# .env.local

# TossPayments
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxx  # 클라이언트 키 (공개)
TOSS_SECRET_KEY=test_sk_xxx              # 시크릿 키 (서버만!)

# 빌링키 암호화
BILLING_KEY_ENCRYPTION_KEY=32-char-encryption-key

# 웹훅 검증
TOSS_WEBHOOK_SECRET=webhook-secret
```

### TossPayments Client

```typescript
// src/lib/payment/toss.ts

const TOSS_API_URL = 'https://api.tosspayments.com/v1';

export class TossPaymentsClient {
  private authHeader: string;

  constructor(secretKey: string) {
    this.authHeader = Buffer.from(`${secretKey}:`).toString('base64');
  }

  async confirmPayment(paymentKey: string, orderId: string, amount: number) {
    const response = await fetch(`${TOSS_API_URL}/payments/confirm`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new PaymentError(error.code, error.message);
    }

    return response.json();
  }

  async issueBillingKey(authKey: string, customerKey: string) {
    const response = await fetch(
      `${TOSS_API_URL}/billing/authorizations/issue`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${this.authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ authKey, customerKey }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new PaymentError(error.code, error.message);
    }

    return response.json();
  }

  async chargeBilling(
    billingKey: string,
    customerKey: string,
    amount: number,
    orderId: string,
    orderName: string
  ) {
    const response = await fetch(`${TOSS_API_URL}/billing/${billingKey}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerKey,
        amount,
        orderId,
        orderName,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new PaymentError(error.code, error.message);
    }

    return response.json();
  }
}

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

### Pricing Constants

```typescript
// src/lib/payment/plans.ts

export const PLANS = {
  PRO: {
    monthly: { amount: 29900, credits: 100 },
    yearly: { amount: 299000, credits: 100 },
  },
  TEAM: {
    monthly: { amount: 99000, credits: 500 },
    yearly: { amount: 990000, credits: 500 },
  },
} as const;

export const CREDIT_PACKAGES = {
  BASIC: { amount: 9900, credits: 50, validDays: 90 },
  STANDARD: { amount: 24900, credits: 150, validDays: 90 },
  PREMIUM: { amount: 49900, credits: 350, validDays: 180 },
} as const;
```

---

## Security Guidelines

### Security Checklist

```yaml
결제 보안:
  - 시크릿 키 서버 사이드만 저장 (환경변수)
  - 클라이언트에 시크릿 키 노출 금지
  - 결제 금액 서버 사이드 검증
  - 웹훅 서명 검증
  - HTTPS 필수
  - 빌링키 AES 암호화 저장

API 보안:
  - Rate Limiting 적용
  - Input Validation (Zod)
  - SQL Injection 방지 (Prisma ORM)
  - XSS 방지 (React 자동 이스케이프)

인증:
  - 세션 기반 인증 (NextAuth)
  - CSRF 토큰
  - 비밀번호 해싱 (bcrypt)
```

---

## Troubleshooting

### Common Issues

```bash
# 캐시 정리
rm -rf .next node_modules
npm install
npm run dev

# Supabase 타입 생성
npm run db:generate

# Supabase 마이그레이션
npm run db:migrate

# Supabase 리셋
npm run db:reset

# 타입 검사
npx tsc --noEmit

# 린트 수정
npm run lint -- --fix
```

---

## Quick Reference

### Commands

```bash
# 개발
npm run dev              # 개발 서버 (Turbopack)
npm run build            # 프로덕션 빌드
npm run start            # 프로덕션 서버

# 품질
npm run lint             # ESLint
npm run type-check       # TypeScript

# DB (Supabase)
npm run db:generate      # TypeScript 타입 생성
npm run db:migrate       # 스키마 푸시
npm run db:reset         # DB 리셋
```

### Claude Code 명령어

```bash
/analyze     # 분석
/build       # 빌드
/implement   # 구현
/test        # 테스트
/git         # Git 관리
```

---

## Multi-Terminal Session Strategy (병렬 작업 전략)

CodeGen AI 프로젝트를 효율적으로 진행하기 위한 멀티 터미널 세션 가이드입니다. 각 세션에 전문가 페르소나를 할당하여 병렬 작업으로 개발 속도를 극대화합니다.

### Session Architecture (세션 구조)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CodeGen AI 병렬 개발 터미널 구조                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Terminal 1: Frontend]     [Terminal 2: Backend]                       │
│  ├─ Persona: frontend       ├─ Persona: backend                         │
│  ├─ 담당: UI/UX, 컴포넌트     ├─ 담당: Server Actions, API               │
│  ├─ MCP: Magic, Playwright   ├─ MCP: Context7, Sequential               │
│  └─ 포트: 3000 (dev)         └─ 포트: N/A (Server Actions)              │
│                                                                         │
│  [Terminal 3: QA/Test]      [Terminal 4: DevOps/DB]                     │
│  ├─ Persona: qa             ├─ Persona: devops                          │
│  ├─ 담당: 테스트, 품질 검증    ├─ 담당: DB 마이그레이션, 배포             │
│  ├─ MCP: Playwright, Seq     ├─ MCP: Sequential, Context7               │
│  └─ 실행: vitest, playwright └─ 실행: supabase, vercel                  │
│                                                                         │
│  [Terminal 5: AI/Content]   [Terminal 6: Architect] (필요시)            │
│  ├─ Persona: analyzer       ├─ Persona: architect                       │
│  ├─ 담당: AI 프롬프트, 콘텐츠  ├─ 담당: 설계, 리팩토링, 코드 리뷰          │
│  ├─ MCP: Sequential, C7      ├─ MCP: All (--ultrathink)                 │
│  └─ 작업: 프롬프트 엔지니어링   └─ 작업: 아키텍처 결정, PR 리뷰            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Terminal Session Definitions (세션 정의)

#### Terminal 1: Frontend Session (프론트엔드)

```yaml
Session Name: "CodeGen-Frontend"
Persona: --persona-frontend
MCP Servers: --magic --play
Focus Areas:
  - src/components/         # UI 컴포넌트
  - src/app/(marketing)/    # 랜딩, 가격 페이지
  - src/app/(auth)/         # 로그인, 회원가입
  - src/app/(protected)/    # 대시보드, 생성 페이지
  - src/styles/             # 전역 스타일

Recommended Commands:
  sc:implement --type component   # 컴포넌트 구현
  sc:build --focus ui             # UI 빌드 검증
  sc:improve --focus accessibility # 접근성 개선

Initial Prompt:
  "나는 CodeGen AI의 프론트엔드 전문가입니다.
   React 19 + Next.js 16 App Router를 사용합니다.
   shadcn/ui + Tailwind CSS로 UI를 구현합니다.
   RSC 우선, 필요시에만 'use client' 사용합니다."
```

#### Terminal 2: Backend Session (백엔드)

```yaml
Session Name: "CodeGen-Backend"
Persona: --persona-backend
MCP Servers: --c7 --seq
Focus Areas:
  - src/actions/            # Server Actions
  - src/lib/supabase/       # Supabase 클라이언트
  - src/lib/payment/        # 결제 로직
  - src/app/api/            # API Routes (웹훅)
  - src/lib/validators/     # Zod 스키마

Recommended Commands:
  sc:implement --type api         # API 구현
  sc:analyze --focus security     # 보안 분석
  sc:improve --focus reliability  # 안정성 개선

Initial Prompt:
  "나는 CodeGen AI의 백엔드 전문가입니다.
   Server Actions 우선, API Route는 웹훅용으로만 사용합니다.
   Supabase (PostgreSQL + Auth)를 사용합니다.
   모든 입력은 Zod로 검증하고, 결제는 서버 사이드 검증 필수입니다."
```

#### Terminal 3: QA/Test Session (품질 보증)

```yaml
Session Name: "CodeGen-QA"
Persona: --persona-qa
MCP Servers: --play --seq
Focus Areas:
  - tests/unit/             # 단위 테스트
  - tests/e2e/              # E2E 테스트
  - tests/__mocks__/        # 목 데이터
  - playwright.config.ts
  - vitest.config.ts

Recommended Commands:
  sc:test --type unit             # 단위 테스트
  sc:test --type e2e              # E2E 테스트
  sc:analyze --focus quality      # 코드 품질 분석

Initial Prompt:
  "나는 CodeGen AI의 QA 전문가입니다.
   Vitest로 단위 테스트, Playwright로 E2E 테스트를 작성합니다.
   커버리지 목표: 단위 80%, 통합 70%입니다.
   결제 플로우와 인증 플로우는 반드시 E2E 테스트가 필요합니다."
```

#### Terminal 4: DevOps/DB Session (인프라)

```yaml
Session Name: "CodeGen-DevOps"
Persona: --persona-devops
MCP Servers: --seq --c7
Focus Areas:
  - supabase/migrations/    # DB 마이그레이션
  - .github/workflows/      # CI/CD
  - vercel.json             # Vercel 설정
  - .env.example            # 환경변수

Recommended Commands:
  sc:build --focus deploy         # 배포 빌드
  sc:analyze --focus infra        # 인프라 분석
  sc:troubleshoot                 # 문제 진단

Initial Prompt:
  "나는 CodeGen AI의 DevOps 전문가입니다.
   Supabase 마이그레이션과 Vercel 배포를 담당합니다.
   GitHub Actions로 CI/CD를 관리합니다.
   환경변수 관리와 시크릿 보안에 주의합니다."
```

#### Terminal 5: AI/Content Session (AI 콘텐츠)

```yaml
Session Name: "CodeGen-AI"
Persona: --persona-analyzer
MCP Servers: --seq --c7
Focus Areas:
  - src/lib/ai/             # AI 프로바이더, 스키마
  - src/actions/generate.ts # 콘텐츠 생성 액션
  - src/app/api/ai/         # AI 스트리밍 API

Recommended Commands:
  sc:analyze --think-hard         # 심층 분석
  sc:implement --type service     # AI 서비스 구현
  sc:improve --focus performance  # 성능 최적화

Initial Prompt:
  "나는 CodeGen AI의 AI 콘텐츠 전문가입니다.
   Vercel AI SDK 4.x로 스트리밍 응답을 구현합니다.
   Claude (claude-sonnet-4) 우선, OpenAI (gpt-4o-mini) 폴백입니다.
   프롬프트 엔지니어링과 토큰 최적화를 담당합니다."
```

### Parallel Workflow Examples (병렬 작업 예시)

#### Example 1: 새 기능 개발 (결제 기능)

```yaml
Phase 1 - 설계 (Architect 세션):
  Terminal: 6
  Command: "sc:design --ultrathink 결제 기능 설계"
  Output: 설계 문서, 시퀀스 다이어그램

Phase 2 - 병렬 구현:
  Terminal 2 (Backend):
    - "결제 Server Action 구현 (src/actions/payment.ts)"
    - "토스페이먼츠 클라이언트 구현"

  Terminal 1 (Frontend):
    - "결제 UI 컴포넌트 구현"
    - "결제 폼, 성공/실패 페이지"

  Terminal 4 (DevOps):
    - "결제 테이블 마이그레이션"
    - "웹훅 엔드포인트 설정"

Phase 3 - 테스트:
  Terminal 3 (QA):
    - "결제 플로우 E2E 테스트"
    - "웹훅 처리 단위 테스트"
```

#### Example 2: 버그 수정 (긴급)

```yaml
Terminal 3 (QA):
  1. 버그 재현 및 테스트 케이스 작성
  2. 실패 테스트 확인

Terminal 2 (Backend) 또는 Terminal 1 (Frontend):
  1. 버그 원인 분석
  2. 수정 구현

Terminal 3 (QA):
  1. 수정 검증
  2. 회귀 테스트 실행
```

### Session Communication Protocol (세션 간 소통)

```yaml
작업 분배:
  - TaskCreate로 각 세션에 작업 할당
  - TaskUpdate로 진행 상황 공유
  - 의존성 있는 작업은 blockedBy 설정

파일 충돌 방지:
  - 각 세션은 담당 영역만 수정
  - 공유 파일 (types/, lib/) 수정 시 사전 조율
  - Git 브랜치: feature/{session}-{feature-name}

동기화 포인트:
  - 타입 변경 시 모든 세션에 알림
  - DB 스키마 변경 시 DevOps 세션 우선 작업
  - API 계약 변경 시 Backend → Frontend 순서
```

### Session Startup Commands (세션 시작 명령)

```bash
# Terminal 1: Frontend
claude --persona-frontend --magic --play

# Terminal 2: Backend
claude --persona-backend --c7 --seq

# Terminal 3: QA
claude --persona-qa --play --seq

# Terminal 4: DevOps
claude --persona-devops --seq --c7

# Terminal 5: AI/Content
claude --persona-analyzer --seq --c7 --think

# Terminal 6: Architect (필요시)
claude --persona-architect --all-mcp --ultrathink
```

### Best Practices (모범 사례)

```yaml
DO:
  ✅ 각 세션의 담당 영역 명확히 구분
  ✅ 공유 타입/스키마 변경 시 모든 세션에 알림
  ✅ 병렬 작업 가능한 독립 작업 먼저 식별
  ✅ TaskCreate로 작업 추적 및 의존성 관리
  ✅ 정기적으로 git pull로 동기화
  ✅ 복잡한 기능은 Architect 세션에서 설계 후 분배

DON'T:
  ❌ 여러 세션에서 동일 파일 동시 수정
  ❌ 타입 정의 없이 구현 시작
  ❌ 테스트 없이 기능 완료 선언
  ❌ DevOps 승인 없이 DB 스키마 변경
  ❌ 세션 간 직접 의존성 생성 (인터페이스 통해 소통)
```

---

## Development Roadmap

```
Phase 1 (Week 1-4): Core
├── 프로젝트 구조 설정 (현재)
├── DB 스키마 정의
├── AI 콘텐츠 생성 기능
└── 기본 UI

Phase 2 (Week 5-8): Features
├── 사용자 인증
├── 결제 시스템 (토스페이먼츠)
├── PDF 내보내기
└── 히스토리 관리

Phase 3 (Week 9-12): Polish
├── 추가 언어 지원
├── 성능 최적화
├── 테스트
└── 배포
```

---

> **Version History**
> - v1.2.0 (2026-02-03): 멀티 터미널 세션 전략 추가 (병렬 작업 가이드)
> - v1.1.0 (2026-01-28): Supabase 기술 스택 반영, 콘텐츠 생성 기능 구현
> - v1.0.0 (2026-01-28): CodeGen AI 프로젝트용 초기 버전
