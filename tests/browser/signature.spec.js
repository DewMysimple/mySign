import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('analysis', 'xingshu', 'english');
const inspect = (page) => page.evaluate(() => window.__signatureDebug.inspect());
const state = (page) => page.locator('main');
const waitForState = (page, value) => expect(state(page)).toHaveAttribute('data-state', value);

async function launch(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(`${message.type()}: ${message.text()}`);
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__signatureDebug);
  await mkdir(OUT, { recursive: true });
  return errors;
}

/** Sample the ACTUAL SVG dash endpoint, independently of controller inkPoint. */
async function recordFrames(page, milliseconds) {
  return page.evaluate((duration) => new Promise((resolve) => {
    const samples = [];
    const started = performance.now();
    let previous = started;
    const step = (now) => {
      const debug = window.__signatureDebug.inspect();
      if (debug.phase === 'stroke' && debug.strokeProgress > 0) {
        const el = document.querySelectorAll('.signature-ink path')[debug.strokeIndex];
        const length = el.getTotalLength();
        const offset = Number.parseFloat(getComputedStyle(el).strokeDashoffset);
        const p = el.getPointAtLength(length - offset);
        const screen = new DOMPoint(p.x, p.y).matrixTransform(el.getScreenCTM());
        samples.push({
          dt: now - previous,
          index: debug.strokeIndex,
          progress: debug.strokeProgress,
          error: Math.hypot(screen.x - debug.projectedTip.x, screen.y - debug.projectedTip.y),
        });
      }
      previous = now;
      if (now - started >= duration || debug.state === 'written') resolve(samples);
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), milliseconds);
}

async function assertInkInsideViewport(page) {
  const bounds = await page.evaluate(() => {
    const box = document.querySelector('.signature-ink g').getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, w: innerWidth, h: innerHeight };
  });
  expect(bounds.left).toBeGreaterThan(0);
  expect(bounds.right).toBeLessThan(bounds.w);
  expect(bounds.top).toBeGreaterThan(0);
  expect(bounds.bottom).toBeLessThan(bounds.h * 0.7);
  const form = await page.locator('form').boundingBox();
  expect(form.x).toBeGreaterThanOrEqual(0);
  expect(form.x + form.width).toBeLessThanOrEqual(bounds.w);
  expect(form.y + form.height).toBeLessThan(bounds.h);
}

test('full real-time lifecycle, true SVG/3D synchrony, particle erase and a second name', async ({ page }) => {
  const errors = await launch(page);
  const input = page.getByRole('textbox');
  const initial = await inspect(page);
  await expect(input).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Write signature' })).toBeDisabled();
  await expect(page.locator('.signature-ink path')).toHaveCount(0);
  await expect(page.locator('.pencil-scene canvas')).toHaveCount(1);
  await input.press('Enter');
  await waitForState(page, 'idle');
  await page.screenshot({ path: path.join(OUT, 'desktop-initial.png') });

  await input.fill('Shakespeare');
  await input.press('Enter');
  await waitForState(page, 'writing');
  await expect(page.getByRole('button')).toBeDisabled();
  await expect(input).toHaveAttribute('readonly', '');
  // Repeated native and programmatic submissions must not reset the timeline.
  await input.press('Enter');
  await page.locator('form').evaluate((form) => {
    for (let i = 0; i < 8; i++) form.requestSubmit();
  });
  const partial = await recordFrames(page, 2500);
  await page.screenshot({ path: path.join(OUT, 'desktop-writing.png') });
  const later = await recordFrames(page, 10000);
  await waitForState(page, 'written');
  await expect(page.getByRole('button', { name: 'Erase signature' })).toBeEnabled();
  const signed = await inspect(page);
  expect(signed.name).toBe('Shakespeare');
  expect(signed.active).toBe(false);
  await assertInkInsideViewport(page);
  const offsets = await page.locator('.signature-ink path').evaluateAll((paths) => paths.map((p) => Number(p.style.strokeDashoffset)));
  expect(offsets.every((v) => v === 0)).toBe(true);
  await page.screenshot({ path: path.join(OUT, 'desktop-written.png') });
  const renders = signed.renderCount;
  await page.waitForTimeout(160);
  expect((await inspect(page)).renderCount).toBe(renders); // no idle render loop

  await page.getByRole('button', { name: 'Erase signature' }).click();
  await waitForState(page, 'erasing');
  await expect(page.getByRole('button')).toBeDisabled();
  expect((await inspect(page)).particles).toBeGreaterThan(1000);
  await page.waitForTimeout(140);
  await page.screenshot({ path: path.join(OUT, 'desktop-particles.png') });
  await waitForState(page, 'idle');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(page.locator('.signature-ink path')).toHaveCount(0);
  const cleared = await inspect(page);
  expect(Math.hypot(cleared.projectedTip.x - initial.projectedTip.x, cleared.projectedTip.y - initial.projectedTip.y)).toBeLessThan(0.01);
  expect(cleared.particles).toBe(0);

  await input.fill('Amy');
  await page.getByRole('button', { name: 'Write signature' }).click();
  await waitForState(page, 'written');
  expect((await inspect(page)).name).toBe('Amy');
  await assertInkInsideViewport(page);
  await page.screenshot({ path: path.join(OUT, 'desktop-amy.png') });
  await page.getByRole('button', { name: 'Erase signature' }).click();
  await waitForState(page, 'idle');
  const after = await inspect(page);
  expect(after.geometries).toBe(initial.geometries);
  expect(after.textures).toBe(initial.textures);
  await expect(page.locator('canvas')).toHaveCount(2);

  const samples = [...partial, ...later];
  expect(samples.length).toBeGreaterThan(150);
  const maxError = Math.max(...samples.map((s) => s.error));
  expect(maxError).toBeLessThan(0.2);
  expect(errors).toEqual([]);
  await writeFile(path.join(OUT, 'synchronization.json'), JSON.stringify({
    sampleCount: samples.length, maxErrorPx: maxError,
    p95FrameIntervalMs: samples.map((s) => s.dt).sort((a, b) => a - b)[Math.floor(samples.length * 0.95)],
    initialResources: initial, finalResources: after, consoleErrors: errors, samples,
  }, null, 2));
});

test('resizing while writing and erasing keeps pen, signature and controls together', async ({ page }) => {
  const errors = await launch(page);
  const input = page.getByRole('textbox');
  await input.fill('Mary Jane');
  await input.press('Enter');
  await page.waitForFunction(() => window.__signatureDebug.inspect().phase === 'stroke');
  const samples = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 880, height: 360 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => (await inspect(page)).layout.width).toBe(viewport.width);
    samples.push(...await recordFrames(page, 500));
    await assertInkInsideViewport(page);
  }
  await waitForState(page, 'written');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await inspect(page)).layout.width).toBe(390);
  await assertInkInsideViewport(page);
  await page.screenshot({ path: path.join(OUT, 'mobile-written.png') });
  await page.getByRole('button', { name: 'Erase signature' }).click();
  await page.setViewportSize({ width: 320, height: 568 });
  await waitForState(page, 'idle');
  await expect(input).toHaveValue('');
  await page.screenshot({ path: path.join(OUT, 'mobile-initial.png') });
  const after = await inspect(page);
  expect(after.projectedTip.x).toBeCloseTo(320 * 0.77, 3);
  expect(after.projectedTip.y).toBeCloseTo(568 * 0.505, 3);
  expect(samples.length).toBeGreaterThan(25);
  expect(Math.max(...samples.map((s) => s.error))).toBeLessThan(0.2);
  expect(errors).toEqual([]);
  await writeFile(path.join(OUT, 'responsive.json'), JSON.stringify({ sampleCount: samples.length, maxErrorPx: Math.max(...samples.map((s) => s.error)), consoleErrors: errors }, null, 2));
});

test('reduced motion, complete alphabet, a long name, repeated erase and input recovery', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await launch(page);
  const input = page.getByRole('textbox');
  const initial = await inspect(page);
  expect(initial.reducedMotion).toBe(true);
  // 中文及数字已成为合法输入；用仍未注册的 emoji 验证原拒绝/恢复行为。
  await input.fill('名字🙂');
  await input.press('Enter');
  await waitForState(page, 'idle');
  expect(await input.evaluate((el) => el.validity.customError)).toBe(true);
  await expect(page.locator('.signature-ink path')).toHaveCount(0);

  for (const name of ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz', 'Alexandria Montgomery Fitzgerald', 'i j t f', 'A', 'aBc XYZ']) {
    await input.fill(name);
    await input.press('Enter');
    await waitForState(page, 'written');
    const debug = await inspect(page);
    expect(debug.name).toBe(name);
    expect(debug.duration).toBeLessThan(1.1);
    await assertInkInsideViewport(page);
    if (name.startsWith('Alexandria')) await page.screenshot({ path: path.join(OUT, 'long-name.png') });
    await page.getByRole('button', { name: 'Erase signature' }).click();
    expect((await inspect(page)).particles).toBe(0);
    await waitForState(page, 'idle');
    await expect(input).toHaveValue('');
    await expect(page.locator('.signature-ink path')).toHaveCount(0);
  }
  const end = await inspect(page);
  expect(end.geometries).toBe(initial.geometries);
  expect(end.textures).toBe(initial.textures);
  expect(errors).toEqual([]);
});
