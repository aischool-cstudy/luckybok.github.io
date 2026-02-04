# 코드 리뷰: 터미널 2 (Frontend) - 구독/크레딧 페이지 개선

> **리뷰 일시**: 2026-01-31
> **리뷰 대상**: 구독 플랜 및 크레딧 구매 페이지 UI 개선
> **심각도 분류**: 🔴 Critical | 🟠 Warning | 🟡 Suggestion | 🟢 Good

---

## 📋 리뷰 대상 파일

| 파일 | 상태 | 코드량 |
|------|------|--------|
| `plan-comparison-table.tsx` | 신규 | 224줄 |
| `plan-selector.tsx` | 수정 | 228줄 |
| `subscribe/page.tsx` | 수정 | 346줄 |
| `credits/page.tsx` | 수정 | 457줄 |
| `slider.tsx` | 신규 | 29줄 |

---

## 🟢 좋은 점 (Strengths)

### 1. 코드 구조 및 설계
- ✅ **컴포넌트 분리**: `PlanComparisonTable`을 별도 컴포넌트로 분리하여 재사용성 확보
- ✅ **타입 안전성**: TypeScript 인터페이스 명확하게 정의 (`PlanComparisonTableProps`, `PlanSelectorProps`)
- ✅ **관심사 분리**: 비즈니스 로직과 UI가 적절히 분리됨

### 2. UX/UI 개선
- ✅ **시각적 계층 구조**: 그라데이션 배경, 아이콘, 배지를 활용한 명확한 시각적 계층
- ✅ **반응형 디자인**: `flex-wrap`, `sm:`, `md:` 브레이크포인트 활용
- ✅ **애니메이션**: `animate-in`, `fade-in` 등 부드러운 전환 효과
- ✅ **다크 모드 지원**: `dark:` 접두사로 다크 모드 스타일 적용

### 3. 사용자 경험
- ✅ **사용량 시뮬레이터**: Slider를 활용한 직관적인 크레딧 사용량 계산
- ✅ **추천 패키지 로직**: `useMemo`를 활용한 효율적인 추천 계산
- ✅ **FAQ 아코디언**: 접근성 좋은 `<details>/<summary>` 활용

### 4. 코드 품질
- ✅ **JSDoc 주석**: 컴포넌트 상단에 목적 명시
- ✅ **cn() 유틸 활용**: 조건부 클래스 적용의 일관성
- ✅ **에러 처리**: toast를 활용한 사용자 친화적 에러 메시지

---

## 🟠 개선 필요 (Warnings)

### 1. React Fragment Key 누락 (plan-comparison-table.tsx:178-218)

**위치**: `plan-comparison-table.tsx:178-218`

```tsx
{comparisonItems.map((category) => (
  <>  {/* ⚠️ Fragment에 key 없음 */}
    <tr key={category.category} className="bg-muted/30">
```

**문제**: React에서 리스트 렌더링 시 Fragment에 key가 없으면 경고 발생

**권장 수정**:
```tsx
{comparisonItems.map((category) => (
  <React.Fragment key={category.category}>
    <tr className="bg-muted/30">
    ...
  </React.Fragment>
))}
```

**심각도**: 🟠 Warning

---

### 2. 사용하지 않는 매개변수 (plan-comparison-table.tsx:120)

**위치**: `plan-comparison-table.tsx:120`

```tsx
const renderValue = (value: boolean | string, _planKey: PlanType) => {
```

**문제**: `_planKey` 매개변수가 선언만 되고 사용되지 않음

**권장 조치**:
- 향후 사용 계획이 없다면 매개변수 제거
- 또는 플랜별 차별화된 스타일링에 활용

**심각도**: 🟡 Suggestion

---

### 3. Magic Number 사용 (credits/page.tsx)

**위치**: `credits/page.tsx:68-70`, `credits/page.tsx:245`

```tsx
// 월간 사용량 기준으로 추천
if (monthlyCreditsNeeded <= 50) return 'basic';
if (monthlyCreditsNeeded <= 150) return 'standard';

// Slider max값
max={20}
```

**문제**: 숫자 상수가 하드코딩되어 있어 유지보수 어려움

**권장 수정**:
```tsx
const PACKAGE_THRESHOLDS = {
  basic: { maxMonthly: 50 },
  standard: { maxMonthly: 150 },
} as const;

const USAGE_SIMULATOR_CONFIG = {
  min: 1,
  max: 20,
  defaultValue: 5,
} as const;
```

**심각도**: 🟡 Suggestion

---

### 4. 에러 처리 개선 필요 (credits/page.tsx:76-80)

**위치**: `credits/page.tsx:76-80`

```tsx
const fetchBalance = async () => {
  const result = await getCreditBalance();
  if (result) {
    setCreditBalance(result.balance);
  }
};
```

**문제**: 에러 발생 시 사용자에게 알림 없음, 로딩 상태 표시 없음

**권장 수정**:
```tsx
const [isBalanceLoading, setIsBalanceLoading] = useState(true);

const fetchBalance = async () => {
  try {
    setIsBalanceLoading(true);
    const result = await getCreditBalance();
    if (result?.success) {
      setCreditBalance(result.balance);
    } else {
      toast({ title: '알림', description: '잔액 조회에 실패했습니다', variant: 'destructive' });
    }
  } catch (error) {
    console.error('Failed to fetch balance:', error);
  } finally {
    setIsBalanceLoading(false);
  }
};
```

**심각도**: 🟠 Warning

---

### 5. 테이블 접근성 개선 필요 (plan-comparison-table.tsx)

**위치**: `plan-comparison-table.tsx:143-220`

**문제**:
- `<table>`에 `aria-label` 또는 `<caption>` 없음
- 스크린 리더 사용자를 위한 설명 부재

**권장 수정**:
```tsx
<table className="w-full border-collapse" aria-label="플랜별 기능 비교">
  <caption className="sr-only">
    Starter, Pro, Team 플랜의 기능을 비교합니다
  </caption>
```

**심각도**: 🟡 Suggestion

---

### 6. 중복 코드 패턴 (subscribe/page.tsx, credits/page.tsx)

**위치**: 양쪽 페이지의 신뢰 배지 및 FAQ 섹션

**문제**: 두 페이지에 거의 동일한 신뢰 배지 UI 패턴 중복

**권장 조치**:
```tsx
// components/features/payment/trust-badges.tsx
export function TrustBadges({ badges }: { badges: TrustBadge[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
      {badges.map((badge) => (
        <div key={badge.label} className="flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-full">
          <badge.icon className="h-4 w-4 text-green-500" />
          <span>{badge.label}</span>
        </div>
      ))}
    </div>
  );
}
```

**심각도**: 🟡 Suggestion

---

## 🔴 주의 필요 (Critical)

### 1. XSS 방지 확인 필요

**위치**: `subscribe/page.tsx:201`, `credits/page.tsx:210`

```tsx
<span className="text-4xl font-bold">
  {creditBalance.toLocaleString()}
</span>

<span className="font-semibold text-lg">
  현재 {currentSubscription.plan.toUpperCase()} 플랜
</span>
```

**상태**: ✅ 안전
- React가 기본적으로 문자열을 이스케이프 처리
- 숫자 값만 표시하므로 XSS 위험 없음

---

## 📊 성능 분석

### 1. useMemo 활용 (Good)
```tsx
// credits/page.tsx:50-60
const packageAnalysis = useMemo(() => { ... }, [dailyUsage]);

// credits/page.tsx:63-71
const recommendedPackage = useMemo(() => { ... }, [dailyUsage]);
```
✅ 적절한 메모이제이션으로 불필요한 재계산 방지

### 2. 잠재적 성능 이슈
```tsx
// plan-comparison-table.tsx:178-218
{comparisonItems.map((category) => (
  <>
    {category.items.map((item, itemIndex) => (
      ...
    ))}
  </>
))}
```
🟡 중첩 map은 데이터가 커지면 성능 저하 가능 (현재 규모에서는 문제 없음)

---

## 🎨 디자인 시스템 일관성

### 색상 팔레트
| 페이지 | 주요 색상 | 그라데이션 |
|--------|----------|-----------|
| 구독 | blue-500, purple-500 | ✅ 일관됨 |
| 크레딧 | yellow-500, orange-500 | ✅ 일관됨 |

### 컴포넌트 스타일 일관성
- ✅ 배지 스타일 일관성 유지
- ✅ 카드 라운딩 일관성 (rounded-xl, rounded-2xl)
- ✅ 그림자 일관성 (shadow-lg, shadow-xl)

---

## 📱 반응형 체크리스트

| 요소 | 모바일 | 태블릿 | 데스크톱 |
|------|--------|--------|----------|
| 플랜 카드 그리드 | ✅ 1열 | ✅ 2-3열 | ✅ 3열 |
| 뷰 모드 토글 | ✅ 숨김 | ✅ 표시 | ✅ 표시 |
| FAQ 섹션 | ✅ 전체 너비 | ✅ max-w-3xl | ✅ max-w-3xl |
| 사용량 시뮬레이터 | ✅ 전체 너비 | ✅ max-w-2xl | ✅ max-w-2xl |

---

## ♿ 접근성 체크리스트

| 항목 | 상태 | 비고 |
|------|------|------|
| 색상 대비 | ⚠️ 확인 필요 | text-muted-foreground 대비율 체크 |
| 키보드 네비게이션 | ✅ | Button, details 요소 기본 지원 |
| 스크린 리더 | ⚠️ 개선 필요 | 테이블 aria-label 추가 권장 |
| 포커스 표시 | ✅ | focus-visible 스타일 적용 |
| 애니메이션 | ⚠️ 확인 필요 | prefers-reduced-motion 미대응 |

---

## 📝 최종 권장 사항

### 즉시 수정 권장 (Priority: High)
1. 🟠 React Fragment key 추가
2. 🟠 크레딧 잔액 조회 에러 처리 개선

### 단기 개선 (Priority: Medium)
3. 🟡 Magic Number를 상수로 추출
4. 🟡 테이블 접근성 개선 (aria-label, caption)
5. 🟡 신뢰 배지 컴포넌트 공통화

### 장기 개선 (Priority: Low)
6. 🟡 애니메이션 prefers-reduced-motion 대응
7. 🟡 사용하지 않는 매개변수 정리

---

## 📈 코드 품질 점수

| 카테고리 | 점수 | 평가 |
|----------|------|------|
| 코드 구조 | 9/10 | 우수한 컴포넌트 분리 |
| 타입 안전성 | 9/10 | 명확한 타입 정의 |
| 성능 | 8/10 | useMemo 적절히 활용 |
| 접근성 | 7/10 | 기본 지원, 개선 여지 있음 |
| UX/UI | 9/10 | 세련된 디자인 시스템 |
| 보안 | 10/10 | XSS 위험 없음 |
| **종합** | **8.7/10** | **우수** |

---

*리뷰 작성: Claude Code (Terminal 5)*
*리뷰 기준: CodeGen AI 프로젝트 코딩 표준*
