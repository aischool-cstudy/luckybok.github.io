# CodeGen AI 테스트 전략

> **Version**: 1.0.0
> **Last Updated**: 2026-01-31
> **Author**: 🧪 QA Expert Persona
> **Status**: Active

---

## 목차

1. [테스트 철학](#테스트-철학)
2. [테스트 피라미드](#테스트-피라미드)
3. [테스트 유형별 가이드](#테스트-유형별-가이드)
4. [테스트 도구](#테스트-도구)
5. [테스트 커버리지 목표](#테스트-커버리지-목표)
6. [CI/CD 통합](#cicd-통합)
7. [테스트 작성 가이드라인](#테스트-작성-가이드라인)
8. [모킹 전략](#모킹-전략)

---

## 테스트 철학

### 핵심 원칙

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Testing Philosophy                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. 사용자 관점 우선                                                     │
│     "테스트는 사용자가 겪을 시나리오를 반영해야 한다"                       │
│                                                                         │
│  2. 빠른 피드백                                                          │
│     "개발자가 코드를 작성한 직후 테스트 결과를 알 수 있어야 한다"           │
│                                                                         │
│  3. 신뢰할 수 있는 테스트                                                 │
│     "플래키(Flaky) 테스트는 없는 것보다 나쁘다"                           │
│                                                                         │
│  4. 유지보수 가능한 테스트                                               │
│     "테스트 코드도 프로덕션 코드처럼 관리한다"                            │
│                                                                         │
│  5. 적절한 수준의 테스트                                                 │
│     "100% 커버리지보다 중요한 것은 중요한 로직의 커버리지"                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 테스트 ROI 매트릭스

| 영역 | 비즈니스 중요도 | 복잡도 | 테스트 우선순위 |
|------|----------------|--------|----------------|
| 결제 처리 | 🔴 Critical | 높음 | ⭐⭐⭐⭐⭐ |
| 인증/인가 | 🔴 Critical | 중간 | ⭐⭐⭐⭐⭐ |
| AI 콘텐츠 생성 | 🟠 High | 높음 | ⭐⭐⭐⭐ |
| 크레딧 관리 | 🟠 High | 중간 | ⭐⭐⭐⭐ |
| 사용자 프로필 | 🟡 Medium | 낮음 | ⭐⭐⭐ |
| UI 컴포넌트 | 🟡 Medium | 낮음 | ⭐⭐ |

---

## 테스트 피라미드

```
                          ┌─────────────┐
                         ╱   E2E Tests  ╲         10%
                        ╱    (Playwright)╲        느림, 비쌈
                       ├─────────────────┤
                      ╱  Integration Tests╲       20%
                     ╱    (Vitest + MSW)   ╲      중간
                    ├───────────────────────┤
                   ╱      Unit Tests         ╲    70%
                  ╱        (Vitest)           ╲   빠름, 저렴
                 └─────────────────────────────┘
```

### 테스트 레벨별 책임

| 레벨 | 테스트 대상 | 속도 | 실행 빈도 |
|------|-----------|------|----------|
| **Unit** | 함수, 유틸리티, 훅 | < 1초 | 매 커밋 |
| **Integration** | Server Actions, API | < 10초 | 매 PR |
| **E2E** | 전체 사용자 플로우 | < 60초 | 매 PR, 배포 전 |

---

## 테스트 유형별 가이드

### 1. 단위 테스트 (Unit Tests)

**대상**: 순수 함수, 유틸리티, 커스텀 훅

**위치**: `tests/unit/`

**도구**: Vitest + React Testing Library

```typescript
// tests/unit/lib/payment/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { encryptBillingKey, decryptBillingKey } from '@/lib/payment/crypto';

describe('Billing Key Encryption', () => {
  it('should encrypt and decrypt billing key correctly', () => {
    const originalKey = 'billing_key_test_12345';

    const encrypted = encryptBillingKey(originalKey);
    const decrypted = decryptBillingKey(encrypted);

    expect(decrypted).toBe(originalKey);
    expect(encrypted).not.toBe(originalKey);
    expect(encrypted).toContain(':'); // IV:AuthTag:Data 형식
  });

  it('should generate different ciphertext for same plaintext', () => {
    const originalKey = 'billing_key_test_12345';

    const encrypted1 = encryptBillingKey(originalKey);
    const encrypted2 = encryptBillingKey(originalKey);

    expect(encrypted1).not.toBe(encrypted2); // IV가 달라 매번 다름
  });

  it('should throw error for invalid encrypted data', () => {
    expect(() => decryptBillingKey('invalid_data')).toThrow();
  });
});
```

```typescript
// tests/unit/lib/rate-limit.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  clearRateLimitStore,
  RATE_LIMIT_PRESETS,
} from '@/lib/rate-limit';

describe('Rate Limiting', () => {
  beforeEach(async () => {
    await clearRateLimitStore();
  });

  it('should allow requests within limit', async () => {
    const result = await checkRateLimit(
      'user_123',
      'test_action',
      { windowMs: 60000, max: 5 }
    );

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should block requests exceeding limit', async () => {
    const config = { windowMs: 60000, max: 3 };

    // 3회 요청 (허용)
    for (let i = 0; i < 3; i++) {
      await checkRateLimit('user_123', 'test_action', config);
    }

    // 4번째 요청 (차단)
    const result = await checkRateLimit('user_123', 'test_action', config);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
```

### 2. 통합 테스트 (Integration Tests)

**대상**: Server Actions, 데이터베이스 연동

**위치**: `tests/unit/actions/`

**도구**: Vitest + MSW (Mock Service Worker)

```typescript
// tests/unit/actions/payment.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { confirmCreditPayment } from '@/actions/payment';

// Supabase 모킹
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user_123' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { amount: 24900, status: 'pending' },
        error: null,
      }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

// TossPayments 모킹
vi.mock('@/lib/payment/toss', () => ({
  tossClient: {
    confirmPayment: vi.fn().mockResolvedValue({
      paymentKey: 'pk_test_123',
      orderId: 'CREDIT_20260131_ABC123',
      status: 'DONE',
    }),
  },
}));

describe('confirmCreditPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should confirm payment with valid input', async () => {
    const input = {
      paymentKey: 'pk_test_123',
      orderId: 'CREDIT_20260131_ABC123',
      amount: 24900,
    };

    const result = await confirmCreditPayment(input);

    expect(result.success).toBe(true);
  });

  it('should reject payment with amount mismatch', async () => {
    const input = {
      paymentKey: 'pk_test_123',
      orderId: 'CREDIT_20260131_ABC123',
      amount: 99999, // 불일치 금액
    };

    const result = await confirmCreditPayment(input);

    expect(result.success).toBe(false);
    expect(result.error).toContain('금액');
  });
});
```

### 3. E2E 테스트 (End-to-End Tests)

**대상**: 전체 사용자 플로우

**위치**: `tests/e2e/`

**도구**: Playwright

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('인증 플로우', () => {
  test('회원가입 → 로그인 → 대시보드 접근', async ({ page }) => {
    // 1. 회원가입 페이지 이동
    await page.goto('/register');

    // 2. 폼 입력
    await page.fill('[name="name"]', '테스트 사용자');
    await page.fill('[name="email"]', `test_${Date.now()}@example.com`);
    await page.fill('[name="password"]', 'Test1234!@');
    await page.fill('[name="confirmPassword"]', 'Test1234!@');

    // 3. 제출
    await page.click('button[type="submit"]');

    // 4. 대시보드로 리다이렉트 확인
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('환영합니다')).toBeVisible();
  });

  test('비로그인 시 보호된 페이지 접근 차단', async ({ page }) => {
    await page.goto('/generate');

    // 로그인 페이지로 리다이렉트
    await expect(page).toHaveURL(/\/login\?redirectTo=/);
  });
});

// tests/e2e/payment.spec.ts
test.describe('결제 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // 테스트 계정으로 로그인
    await page.goto('/login');
    await page.fill('[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('크레딧 구매 페이지 UI 확인', async ({ page }) => {
    await page.goto('/payment/credits');

    // 패키지 목록 확인
    await expect(page.getByText('Basic')).toBeVisible();
    await expect(page.getByText('Standard')).toBeVisible();
    await expect(page.getByText('Premium')).toBeVisible();

    // 가격 확인
    await expect(page.getByText('9,900원')).toBeVisible();
  });
});
```

### 4. 컴포넌트 테스트

**대상**: React 컴포넌트 렌더링 및 인터랙션

**도구**: Vitest + React Testing Library

```typescript
// tests/unit/components/credit-package-card.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreditPackageCard } from '@/components/features/payment/credit-package-card';

describe('CreditPackageCard', () => {
  const mockPackage = {
    id: 'standard',
    name: 'Standard',
    credits: 150,
    price: 24900,
    pricePerCredit: 166,
    popular: true,
  };

  it('should render package information correctly', () => {
    render(<CreditPackageCard package={mockPackage} onSelect={vi.fn()} />);

    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('150 크레딧')).toBeInTheDocument();
    expect(screen.getByText('24,900원')).toBeInTheDocument();
    expect(screen.getByText('인기')).toBeInTheDocument(); // 인기 배지
  });

  it('should call onSelect when clicked', () => {
    const handleSelect = vi.fn();
    render(<CreditPackageCard package={mockPackage} onSelect={handleSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /구매/i }));

    expect(handleSelect).toHaveBeenCalledWith('standard');
  });

  it('should be disabled when isLoading is true', () => {
    render(
      <CreditPackageCard
        package={mockPackage}
        onSelect={vi.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

---

## 테스트 도구

### 도구 스택

| 도구 | 용도 | 설정 파일 |
|------|------|----------|
| **Vitest** | 단위/통합 테스트 | `vitest.config.ts` |
| **Playwright** | E2E 테스트 | `playwright.config.ts` |
| **React Testing Library** | 컴포넌트 테스트 | - |
| **MSW** | API 모킹 | `tests/mocks/` |
| **Faker** | 테스트 데이터 생성 | - |

### Vitest 설정

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
    testTimeout: 10000,
  },
});
```

### Playwright 설정

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'tests/reports/playwright' }],
    ['json', { outputFile: 'tests/reports/results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

---

## 테스트 커버리지 목표

### 현재 vs 목표

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Test Coverage Goals                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  영역               현재 (추정)    목표 (Phase 1)   목표 (Phase 2)       │
│  ─────────────────────────────────────────────────────────────────────  │
│  전체               ~30%           60%              80%                  │
│  결제 로직          ~40%           90%              95%                  │
│  인증 로직          ~35%           85%              90%                  │
│  AI 생성            ~20%           70%              80%                  │
│  UI 컴포넌트        ~25%           50%              70%                  │
│  유틸리티           ~50%           90%              95%                  │
│                                                                         │
│  ████████░░░░░░░░░░░░░░░░░░░░  현재 (30%)                               │
│  ████████████████████░░░░░░░░  Phase 1 목표 (60%)                       │
│  ████████████████████████████  Phase 2 목표 (80%)                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 커버리지 제외 항목

```typescript
// vitest.config.ts - coverage.exclude
[
  'node_modules/',
  'tests/',
  '**/*.d.ts',
  '**/*.config.*',
  '**/types/**',           // 타입 정의
  '**/mocks/**',           // 모킹 파일
  'src/app/**/layout.tsx', // 레이아웃 (복잡한 테스트 불필요)
  'src/app/**/loading.tsx', // 로딩 UI
]
```

---

## CI/CD 통합

### GitHub Actions 워크플로우

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-type:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  unit-tests:
    runs-on: ubuntu-latest
    needs: lint-and-type
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true

  e2e-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm run test:e2e
        env:
          BASE_URL: http://localhost:3000
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: tests/reports/playwright/
```

### 테스트 실행 명령어

```bash
# 단위 테스트
npm run test                    # 전체 실행
npm run test -- --watch         # 감시 모드
npm run test:coverage           # 커버리지 포함

# 특정 파일/패턴
npm run test -- payment.test.ts
npm run test -- --grep "Rate Limit"

# E2E 테스트
npm run test:e2e               # 전체 실행
npm run test:e2e:ui            # UI 모드
npm run test:e2e -- --headed   # 브라우저 표시
npm run test:e2e -- auth.spec.ts  # 특정 파일
```

---

## 테스트 작성 가이드라인

### 명명 규칙

```typescript
// 파일명: {대상}.test.ts 또는 {대상}.spec.ts
// payment.test.ts (단위)
// payment.spec.ts (E2E)

// describe: 테스트 대상
describe('confirmCreditPayment', () => {
  // it: 행동 설명 (should ~)
  it('should confirm payment with valid input', () => {});
  it('should reject payment with amount mismatch', () => {});
  it('should handle network errors gracefully', () => {});
});
```

### AAA 패턴

```typescript
it('should calculate total credits correctly', () => {
  // Arrange (준비)
  const packages = [
    { credits: 50 },
    { credits: 150 },
  ];

  // Act (실행)
  const total = calculateTotalCredits(packages);

  // Assert (검증)
  expect(total).toBe(200);
});
```

### Given-When-Then (E2E)

```typescript
test('사용자가 크레딧을 구매한다', async ({ page }) => {
  // Given: 로그인된 상태
  await loginAsTestUser(page);

  // When: 크레딧 구매 진행
  await page.goto('/payment/credits');
  await page.click('text=Standard');
  await page.click('button:has-text("구매")');

  // Then: 결제 완료 확인
  await expect(page).toHaveURL(/\/payment\/success/);
});
```

---

## 모킹 전략

### Supabase 모킹

```typescript
// tests/mocks/supabase.ts
import { vi } from 'vitest';

export const createMockSupabaseClient = (overrides = {}) => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'test_user_id', email: 'test@example.com' } },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides.auth,
  },
  from: vi.fn((table) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides[table],
  })),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  ...overrides,
});
```

### TossPayments 모킹

```typescript
// tests/mocks/toss.ts
export const createMockTossClient = () => ({
  confirmPayment: vi.fn().mockResolvedValue({
    paymentKey: 'pk_test_123',
    orderId: 'CREDIT_20260131_ABC123',
    status: 'DONE',
    totalAmount: 24900,
    method: '카드',
    card: {
      company: '신한',
      number: '1234****5678',
    },
  }),
  issueBillingKey: vi.fn().mockResolvedValue({
    billingKey: 'billing_key_test_123',
    customerKey: 'cust_123',
    cardCompany: '신한',
    cardNumber: '1234****5678',
  }),
  chargeBilling: vi.fn().mockResolvedValue({
    paymentKey: 'pk_test_456',
    status: 'DONE',
  }),
});
```

### AI SDK 모킹

```typescript
// tests/mocks/ai.ts
export const createMockAIStream = (content: string) => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      const chunks = content.split(' ');
      chunks.forEach((chunk, i) => {
        setTimeout(() => {
          controller.enqueue(encoder.encode(chunk + ' '));
          if (i === chunks.length - 1) {
            controller.close();
          }
        }, i * 10);
      });
    },
  });
};
```

---

## 테스트 데이터

### Fixtures

```typescript
// tests/fixtures/users.ts
export const testUsers = {
  standard: {
    id: 'user_standard_123',
    email: 'standard@test.com',
    plan: 'starter',
    creditsBalance: 10,
  },
  pro: {
    id: 'user_pro_456',
    email: 'pro@test.com',
    plan: 'pro',
    creditsBalance: 100,
  },
  admin: {
    id: 'user_admin_789',
    email: 'admin@test.com',
    plan: 'enterprise',
    creditsBalance: 1000,
  },
};

// tests/fixtures/payments.ts
export const testPayments = {
  credit_pending: {
    id: 'pay_pending_123',
    orderId: 'CREDIT_20260131_PENDING',
    amount: 24900,
    status: 'pending',
    type: 'credit_purchase',
  },
  credit_completed: {
    id: 'pay_completed_456',
    orderId: 'CREDIT_20260131_DONE',
    amount: 24900,
    status: 'completed',
    type: 'credit_purchase',
    paidAt: '2026-01-31T10:00:00Z',
  },
};
```

---

## 트러블슈팅

### 일반적인 문제

| 문제 | 원인 | 해결 |
|------|------|------|
| 테스트 타임아웃 | 비동기 작업 미완료 | `await` 확인, 타임아웃 증가 |
| 플래키 테스트 | 타이밍 의존성 | `waitFor` 사용, 고정 값 사용 |
| 환경 변수 오류 | `.env.test` 미설정 | 테스트 환경 변수 설정 |
| 모킹 실패 | 경로 불일치 | `vi.mock` 경로 확인 |

### 디버깅 팁

```bash
# Vitest 디버깅
npm run test -- --inspect-brk

# Playwright 디버깅
npm run test:e2e -- --debug

# 단일 테스트만 실행
it.only('should work', () => {});

# 테스트 건너뛰기
it.skip('not ready', () => {});
```

---

## 참고 자료

- [Vitest 문서](https://vitest.dev/)
- [Playwright 문서](https://playwright.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)

---

*마지막 업데이트: 2026-01-31*
