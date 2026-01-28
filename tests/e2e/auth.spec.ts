import { expect, test } from '@playwright/test';

test.describe('인증 플로우', () => {
  test.describe('회원가입', () => {
    test('회원가입 폼이 정상적으로 표시된다', async ({ page }) => {
      await page.goto('/register');

      await expect(page.getByRole('heading', { name: /회원가입/i })).toBeVisible();
      await expect(page.getByLabel(/이름/i)).toBeVisible();
      await expect(page.getByLabel(/이메일/i)).toBeVisible();
      await expect(page.getByLabel(/^비밀번호$/i)).toBeVisible();
      await expect(page.getByLabel(/비밀번호 확인/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /회원가입/i })).toBeVisible();
    });

    test('빈 폼 제출 시 검증 오류가 표시된다', async ({ page }) => {
      await page.goto('/register');

      await page.getByRole('button', { name: /회원가입/i }).click();

      // 검증 오류 메시지 확인
      await expect(page.getByText(/이름을 입력해주세요/i)).toBeVisible();
    });

    test('비밀번호 불일치 시 오류가 표시된다', async ({ page }) => {
      await page.goto('/register');

      await page.getByLabel(/이름/i).fill('테스트 사용자');
      await page.getByLabel(/이메일/i).fill('test@example.com');
      await page.getByLabel(/^비밀번호$/i).fill('password123');
      await page.getByLabel(/비밀번호 확인/i).fill('different123');

      await page.getByRole('button', { name: /회원가입/i }).click();

      await expect(page.getByText(/비밀번호가 일치하지 않습니다/i)).toBeVisible();
    });

    test('로그인 페이지로 이동 링크가 동작한다', async ({ page }) => {
      await page.goto('/register');

      await page.getByRole('link', { name: /로그인/i }).click();

      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('로그인', () => {
    test('로그인 폼이 정상적으로 표시된다', async ({ page }) => {
      await page.goto('/login');

      await expect(page.getByRole('heading', { name: /로그인/i })).toBeVisible();
      await expect(page.getByLabel(/이메일/i)).toBeVisible();
      await expect(page.getByLabel(/비밀번호/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /로그인/i })).toBeVisible();
    });

    test('빈 폼 제출 시 검증 오류가 표시된다', async ({ page }) => {
      await page.goto('/login');

      await page.getByRole('button', { name: /로그인/i }).click();

      // 검증 오류 메시지 확인
      await expect(page.getByText(/이메일을 입력해주세요/i)).toBeVisible();
    });

    test('잘못된 자격 증명 시 오류 메시지가 표시된다', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/이메일/i).fill('wrong@example.com');
      await page.getByLabel(/비밀번호/i).fill('wrongpassword');

      await page.getByRole('button', { name: /로그인/i }).click();

      // 오류 메시지 대기 (네트워크 요청 필요)
      await expect(page.getByText(/이메일 또는 비밀번호가 올바르지 않습니다|오류/i)).toBeVisible({
        timeout: 10000,
      });
    });

    test('회원가입 페이지로 이동 링크가 동작한다', async ({ page }) => {
      await page.goto('/login');

      await page.getByRole('link', { name: /회원가입/i }).click();

      await expect(page).toHaveURL(/\/register/);
    });
  });

  test.describe('보호된 라우트', () => {
    test('비로그인 시 대시보드 접근이 차단된다', async ({ page }) => {
      await page.goto('/dashboard');

      // 로그인 페이지로 리다이렉트
      await expect(page).toHaveURL(/\/login/);
    });

    test('비로그인 시 생성 페이지 접근이 차단된다', async ({ page }) => {
      await page.goto('/generate');

      // 로그인 페이지로 리다이렉트
      await expect(page).toHaveURL(/\/login/);
    });

    test('리다이렉트 시 원래 URL이 보존된다', async ({ page }) => {
      await page.goto('/generate');

      // 로그인 페이지로 리다이렉트되며 redirectTo 파라미터 포함
      await expect(page).toHaveURL(/\/login\?redirectTo=%2Fgenerate/);
    });
  });
});
