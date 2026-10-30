import { chromium } from '@playwright/test';
import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out = 'analysis/xingshu/visual';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
  recordVideo: { dir: out, size: { width: 1440, height: 900 } },
});
const page = await context.newPage(), errors = [], results = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
try {
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__signatureDebug);
  for (const [text, label] of [['你好','nihao'], ['你','ni'], ['好','hao']]) {
    const frames = [];
    await page.evaluate(() => {
      window.prototypeSamples = [];
      window.stopPrototype = false;
      let previous = performance.now();
      const frame = now => {
        const d = window.__signatureDebug.inspect();
        if (d.state === 'writing') {
          let error = null;
          if (d.phase === 'stroke') {
            const r = document.querySelector(`[data-route="${d.strokeIndex}"]`);
            const v = document.querySelector(`[data-outline="${d.strokeIndex}"]`) || r;
            const p = r.getPointAtLength(r.getTotalLength() - parseFloat(getComputedStyle(r).strokeDashoffset));
            const screen = new DOMPoint(p.x, p.y).matrixTransform(v.getScreenCTM());
            error = Math.hypot(screen.x - d.projectedTip.x, screen.y - d.projectedTip.y);
          }
          window.prototypeSamples.push({ now, dt: now - previous, phase: d.phase, index: d.strokeIndex, p: d.strokeProgress,
            segment: d.currentSegment, tip: d.projectedTip, shadow: d.projectedShadowTip, shadowOpacity: d.shadowOpacity, error });
        }
        previous = now;
        if (!window.stopPrototype) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    await page.getByRole('textbox').fill(text);
    await page.getByRole('textbox').press('Enter');
    if (label === 'nihao') {
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(700);
        const d = await page.evaluate(() => window.__signatureDebug.inspect());
        frames.push({ file: `keyframe-${i + 1}.png`, phase: d.phase, index: d.strokeIndex, p: d.strokeProgress });
        await page.screenshot({ path: `${out}/keyframe-${i + 1}.png` });
      }
      for (const [index, target] of [14, 15].entries()) {
        await page.waitForFunction(target => {
          const d = window.__signatureDebug.inspect();
          return d.strokeIndex >= target || d.state === 'written';
        }, target);
        const d = await page.evaluate(() => window.__signatureDebug.inspect());
        frames.push({ file: `keyframe-${index + 6}.png`, phase: d.phase, index: d.strokeIndex, p: d.strokeProgress });
        await page.screenshot({ path: `${out}/keyframe-${index + 6}.png` });
      }
    }
    await page.waitForFunction(() => window.__signatureDebug.inspect().state === 'written');
    const written = await page.evaluate(() => { window.stopPrototype = true; return window.__signatureDebug.inspect(); });
    const samples = await page.evaluate(() => window.prototypeSamples);
    await page.screenshot({ path: `${out}/${label}-full.png` });
    await writeFile(`${out}/${label}.svg`, await page.locator('.signature-ink').evaluate(el => el.outerHTML));
    await page.locator('.pencil-scene').evaluate(el => { el.style.visibility = 'hidden'; });
    await page.screenshot({ path: `${out}/${label}-ink-only.png` });
    await page.locator('.pencil-scene').evaluate(el => { el.style.visibility = ''; });
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Erase signature' }).click();
    if (label === 'nihao') {
      await page.waitForTimeout(230);
      await page.screenshot({ path: `${out}/nihao-particles.png` });
    }
    await page.waitForFunction(() => window.__signatureDebug.inspect().state === 'idle');
    results.push({ text, written, frames, samples, afterErase: await page.evaluate(() => window.__signatureDebug.inspect()) });
  }
  const sourceFiles = await Promise.all([
    'data/xingshu/v0.1.0/artwork.json', 'data/xingshu/v0.1.0/ni.json', 'data/xingshu/v0.1.0/hao.json',
    'src/handwriting/inkRenderer.js', 'src/handwriting/writingPlan.js', 'src/animation/SignatureController.js',
  ].map(async file => ({ file, sha256: createHash('sha256').update(await readFile(file)).digest('hex') })));
  await writeFile(`${out}/capture.json`, JSON.stringify({ generatedAt: new Date().toISOString(), browser: browser.version(),
    viewport: { width: 1440, height: 900, dpr: 1 }, sourceFiles, errors, results }, null, 2) + '\n');
  const video = page.video();
  await context.close();
  await rename(await video.path(), `${out}/nihao-prototype-live.webm`);
  console.log(JSON.stringify(results.map(r => ({ text: r.text, seconds: r.written.metrics.actualSeconds,
    logical: r.written.logicalStrokeCount, segments: r.written.strokeCount,
    samples: r.samples.length, maxSyncError: Math.max(...r.samples.map(s => s.error || 0)) }))));
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
