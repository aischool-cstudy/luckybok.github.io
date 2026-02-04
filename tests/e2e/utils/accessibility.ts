/**
 * WCAG 2.1 AA 접근성 테스트 유틸리티
 * - axe-core 기반 자동 검증
 * - 키보드 네비게이션 테스트 헬퍼
 * - ARIA 레이블 검증 헬퍼
 */

import { Page, expect, Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * WCAG 2.1 AA 기준 접근성 검사 결과 인터페이스
 */
export interface AccessibilityResult {
  violations: Array<{
    id: string;
    impact: 'minor' | 'moderate' | 'serious' | 'critical';
    description: string;
    help: string;
    helpUrl: string;
    nodes: Array<{
      html: string;
      target: string[];
    }>;
  }>;
  passes: number;
  incomplete: number;
}

/**
 * axe-core를 사용한 WCAG 2.1 AA 기준 접근성 검사
 * @param page Playwright Page 객체
 * @param options 검사 옵션
 * @returns 검사 결과
 */
export async function checkAccessibility(
  page: Page,
  options?: {
    /** 무시할 규칙 ID 목록 */
    disableRules?: string[];
    /** 검사할 DOM 영역 선택자 */
    include?: string[];
    /** 제외할 DOM 영역 선택자 */
    exclude?: string[];
    /** 태그 필터 (예: ['wcag2a', 'wcag2aa']) */
    tags?: string[];
  }
): Promise<AccessibilityResult> {
  let builder = new AxeBuilder({ page });

  // WCAG 2.1 AA 기준 기본 설정
  builder = builder.withTags(options?.tags ?? ['wcag2a', 'wcag2aa', 'wcag21aa']);

  if (options?.disableRules) {
    builder = builder.disableRules(options.disableRules);
  }

  if (options?.include) {
    for (const selector of options.include) {
      builder = builder.include(selector);
    }
  }

  if (options?.exclude) {
    for (const selector of options.exclude) {
      builder = builder.exclude(selector);
    }
  }

  const results = await builder.analyze();

  return {
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact as 'minor' | 'moderate' | 'serious' | 'critical',
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map((n) => ({
        html: n.html,
        target: n.target as string[],
      })),
    })),
    passes: results.passes.length,
    incomplete: results.incomplete.length,
  };
}

/**
 * 접근성 위반 사항이 없음을 검증
 * @param page Playwright Page 객체
 * @param options 검사 옵션
 */
export async function expectNoAccessibilityViolations(
  page: Page,
  options?: {
    disableRules?: string[];
    include?: string[];
    exclude?: string[];
    /** 허용할 최대 위반 수준 (기본: 'moderate' - serious/critical만 실패) */
    maxImpact?: 'minor' | 'moderate' | 'serious' | 'critical';
  }
): Promise<void> {
  const result = await checkAccessibility(page, options);

  // 위반 사항 필터링 (심각도 기준)
  const impactOrder = ['minor', 'moderate', 'serious', 'critical'];
  const maxImpactLevel = options?.maxImpact ?? 'moderate';
  const minLevel = impactOrder.indexOf(maxImpactLevel) + 1;

  const criticalViolations = result.violations.filter(
    (v) => impactOrder.indexOf(v.impact) >= minLevel
  );

  if (criticalViolations.length > 0) {
    const violationDetails = criticalViolations
      .map(
        (v) =>
          `\n[${v.impact.toUpperCase()}] ${v.id}: ${v.help}\n` +
          `  URL: ${v.helpUrl}\n` +
          `  Elements:\n${v.nodes.map((n) => `    - ${n.target.join(' > ')}`).join('\n')}`
      )
      .join('\n');

    throw new Error(
      `WCAG 접근성 위반 발견 (${criticalViolations.length}건):${violationDetails}`
    );
  }
}

/**
 * 키보드 네비게이션 테스트 - Tab 키로 순차 이동 검증
 * @param page Playwright Page 객체
 * @param expectedOrder 예상 포커스 순서 (선택자 또는 역할 배열)
 */
export async function testKeyboardNavigation(
  page: Page,
  expectedOrder: Array<{
    role?: string;
    name?: string | RegExp;
    selector?: string;
  }>
): Promise<void> {
  // 페이지 시작점으로 포커스 이동
  await page.keyboard.press('Tab');

  for (let i = 0; i < expectedOrder.length; i++) {
    const expected = expectedOrder[i];
    let focusedElement: Locator;

    if (expected.selector) {
      focusedElement = page.locator(expected.selector);
    } else if (expected.role) {
      focusedElement = page.getByRole(expected.role as Parameters<typeof page.getByRole>[0], {
        name: expected.name,
      });
    } else {
      throw new Error('selector 또는 role을 지정해야 합니다.');
    }

    await expect(focusedElement).toBeFocused({
      timeout: 5000,
    });

    // 마지막이 아니면 다음 요소로 이동
    if (i < expectedOrder.length - 1) {
      await page.keyboard.press('Tab');
    }
  }
}

/**
 * Enter/Space 키로 활성화 가능한지 검증
 * @param element 테스트할 요소
 * @param key 사용할 키 ('Enter' | 'Space')
 */
export async function testKeyboardActivation(
  element: Locator,
  key: 'Enter' | ' ' = 'Enter'
): Promise<void> {
  await element.focus();
  await expect(element).toBeFocused();
  await element.press(key);
}

/**
 * Skip Link 동작 검증
 * @param page Playwright Page 객체
 * @param skipLinkSelector Skip Link 선택자
 * @param targetId 대상 요소 ID
 */
export async function testSkipLink(
  page: Page,
  skipLinkSelector: string = 'a[href="#main-content"]',
  targetId: string = 'main-content'
): Promise<void> {
  // Tab 키로 Skip Link에 포커스
  await page.keyboard.press('Tab');

  const skipLink = page.locator(skipLinkSelector);
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  // Enter 키로 활성화
  await page.keyboard.press('Enter');

  // 대상 요소로 포커스 이동 확인
  const target = page.locator(`#${targetId}`);
  await expect(target).toBeFocused();
}

/**
 * ARIA 레이블이 적절히 설정되었는지 검증
 * @param page Playwright Page 객체
 * @param selector 검사할 요소 선택자
 * @param expectedLabel 예상 레이블 (aria-label 또는 aria-labelledby 참조 텍스트)
 */
export async function expectAriaLabel(
  page: Page,
  selector: string,
  expectedLabel: string | RegExp
): Promise<void> {
  const element = page.locator(selector);

  const ariaLabel = await element.getAttribute('aria-label');
  const ariaLabelledBy = await element.getAttribute('aria-labelledby');

  if (ariaLabel) {
    if (typeof expectedLabel === 'string') {
      expect(ariaLabel).toBe(expectedLabel);
    } else {
      expect(ariaLabel).toMatch(expectedLabel);
    }
    return;
  }

  if (ariaLabelledBy) {
    const labelElement = page.locator(`#${ariaLabelledBy}`);
    const labelText = await labelElement.textContent();
    if (typeof expectedLabel === 'string') {
      expect(labelText).toBe(expectedLabel);
    } else {
      expect(labelText).toMatch(expectedLabel);
    }
    return;
  }

  throw new Error(
    `요소 "${selector}"에 aria-label 또는 aria-labelledby가 없습니다.`
  );
}

/**
 * 포커스 가시성 검증 (outline 또는 ring 스타일 확인)
 * @param element 테스트할 요소
 */
export async function expectVisibleFocusIndicator(
  element: Locator
): Promise<void> {
  await element.focus();
  await expect(element).toBeFocused();

  // CSS outline 또는 box-shadow (ring) 확인
  const outlineStyle = await element.evaluate((el) => {
    const styles = window.getComputedStyle(el);
    return {
      outline: styles.outline,
      outlineWidth: styles.outlineWidth,
      outlineStyle: styles.outlineStyle,
      boxShadow: styles.boxShadow,
    };
  });

  const hasVisibleOutline =
    outlineStyle.outlineStyle !== 'none' &&
    outlineStyle.outlineWidth !== '0px';
  const hasBoxShadow =
    outlineStyle.boxShadow !== 'none' && outlineStyle.boxShadow !== '';

  expect(
    hasVisibleOutline || hasBoxShadow,
    `포커스 인디케이터가 표시되지 않습니다. outline: ${outlineStyle.outline}, boxShadow: ${outlineStyle.boxShadow}`
  ).toBe(true);
}

/**
 * 색상 대비 검증 (WCAG AA: 4.5:1, AAA: 7:1)
 * @param page Playwright Page 객체
 * @param selector 검사할 요소 선택자
 * @param level 대비 수준 ('AA' | 'AAA')
 */
export async function checkColorContrast(
  page: Page,
  selector: string,
  level: 'AA' | 'AAA' = 'AA'
): Promise<boolean> {
  const result = await checkAccessibility(page, {
    include: [selector],
    tags: level === 'AAA' ? ['wcag2aaa'] : ['wcag2aa'],
  });

  const contrastViolations = result.violations.filter(
    (v) => v.id === 'color-contrast'
  );

  return contrastViolations.length === 0;
}

/**
 * 폼 필드와 레이블 연결 검증
 * @param page Playwright Page 객체
 * @param inputSelector 입력 필드 선택자
 */
export async function expectLabelledInput(
  page: Page,
  inputSelector: string
): Promise<void> {
  const input = page.locator(inputSelector);
  const inputId = await input.getAttribute('id');

  if (!inputId) {
    throw new Error(`입력 필드 "${inputSelector}"에 id가 없습니다.`);
  }

  // 명시적 레이블 확인
  const explicitLabel = page.locator(`label[for="${inputId}"]`);
  const hasExplicitLabel = (await explicitLabel.count()) > 0;

  // aria-label 또는 aria-labelledby 확인
  const ariaLabel = await input.getAttribute('aria-label');
  const ariaLabelledBy = await input.getAttribute('aria-labelledby');

  const hasAriaLabel = !!ariaLabel || !!ariaLabelledBy;

  expect(
    hasExplicitLabel || hasAriaLabel,
    `입력 필드 "${inputSelector}"에 연결된 레이블이 없습니다.`
  ).toBe(true);
}

/**
 * Live Region 검증 (동적 콘텐츠 알림)
 * @param page Playwright Page 객체
 * @param selector Live Region 선택자
 * @param expectedPoliteness 예상 politeness 값
 */
export async function expectLiveRegion(
  page: Page,
  selector: string,
  expectedPoliteness: 'polite' | 'assertive' = 'polite'
): Promise<void> {
  const element = page.locator(selector);
  const ariaLive = await element.getAttribute('aria-live');
  const role = await element.getAttribute('role');

  // aria-live 또는 적절한 role 확인
  const hasAriaLive = ariaLive === expectedPoliteness;
  const hasLiveRole = ['alert', 'status', 'log'].includes(role || '');

  expect(
    hasAriaLive || hasLiveRole,
    `요소 "${selector}"가 적절한 live region이 아닙니다.`
  ).toBe(true);
}

/**
 * 랜드마크 구조 검증
 * @param page Playwright Page 객체
 * @param expectedLandmarks 예상 랜드마크 목록
 */
export async function expectLandmarks(
  page: Page,
  expectedLandmarks: Array<'banner' | 'main' | 'navigation' | 'contentinfo' | 'complementary' | 'form' | 'search'>
): Promise<void> {
  for (const landmark of expectedLandmarks) {
    const elements = page.getByRole(landmark);
    const count = await elements.count();
    expect(count, `랜드마크 "${landmark}"가 존재해야 합니다.`).toBeGreaterThan(0);
  }
}

/**
 * 헤딩 구조 검증 (올바른 계층 구조)
 * @param page Playwright Page 객체
 */
export async function expectProperHeadingStructure(
  page: Page
): Promise<void> {
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
  const levels: number[] = [];

  for (const heading of headings) {
    const tagName = await heading.evaluate((el) => el.tagName.toLowerCase());
    const level = parseInt(tagName.replace('h', ''), 10);
    levels.push(level);
  }

  // H1이 하나만 있는지 확인
  const h1Count = levels.filter((l) => l === 1).length;
  expect(h1Count, '페이지에 H1이 정확히 하나 있어야 합니다.').toBe(1);

  // 레벨 건너뛰기 확인 (H1 → H3 같은 경우)
  for (let i = 1; i < levels.length; i++) {
    const diff = levels[i] - levels[i - 1];
    expect(
      diff <= 1,
      `헤딩 레벨 건너뛰기: H${levels[i - 1]} 다음에 H${levels[i]}가 옴`
    ).toBe(true);
  }
}
