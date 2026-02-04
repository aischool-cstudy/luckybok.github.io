# CodeGen AI 개선 로드맵

> **Version**: 1.0.0
> **Last Updated**: 2026-01-31
> **Status**: Active Planning

---

## 목차

1. [현재 상태 요약](#현재-상태-요약)
2. [Phase 1: 안정화 (1-2주)](#phase-1-안정화)
3. [Phase 2: 품질 향상 (3-4주)](#phase-2-품질-향상)
4. [Phase 3: 확장 준비 (1-2개월)](#phase-3-확장-준비)
5. [기술 부채 목록](#기술-부채-목록)
6. [추적 대시보드](#추적-대시보드)

---

## 현재 상태 요약

### 종합 평가

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CodeGen AI 프로젝트 상태                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  종합 점수: 7.6/10 (B+)                                                 │
│  ★★★★★★★☆☆☆                                                          │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  영역           점수    상태                                      │   │
│  │  ──────────────────────────────────────────────────────────────  │   │
│  │  아키텍처       7.2     ⚠️  복잡성 관리 필요                      │   │
│  │  보안           7.5     ✅  결제 보안 우수                        │   │
│  │  프론트엔드     7.5     ⚠️  접근성 개선 필요                      │   │
│  │  백엔드         7.5     ⚠️  에러 처리 강화 필요                   │   │
│  │  트렌드 정렬    8.2     ✅  최신 기술 적용                        │   │
│  │  테스트         3.5     ❌  커버리지 대폭 확대 필요               │   │
│  │  문서화         5.5     ⚠️  체계화 진행 중                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 핵심 강점

- ✅ 현대적 AI 통합 (Vercel AI SDK 4.0)
- ✅ 견고한 결제 보안 (AES-256, RPC, 웹훅)
- ✅ 체계적인 데이터 모델 (23개 마이그레이션)
- ✅ TypeScript strict + Zod 검증

### 핵심 약점

- ❌ 테스트 커버리지 부족 (~30%)
- ❌ 상태 관리 부재 (Zustand 미사용)
- ❌ 접근성 미준수 (WCAG)
- ❌ 문서화 부족 (API, 아키텍처)

---

## Phase 1: 안정화

### 기간: 1-2주

### 목표

- 테스트 커버리지 60% 달성
- 핵심 에러 처리 표준화
- 접근성 기본 준수

### 작업 항목

#### Week 1

| # | 작업 | 우선순위 | 담당 | 상태 |
|---|------|----------|------|------|
| 1.1 | Zustand + TanStack Query 상태 관리 설정 | 🔴 Critical | - | ⬜ 대기 |
| 1.2 | ErrorCode enum 정의 및 적용 | 🔴 Critical | - | ⬜ 대기 |
| 1.3 | 핵심 Server Actions 단위 테스트 | 🔴 Critical | - | ⬜ 대기 |
| 1.4 | ARIA 속성 추가 (접근성) | 🔴 Critical | - | ⬜ 대기 |
| 1.5 | 키보드 네비게이션 지원 | 🟠 High | - | ⬜ 대기 |

```typescript
// 1.1 상태 관리 설정 예시
// src/stores/user-store.ts
import { create } from 'zustand';

interface UserState {
  credits: number;
  plan: string;
  updateCredits: (credits: number) => void;
}

export const useUserStore = create<UserState>((set) => ({
  credits: 0,
  plan: 'starter',
  updateCredits: (credits) => set({ credits }),
}));
```

```typescript
// 1.2 에러 코드 체계 예시
// src/lib/errors.ts
export enum ErrorCode {
  // 인증
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // 검증
  INVALID_INPUT = 'INVALID_INPUT',
  VALIDATION_FAILED = 'VALIDATION_FAILED',

  // 결제
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',

  // Rate Limit
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // AI
  AI_GENERATION_FAILED = 'AI_GENERATION_FAILED',
  AI_TIMEOUT = 'AI_TIMEOUT',

  // 시스템
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

#### Week 2

| # | 작업 | 우선순위 | 담당 | 상태 |
|---|------|----------|------|------|
| 1.6 | 결제 E2E 테스트 자동화 | 🔴 Critical | - | ⬜ 대기 |
| 1.7 | 보안 헤더 추가 (HSTS 강화) | 🟠 High | - | ⬜ 대기 |
| 1.8 | 'use client' 최적화 (20% 감소 목표) | 🟠 High | - | ⬜ 대기 |
| 1.9 | AI 모델 폴백 구현 | 🟠 High | - | ⬜ 대기 |
| 1.10 | 결제 Idempotency Key 강화 | 🟠 High | - | ⬜ 대기 |

```typescript
// 1.9 AI 폴백 구현 예시
// src/lib/ai/providers.ts
export async function generateWithFallback(params: GenerateParams) {
  try {
    // Primary: Claude
    return await generateWithClaude(params);
  } catch (error) {
    logWarn('Claude 실패, GPT-4o로 폴백', { error });

    try {
      // Fallback: GPT-4o
      return await generateWithOpenAI(params);
    } catch (fallbackError) {
      logError('AI 폴백 실패', fallbackError as Error);
      throw new AppError(
        ErrorCode.AI_GENERATION_FAILED,
        '콘텐츠 생성에 실패했습니다. 잠시 후 다시 시도해주세요.'
      );
    }
  }
}
```

### Phase 1 완료 기준

- [ ] 테스트 커버리지 60% 이상
- [ ] E2E 테스트 자동화 완료
- [ ] 에러 코드 체계 적용 완료
- [ ] WCAG 2.1 AA 기본 항목 준수
- [ ] 번들 크기 20% 감소

---

## Phase 2: 품질 향상

### 기간: 3-4주

### 목표

- 테스트 커버리지 75% 달성
- API 문서화 완료
- 모니터링 대시보드 구축
- 모바일 반응형 완성

### 작업 항목

#### Week 3

| # | 작업 | 우선순위 | 담당 | 상태 |
|---|------|----------|------|------|
| 2.1 | OpenAPI/Swagger 스펙 작성 | 🟠 High | - | ⬜ 대기 |
| 2.2 | 통합 테스트 확대 | 🟠 High | - | ⬜ 대기 |
| 2.3 | Sentry 에러 추적 강화 | 🟠 High | - | ⬜ 대기 |
| 2.4 | 모바일 반응형 개선 (sm breakpoint) | 🟡 Medium | - | ⬜ 대기 |

#### Week 4

| # | 작업 | 우선순위 | 담당 | 상태 |
|---|------|----------|------|------|
| 2.5 | 모니터링 대시보드 구축 | 🟠 High | - | ⬜ 대기 |
| 2.6 | 에러 처리 사용자 가이드 UI | 🟡 Medium | - | ⬜ 대기 |
| 2.7 | useActionState() 도입 | 🟡 Medium | - | ⬜ 대기 |
| 2.8 | 색상 대비 접근성 개선 | 🟡 Medium | - | ⬜ 대기 |

```typescript
// 2.7 useActionState 예시 (React 19)
// src/components/features/generate/generate-form.tsx
'use client';

import { useActionState } from 'react';
import { generateContent } from '@/actions/generate';

export function GenerateForm() {
  const [state, formAction, isPending] = useActionState(
    generateContent,
    { success: false, error: null, data: null }
  );

  return (
    <form action={formAction}>
      {/* 폼 필드들 */}

      {state.error && (
        <div role="alert" className="text-red-500">
          {state.error}
        </div>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? '생성 중...' : '콘텐츠 생성'}
      </button>
    </form>
  );
}
```

### Phase 2 완료 기준

- [ ] 테스트 커버리지 75% 이상
- [ ] OpenAPI 스펙 완성
- [ ] 모니터링 대시보드 운영
- [ ] 모바일 반응형 완성
- [ ] React 19 신기능 적용

---

## Phase 3: 확장 준비

### 기간: 1-2개월

### 목표

- 테스트 커버리지 80% 달성
- API 버전 관리 체계
- 성능 최적화 완료
- 확장성 검증

### 작업 항목

| # | 작업 | 우선순위 | 담당 | 상태 |
|---|------|----------|------|------|
| 3.1 | API 버전 관리 (/api/v1) | 🟠 High | - | ⬜ 대기 |
| 3.2 | 캐싱 전략 구현 (Redis/KV) | 🟠 High | - | ⬜ 대기 |
| 3.3 | 비동기 작업 큐 도입 | 🟡 Medium | - | ⬜ 대기 |
| 3.4 | 번들 분석 + 성능 예산 설정 | 🟡 Medium | - | ⬜ 대기 |
| 3.5 | 부하 테스트 (10,000+ 동시 사용자) | 🟡 Medium | - | ⬜ 대기 |
| 3.6 | DB 쿼리 최적화 | 🟡 Medium | - | ⬜ 대기 |
| 3.7 | 키 로테이션 프로세스 | 🟢 Low | - | ⬜ 대기 |
| 3.8 | 국제화(i18n) 기반 구축 | 🟢 Low | - | ⬜ 대기 |

### Phase 3 완료 기준

- [ ] 테스트 커버리지 80% 이상
- [ ] API v1 안정화
- [ ] 10,000 동시 사용자 부하 테스트 통과
- [ ] Core Web Vitals 모든 항목 'Good'
- [ ] 확장 준비 완료

---

## 기술 부채 목록

### 🔴 Critical (즉시 해결)

| ID | 항목 | 위치 | 영향 | 해결 방안 |
|----|------|------|------|----------|
| TD-001 | 상태 관리 부재 | 전역 | 데이터 동기화 문제 | Zustand + TanStack Query |
| TD-002 | 테스트 부족 | 전체 | 회귀 버그 위험 | 테스트 확대 |
| TD-003 | 에러 코드 미정의 | actions/ | 디버깅 어려움 | ErrorCode enum |

### 🟠 High (2주 내 해결)

| ID | 항목 | 위치 | 영향 | 해결 방안 |
|----|------|------|------|----------|
| TD-004 | 'use client' 과다 | components/ | 번들 크기 | RSC 활용 확대 |
| TD-005 | 접근성 미준수 | UI 전체 | 사용자 배제 | ARIA, 키보드 |
| TD-006 | AI 폴백 없음 | ai/ | 서비스 중단 | OpenAI 폴백 |
| TD-007 | subscription.ts RPC 미사용 | actions/ | 트랜잭션 불안정 | RPC 적용 |

### 🟡 Medium (1개월 내 해결)

| ID | 항목 | 위치 | 영향 | 해결 방안 |
|----|------|------|------|----------|
| TD-008 | API 문서 부재 | - | 협업 어려움 | OpenAPI |
| TD-009 | 모니터링 미흡 | - | 장애 대응 지연 | 대시보드 구축 |
| TD-010 | 마이그레이션 관리 | supabase/ | 롤백 불가 | 버전 스냅샷 |

### 🟢 Low (분기 내 해결)

| ID | 항목 | 위치 | 영향 | 해결 방안 |
|----|------|------|------|----------|
| TD-011 | 키 로테이션 없음 | payment/ | 보안 위험 | 로테이션 프로세스 |
| TD-012 | 국제화 미지원 | - | 시장 제한 | i18n 기반 |

---

## 추적 대시보드

### 전체 진행률

```
Phase 1 (안정화):      ░░░░░░░░░░░░░░░░░░░░ 0%
Phase 2 (품질 향상):   ░░░░░░░░░░░░░░░░░░░░ 0%
Phase 3 (확장 준비):   ░░░░░░░░░░░░░░░░░░░░ 0%

전체 진행률:           ░░░░░░░░░░░░░░░░░░░░ 0%
```

### 주간 업데이트

| 주차 | 완료 항목 | 진행 중 | 차단됨 | 비고 |
|------|----------|---------|--------|------|
| W1 | - | - | - | 시작 전 |
| W2 | - | - | - | - |
| W3 | - | - | - | - |
| W4 | - | - | - | - |

### 메트릭 추적

| 메트릭 | 시작 | 현재 | 목표 | 상태 |
|--------|------|------|------|------|
| 테스트 커버리지 | ~30% | ~30% | 80% | ❌ |
| 번들 크기 | 측정 필요 | - | -20% | ⬜ |
| p95 응답 시간 | 측정 필요 | - | <1s | ⬜ |
| 에러율 | 측정 필요 | - | <1% | ⬜ |
| 접근성 점수 | 측정 필요 | - | AA | ⬜ |

---

## 참고 자료

- [전문가 검토 보고서](./expert-review-comprehensive-2026-01-31.md)
- [테스트 전략](./testing/strategy.md)
- [보안 가이드](./security/index.md)
- [아키텍처 개요](./architecture/overview.md)

---

## 업데이트 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-31 | 초기 로드맵 작성 |

---

*이 로드맵은 프로젝트 진행에 따라 주기적으로 업데이트됩니다.*
