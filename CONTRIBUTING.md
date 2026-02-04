# 기여 가이드 (Contributing Guide)

> **Version**: 1.0.0
> **Last Updated**: 2026-01-31

CodeGen AI 프로젝트에 기여해 주셔서 감사합니다! 이 문서는 프로젝트에 효과적으로 기여하기 위한 가이드라인을 제공합니다.

---

## 목차

1. [행동 강령](#행동-강령)
2. [기여 방법](#기여-방법)
3. [개발 환경 설정](#개발-환경-설정)
4. [브랜치 전략](#브랜치-전략)
5. [커밋 컨벤션](#커밋-컨벤션)
6. [Pull Request 가이드](#pull-request-가이드)
7. [코드 스타일](#코드-스타일)
8. [테스트 가이드](#테스트-가이드)
9. [이슈 리포팅](#이슈-리포팅)

---

## 행동 강령

### 기본 원칙

- **존중**: 모든 기여자를 존중하고 건설적인 피드백을 제공합니다.
- **협력**: 팀원들과 적극적으로 소통하고 협력합니다.
- **품질**: 코드 품질과 문서화에 책임감을 갖습니다.
- **학습**: 새로운 기술과 방법론에 열린 자세를 유지합니다.

---

## 기여 방법

### 기여 유형

| 유형 | 설명 | 라벨 |
|------|------|------|
| 🐛 버그 수정 | 기존 기능의 버그 수정 | `bug` |
| ✨ 새 기능 | 새로운 기능 개발 | `feature` |
| 📝 문서화 | 문서 추가/수정 | `documentation` |
| 🎨 UI/UX | 인터페이스 개선 | `ui` |
| ⚡ 성능 | 성능 최적화 | `performance` |
| 🔒 보안 | 보안 관련 개선 | `security` |
| ♻️ 리팩토링 | 코드 구조 개선 | `refactor` |
| 🧪 테스트 | 테스트 추가/개선 | `test` |

### 기여 프로세스

```
1. 이슈 확인 또는 생성
   └─ 작업할 이슈 선택 또는 새 이슈 생성

2. Fork & 브랜치 생성
   └─ 개인 저장소 Fork 후 feature 브랜치 생성

3. 개발 진행
   └─ 코드 작성, 테스트, 문서화

4. PR 생성
   └─ 템플릿에 맞춰 Pull Request 작성

5. 코드 리뷰
   └─ 리뷰어 피드백 반영

6. 병합
   └─ 승인 후 main 브랜치에 병합
```

---

## 개발 환경 설정

### 필수 요구사항

```bash
# Node.js 버전 확인 (20.0.0 이상)
node -v

# npm 버전 확인
npm -v

# Git 버전 확인
git --version
```

### 초기 설정

```bash
# 1. 저장소 Fork (GitHub에서)

# 2. Fork한 저장소 클론
git clone https://github.com/YOUR_USERNAME/codegen-ai.git
cd codegen-ai

# 3. 원본 저장소를 upstream으로 추가
git remote add upstream https://github.com/original-org/codegen-ai.git

# 4. 의존성 설치
npm install

# 5. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일 편집

# 6. Supabase 타입 생성
npm run db:generate

# 7. 개발 서버 실행
npm run dev
```

### VS Code 권장 확장

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-playwright.playwright"
  ]
}
```

---

## 브랜치 전략

### 브랜치 네이밍 규칙

```
{type}/{issue-number}-{short-description}
```

| 타입 | 용도 | 예시 |
|------|------|------|
| `feature/` | 새 기능 | `feature/123-add-pdf-export` |
| `fix/` | 버그 수정 | `fix/456-login-redirect` |
| `docs/` | 문서화 | `docs/789-api-documentation` |
| `refactor/` | 리팩토링 | `refactor/101-auth-module` |
| `test/` | 테스트 | `test/102-payment-tests` |
| `chore/` | 기타 | `chore/103-update-deps` |

### 브랜치 플로우

```
main (프로덕션)
│
├── develop (개발 통합)
│   │
│   ├── feature/123-new-feature
│   │   └── 기능 개발 후 develop에 PR
│   │
│   └── fix/456-bug-fix
│       └── 버그 수정 후 develop에 PR
│
└── hotfix/789-critical-fix
    └── 긴급 수정 후 main/develop 모두에 PR
```

### 브랜치 동기화

```bash
# upstream 변경사항 가져오기
git fetch upstream

# main 브랜치 동기화
git checkout main
git merge upstream/main

# feature 브랜치에 최신 main 반영
git checkout feature/123-my-feature
git rebase main
```

---

## 커밋 컨벤션

### Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### 커밋 타입

| 타입 | 설명 | 예시 |
|------|------|------|
| `feat` | 새로운 기능 | `feat(auth): 소셜 로그인 추가` |
| `fix` | 버그 수정 | `fix(payment): 결제 금액 검증 오류 수정` |
| `docs` | 문서 수정 | `docs(readme): 설치 가이드 업데이트` |
| `style` | 코드 스타일 | `style(ui): 버튼 패딩 조정` |
| `refactor` | 리팩토링 | `refactor(api): 에러 핸들링 통합` |
| `test` | 테스트 | `test(auth): 로그인 E2E 테스트 추가` |
| `chore` | 기타 | `chore(deps): 의존성 업데이트` |
| `perf` | 성능 개선 | `perf(query): 인덱스 최적화` |
| `ci` | CI/CD | `ci(github): 워크플로우 수정` |

### 커밋 작성 규칙

```bash
# Good ✅
git commit -m "feat(generate): AI 콘텐츠 스트리밍 지원 추가"
git commit -m "fix(auth): 리다이렉트 URL 인코딩 오류 수정"
git commit -m "docs(api): 결제 API 문서 추가"

# Bad ❌
git commit -m "기능 추가"
git commit -m "버그 수정"
git commit -m "update"
```

### 커밋 본문 작성 (선택)

```bash
git commit -m "feat(payment): 부분 환불 기능 구현

- 환불 금액 검증 로직 추가
- 환불 사유 필수 입력 처리
- 환불 내역 테이블에 기록

Closes #234"
```

---

## Pull Request 가이드

### PR 생성 전 체크리스트

```bash
# 1. 코드 포맷팅
npm run lint:fix

# 2. 타입 체크
npm run type-check

# 3. 테스트 실행
npm run test

# 4. 빌드 확인
npm run build
```

### PR 템플릿

```markdown
## 📋 관련 이슈

Closes #이슈번호

## 📝 변경 사항

### 주요 변경
- 변경 사항 1
- 변경 사항 2

### 스크린샷 (UI 변경 시)
| Before | After |
|--------|-------|
| 이미지 | 이미지 |

## ✅ 체크리스트

- [ ] 코드가 프로젝트 스타일 가이드를 따릅니다
- [ ] 셀프 코드 리뷰를 완료했습니다
- [ ] 필요한 테스트를 추가했습니다
- [ ] 모든 테스트가 통과합니다
- [ ] 문서를 업데이트했습니다 (필요 시)

## 🧪 테스트 방법

1. 테스트 단계 1
2. 테스트 단계 2

## 📌 추가 정보

리뷰어가 알아야 할 추가 정보
```

### PR 라벨

| 라벨 | 설명 | 색상 |
|------|------|------|
| `ready-for-review` | 리뷰 요청 | 🟢 |
| `work-in-progress` | 작업 중 | 🟡 |
| `needs-discussion` | 논의 필요 | 🟠 |
| `blocked` | 차단됨 | 🔴 |

### 코드 리뷰 가이드

**리뷰어**:
- 24시간 내 리뷰 시작
- 건설적인 피드백 제공
- Approve/Request Changes 명확히 표시

**작성자**:
- 피드백에 48시간 내 응답
- 변경 사항 설명 추가
- 리뷰어 제안 적극 검토

---

## 코드 스타일

### TypeScript 규칙

```typescript
// ✅ Good: 명시적 타입 정의
interface User {
  id: string;
  email: string;
  name: string | null;
}

async function getUser(id: string): Promise<User | null> {
  // ...
}

// ❌ Bad: any 타입 사용
async function getUser(id: any): Promise<any> {
  // ...
}
```

### React 컴포넌트 규칙

```tsx
// ✅ Good: Server Component (기본)
// src/components/features/dashboard/stats-card.tsx
interface StatsCardProps {
  title: string;
  value: number;
  trend?: 'up' | 'down';
}

export function StatsCard({ title, value, trend }: StatsCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

// ✅ Good: Client Component (필요 시에만)
// src/components/features/generate/form.tsx
'use client';

import { useState } from 'react';

export function GenerateForm() {
  const [topic, setTopic] = useState('');
  // ...
}
```

### 파일 명명 규칙

```
src/
├── components/
│   └── features/
│       └── payment/
│           ├── credit-package-card.tsx  # kebab-case
│           └── index.ts                 # re-export
├── actions/
│   └── payment.ts                       # camelCase 함수
├── types/
│   └── payment.types.ts                 # PascalCase 타입
└── lib/
    └── payment/
        └── toss.ts                      # 유틸리티
```

### 임포트 순서

```typescript
// 1. React/Next.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. 외부 라이브러리
import { z } from 'zod';
import { useForm } from 'react-hook-form';

// 3. 내부 모듈 (절대 경로)
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

// 4. 타입
import type { User } from '@/types';

// 5. 상대 경로 (같은 기능 내)
import { FormField } from './form-field';
```

---

## 테스트 가이드

### 테스트 파일 위치

```
tests/
├── unit/                    # 단위 테스트
│   ├── actions/
│   │   └── payment.test.ts
│   └── lib/
│       └── rate-limit.test.ts
├── e2e/                     # E2E 테스트
│   ├── auth.spec.ts
│   └── payment.spec.ts
└── fixtures/                # 테스트 데이터
    └── users.json
```

### 단위 테스트 작성

```typescript
// tests/unit/actions/payment.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { confirmCreditPayment } from '@/actions/payment';

describe('confirmCreditPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should confirm payment with valid input', async () => {
    // Arrange
    const input = {
      paymentKey: 'pk_test_123',
      orderId: 'CREDIT_20260131_ABC123',
      amount: 24900,
    };

    // Act
    const result = await confirmCreditPayment(input);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('credits');
  });

  it('should reject payment with amount mismatch', async () => {
    // 금액 불일치 테스트
  });
});
```

### E2E 테스트 작성

```typescript
// tests/e2e/payment.spec.ts
import { test, expect } from '@playwright/test';

test.describe('크레딧 구매 플로우', () => {
  test('로그인 후 크레딧 구매 페이지 접근', async ({ page }) => {
    // 로그인
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 크레딧 구매 페이지 이동
    await page.goto('/payment/credits');
    await expect(page.getByText('크레딧 충전')).toBeVisible();

    // 패키지 선택
    await page.click('text=Standard');
    await expect(page.getByText('24,900원')).toBeVisible();
  });
});
```

### 테스트 명령어

```bash
# 전체 단위 테스트
npm run test

# 특정 파일 테스트
npm run test -- payment.test.ts

# 커버리지 리포트
npm run test:coverage

# E2E 테스트
npm run test:e2e

# E2E 테스트 (UI 모드)
npm run test:e2e:ui
```

---

## 이슈 리포팅

### 버그 리포트 템플릿

```markdown
## 🐛 버그 설명

버그에 대한 명확한 설명

## 재현 단계

1. '...'로 이동
2. '...' 클릭
3. '...' 스크롤
4. 오류 발생

## 예상 동작

예상했던 동작에 대한 설명

## 실제 동작

실제 발생한 동작에 대한 설명

## 스크린샷

해당되는 경우 스크린샷 첨부

## 환경

- OS: [예: macOS Sonoma]
- Browser: [예: Chrome 120]
- Node.js: [예: 20.10.0]

## 추가 정보

문제에 대한 추가 정보
```

### 기능 요청 템플릿

```markdown
## ✨ 기능 설명

제안하는 기능에 대한 명확한 설명

## 해결하려는 문제

이 기능이 해결할 문제나 개선점

## 제안하는 솔루션

원하는 구현 방식에 대한 설명

## 대안

고려한 다른 대안이 있다면 설명

## 추가 정보

기능에 대한 추가 정보, 목업, 참고 자료
```

---

## 도움이 필요하신가요?

- **문서**: [docs/](./docs/) 폴더 참조
- **이슈**: GitHub Issues에서 `help wanted` 라벨 확인
- **논의**: GitHub Discussions 활용
- **연락**: support@codegen.ai

---

*감사합니다! 여러분의 기여가 CodeGen AI를 더 좋게 만듭니다.* 🚀
