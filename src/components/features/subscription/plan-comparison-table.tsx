'use client';

/**
 * 플랜 비교 테이블 컴포넌트
 * - 플랜별 기능 한눈에 비교
 * - 반응형 디자인 (모바일에서는 카드 형태)
 */

import { Check, X, Infinity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PlanType } from '@/types/payment.types';

interface PlanComparisonTableProps {
  currentPlan?: PlanType;
  className?: string;
}

// 비교 항목 정의
const comparisonItems = [
  {
    category: '콘텐츠 생성',
    items: [
      {
        name: '일일 생성 횟수',
        starter: '10회',
        pro: '100회',
        team: '500회',
        enterprise: '무제한',
      },
      {
        name: '지원 언어',
        starter: 'Python만',
        pro: '6개 전체',
        team: '6개 전체',
        enterprise: '6개 전체',
      },
      {
        name: '프리미엄 템플릿',
        starter: false,
        pro: true,
        team: true,
        enterprise: true,
      },
    ],
  },
  {
    category: '내보내기 & 저장',
    items: [
      {
        name: 'PDF 내보내기',
        starter: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: '히스토리 보관',
        starter: '7일',
        pro: '30일',
        team: '무제한',
        enterprise: '무제한',
      },
    ],
  },
  {
    category: '협업 & API',
    items: [
      {
        name: '팀원 계정',
        starter: '1명',
        pro: '1명',
        team: '5명',
        enterprise: '무제한',
      },
      {
        name: 'API 접근',
        starter: false,
        pro: false,
        team: true,
        enterprise: true,
      },
    ],
  },
  {
    category: '지원',
    items: [
      {
        name: '이메일 지원',
        starter: true,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: '우선 지원',
        starter: false,
        pro: false,
        team: true,
        enterprise: true,
      },
      {
        name: '전담 매니저',
        starter: false,
        pro: false,
        team: false,
        enterprise: true,
      },
    ],
  },
];

const planColumns: { key: PlanType; name: string; highlight?: boolean }[] = [
  { key: 'starter', name: 'Starter' },
  { key: 'pro', name: 'Pro', highlight: true },
  { key: 'team', name: 'Team' },
];

export function PlanComparisonTable({ currentPlan, className }: PlanComparisonTableProps) {
  const renderValue = (value: boolean | string, _planKey: PlanType) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-5 w-5 text-green-500 mx-auto" />
      ) : (
        <X className="h-5 w-5 text-muted-foreground/30 mx-auto" />
      );
    }

    if (value === '무제한') {
      return (
        <span className="flex items-center justify-center gap-1 text-primary font-medium">
          <Infinity className="h-4 w-4" />
          무제한
        </span>
      );
    }

    return <span className="text-sm">{value}</span>;
  };

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse">
        {/* 헤더 */}
        <thead>
          <tr className="border-b">
            <th className="text-left py-4 px-4 font-medium text-muted-foreground w-1/4">
              기능
            </th>
            {planColumns.map((plan) => (
              <th
                key={plan.key}
                className={cn(
                  'py-4 px-4 text-center min-w-[120px]',
                  plan.highlight && 'bg-primary/5'
                )}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="font-semibold text-lg">{plan.name}</span>
                  {currentPlan === plan.key && (
                    <Badge variant="secondary" className="text-xs">
                      현재 플랜
                    </Badge>
                  )}
                  {plan.highlight && currentPlan !== plan.key && (
                    <Badge className="text-xs bg-primary/20 text-primary border-0">
                      추천
                    </Badge>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* 바디 */}
        <tbody>
          {comparisonItems.map((category) => (
            <>
              {/* 카테고리 헤더 */}
              <tr key={category.category} className="bg-muted/30">
                <td
                  colSpan={4}
                  className="py-3 px-4 font-semibold text-sm text-muted-foreground uppercase tracking-wide"
                >
                  {category.category}
                </td>
              </tr>

              {/* 카테고리 아이템 */}
              {category.items.map((item, itemIndex) => (
                <tr
                  key={item.name}
                  className={cn(
                    'border-b border-muted/50 hover:bg-muted/20 transition-colors',
                    itemIndex === category.items.length - 1 && 'border-b-0'
                  )}
                >
                  <td className="py-3 px-4 text-sm">{item.name}</td>
                  {planColumns.map((plan) => (
                    <td
                      key={plan.key}
                      className={cn(
                        'py-3 px-4 text-center',
                        plan.highlight && 'bg-primary/5',
                        currentPlan === plan.key && 'bg-green-500/5'
                      )}
                    >
                      {renderValue(
                        item[plan.key as keyof typeof item] as boolean | string,
                        plan.key
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
