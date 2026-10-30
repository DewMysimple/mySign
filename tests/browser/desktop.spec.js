import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
test('desktop prototype/mixed writing, IME, rejected newlines, erase, English and live reduced motion', async ({
  page,
  browserName,
}, testInfo) => {
  const out = 'analysis/xingshu-v2/browser';
  await mkdir(out, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__signatureDebug);
  const input = page.getByRole('textbox');
  await input.fill('你\n好');
  await input.press('Enter');
  await expect(page.locator('main')).toHaveAttribute('data-state', 'idle');
  await expect(input).toHaveValue('你\n好');
  await expect(page.locator('#signature-status')).toContainText('单行');
  const text = '你好 王明 Amy，2026！';
  await input.fill(text);
  await input.dispatchEvent('compositionstart');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  await expect(page.locator('main')).toHaveAttribute('data-state', 'idle');
  await input.dispatchEvent('compositionend');
  await page.getByRole('button', { name: 'Write signature' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-state', 'writing');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('main')).toHaveAttribute('data-state', 'written');
  const d = await page.evaluate(() => window.__signatureDebug.inspect());
  expect(d.lines).toEqual([text]);
  expect(d.prototypeCharacters).toEqual(['你', '好']);
  expect(await page.locator('[data-outline]').evaluateAll(nodes => nodes.every(n => n.style.opacity === '1' && !n.hasAttribute('mask')))).toBe(true);
  expect(d.reducedMotion).toBe(true);
  await page.screenshot({
    path: `${out}/${testInfo.project.name.toLowerCase()}-written.png`,
  });
  await page.getByRole('button', { name: 'Erase signature' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-state', 'idle');
  await expect(input).toHaveValue('');
  await input.fill('Shakespeare');
  await input.press('Enter');
  await expect(page.locator('main')).toHaveAttribute('data-state', 'written');
  await page.getByRole('button', { name: 'Erase signature' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-state', 'idle');
  expect(errors).toEqual([]);
  await writeFile(
    `${out}/${testInfo.project.name.toLowerCase()}-result.json`,
    JSON.stringify(
      {
        browser: browserName,
        version: page.context().browser().version(),
        mixed: d,
        errors,
        final: await page.evaluate(() => window.__signatureDebug.inspect()),
      },
      null,
      2
    )
  );
});
