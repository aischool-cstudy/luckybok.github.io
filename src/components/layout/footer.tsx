'use client';

import Link from 'next/link';
import { siteConfig } from '@/config/site';

interface FooterProps {
  variant?: 'default' | 'marketing';
}

export function Footer({ variant = 'default' }: FooterProps) {
  const currentYear = new Date().getFullYear();

  if (variant === 'default') {
    return (
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {currentYear} {siteConfig.name}. All rights reserved.
        </div>
      </footer>
    );
  }

  // Marketing footer with more links
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-xl font-bold">
              {siteConfig.name}
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">
              AI 기반 코딩 교육 콘텐츠 자동 생성기
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-3">제품</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/#features" className="hover:text-foreground transition-colors">
                  기능
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground transition-colors">
                  요금제
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-foreground transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-3">회사</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/about" className="hover:text-foreground transition-colors">
                  소개
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-foreground transition-colors">
                  블로그
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground transition-colors">
                  문의
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-3">법적 고지</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/terms" className="hover:text-foreground transition-colors">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  개인정보처리방침
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          © {currentYear} {siteConfig.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
