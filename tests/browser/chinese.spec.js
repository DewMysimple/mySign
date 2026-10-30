import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('analysis/xingshu-v2/browser');
const inspect = (page) =>
  page.evaluate(() => window.__signatureDebug.inspect());
const waitState = (page, state) =>
  expect(page.locator('main')).toHaveAttribute('data-state', state);
async function launch(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type()))
      errors.push(`${m.type()}: ${m.text()}`);
  });
  await mkdir(OUT, { recursive: true });
  await page.goto('/');
  await page.waitForFunction(() => window.__signatureDebug);
  return errors;
}
async function sign(page, text) {
  await page.getByRole('textbox').fill(text);
  await page.getByRole('button', { name: 'Write signature' }).click();
}
async function erase(page) {
  await page.getByRole('button', { name: 'Erase signature' }).click();
  await waitState(page, 'idle');
}
async function sample(page, milliseconds) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const samples = [],
          start = performance.now();
        let previous = start;
        function frame(now) {
          const d = window.__signatureDebug.inspect();
          if (d.phase === 'stroke' && d.strokeProgress > 0) {
            const el = document.querySelector(
                `[data-route="${d.strokeIndex}"]`
              ),
              length = el.getTotalLength();
            const p = el.getPointAtLength(
              length - parseFloat(getComputedStyle(el).strokeDashoffset)
            );
            const visual =
              document.querySelector(`[data-outline="${d.strokeIndex}"]`) || el;
            const point = new DOMPoint(p.x, p.y).matrixTransform(
              visual.getScreenCTM()
            );
            samples.push({
              index: d.strokeIndex,
              p: d.strokeProgress,
              dt: now - previous,
              error: Math.hypot(
                point.x - d.projectedTip.x,
                point.y - d.projectedTip.y
              ),
            });
          }
          previous = now;
          if (now - start >= duration || d.state !== 'writing')
            resolve(samples);
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }),
    milliseconds
  );
}

test('Chinese full contours, mixed original Latin, digits, punctuation, synchrony and sequential area particles', async ({
  page,
}) => {
  const errors = await launch(page),
    initial = await inspect(page);
  const text = '王明 Amy，2026！';
  await sign(page, text);
  await waitState(page, 'writing');
  const samples = await sample(page, 1800);
  await page.screenshot({ path: path.join(OUT, 'mixed-writing.png') });
  samples.push(...(await sample(page, 20000)));
  await waitState(page, 'written');
  const written = await inspect(page);
  expect(written.name).toBe(text);
  expect(written.engines).toEqual(
    expect.arrayContaining(['hanzi', 'latin', 'symbol'])
  );
  expect(await page.locator('[data-outline]').count()).toBeGreaterThan(5);
  const full = await page
    .locator('[data-route]')
    .evaluateAll((paths) =>
      paths.every((p) => Number(p.style.strokeDashoffset) === 0)
    );
  expect(full).toBe(true);
  await page.screenshot({ path: path.join(OUT, 'mixed-written.png') });
  expect(samples.length).toBeGreaterThan(100);
  expect(Math.max(...samples.map((s) => s.error))).toBeLessThan(0.2);
  const renderCount = written.renderCount;
  await page.waitForTimeout(100);
  expect((await inspect(page)).renderCount).toBe(renderCount);
  await page.getByRole('button', { name: 'Erase signature' }).click();
  await waitState(page, 'erasing');
  expect((await inspect(page)).particles).toBeGreaterThan(100);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'mixed-particles.png') });
  await waitState(page, 'idle');
  const after = await inspect(page);
  expect(after.cache.raw.pinned).toBe(0);
  expect(after.cache.parsed.pinned).toBe(0);
  expect(after.particles).toBe(0);
  expect(after.geometries).toBe(initial.geometries);
  expect(after.textures).toBe(initial.textures);
  expect(errors).toEqual([]);
  await writeFile(
    path.join(OUT, 'synchronization.json'),
    JSON.stringify(
      {
        sampleCount: samples.length,
        maxErrorPx: Math.max(...samples.map((s) => s.error)),
        written,
        after,
        errors,
        samples,
      },
      null,
      2
    )
  );
});

test('IME Enter is consumed, Shift+Enter cannot insert a newline, all invalid graphemes preserve the input', async ({
  page,
}) => {
  const errors = await launch(page),
    input = page.getByRole('textbox');
  await input.fill('王明');
  await input.dispatchEvent('compositionstart');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  await waitState(page, 'idle');
  await input.dispatchEvent('compositionend');
  await input.evaluate((el) =>
    el.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        keyCode: 229,
        bubbles: true,
        cancelable: true,
      })
    )
  );
  await waitState(page, 'idle');
  await input.press('End');
  await input.press('Shift+Enter');
  await input.press('A');
  await expect(input).toHaveValue('王明A');
  const invalid = '王🙂\tÉ';
  await input.fill(invalid);
  await input.press('Enter');
  await waitState(page, 'idle');
  await expect(input).toHaveValue(invalid);
  await expect(page.locator('#signature-status')).toContainText('第 2 个字符');
  await expect(page.locator('#signature-status')).toContainText('第 3 个字符');
  await expect(page.locator('#signature-status')).toContainText('第 4 个字符');
  await expect(input).toBeEditable();
  await expect(page.locator('[data-stroke]')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const pasted = '王明\n\n  Amy，2026！ ';
  await sign(page, pasted);
  await waitState(page, 'idle');
  await expect(input).toHaveValue(pasted);
  await expect(page.locator('#signature-status')).toContainText('单行');
  await sign(page, '  王明 Amy，2026！ ');
  await waitState(page, 'written');
  const d = await inspect(page);
  expect(d.name).toBe('  王明 Amy，2026！ ');
  expect(d.lines).toEqual(['  王明 Amy，2026！ ']);
  await page.screenshot({ path: path.join(OUT, 'single-line-spaces.png') });
  await erase(page);
  expect(errors).toEqual([]);
});

test('single-line mixed layout survives desktop resize and live motion changes without restarting a stroke', async ({
  page,
}) => {
  const errors = await launch(page);
  await page.setViewportSize({ width: 700, height: 700 });
  await sign(page, '王明 Amy！');
  await waitState(page, 'writing');
  await page.waitForFunction(() => {
    const d = window.__signatureDebug.inspect();
    return d.phase === 'stroke' && d.strokeIndex > 0 && d.strokeProgress > 0.1;
  });
  const before = await inspect(page);
  expect(before.lines).toEqual(['王明 Amy！']);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const changed = await inspect(page);
  expect(changed.strokeIndex).toBeGreaterThanOrEqual(before.strokeIndex);
  await page.setViewportSize({ width: 1280, height: 800 });
  const samples = await sample(page, 5000);
  await waitState(page, 'written');
  const done = await inspect(page);
  expect(done.lines).toEqual(before.lines);
  expect(done.reducedMotion).toBe(true);
  if (samples.length)
    expect(Math.max(...samples.map((s) => s.error))).toBeLessThan(0.2);
  await page.screenshot({ path: path.join(OUT, 'single-line-resize.png') });
  await erase(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await sign(page, '永');
  await waitState(page, 'written');
  await erase(page);
  expect(errors).toEqual([]);
});

test('load failure and preflight budgets preserve original text, then recover with verified caches', async ({
  page,
}) => {
  await launch(page);
  const input = page.getByRole('textbox');
  await page.route('**/glyphs/shard-*.json', (route) => route.abort());
  const text = '张李陈赵';
  await sign(page, text);
  await waitState(page, 'idle');
  await expect(input).toHaveValue(text);
  await expect(input).toBeEditable();
  expect((await inspect(page)).active).toBe(false);
  expect((await inspect(page)).cache.raw.pinned).toBe(0);
  await page.unroute('**/glyphs/shard-*.json');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await sign(page, text);
  await waitState(page, 'written');
  await erase(page);
  const huge = '王'.repeat(1000);
  await sign(page, huge);
  await waitState(page, 'idle');
  await expect(input).toHaveValue(huge);
  await expect(page.locator('#signature-status')).toContainText('超过');
  expect((await inspect(page)).cache.parsed.pinned).toBe(0);
  await sign(page, 'Amy');
  await waitState(page, 'written');
  await erase(page);
});

test('fault injection covers preflight, loading, stroke, lift, particle preparation and erase completion, each retry succeeds', async ({
  page,
}) => {
  const errors = await launch(page);
  const initialPose=await inspect(page);
  const results = [];
  for (const stage of [
    'preflight',
    'loading',
    'stroke',
    'lift',
    'particles',
    'particle-draw',
    'erase',
  ]) {
    const text = '王明 Amy';
    const isClear = ['particles', 'particle-draw', 'erase'].includes(stage);
    await page.emulateMedia({
      reducedMotion:
        isClear && stage !== 'particle-draw' ? 'reduce' : 'no-preference',
    });
    if (isClear) {
      await sign(page, text);
      await waitState(page, 'written');
    }
    await page.evaluate(
      (stage) => window.__signatureDebug.inject(stage),
      stage
    );
    if (isClear)
      await page.getByRole('button', { name: 'Erase signature' }).click();
    else await sign(page, text);
    await waitState(page, 'idle');
    await expect(page.getByRole('textbox')).toHaveValue(text);
    await expect(page.getByRole('textbox')).toBeEditable();
    const d = await inspect(page);
    await writeFile(
      path.join(OUT, `fault-${stage}.json`),
      JSON.stringify(d, null, 2)
    );
    expect(d.active, stage).toBe(false);
    expect(d.particles).toBe(0);
    expect(d.cache.raw.pinned).toBe(0);
    expect(d.cache.parsed.pinned).toBe(0);
    expect(d.strokeCount).toBe(0);
    expect(d.loadAborted).toBe(true);expect(d.hasGlyphLease).toBe(false);
    expect(Math.hypot(d.projectedShadowTip.x-initialPose.projectedShadowTip.x,d.projectedShadowTip.y-initialPose.projectedShadowTip.y)).toBeLessThan(.01);
    expect(d.shadowOpacity).toBeCloseTo(d.reducedMotion?.28:.42,5);
    expect(d.projectedTip.x).toBeCloseTo(1440 * 0.685, 3);
    expect(d.projectedTip.y).toBeCloseTo(900 * 0.505, 3);
    results.push({ stage, after: d });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await sign(page, text);
    await waitState(page, 'written');
    await erase(page);
  }
  expect(errors).toEqual([]);
  await writeFile(
    path.join(OUT, 'faults.json'),
    JSON.stringify({ results, errors }, null, 2)
  );
});

test('bounded cache reuse and resources stay stable through repeated mixed write/clear cycles', async ({
  page,
}) => {
  const errors = await launch(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const initial = await inspect(page),
    cycles = [];
  for (const text of [
    '王明',
    '李华 0123456789',
    '中文，。！？；：“”‘’（）《》',
    '王明',
    '永我心书圆回风飞女水火',
    '王明',
  ]) {
    await sign(page, text);
    await waitState(page, 'written');
    cycles.push(await inspect(page));
    await erase(page);
    const d = await inspect(page);
    expect(d.cache.raw.bytes).toBeLessThanOrEqual(d.cache.raw.budgetBytes);
    expect(d.cache.parsed.bytes).toBeLessThanOrEqual(
      d.cache.parsed.budgetBytes
    );
    expect(d.cache.parsed.pinned).toBe(0);
    expect(d.geometries).toBe(initial.geometries);
    expect(d.textures).toBe(initial.textures);
  }
  expect(cycles.at(-1).cache.parsed.hits).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await writeFile(
    path.join(OUT, 'cache-cycles.json'),
    JSON.stringify({ initial, cycles, final: await inspect(page) }, null, 2)
  );
});

test('React unmount invalidates in-flight loads and active animations; remount reuses only verified caches', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tests/fixtures/lifecycle.html');
  await page.waitForFunction(() => window.__signatureDebug);
  let pending;
  await page.route('**/glyphs/shard-*.json', (route) => {
    pending = route;
  });
  await sign(page, '李华');
  await waitState(page, 'preflighting');
  await expect(page.getByRole('textbox')).toHaveAttribute('readonly', '');
  await page.evaluate(() => {
    window.__oldSignature = window.__signatureDebug;
  });
  await page.getByRole('button', { name: 'Unmount test app' }).click();
  await expect(page.locator('.pencil-canvas')).toHaveCount(0);
  await page.waitForFunction(() => !window.__signatureDebug);
  const old = await page.evaluate(() => window.__oldSignature.inspect());
  expect(old.active).toBe(false);
  expect(old.disposed).toBe(true);expect(old.loadAborted).toBe(true);expect(old.hasGlyphLease).toBe(false);
  expect(old.cache.raw.pinned).toBe(0);
  expect(old.cache.parsed.pinned).toBe(0);
  if (pending) await pending.abort().catch(() => {});
  await page.unroute('**/glyphs/shard-*.json');
  await page
    .getByRole('button', { name: 'Mount test app', exact: true })
    .click();
  await page.waitForFunction(() => window.__signatureDebug);
  await sign(page, '李华');
  await waitState(page, 'writing');
  await page.waitForFunction(
    () => window.__signatureDebug.inspect().phase === 'stroke'
  );
  const loaded = await inspect(page);
  expect(loaded.cache.parsed.entries).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.__oldSignature = window.__signatureDebug;
  });
  await page.getByRole('button', { name: 'Unmount test app' }).click();
  await expect(page.locator('.pencil-canvas')).toHaveCount(0);
  const cancelled = await page.evaluate(() => window.__oldSignature.inspect());
  expect(cancelled.active).toBe(false);
  expect(cancelled.disposed).toBe(true);expect(cancelled.loadAborted).toBe(true);expect(cancelled.hasGlyphLease).toBe(false);
  expect(cancelled.cache.parsed.pinned).toBe(0);
  expect(cancelled.strokeCount).toBe(0);
  await page
    .getByRole('button', { name: 'Mount test app', exact: true })
    .click();
  await page.waitForFunction(() => window.__signatureDebug);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await sign(page, '李华');
  await waitState(page, 'written');
  const reused = await inspect(page);
  expect(reused.cache.parsed.hits).toBeGreaterThan(loaded.cache.parsed.hits);
  await erase(page);
  expect(errors).toEqual([]);
  await writeFile(
    path.join(OUT, 'unmount.json'),
    JSON.stringify({ old, cancelled, reused, errors }, null, 2)
  );
});

test('changing reduced motion during erase keeps the return gesture and never restores faded ink', async ({
  page,
}) => {
  const errors = await launch(page),
    results = [];
  for (const text of ['Shakespeare', '中文签名']) {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await sign(page, text);
    await waitState(page, 'written');
    const written = await inspect(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect
      .poll(async () => (await inspect(page)).renderCount)
      .toBeGreaterThan(written.renderCount);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: 'Erase signature' }).click();
    await page.waitForTimeout(330);
    const before = await inspect(page),
      opacityBefore = await page
        .locator('.signature-ink > g')
        .evaluate((el) => Number(getComputedStyle(el).opacity));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect
      .poll(async () => (await inspect(page)).reducedMotion)
      .toBe(true);
    const after = await inspect(page);
    expect(after.phase).toBe('return');
    expect(after.strokeProgress).toBeGreaterThanOrEqual(before.strokeProgress);
    expect(after.eraseProgress).toBeGreaterThanOrEqual(before.eraseProgress);
    expect(after.particles).toBe(0);
    const opacityAfter = await page
      .locator('.signature-ink > g')
      .evaluate((el) => Number(getComputedStyle(el).opacity));
    expect(opacityAfter).toBeLessThanOrEqual(opacityBefore + 0.001);
    await waitState(page, 'idle');
    await expect(page.getByRole('textbox')).toHaveValue('');
    results.push({ text, before, after });
  }
  expect(errors).toEqual([]);
  await writeFile(
    path.join(OUT, 'motion-during-erase.json'),
    JSON.stringify({ results, errors }, null, 2)
  );
});

test('sustained slow frames reduce only scene quality and keep the pen synchronized through preference changes', async ({
  page,
}) => {
  const errors = await launch(page);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
    await sign(page, '中文签名王明');
    await waitState(page, 'writing');
    await expect
      .poll(async () => (await inspect(page)).quality, { timeout: 20000 })
      .toBe('economy');
    const fallback = await inspect(page);
    expect(fallback.pixelRatio).toBeLessThanOrEqual(1);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const samples = await sample(page, 350);
    if (samples.length)
      expect(Math.max(...samples.map((s) => s.error))).toBeLessThan(0.2);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await waitState(page, 'written');
    const reduced = await inspect(page);
    expect(reduced.quality).toBe('economy');
    expect(reduced.pixelRatio).toBeLessThanOrEqual(1);
    await erase(page);
    expect(errors).toEqual([]);
    await writeFile(
      path.join(OUT, 'adaptive-quality.json'),
      JSON.stringify({ fallback, reduced, samples, errors }, null, 2)
    );
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
});
