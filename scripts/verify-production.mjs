import { chromium, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { buildSignature, INK_COLOR, STROKE_WIDTH } from '../src/handwriting/signature.js';

const out = path.resolve('analysis', 'verification');
await mkdir(out, { recursive: true });
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || (existsSync(chrome) ? chrome : undefined),
  args: ['--enable-unsafe-swiftshader'],
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  const response = await page.goto('http://127.0.0.1:4173/');
  expect(response.status()).toBe(200);
  await expect(page.locator('.pencil-scene canvas')).toHaveCount(1);
  expect(await page.evaluate(() => typeof window.__signatureDebug)).toBe('undefined');
  await page.getByRole('textbox').fill('Shakespeare');
  await page.getByRole('textbox').press('Enter');
  await expect(page.locator('main')).toHaveAttribute('data-state', 'written');
  await expect(page.getByRole('button', { name: 'Erase signature' })).toBeEnabled();
  const strokes = await page.locator('.signature-ink path').evaluateAll((paths) => paths.map((p) => ({
    length: p.getTotalLength(), offset: Number(p.style.strokeDashoffset), opacity: Number(p.style.opacity),
  })));
  expect(strokes.length).toBeGreaterThan(10);
  expect(strokes.every((p) => p.length > 0 && p.offset === 0 && p.opacity === 1)).toBe(true);
  await page.screenshot({ path: path.join(out, 'production-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator('.signature-ink').evaluate((svg) => svg.viewBox.baseVal.width)).toBe(390);
  await page.screenshot({ path: path.join(out, 'production-mobile.png') });
  await page.getByRole('button', { name: 'Erase signature' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-state', 'idle');
  await expect(page.getByRole('textbox')).toHaveValue('');
  await expect(page.locator('.signature-ink path')).toHaveCount(0);
  expect(errors).toEqual([]);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const report = { date, productionHttpStatus: response.status(), deviceScaleFactor: 2, signedStrokeCount: strokes.length, debugApiIncluded: false, writeAndErase: 'passed', consoleErrors: errors };
  await writeFile(path.join(out, 'production-smoke.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));

  // A source-centreline contact sheet for visual QA, separate from the product UI.
  const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'];
  const cells = letters.map((letter, index) => {
    const x = index % 8 * 144, y = Math.floor(index / 8) * 144;
    const signature = buildSignature(letter);
    const centre = (signature.bounds.minX + signature.bounds.maxX) / 2;
    return `<g transform="translate(${x} ${y})"><rect width="144" height="144" fill="none" stroke="#e0e1dc"/><text x="12" y="20" fill="#73766e" font-family="Arial" font-size="13">${letter}</text><g transform="translate(${72 - centre} 110)" fill="none" stroke="${INK_COLOR}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${signature.strokes.map((s) => `<path d="${s.d}"/>`).join('')}</g></g>`;
  }).join('');
  const atlasPath = path.join(out, 'glyph-atlas.svg');
  await writeFile(atlasPath, `<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="1008" viewBox="0 0 1152 1008"><rect width="1152" height="1008" fill="#f3f3f1"/>${cells}</svg>`);
  const atlas = await browser.newPage({ viewport: { width: 1152, height: 1008 }, deviceScaleFactor: 1 });
  await atlas.goto(pathToFileURL(atlasPath).href);
  await atlas.screenshot({ path: path.join(out, 'glyph-atlas.png') });
} finally {
  await browser.close();
}
