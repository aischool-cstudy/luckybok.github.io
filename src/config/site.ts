import { clientEnv } from '@/lib/env';

export const siteConfig = {
  name: 'CodeGen AI',
  description: 'AI 기반 코딩 교육 콘텐츠 자동 생성기',
  url: clientEnv.APP_URL,
  ogImage: '/og-image.png',
  links: {
    github: 'https://github.com',
  },
} as const;

export type SiteConfig = typeof siteConfig;
