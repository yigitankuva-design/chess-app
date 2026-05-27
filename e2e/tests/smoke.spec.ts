import { test, expect } from '@playwright/test';

test('homepage shows welcome heading', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Çocuklar İçin Satranç/i })
  ).toBeVisible();
});
