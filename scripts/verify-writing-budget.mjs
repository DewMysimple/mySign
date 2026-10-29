import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const OUT = 'analysis/chinese/performance';
await mkdir(OUT, { recursive: true });
const budget = JSON.parse(await readFile(`${OUT}/budgets.json`, 'utf8'));
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) errors.push(m.text());
  });
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__signatureDebug);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const baselineHeap = await cdp.send('Runtime.getHeapUsage');
  const text = '.'.repeat(budget.maxStrokes);
  await page.getByRole('textbox').fill(text);
  await page.getByRole('button', { name: 'Write signature' }).click();
  await page.waitForFunction(
    () => window.__signatureDebug.inspect().state === 'writing'
  );
  const samples = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const frames = [];
        let previous = performance.now();
        function frame(now) {
          const d = window.__signatureDebug.inspect();
          if (d.phase === 'stroke') {
            const route = document.querySelector(
                `[data-route="${d.strokeIndex}"]`
              ),
              p = route.getPointAtLength(
                route.getTotalLength() -
                  parseFloat(getComputedStyle(route).strokeDashoffset)
              ),
              screen = new DOMPoint(p.x, p.y).matrixTransform(
                route.getScreenCTM()
              );
            frames.push({
              dt: now - previous,
              index: d.strokeIndex,
              error: Math.hypot(
                screen.x - d.projectedTip.x,
                screen.y - d.projectedTip.y
              ),
            });
          }
          previous = now;
          if (d.state === 'writing') requestAnimationFrame(frame);
          else resolve(frames);
        }
        requestAnimationFrame(frame);
      })
  );
  const written = await page.evaluate(() => window.__signatureDebug.inspect());
  expect(written.state).toBe('written');
  expect(written.strokeCount).toBe(budget.maxStrokes);
  await cdp.send('HeapProfiler.collectGarbage');
  const activeHeap = await cdp.send('Runtime.getHeapUsage');
  await page.screenshot({ path: `${OUT}/stroke-budget-420.png` });
  await page.getByRole('button', { name: 'Erase signature' }).click();
  await page.waitForFunction(
    () => window.__signatureDebug.inspect().state === 'idle'
  );
  const cleared = await page.evaluate(() => window.__signatureDebug.inspect());
  await cdp.send('HeapProfiler.collectGarbage');
  const finalHeap = await cdp.send('Runtime.getHeapUsage');
  await page.getByRole('textbox').fill(text + '.');
  await page.getByRole('button', { name: 'Write signature' }).click();
  await page.waitForFunction(() =>
    document.querySelector('#signature-status').textContent.includes('超过')
  );
  await expect(page.getByRole('textbox')).toHaveValue(text + '.');
  await expect(page.getByRole('textbox')).toBeEditable();
  await expect(page.locator('[data-stroke]')).toHaveCount(0);
  const sorted = samples.map((s) => s.dt).sort((a, b) => a - b),
    p95 = sorted[Math.floor(sorted.length * 0.95)],
    maxError = Math.max(...samples.map((s) => s.error));
  const gates = {
    p95: p95 <= budget.p95FrameMs,
    sync: maxError <= budget.syncErrorCssPx,
    load: written.metrics.loadMs <= budget.loadMs,
    plan: written.metrics.planMs <= budget.planMs,
    heap: activeHeap.usedSize <= budget.activeJsHeapBytes,
    retainedHeap:
      finalHeap.usedSize - baselineHeap.usedSize <=
      budget.retainedHeapGrowthBytes,
    duration:
      Math.abs(
        written.metrics.actualSeconds - written.metrics.estimatedSeconds
      ) <= budget.durationErrorSeconds,
    erase: cleared.metrics.eraseMs <= budget.erasureMs,
    errors: errors.length === 0,
  };
  const report = {
    date: new Date().toISOString(),
    browser: browser.version(),
    scope:
      'independent verification against frozen budgets.json, full normal-motion 420-stroke boundary and rejection at 421',
    gates,
    pass: Object.values(gates).every(Boolean),
    p95FrameMs: p95,
    maxErrorPx: maxError,
    baselineHeap,
    activeHeap,
    finalHeap,
    written,
    cleared,
    errors,
    samples,
  };
  await writeFile(
    `${OUT}/budget-verification.json`,
    JSON.stringify(report, null, 2)
  );
  console.log(
    JSON.stringify({
      gates,
      pass: report.pass,
      strokes: written.strokeCount,
      p95FrameMs: p95,
      maxErrorPx: maxError,
    })
  );
  expect(report.pass).toBe(true);
} finally {
  await browser.close();
}
