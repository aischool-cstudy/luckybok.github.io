import { expect, test } from '@playwright/test';

test.describe('홈페이지', () => {
  test('메인 페이지가 정상적으로 로드된다', async ({ page }) => {
    await page.goto('/');

    // 타이틀 확인
    await expect(page).toHaveTitle(/CodeGen AI/);

    // 메인 헤딩 확인 (실제 H1 텍스트)
    await expect(
      page.getByRole('heading', { name: /10분 안에 실무형 코딩 교육 콘텐츠 완성/i })
    ).toBeVisible();

    // CTA 버튼 확인 (실제 링크 텍스트)
    await expect(page.getByRole('link', { name: /무료로 시작하기/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /로그인/i })).toBeVisible();
  });

  test('시작하기 버튼 클릭 시 회원가입 페이지로 이동한다', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /무료로 시작하기/i }).first().click();

    // "무료로 시작하기"는 /register로 이동
    await expect(page).toHaveURL(/\/(register|login)/);
  });
});
