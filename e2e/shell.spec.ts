import { expect, test } from '@playwright/test';

test('app shell renders with the dark theme', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  await expect(page).toHaveTitle('PCB Reverse Tracer');
  await expect(page.getByRole('heading', { level: 1, name: 'PCB Reverse Tracer' })).toBeVisible();
  await expect(page.getByRole('main', { name: 'Board view' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Tools' })).toBeVisible();

  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe('rgb(21, 23, 26)');
  expect(errors).toEqual([]);
});

test('layout fits the minimum supported viewport (1366×768) without scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');

  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth > window.innerWidth,
    y: document.documentElement.scrollHeight > window.innerHeight,
  }));
  expect(overflow).toEqual({ x: false, y: false });
});
