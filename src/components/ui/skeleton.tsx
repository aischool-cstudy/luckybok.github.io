import { cn } from '@/lib/utils';

/**
 * 스켈레톤 컴포넌트
 * - 로딩 상태를 시각적으로 표시
 * - 접근성 지원 (aria-busy, role)
 */

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 스켈레톤 높이 (기본값: auto) */
  height?: string | number;
  /** 스켈레톤 너비 (기본값: 100%) */
  width?: string | number;
  /** 원형 스켈레톤 여부 */
  circle?: boolean;
  /** 애니메이션 활성화 여부 */
  animate?: boolean;
}

function Skeleton({
  className,
  height,
  width,
  circle = false,
  animate = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="로딩 중..."
      className={cn(
        'bg-muted',
        animate && 'animate-pulse',
        circle && 'rounded-full',
        !circle && 'rounded-md',
        className
      )}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: typeof width === 'number' ? `${width}px` : width,
      }}
      {...props}
    />
  );
}

/**
 * 텍스트 스켈레톤 - 여러 줄의 텍스트 로딩 상태
 */
interface TextSkeletonProps {
  /** 텍스트 줄 수 */
  lines?: number;
  /** 마지막 줄 너비 (기본값: 80%) */
  lastLineWidth?: string;
  /** 줄 간격 */
  gap?: number;
  className?: string;
}

function TextSkeleton({
  lines = 3,
  lastLineWidth = '80%',
  gap = 2,
  className,
}: TextSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="텍스트 로딩 중..."
      className={cn('space-y-' + gap, className)}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{
            width: i === lines - 1 ? lastLineWidth : '100%',
          }}
        />
      ))}
      <span className="sr-only">콘텐츠를 불러오는 중입니다</span>
    </div>
  );
}

/**
 * 카드 스켈레톤 - 카드 레이아웃의 로딩 상태
 */
interface CardSkeletonProps {
  /** 헤더 표시 여부 */
  showHeader?: boolean;
  /** 이미지 영역 표시 여부 */
  showImage?: boolean;
  /** 콘텐츠 줄 수 */
  contentLines?: number;
  className?: string;
}

function CardSkeleton({
  showHeader = true,
  showImage = false,
  contentLines = 3,
  className,
}: CardSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="카드 로딩 중..."
      className={cn(
        'rounded-lg border bg-card p-4 space-y-4',
        className
      )}
    >
      {showImage && (
        <Skeleton className="h-32 w-full rounded-md" />
      )}
      {showHeader && (
        <div className="space-y-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      )}
      <TextSkeleton lines={contentLines} />
      <span className="sr-only">카드 콘텐츠를 불러오는 중입니다</span>
    </div>
  );
}

/**
 * 크레딧 잔액 스켈레톤
 */
function CreditBalanceSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="크레딧 잔액 로딩 중..."
      className={cn('flex items-center gap-4', className)}
    >
      <Skeleton circle className="h-14 w-14" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
      </div>
      <span className="sr-only">크레딧 잔액을 불러오는 중입니다</span>
    </div>
  );
}

/**
 * 구독 상태 스켈레톤
 */
function SubscriptionStatusSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="구독 상태 로딩 중..."
      className={cn('flex items-center justify-between', className)}
    >
      <div className="flex items-center gap-4">
        <Skeleton circle className="h-12 w-12" />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="h-8 w-36 rounded-lg" />
      <span className="sr-only">구독 상태를 불러오는 중입니다</span>
    </div>
  );
}

/**
 * 플랜 카드 스켈레톤
 */
function PlanCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="플랜 정보 로딩 중..."
      className={cn(
        'rounded-xl border bg-card p-6 space-y-4',
        className
      )}
    >
      <div className="space-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="space-y-2 pt-4 border-t">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton circle className="h-4 w-4" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-full mt-4" />
      <span className="sr-only">플랜 정보를 불러오는 중입니다</span>
    </div>
  );
}

export {
  Skeleton,
  TextSkeleton,
  CardSkeleton,
  CreditBalanceSkeleton,
  SubscriptionStatusSkeleton,
  PlanCardSkeleton,
};
