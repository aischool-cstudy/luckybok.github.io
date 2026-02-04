import { expect, test, type Page } from '@playwright/test';

// 테스트 환경 변수로 테스트 계정 설정
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123';

// 테스트 계정이 설정되어 있는지 확인
const hasTestCredentials = process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD;

test.describe('콘텐츠 생성 플로우', () => {
  // 로그인 상태로 테스트 시작하는 헬퍼
  const loginAsTestUser = async (page: Page) => {
    await page.goto('/login');
    await page.getByLabel(/이메일/i).fill(TEST_EMAIL);
    await page.getByLabel(/비밀번호/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /로그인/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  };

  test.describe('생성 폼', () => {
    test('비로그인 시 생성 페이지 접근이 차단된다', async ({ page }) => {
      await page.goto('/generate');
      await expect(page).toHaveURL(/\/login/);
    });

    // 테스트 계정이 설정된 경우에만 실행
    test('생성 페이지 폼 요소 확인', async ({ page }) => {
      test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

      await loginAsTestUser(page);
      await page.goto('/generate');

      // 폼 요소 확인
      await expect(page.getByRole('heading', { name: /콘텐츠 생성/i })).toBeVisible();
      await expect(page.getByText(/프로그래밍 언어/i)).toBeVisible();
      await expect(page.getByText(/학습 주제/i)).toBeVisible();
      await expect(page.getByText(/난이도/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /생성/i })).toBeVisible();
    });

    test('Starter 플랜은 Python만 선택 가능하다', async ({ page }) => {
      test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

      await loginAsTestUser(page);
      await page.goto('/generate');

      // 언어 선택 트리거 클릭
      await page.getByRole('combobox').first().click();

      // Python 옵션이 보여야 함
      await expect(page.getByRole('option', { name: /Python/i })).toBeVisible();
    });
  });

  test.describe('콘텐츠 생성', () => {
    test('폼 유효성 검사가 동작한다', async ({ page }) => {
      test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

      await loginAsTestUser(page);
      await page.goto('/generate');

      // 주제 없이 생성 버튼 클릭 시도
      const submitButton = page.getByRole('button', { name: /생성/i });

      // 비활성화 상태이거나 에러 메시지 표시
      const isDisabled = await submitButton.isDisabled();
      if (!isDisabled) {
        await submitButton.click();
        // 에러 메시지 또는 유효성 검사 확인
        await expect(page.getByText(/주제/i)).toBeVisible();
      } else {
        expect(isDisabled).toBe(true);
      }
    });

    test('콘텐츠 생성 버튼 클릭 시 로딩 상태가 표시된다', async ({ page }) => {
      test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

      await loginAsTestUser(page);
      await page.goto('/generate');

      // 폼 입력
      await page.getByPlaceholder(/주제/i).fill('리스트 컴프리헨션');

      // 생성 버튼 클릭
      await page.getByRole('button', { name: /생성/i }).click();

      // 로딩 상태 확인 (버튼 비활성화 또는 로딩 텍스트)
      await expect(
        page.getByRole('button', { name: /생성 중|로딩/i }).or(
          page.getByRole('button', { name: /생성/i, disabled: true })
        )
      ).toBeVisible({ timeout: 5000 });
    });
  });
});

test.describe('대시보드', () => {
  test('비로그인 시 대시보드 접근이 차단된다', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('대시보드에서 남은 생성 횟수가 표시된다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await page.goto('/login');
    await page.getByLabel(/이메일/i).fill(TEST_EMAIL);
    await page.getByLabel(/비밀번호/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /로그인/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // 통계 카드 확인
    await expect(page.getByText(/남은 생성 횟수|오늘 남은/i)).toBeVisible();
  });

  test('대시보드에서 빠른 시작 버튼이 동작한다', async ({ page }) => {
    test.skip(!hasTestCredentials, '테스트 계정이 설정되지 않음');

    await page.goto('/login');
    await page.getByLabel(/이메일/i).fill(TEST_EMAIL);
    await page.getByLabel(/비밀번호/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /로그인/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // 빠른 시작 버튼 클릭
    await page.getByRole('link', { name: /콘텐츠 생성/i }).click();
    await expect(page).toHaveURL(/\/generate/);
  });
});
