import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
test('first frames after four mixed resize/motion changes share the SVG and Three mapping', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__signatureDebug);
  const samples = [];
  for (const [before, after] of [
    [
      { width: 700, height: 700 },
      { width: 1280, height: 800 },
    ],
    [
      { width: 1440, height: 900 },
      { width: 800, height: 600 },
    ],
    [
      { width: 1024, height: 768 },
      { width: 1600, height: 1000 },
    ],
    [
      { width: 900, height: 700 },
      { width: 700, height: 900 },
    ],
  ]) {
    await page.setViewportSize(before);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(
      () => !window.__signatureDebug.inspect().reducedMotion
    );
    await page.getByRole('textbox').fill('你好王明 Amy！');
    await page.getByRole('button', { name: 'Write signature' }).click();
    await page.waitForFunction(() => {
      const d = window.__signatureDebug.inspect();
      return (
        d.phase === 'stroke' &&
        d.strokeProgress > 0.05 &&
        d.strokeProgress < 0.6
      );
    });
    const lines = await page.evaluate(
      () => window.__signatureDebug.inspect().lines
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(after);
    // Deliberately do NOT wait for ResizeObserver/layout diagnostics here.
    samples.push(
      ...(await page.evaluate(
        () =>
          new Promise((resolve) => {
            const rows = [],
              start = performance.now();
            function frame(now) {
              const d = window.__signatureDebug.inspect();
              if (d.phase === 'stroke' && d.strokeProgress > 0) {
                const r = document.querySelector(
                    `[data-route="${d.strokeIndex}"]`
                  ),
                  v =
                    document.querySelector(
                      `[data-outline="${d.strokeIndex}"]`
                    ) || r;
                const p = r.getPointAtLength(
                    r.getTotalLength() -
                      parseFloat(getComputedStyle(r).strokeDashoffset)
                  ),
                  s = new DOMPoint(p.x, p.y).matrixTransform(v.getScreenCTM());
                rows.push({
                  width: innerWidth,
                  height: innerHeight,
                  layout: d.layout,
                  index: d.strokeIndex,
                  p: d.strokeProgress,
                  error: Math.hypot(
                    s.x - d.projectedTip.x,
                    s.y - d.projectedTip.y
                  ),
                });
              }
              if (now - start < 160 && d.state === 'writing')
                requestAnimationFrame(frame);
              else resolve(rows);
            }
            requestAnimationFrame(frame);
          })
      ))
    );
    await expect(page.locator('main')).toHaveAttribute('data-state', 'written');
    expect(
      await page.evaluate(() => window.__signatureDebug.inspect().lines)
    ).toEqual(lines);
    await page.getByRole('button', { name: 'Erase signature' }).click();
    await expect(page.locator('main')).toHaveAttribute('data-state', 'idle');
  }
  await mkdir('analysis/xingshu-v2/browser', { recursive: true });
  const maxError = Math.max(...samples.map((s) => s.error));
  await writeFile(
    'analysis/xingshu-v2/browser/resize-motion.json',
    JSON.stringify({ samples, maxError, errors }, null, 2)
  );
  expect(samples.length).toBeGreaterThan(10);
  expect(maxError).toBeLessThan(0.2);
  expect(errors).toEqual([]);
});
