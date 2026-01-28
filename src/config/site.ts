export const siteConfig = {
  name: 'CodeGen AI',
  description: 'AI 기반 코딩 교육 콘텐츠 자동 생성기',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ogImage: '/og-image.png',
  links: {
    github: 'https://github.com',
  },
} as const;

export type SiteConfig = typeof siteConfig;
