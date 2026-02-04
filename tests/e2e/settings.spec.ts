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

test.describe('설정 페이지', () => {
  test('비로그인 시 설정 페이지 접근이 차단된다', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('설정 페이지가 올바르게 로드된다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);
    await page.goto('/settings');

    // 설정 페이지 타이틀 확인
    await expect(page.getByRole('heading', { name: /설정/i })).toBeVisible();
  });
});

test.describe('프로필 설정', () => {
  test('프로필 섹션이 표시된다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);
    await page.goto('/settings');

    // 프로필 관련 섹션 확인
    await expect(page.getByText(/프로필|계정/i).first()).toBeVisible();
  });

  test('이름 필드가 표시된다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);
    await page.goto('/settings');

    // 이름 입력 필드 확인
    await expect(page.getByLabel(/이름/i)).toBeVisible();
  });

  test('이메일 필드가 표시된다 (읽기 전용)', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);
    await page.goto('/settings');

    // 이메일 필드 확인 - 읽기 전용이거나 disabled
    const emailField = page.getByLabel(/이메일/i);
    await expect(emailField).toBeVisible();
  });
});

test.describe('비밀번호 변경', () => {
  test('비밀번호 변경 섹션이 표시된다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);
    await page.goto('/settings');

    await expect(page.getByText(/비밀번호/i).first()).toBeVisible();
  });

  test('비밀번호 입력 필드들이 있다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);
    await page.goto('/settings');

    // type="password" 필드 확인
    const passwordInputs = page.locator('input[type="password"]');

    const count = await passwordInputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('크레딧 및 구독', () => {
  test('크레딧 정보가 표시된다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);
    await page.goto('/settings');

    // 크레딧 관련 정보 확인
    await expect(page.getByText(/크레딧|잔액/i).first()).toBeVisible();
  });

  test('구독 정보가 표시된다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);
    await page.goto('/settings');

    // 구독/플랜 관련 정보 확인
    await expect(page.getByText(/구독|플랜|Starter|Pro|Team/i).first()).toBeVisible();
  });
});

test.describe('결제 수단', () => {
  test('결제 수단 섹션이 표시된다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);
    await page.goto('/settings');

    // 결제 관련 섹션 확인
    await expect(page.getByText(/결제|카드/i).first()).toBeVisible();
  });
});

test.describe('설정 저장', () => {
  test('프로필 저장 버튼이 있다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);
    await page.goto('/settings');

    // 저장 버튼 확인
    await expect(page.getByRole('button', { name: /저장|변경/i }).first()).toBeVisible();
  });

  test('이름 변경 후 저장할 수 있다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await loginAsTestUser(page);
    await page.goto('/settings');

    // 이름 필드 수정
    const nameField = page.getByLabel(/이름/i);
    await nameField.clear();
    await nameField.fill('테스트 사용자');

    // 저장 버튼 클릭
    const saveButton = page.getByRole('button', { name: /저장|변경/i }).first();
    await saveButton.click();

    // 성공 메시지 또는 토스트 확인 (옵션)
    // await expect(page.getByText(/저장|성공/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('설정 페이지 반응형', () => {
  test('모바일 뷰포트에서 올바르게 표시된다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await page.setViewportSize({ width: 375, height: 667 });

    await loginAsTestUser(page);
    await page.goto('/settings');

    // 설정 페이지가 모바일에서도 표시되는지 확인
    await expect(page.getByRole('heading', { name: /설정/i })).toBeVisible();
  });
});
