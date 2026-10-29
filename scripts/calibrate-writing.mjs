import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { buildWritingPlan, assertValidText } from '../src/handwriting/writingPlan.js';
const OUT = 'analysis/chinese/performance';
await mkdir(OUT, { recursive: true });
const manifest = JSON.parse(
    await readFile('public/glyphs/manifest.json', 'utf8')
  ),
  glyphs = new Map();
for (const shard of manifest.shards) {
  for (const g of Object.values(
    JSON.parse(await readFile(`public/glyphs/${shard.file}`, 'utf8')).glyphs
  ))
    glyphs.set(g.character, g);
}
let longText = '王';
for (let n = 1; n < 100; n++) {
  try {
    const text = '王'.repeat(n);
    const p = buildWritingPlan(text, glyphs, 1440, 900);
    if (p.estimatedSeconds > 86) break;
    longText = text;
  } catch {
    break;
  }
}
const scenarios = [
  '王明 Amy，2026！',
  '永盼',
  '国圆回风飞女',
  '我心书水火',
  '张李陈赵黄明德爱谢',
  '赢警藏戴齿凹凸卵',
  longText,
];
scenarios.forEach(assertValidText);
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
    errors = [],
    requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) errors.push(m.text());
  });
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__signatureDebug);
  const cdp = await page.context().newCDPSession(page);
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    return cdp.send('Runtime.getHeapUsage');
  };
  const baselineHeap = await heap(),
    results = [];
  for (const [index, text] of scenarios.entries()) {
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
                length = route.getTotalLength(),
                distance =
                  length - parseFloat(getComputedStyle(route).strokeDashoffset),
                local = route.getPointAtLength(distance);
              const visual =
                  document.querySelector(`[data-outline="${d.strokeIndex}"]`) ||
                  route,
                screen = new DOMPoint(local.x, local.y).matrixTransform(
                  visual.getScreenCTM()
                );
              frames.push({
                dt: now - previous,
                index: d.strokeIndex,
                p: d.strokeProgress,
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
    const written = await page.evaluate(() =>
      window.__signatureDebug.inspect()
    );
    if (written.state !== 'written') throw Error(`Scenario failed: ${text}`);
    const activeHeap = await heap();
    await page.screenshot({ path: `${OUT}/scenario-${index + 1}.png` });
    await page.getByRole('button', { name: 'Erase signature' }).click();
    await page.waitForFunction(
      () => window.__signatureDebug.inspect().state === 'idle'
    );
    const cleared = await page.evaluate(() =>
        window.__signatureDebug.inspect()
      ),
      afterHeap = await heap();
    const sorted = samples.map((x) => x.dt).sort((a, b) => a - b),
      p95 = sorted[Math.floor(sorted.length * 0.95)];
    const summary = {
      text,
      strokeCount: written.strokeCount,
      lines: written.lines,
      sampleCount: samples.length,
      p95FrameMs: p95,
      maxErrorPx: Math.max(...samples.map((x) => x.error)),
      metrics: { ...written.metrics, frameIntervals: undefined },
      quality: written.quality,
      cache: written.cache,
      clearedCache: cleared.cache,
      resources: { geometries: cleared.geometries, textures: cleared.textures },
      activeHeap,
      afterHeap,
    };
    results.push(summary);
    await writeFile(`${OUT}/calibration.partial.json`,JSON.stringify({baselineHeap,results,environment:{browser:browser.version(),date:new Date().toISOString()},status:'running'},null,2));
    await writeFile(
      `${OUT}/samples-${index + 1}.json`,
      JSON.stringify(samples)
    );
    console.log(
      JSON.stringify({
        scenario: index + 1,
        strokes: summary.strokeCount,
        p95: summary.p95FrameMs,
        loadMs: summary.metrics.loadMs,
        planMs: summary.metrics.planMs,
        actual: summary.metrics.actualSeconds,
        error: summary.maxErrorPx,
      })
    );
  }
  // Force reuse after earlier cache evictions, and measure retained heap after cycles.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (let i = 0; i < 12; i++) {
    await page.getByRole('textbox').fill(i % 2 ? '王明' : '李华 Amy');
    await page.getByRole('button', { name: 'Write signature' }).click();
    await page.waitForFunction(
      () => window.__signatureDebug.inspect().state === 'written'
    );
    await page.getByRole('button', { name: 'Erase signature' }).click();
    await page.waitForFunction(
      () => window.__signatureDebug.inspect().state === 'idle'
    );
  }
  const finalHeap = await heap(),
    final = await page.evaluate(() => window.__signatureDebug.inspect());
  const report = {
    date: new Date().toISOString(),
    environment: {
      browser: browser.version(),
      os: process.platform,
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      rendering: 'headless desktop, SwiftShader permitted; no mobile claims',
    },
    baselineHeap,
    results,
    finalHeap,
    final,
    errors,
    externalRequests: requests.filter(
      (u) =>
        !u.startsWith('http://127.0.0.1:5173/') &&
        !u.startsWith('ws://127.0.0.1:5173/')
    ),
  };
  await writeFile(`${OUT}/calibration.json`, JSON.stringify(report, null, 2));
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
}
