/**
 * Skip Link 컴포넌트
 * - 스크린 리더 및 키보드 사용자를 위한 건너뛰기 링크
 * - 포커스 시에만 화면에 표시
 * - 메인 콘텐츠로 바로 이동 가능
 */

import { cn } from '@/lib/utils';

interface SkipLinkProps {
  /** 건너뛸 타겟 ID (기본값: main-content) */
  targetId?: string;
  /** 링크 텍스트 */
  text?: string;
  /** 추가 클래스명 */
  className?: string;
}

export function SkipLink({
  targetId = 'main-content',
  text = '메인 콘텐츠로 건너뛰기',
  className,
}: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        // 기본적으로 화면 밖에 숨김
        'sr-only',
        // 포커스 시 화면에 표시
        'focus:not-sr-only',
        'focus:fixed focus:top-4 focus:left-4 focus:z-[100]',
        'focus:inline-flex focus:items-center focus:justify-center',
        'focus:px-4 focus:py-2',
        'focus:bg-background focus:text-foreground',
        'focus:border focus:border-border focus:rounded-md',
        'focus:shadow-lg',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        'focus:animate-in focus:fade-in focus:duration-200',
        // 텍스트 스타일
        'text-sm font-medium',
        className
      )}
    >
      {text}
    </a>
  );
}
