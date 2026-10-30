// Normal-speed recordings of the real App/Controller, never an SVG animation.
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const label = process.argv[2] || 'final';
const base = process.argv[3] || 'http://127.0.0.1:5173';
const out = `analysis/xingshu-v2/${label}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
  recordVideo: { dir: out, size: { width: 1440, height: 900 } } });
const page = await context.newPage(), errors = [], results = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (['error','warning'].includes(m.type())) errors.push(m.text()); });
try {
  await page.goto(base); await page.waitForFunction(() => window.__signatureDebug);
  for (const [text, name] of [['你好','nihao'], ['你','ni'], ['好','hao']]) {
    await page.evaluate(() => {
      window.round2Samples = []; window.round2Stop = false;
      const frame = now => {
        const d = window.__signatureDebug.inspect();
        if (d.state === 'writing') {
          let error = null;
          if (d.phase === 'stroke') {
            const route = document.querySelector(`[data-route="${d.strokeIndex}"]`);
            const visible = document.querySelector(`[data-outline="${d.strokeIndex}"]`) || route;
            const p = route.getPointAtLength(route.getTotalLength() - parseFloat(getComputedStyle(route).strokeDashoffset));
            const screen = new DOMPoint(p.x,p.y).matrixTransform(visible.getScreenCTM());
            error = Math.hypot(screen.x-d.projectedTip.x,screen.y-d.projectedTip.y);
          }
          window.round2Samples.push({now,phase:d.phase,index:d.strokeIndex,p:d.strokeProgress,
            segment:d.currentSegment,tip:d.projectedTip,shadow:d.projectedShadowTip,opacity:d.shadowOpacity,error});
        }
        if (!window.round2Stop) requestAnimationFrame(frame);
      }; requestAnimationFrame(frame);
    });
    await page.getByRole('textbox').fill(text); await page.getByRole('textbox').press('Enter');
    const frames = [];
    if (name === 'nihao') {
      let i = 0;
      while ((await page.evaluate(() => window.__signatureDebug.inspect().state)) !== 'written') {
        await page.waitForTimeout(450);
        const d = await page.evaluate(() => window.__signatureDebug.inspect());
        const file = `frame-${String(++i).padStart(2,'0')}.png`;
        await page.screenshot({path:`${out}/${file}`});
        frames.push({file,phase:d.phase,index:d.strokeIndex,pBeforeScreenshot:d.strokeProgress});
      }
    }
    await page.waitForFunction(() => window.__signatureDebug.inspect().state === 'written');
    const done = await page.evaluate(() => { window.round2Stop = true; return window.__signatureDebug.inspect(); });
    const samples = await page.evaluate(() => window.round2Samples);
    await page.screenshot({path:`${out}/${name}-full.png`});
    const svg = await page.locator('.signature-ink').evaluate(el => el.outerHTML);
    await writeFile(`${out}/${name}.svg`,svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" '));
    await page.locator('.pencil-scene').evaluate(el => { el.style.visibility='hidden'; });
    await page.screenshot({path:`${out}/${name}-ink-only.png`});
    await page.locator('.pencil-scene').evaluate(el => { el.style.visibility=''; });
    await page.waitForTimeout(200);
    await page.getByRole('button',{name:'Erase signature'}).click();
    if (name === 'nihao') { await page.waitForTimeout(190); await page.screenshot({path:`${out}/particles.png`}); }
    await page.waitForFunction(() => window.__signatureDebug.inspect().state === 'idle');
    results.push({text,done,frames,samples,afterErase:await page.evaluate(() => window.__signatureDebug.inspect())});
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const sourceFiles = await Promise.all(['src/animation/SignatureController.js','src/handwriting/inkRenderer.js','src/handwriting/xingshuRegistry.js'].map(async file => ({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')})));
  await writeFile(`${out}/capture.json`,JSON.stringify({label,base,generatedAt:new Date().toISOString(),browser:browser.version(),viewport:{width:1440,height:900,dpr:1},normalSpeed:true,sourceFiles,errors,results},null,2)+'\n');
  const video=page.video(); await context.close(); await rename(await video.path(),`${out}/live.webm`);
  console.log(JSON.stringify({label,results:results.map(r=>({text:r.text,seconds:r.done.metrics.actualSeconds,segments:r.done.strokeCount,maxSyncError:Math.max(...r.samples.map(s=>s.error||0))}))}));
} finally { await browser.close(); }
