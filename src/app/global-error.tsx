'use client';

import { useEffect } from 'react';
import { logClientError } from '@/lib/client-logger';

/**
 * Global Error Boundary
 * - 전체 애플리케이션의 에러를 처리
 * - 루트 레이아웃 에러도 캐치
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 구조화된 에러 로깅 (민감 정보 마스킹 포함)
    logClientError(error, 'GlobalError');
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          background: 'linear-gradient(to bottom right, #fef2f2, #fff, #fef2f2)'
        }}>
          <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
            {/* Error Icon */}
            <div style={{
              marginBottom: '2rem',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '6rem',
                height: '6rem',
                borderRadius: '1.5rem',
                background: 'linear-gradient(to bottom right, #ef4444, #f97316)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.3)'
              }}>
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <h1 style={{
              fontSize: '1.875rem',
              fontWeight: 'bold',
              marginBottom: '0.75rem',
              color: '#1f2937'
            }}>
              심각한 오류가 발생했습니다
            </h1>
            <p style={{
              color: '#6b7280',
              marginBottom: '2rem',
              lineHeight: '1.75'
            }}>
              죄송합니다. 예상치 못한 오류가 발생했습니다.
              <br />
              페이지를 새로고침하거나 잠시 후 다시 시도해 주세요.
            </p>

            {/* Error Digest (Development) */}
            {process.env.NODE_ENV === 'development' && error.digest && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '0.75rem',
                borderRadius: '0.75rem',
                background: '#f3f4f6',
                border: '1px solid #e5e7eb'
              }}>
                <p style={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: '#6b7280'
                }}>
                  Error: {error.digest}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <button
                onClick={reset}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  background: 'linear-gradient(to right, #ef4444, #f97316)',
                  color: 'white',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.25)'
                }}
              >
                다시 시도
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.75rem',
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  color: '#374151',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                홈으로 이동
              </button>
            </div>

            {/* Support Link */}
            <p style={{
              marginTop: '2rem',
              fontSize: '0.875rem',
              color: '#9ca3af'
            }}>
              문제가 계속되면{' '}
              <a
                href="mailto:support@codegen.ai"
                style={{ color: '#3b82f6', textDecoration: 'none' }}
              >
                고객 지원
              </a>
              에 문의해 주세요.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
