import '@testing-library/jest-dom/vitest';
import { toHaveNoViolations } from 'jest-axe';

import { cleanup } from '@testing-library/react';
import { afterEach, vi, expect } from 'vitest';

// jest-axe 매처 확장 (WCAG 접근성 테스트용)
expect.extend(toHaveNoViolations);

// 각 테스트 후 cleanup
afterEach(() => {
  cleanup();
});

// 환경 변수 모킹
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');

// Sentry 모킹 (테스트 환경)
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  init: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setTags: vi.fn(),
  setContext: vi.fn(),
  addBreadcrumb: vi.fn(),
  withScope: vi.fn((callback) => callback({ setTag: vi.fn(), setExtra: vi.fn() })),
  Severity: {
    Error: 'error',
    Warning: 'warning',
    Info: 'info',
  },
}));
