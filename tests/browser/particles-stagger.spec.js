import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
test('mixed Latin particles start with their own stroke instead of erupting ahead of the Chinese erase', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__signatureDebug);
  await page.getByRole('textbox').fill('王A');
  await page.getByRole('button', { name: 'Write signature' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-state', 'written');
  const threshold = await page
    .locator('[data-engine="latin"]')
    .first()
    .evaluate((el) => el.getBoundingClientRect().x + 30);
  await page.getByRole('button', { name: 'Erase signature' }).click();
  await page.waitForFunction(() => {
    const d = window.__signatureDebug.inspect();
    return d.eraseProgress > 0.08 && d.eraseProgress < 0.18;
  });
  const sample = () =>
    page.evaluate((threshold) => {
      const c = document.querySelector('.particle-canvas'),
        data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
        edge = Math.floor((threshold * c.width) / innerWidth);
      let left = 0,
        right = 0;
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          if (data[(y * c.width + x) * 4 + 3]) {
            if (x > edge) right++;
            else left++;
          }
        }
      return {
        left,
        right,
        progress: window.__signatureDebug.inspect().eraseProgress,
      };
    }, threshold);
  const early = await sample();
  expect(early.left).toBeGreaterThan(0);
  expect(early.right).toBe(0);
  await page.waitForFunction(() => {
    const p = window.__signatureDebug.inspect().eraseProgress;
    return p > 0.46 && p < 0.62;
  });
  const later = await sample();
  expect(later.right).toBeGreaterThan(0);
  await expect(page.locator('main')).toHaveAttribute('data-state', 'idle');
  await mkdir('analysis/chinese/browser', { recursive: true });
  await writeFile(
    'analysis/chinese/browser/particle-order.json',
    JSON.stringify({ threshold, early, later }, null, 2)
  );
});
