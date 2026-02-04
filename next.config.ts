import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 번들 최적화
  experimental: {
    // 사용하지 않는 export를 트리 쉐이킹
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "date-fns",
    ],
  },

  // 모듈 트랜스파일 (서버 컴포넌트 최적화)
  transpilePackages: ["@react-pdf/renderer"],
  // Partial Prerendering (프로덕션에서만 활성화 권장)
  // 동적 라우트와 충돌하므로 개발 단계에서는 비활성화
  // cacheComponents: true,

  // 이미지 최적화 설정
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },

  // 보안 헤더 (단일 소스로 관리 - vercel.json의 headers는 제거됨)
  headers: async () => {
    const isDev = process.env.NODE_ENV === "development";

    // CSP 정책 구성
    // 개발 환경: HMR(Hot Module Replacement)이 eval() 사용하므로 'unsafe-eval' 필요
    // 프로덕션: 보안 강화를 위해 'unsafe-eval' 제거
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.tosspayments.com"
      : "script-src 'self' 'unsafe-inline' https://js.tosspayments.com";

    const cspDirectives = [
      "default-src 'self'",
      // Next.js 개발/프로덕션 + TossPayments SDK
      scriptSrc,
      // Tailwind CSS 인라인 스타일
      "style-src 'self' 'unsafe-inline'",
      // 이미지: self, data URI, 외부 이미지 (Supabase, GitHub 등)
      "img-src 'self' data: https: blob:",
      // 폰트
      "font-src 'self' data:",
      // API 연결: self + 외부 서비스
      "connect-src 'self' https://*.supabase.co https://api.tosspayments.com wss://*.supabase.co",
      // iframe 내 표시 금지
      "frame-ancestors 'none'",
      // base 태그 제한
      "base-uri 'self'",
      // form 제출 대상 제한
      "form-action 'self'",
      // object/embed 금지
      "object-src 'none'",
      // HTTPS 강제 업그레이드
      "upgrade-insecure-requests",
      // 혼합 콘텐츠 차단
      "block-all-mixed-content",
    ];

    const csp = cspDirectives.join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          // DNS Prefetch
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          // MIME 타입 스니핑 방지
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // 클릭재킹 방지 (CSP frame-ancestors와 중복이지만 구형 브라우저용)
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // XSS 필터 (구형 브라우저용)
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // Referrer 정책
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // HTTPS 강제 (프로덕션)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          // 권한 정책 (카메라, 마이크 등 제한)
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Cross-Origin 격리 정책
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          // Cross-Origin-Embedder-Policy는 외부 리소스 호환성 위해 생략
          // SharedArrayBuffer 필요 시 "require-corp" 추가
        ],
      },
    ];
  },

  // 로깅 설정
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
