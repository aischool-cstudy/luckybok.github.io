import { expect, test, type Page } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123';

const hasTestCredentials = process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD;

const loginAsTestUser = async (page: Page) => {
  await page.goto('/login');
  await page.getByLabel(/이메일/i).fill(TEST_EMAIL);
  await page.getByLabel(/비밀번호/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /로그인/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
};

test.describe('대시보드 페이지', () => {
  test('비로그인 시 대시보드 접근이 차단된다', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('대시보드 레이아웃이 올바르게 표시된다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);

    // 인사말 확인
    await expect(page.getByText(/안녕하세요/i)).toBeVisible();

    // 통계 카드 확인
    await expect(page.getByText(/오늘 남은 생성 횟수/i)).toBeVisible();
    await expect(page.getByText(/오늘 생성한 콘텐츠/i)).toBeVisible();
    await expect(page.getByText(/현재 플랜/i)).toBeVisible();
  });

  test('빠른 시작 카드가 표시된다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);

    await expect(page.getByText(/빠른 시작/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /콘텐츠 생성/i })).toBeVisible();
  });

  test('최근 생성 콘텐츠 섹션이 표시된다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);

    await expect(page.getByText(/최근 생성 콘텐츠/i)).toBeVisible();
  });

  test('통계 카드의 숫자가 표시된다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);

    // 숫자 값이 표시되는지 확인 (text-4xl 클래스 내의 숫자)
    const statsCards = page.locator('.text-4xl');
    const count = await statsCards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('콘텐츠 생성하기 버튼 클릭 시 생성 페이지로 이동', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);

    await page.getByRole('link', { name: /콘텐츠 생성/i }).click();
    await expect(page).toHaveURL(/\/generate/);
  });
});

test.describe('대시보드 네비게이션', () => {
  test('히스토리 페이지로 이동할 수 있다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);

    // 네비게이션에서 히스토리 링크 클릭
    await page.getByRole('link', { name: /히스토리|기록/i }).click();
    await expect(page).toHaveURL(/\/history/);
  });

  test('설정 페이지로 이동할 수 있다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);

    // 네비게이션에서 설정 링크 클릭
    await page.getByRole('link', { name: /설정/i }).click();
    await expect(page).toHaveURL(/\/settings/);
  });
});

test.describe('대시보드 반응형', () => {
  test('모바일 뷰포트에서 올바르게 표시된다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 667 });

    await loginAsTestUser(page);

    // 기본 요소들이 여전히 표시되는지 확인
    await expect(page.getByText(/안녕하세요/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /콘텐츠 생성/i })).toBeVisible();
  });

  test('태블릿 뷰포트에서 올바르게 표시된다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    // 태블릿 뷰포트 설정
    await page.setViewportSize({ width: 768, height: 1024 });

    await loginAsTestUser(page);

    await expect(page.getByText(/안녕하세요/i)).toBeVisible();
    await expect(page.getByText(/오늘 남은 생성 횟수/i)).toBeVisible();
  });
});
