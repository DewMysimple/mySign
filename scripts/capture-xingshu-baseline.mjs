import { chromium } from '@playwright/test';
import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const out = 'analysis/xingshu/baseline';
await mkdir(out, { recursive: true });
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (revision !== 'b110742bb492233b061f899f0708faf965181b52')
  throw new Error('Run against the unchanged 1.1.0 worktree, not the new prototype.');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
  recordVideo: { dir: out, size: { width: 1440, height: 900 } },
});
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__signatureDebug);
  await page.evaluate(() => {
    window.baselineSamples = [];
    const frame = now => {
      const d = window.__signatureDebug.inspect();
      if (d.state === 'writing') window.baselineSamples.push({
        now, phase: d.phase, index: d.strokeIndex, p: d.strokeProgress,
        tip: d.projectedTip, shadow: d.projectedShadowTip, shadowOpacity: d.shadowOpacity,
      });
      if (!window.stopBaseline) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await page.getByRole('textbox').fill('你好');
  await page.getByRole('textbox').press('Enter');
  const frames = [];
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(850);
    frames.push(await page.evaluate(() => window.__signatureDebug.inspect()));
    await page.screenshot({ path: `${out}/frame-${i + 1}.png` });
  }
  await page.waitForFunction(() => window.__signatureDebug.inspect().state === 'written');
  const written = await page.evaluate(() => { window.stopBaseline = true; return window.__signatureDebug.inspect(); });
  await page.screenshot({ path: `${out}/nihao-full.png` });
  await writeFile(`${out}/nihao.svg`, await page.locator('.signature-ink').evaluate(el => el.outerHTML));
  await page.locator('.pencil-scene').evaluate(el => { el.style.visibility = 'hidden'; });
  await page.screenshot({ path: `${out}/nihao-ink-only.png` });
  await page.locator('.pencil-scene').evaluate(el => { el.style.visibility = ''; });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Erase signature' }).click();
  await page.waitForFunction(() => window.__signatureDebug.inspect().state === 'idle');
  const sourceFiles = await Promise.all([
    'src/handwriting/writingPlan.js', 'src/handwriting/inkRenderer.js',
    'src/animation/SignatureController.js', 'src/handwriting/generated/manifest.json',
    'prompt/prompt_03.txt',
  ].map(async file => ({ file, sha256: createHash('sha256').update(await readFile(file)).digest('hex') })));
  await writeFile(`${out}/capture.json`, JSON.stringify({
    generatedAt: new Date().toISOString(), revision, browser: browser.version(),
    viewport: { width: 1440, height: 900, dpr: 1 }, sourceFiles, text: '你好',
    written, frames, errors, samples: await page.evaluate(() => window.baselineSamples),
  }, null, 2) + '\n');
  const video = page.video();
  await context.close();
  await rename(await video.path(), `${out}/nihao-standard.webm`);
  console.log(JSON.stringify({ revision, strokes: written.strokeCount, seconds: written.metrics.actualSeconds, errors }));
} finally { await browser.close(); }
