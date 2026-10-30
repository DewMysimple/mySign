import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out='analysis/xingshu/performance';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args:['--enable-unsafe-swiftshader','--enable-precise-memory-info']});
const hash=data=>createHash('sha256').update(data).digest('hex');
const p95=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length*.95)]||0;
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
const errors=[],requests=[],cases=[],rejections=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
page.on('request',r=>requests.push(r.url()));
try{
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__signatureDebug);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.enable');await cdp.send('Performance.enable');
  async function heap(){await cdp.send('HeapProfiler.collectGarbage');const {metrics}=await cdp.send('Performance.getMetrics');return metrics.find(m=>m.name==='JSHeapUsedSize').value;}
  const initialHeap=await heap();
  for(const [id,text]of[
    ['ni','你'],['hao','好'],['nihao','你好'],['mixed','你好 Amy，2026！'],
    ['near-duration-floor','你好'.repeat(8)+'你'],
    ['140-segment-boundary','耀'.repeat(7)],
    ['32-character-boundary','1'.repeat(32)],
    ['readability-floor','一'.repeat(18)],
    ['english','Shakespeare'],
  ]){
    await page.getByRole('textbox').fill(text);await page.getByRole('textbox').press('Enter');
    await expect(page.locator('main')).toHaveAttribute('data-state','writing');
    const samples=await page.evaluate(()=>new Promise(resolve=>{
      const samples=[];let previous=performance.now();
      const frame=now=>{const d=window.__signatureDebug.inspect();
        if(d.phase==='stroke'){
          const r=document.querySelector(`[data-route="${d.strokeIndex}"]`),v=document.querySelector(`[data-outline="${d.strokeIndex}"]`)||r;
          const p=r.getPointAtLength(r.getTotalLength()-parseFloat(getComputedStyle(r).strokeDashoffset));
          const s=new DOMPoint(p.x,p.y).matrixTransform(v.getScreenCTM());
          samples.push({dt:now-previous,index:d.strokeIndex,p:d.strokeProgress,error:Math.hypot(s.x-d.projectedTip.x,s.y-d.projectedTip.y),heap:performance.memory?.usedJSHeapSize||0});
        }
        previous=now;
        if(d.state==='written')resolve(samples);else requestAnimationFrame(frame);
      };requestAnimationFrame(frame);
    }));
    const written=await page.evaluate(()=>window.__signatureDebug.inspect());
    await page.screenshot({path:`${out}/${id}.png`});
    await page.getByRole('button',{name:'Erase signature'}).click();
    await expect(page.locator('main')).toHaveAttribute('data-state','idle');
    const after=await page.evaluate(()=>window.__signatureDebug.inspect());
    const row={id,text,segments:written.strokeCount,logicalChineseStrokes:written.logicalStrokeCount,scale:written.layout.scale,
      loadMs:written.metrics.loadMs,planMs:written.metrics.planMs,estimatedSeconds:written.metrics.estimatedSeconds,actualSeconds:written.metrics.actualSeconds,
      p95FrameMs:p95(written.metrics.frameIntervals),maxSyncError:Math.max(...samples.map(s=>s.error)),sampleCount:samples.length,
      peakHeap:Math.max(...samples.map(s=>s.heap)),retainedHeap:await heap(),eraseMs:after.metrics.eraseMs,
      releasedRawBytes:after.cache.raw.bytes,releasedParsedBytes:after.cache.parsed.bytes,
      rawPins:after.cache.raw.pinned,parsedPins:after.cache.parsed.pinned,afterState:after.state,samples};
    cases.push(row);console.log(JSON.stringify({...row,samples:undefined}));
  }
  for(const [id,text,reason]of[
    ['character','1'.repeat(33),'字符'],
    ['width','一'.repeat(19),'单行可用宽度'],
    ['segments','耀'.repeat(7)+'l','超过'],
    ['duration','你好'.repeat(8)+'你l','安全时长'],
    ['newline','你\n好','单行'],
  ]){
    await page.getByRole('textbox').fill(text);await page.getByRole('button',{name:'Write signature'}).click();
    await expect(page.locator('main')).toHaveAttribute('data-state','idle');
    await expect(page.getByRole('textbox')).toHaveValue(text);
    const message=await page.locator('#signature-status').innerText();
    expect(message).toContain(reason);
    rejections.push({id,text,message,state:await page.evaluate(()=>window.__signatureDebug.inspect().state)});
  }
  const limits=JSON.parse(await readFile('src/handwriting/signatureLimits.json','utf8'));
  const gates={
    allCompleted:cases.every(r=>r.afterState==='idle'&&r.sampleCount>100),
    load:cases.every(r=>r.loadMs<250),plan:cases.every(r=>r.planMs<40),
    frame:cases.every(r=>r.p95FrameMs<=33.4),sync:cases.every(r=>r.maxSyncError<.2),
    memory:cases.every(r=>r.peakHeap<64*1024**2),retainedGrowth:cases.at(-1).retainedHeap-initialHeap<8*1024**2,
    erase:cases.every(r=>r.eraseMs<1600),durationAccuracy:cases.every(r=>Math.abs(r.actualSeconds-r.estimatedSeconds)<.25),
    readable:cases.every(r=>r.scale>=limits.minScale),
    cacheReleased:cases.every(r=>!r.rawPins&&!r.parsedPins&&r.releasedRawBytes<=limits.rawBytes&&r.releasedParsedBytes<=limits.parsedBytes),
    localOnly:requests.every(url=>new URL(url).origin==='http://127.0.0.1:5173'),noErrors:errors.length===0,
  };
  await writeFile(`${out}/calibration.json`,JSON.stringify({generatedAt:new Date().toISOString(),
    environment:{browser:browser.version(),node:process.version,os:process.platform,viewport:{width:1440,height:900,dpr:2},rendering:'Desktop headless, SwiftShader allowed; normal speed, no time scaling'},
    limits,limitsSHA256:hash(await readFile('src/handwriting/signatureLimits.json')),
    artworkSHA256:hash(await readFile('data/xingshu/v0.1.0/artwork.json')),
    initialHeap,gates,pass:Object.values(gates).every(Boolean),errors,rejections,cases},null,2)+'\n');
  console.log(JSON.stringify({gates,pass:Object.values(gates).every(Boolean)}));
  if(!Object.values(gates).every(Boolean))process.exitCode=1;
}finally{await browser.close();}
