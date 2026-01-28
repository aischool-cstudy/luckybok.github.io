import { expect, test, type Page } from '@playwright/test';

// 테스트 환경 변수로 테스트 계정 설정 (실제 테스트 시 필요)
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123';

test.describe('콘텐츠 생성 플로우', () => {
  // 로그인 상태로 테스트 시작하는 헬퍼
  const loginAsTestUser = async (page: Page) => {
    await page.goto('/login');
    await page.getByLabel(/이메일/i).fill(TEST_EMAIL);
    await page.getByLabel(/비밀번호/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /로그인/i }).click();
    await page.waitForURL(/\/dashboard/);
  };

  test.describe('생성 폼', () => {
    test('생성 폼이 정상적으로 표시된다 (로그인 필요)', async ({ page }) => {
      // 로그인 시도 후 페이지 로드
      await page.goto('/generate');

      // 비로그인 시 로그인 페이지로 리다이렉트
      await expect(page).toHaveURL(/\/login/);
    });

    // 실제 Supabase 연결 후 활성화할 테스트
    test.skip('생성 페이지 폼 요소 확인', async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/generate');

      // 폼 요소 확인
      await expect(page.getByRole('heading', { name: /콘텐츠 생성/i })).toBeVisible();
      await expect(page.getByLabel(/프로그래밍 언어/i)).toBeVisible();
      await expect(page.getByLabel(/학습 주제/i)).toBeVisible();
      await expect(page.getByLabel(/난이도/i)).toBeVisible();
      await expect(page.getByLabel(/학습자 유형/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /콘텐츠 생성하기/i })).toBeVisible();
    });

    test.skip('Starter 플랜은 Python만 선택 가능하다', async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/generate');

      // 언어 선택 드롭다운 열기
      await page.getByLabel(/프로그래밍 언어/i).click();

      // Python은 활성화, 다른 언어는 비활성화 또는 "Pro 전용" 표시
      await expect(page.getByText(/Python/i)).toBeVisible();
      await expect(page.getByText(/Pro 전용/i)).toBeVisible();
    });
  });

  test.describe('콘텐츠 생성 (Mock)', () => {
    test.skip('콘텐츠 생성 버튼 클릭 시 로딩 상태가 표시된다', async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/generate');

      // 폼 입력
      await page.getByLabel(/학습 주제/i).fill('리스트 컴프리헨션');

      // 생성 버튼 클릭
      await page.getByRole('button', { name: /콘텐츠 생성하기/i }).click();

      // 로딩 상태 확인
      await expect(page.getByText(/생성 중/i)).toBeVisible();
    });
  });

  test.describe('콘텐츠 표시', () => {
    test.skip('생성된 콘텐츠가 올바르게 표시된다', async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/generate');

      // 폼 입력 및 제출
      await page.getByLabel(/학습 주제/i).fill('변수와 자료형');
      await page.getByRole('button', { name: /콘텐츠 생성하기/i }).click();

      // 생성 완료 대기 (최대 60초)
      await expect(page.getByText(/학습 목표/i)).toBeVisible({ timeout: 60000 });

      // 콘텐츠 섹션 확인
      await expect(page.getByText(/핵심 개념/i)).toBeVisible();
      await expect(page.getByText(/예제 코드/i)).toBeVisible();
      await expect(page.getByText(/핵심 요약/i)).toBeVisible();
    });

    test.skip('퀴즈 탭으로 전환할 수 있다', async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/generate');

      // 콘텐츠 생성 (이전 테스트와 동일)
      await page.getByLabel(/학습 주제/i).fill('함수 정의');
      await page.getByRole('button', { name: /콘텐츠 생성하기/i }).click();

      // 생성 완료 대기
      await expect(page.getByText(/학습 목표/i)).toBeVisible({ timeout: 60000 });

      // 퀴즈 탭 클릭
      await page.getByRole('button', { name: /퀴즈/i }).click();

      // 퀴즈 내용 확인
      await expect(page.getByText(/문제 1/i)).toBeVisible();
    });
  });
});

test.describe('대시보드', () => {
  test('비로그인 시 대시보드 접근이 차단된다', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test.skip('대시보드에서 남은 생성 횟수가 표시된다', async ({ page }) => {
    // 로그인 후 대시보드 확인
    await page.goto('/login');
    await page.getByLabel(/이메일/i).fill(TEST_EMAIL);
    await page.getByLabel(/비밀번호/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /로그인/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    // 통계 카드 확인
    await expect(page.getByText(/남은 생성 횟수/i)).toBeVisible();
  });
});
