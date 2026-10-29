import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const OUT = 'analysis/chinese/production';
await mkdir(OUT, { recursive: true });
const base = process.env.PRODUCTION_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-unsafe-swiftshader'],
});
const cases = [];
try {
  for (const [index, config] of [
    { width: 1440, height: 900, dpr: 1, reduced: false },
    { width: 1280, height: 800, dpr: 2, reduced: true },
    { width: 1024, height: 768, dpr: 3, reduced: true },
  ].entries()) {
    const page = await browser.newPage({
        viewport: { width: config.width, height: config.height },
        deviceScaleFactor: config.dpr,
      }),
      errors = [],
      requests = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (['error', 'warning'].includes(m.type())) errors.push(m.text());
    });
    page.on('request', (r) =>
      requests.push({ url: r.url(), method: r.method() })
    );
    await page.route('**/*', (route) =>
      new URL(route.request().url()).origin !== base
        ? route.abort()
        : route.continue()
    );
    await page.emulateMedia({
      reducedMotion: config.reduced ? 'reduce' : 'no-preference',
    });
    const response = await page.goto(base);
    expect(response.status()).toBe(200);
    await expect(page.locator('.pencil-canvas')).toHaveCount(1);
    expect(await page.evaluate(() => typeof window.__signatureDebug)).toBe(
      'undefined'
    );
    const text = '王明 Amy，2026！\n中文签名。';
    await page.getByRole('textbox').fill(text);
    await page.getByRole('button', { name: 'Write signature' }).click();
    if (!config.reduced) {
      await expect(page.locator('main')).toHaveAttribute(
        'data-state',
        'writing'
      );
      await page.waitForTimeout(1800);
      const partial = await page
        .locator('[data-route]')
        .evaluateAll((nodes) =>
          nodes.map((p) => ({
            length: p.getTotalLength(),
            offset: Number(p.style.strokeDashoffset),
          }))
        );
      expect(partial.some((p) => p.offset > 0)).toBe(true);
      expect(partial.some((p) => p.offset < p.length)).toBe(true);
      await page.screenshot({ path: `${OUT}/writing.png` });
    }
    await expect(page.locator('main')).toHaveAttribute(
      'data-state',
      'written',
      { timeout: 60000 }
    );
    const full = await page
      .locator('[data-outline]')
      .evaluateAll((nodes) =>
        nodes.map((p) => ({
          opacity: Number(p.style.opacity),
          mask: p.getAttribute('mask'),
        }))
      );
    expect(full.length).toBeGreaterThan(10);
    expect(full.every((p) => p.opacity === 1 && p.mask === null)).toBe(true);
    const ratio = await page
      .locator('.pencil-canvas')
      .evaluate((c) => c.width / c.getBoundingClientRect().width);
    expect(ratio).toBeLessThanOrEqual(2);
    await page.screenshot({ path: `${OUT}/desktop-dpr-${config.dpr}.png` });
    await page.getByRole('button', { name: 'Erase signature' }).click();
    await expect(page.locator('main')).toHaveAttribute('data-state', 'idle');
    await expect(page.getByRole('textbox')).toHaveValue('');
    await expect(page.locator('[data-stroke]')).toHaveCount(0);
    await page.getByRole('textbox').fill('曦麟🙂');
    await page.getByRole('textbox').press('Enter');
    await expect(page.locator('#signature-status')).toContainText(
      '第 1 个字符'
    );
    await expect(page.locator('#signature-status')).toContainText(
      '第 2 个字符'
    );
    await expect(page.locator('#signature-status')).toContainText(
      '第 3 个字符'
    );
    await expect(page.getByRole('textbox')).toHaveValue('曦麟🙂');
    await expect(page.getByRole('textbox')).toBeEditable();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('textbox').fill('Shakespeare');
    await page.getByRole('textbox').press('Enter');
    await expect(page.locator('main')).toHaveAttribute('data-state', 'written');
    await page.getByRole('button', { name: 'Erase signature' }).click();
    await expect(page.locator('main')).toHaveAttribute('data-state', 'idle');
    const licence = await page.request.get(`${base}/glyphs/ARPHICPL.TXT`);
    expect(licence.status()).toBe(200);
    expect(await licence.text()).toContain('ARPHIC PUBLIC LICENSE');
    const provenance = await page.request.get(`${base}/glyphs/provenance.json`);
    expect(provenance.status()).toBe(200);
    expect(errors).toEqual([]);
    expect(
      requests.every(
        (r) => new URL(r.url).origin === base && r.method === 'GET'
      )
    ).toBe(true);
    cases.push({
      config,
      httpStatus: response.status(),
      fullStrokeCount: full.length,
      canvasPixelRatio: ratio,
      debugApiIncluded: false,
      errors,
      localRequests: requests,
      licenceAvailable: true,
      provenance: await provenance.json(),
      pass: true,
    });
    await page.close();
  }
  await writeFile(
    `${OUT}/production.json`,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browser: browser.version(),
        pass: cases.every((c) => c.pass),
        scope: 'desktop only per user instruction; no mobile certification',
        cases,
      },
      null,
      2
    )
  );
  console.log(JSON.stringify({ cases: cases.length, pass: true }));
} finally {
  await browser.close();
}
