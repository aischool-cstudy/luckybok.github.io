import { expect, test } from '@playwright/test';

test.describe('홈페이지', () => {
  test('메인 페이지가 정상적으로 로드된다', async ({ page }) => {
    await page.goto('/');

    // 타이틀 확인
    await expect(page).toHaveTitle(/CodeGen AI/);

    // 메인 헤딩 확인
    await expect(page.getByRole('heading', { name: /CodeGen AI/i })).toBeVisible();

    // CTA 버튼 확인
    await expect(page.getByRole('link', { name: /시작하기/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /회원가입/i })).toBeVisible();
  });

  test('시작하기 버튼 클릭 시 로그인 페이지로 이동한다', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /시작하기/i }).click();

    await expect(page).toHaveURL(/\/login/);
  });
});
