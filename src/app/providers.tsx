'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 기본 stale time: 1분
            staleTime: 60 * 1000,
            // 기본 gc time: 5분
            gcTime: 5 * 60 * 1000,
            // 재시도 1회
            retry: 1,
            // 포커스시 자동 refetch 비활성화
            refetchOnWindowFocus: false,
          },
          mutations: {
            // mutation 실패시 재시도하지 않음
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
