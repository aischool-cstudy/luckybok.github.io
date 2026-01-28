import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Partial Prerendering 활성화 (Next.js 16+)
  cacheComponents: true,

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

  // 보안 헤더
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "X-DNS-Prefetch-Control",
          value: "on",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-XSS-Protection",
          value: "1; mode=block",
        },
        {
          key: "Referrer-Policy",
          value: "origin-when-cross-origin",
        },
      ],
    },
  ],

  // 로깅 설정
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
