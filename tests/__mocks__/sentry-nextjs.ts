/**
 * @sentry/nextjs 모킹
 * 테스트 환경에서 Sentry 의존성 제거
 */

import { vi } from 'vitest';

export const captureException = vi.fn();
export const captureMessage = vi.fn();
export const init = vi.fn();
export const setUser = vi.fn();
export const setTag = vi.fn();
export const setTags = vi.fn();
export const setContext = vi.fn();
export const addBreadcrumb = vi.fn();
export const withScope = vi.fn((callback: (scope: unknown) => void) =>
  callback({ setTag: vi.fn(), setExtra: vi.fn() })
);
export const startSpan = vi.fn((options: unknown, callback: () => unknown) => callback());
export const startInactiveSpan = vi.fn();
export const setMeasurement = vi.fn();
export const close = vi.fn();
export const flush = vi.fn();

export const Severity = {
  Error: 'error',
  Warning: 'warning',
  Info: 'info',
  Debug: 'debug',
  Log: 'log',
  Fatal: 'fatal',
} as const;

export const BrowserTracing = vi.fn();
export const Replay = vi.fn();

export default {
  captureException,
  captureMessage,
  init,
  setUser,
  setTag,
  setTags,
  setContext,
  addBreadcrumb,
  withScope,
  startSpan,
  startInactiveSpan,
  setMeasurement,
  close,
  flush,
  Severity,
  BrowserTracing,
  Replay,
};
