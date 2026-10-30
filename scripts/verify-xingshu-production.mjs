import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out='analysis/xingshu/production';await mkdir(out,{recursive:true});
const base=process.env.PRODUCTION_URL||'http://127.0.0.1:4173';
const hash=b=>createHash('sha256').update(b).digest('hex');
const ni=JSON.parse(await readFile('data/xingshu/v0.1.0/ni.json','utf8'));
const hao=JSON.parse(await readFile('data/xingshu/v0.1.0/hao.json','utf8'));
const expected=[...ni.strokes,...hao.strokes];
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
const cases=[];
try{
  for(const config of[{width:1440,height:900,dpr:1,reduced:false},{width:1280,height:800,dpr:2,reduced:true},{width:1024,height:768,dpr:3,reduced:true}]){
    const page=await browser.newPage({viewport:{width:config.width,height:config.height},deviceScaleFactor:config.dpr}),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
    page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
    await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
    await page.emulateMedia({reducedMotion:config.reduced?'reduce':'no-preference'});
    expect((await page.goto(base)).status()).toBe(200);
    await expect(page.getByRole('button')).toHaveCount(1);
    expect(await page.evaluate(()=>typeof window.__signatureDebug)).toBe('undefined');
    await page.getByRole('textbox').fill('你好');await page.getByRole('textbox').press('Enter');
    let partial=null;
    if(!config.reduced){
      await expect(page.locator('main')).toHaveAttribute('data-state','writing');await page.waitForTimeout(1100);
      partial=await page.locator('[data-route]').evaluateAll(nodes=>nodes.map(n=>({length:n.getTotalLength(),offset:Number(n.style.strokeDashoffset)})));
      expect(partial.some(p=>p.offset>0)).toBe(true);expect(partial.some(p=>p.offset<p.length)).toBe(true);
      await page.screenshot({path:`${out}/writing.png`});
    }
    await expect(page.locator('main')).toHaveAttribute('data-state','written');
    const full=await page.locator('[data-outline]').evaluateAll(nodes=>nodes.map(n=>({d:n.getAttribute('d'),opacity:n.style.opacity,mask:n.getAttribute('mask')})));
    expect(full.map(s=>s.d)).toEqual(expected.map(s=>s.outline));expect(full.every(s=>s.opacity==='1'&&s.mask===null)).toBe(true);
    expect(await page.locator('[data-route]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d')))).toEqual(expected.map(s=>s.d));
    const pixelRatio=await page.locator('.pencil-canvas').evaluate(c=>c.width/c.getBoundingClientRect().width);
    expect(pixelRatio).toBeLessThanOrEqual(config.reduced?1.25:2);
    await page.screenshot({path:`${out}/desktop-dpr-${config.dpr}.png`});
    await page.getByRole('button',{name:'Erase signature'}).click();
    let particlePixels=0;
    if(!config.reduced){
      await page.waitForTimeout(150);
      particlePixels=await page.locator('.particle-canvas').evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<a.length;i+=4)if(a[i])n++;return n;});
      expect(particlePixels).toBeGreaterThan(0);await page.screenshot({path:`${out}/particles.png`});
    }
    await expect(page.locator('main')).toHaveAttribute('data-state','idle');await expect(page.getByRole('textbox')).toHaveValue('');
    for(const invalid of ['你\n好','1'.repeat(33),'曦麟🙂']){
      await page.getByRole('textbox').fill(invalid);await page.getByRole('button',{name:'Write signature'}).click();
      await expect(page.locator('main')).toHaveAttribute('data-state','idle');await expect(page.getByRole('textbox')).toHaveValue(invalid);
      await expect(page.locator('#signature-status')).not.toHaveText('');await expect(page.locator('[data-stroke]')).toHaveCount(0);
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    const mixed='你好 王明 Amy，2026！';await page.getByRole('textbox').fill(mixed);await page.getByRole('textbox').press('Enter');
    await expect(page.locator('main')).toHaveAttribute('data-state','written');
    const mixedOutlines=await page.locator('[data-outline]').count();expect(mixedOutlines).toBeGreaterThan(16);
    await page.getByRole('button',{name:'Erase signature'}).click();await expect(page.locator('main')).toHaveAttribute('data-state','idle');
    await page.getByRole('textbox').fill('Shakespeare');await page.getByRole('textbox').press('Enter');
    await expect(page.locator('main')).toHaveAttribute('data-state','written');await page.getByRole('button',{name:'Erase signature'}).click();
    await expect(page.locator('main')).toHaveAttribute('data-state','idle');
    const distributedFiles=[];
    for(const name of ['artwork.json','ni.json','hao.json','manifest.json','provenance.json','ARPHICPL.TXT']){
      const path=`experiments/xingshu-v0.1.0/${name}`,r=await page.request.get(`${base}/${path}`);
      expect(r.status()).toBe(200);const body=await r.body();expect(hash(body)).toBe(hash(await readFile(`public/${path}`)));
      distributedFiles.push({path,sha256:hash(body)});
    }
    const formal=await page.request.get(`${base}/glyphs/manifest.json`);expect(formal.status()).toBe(200);
    expect(hash(await formal.body())).toBe(hash(await readFile('public/glyphs/manifest.json')));
    expect(requests.every(r=>new URL(r.url).origin===base&&r.method==='GET')).toBe(true);expect(errors).toEqual([]);
    cases.push({config,partial,completeContours:full.length,pixelRatio,particlePixels,mixedOutlines,debugApiIncluded:false,distributedFiles,formalManifestUnchanged:true,errors,requests});
    await page.close();
  }
  await writeFile(`${out}/production.json`,JSON.stringify({generatedAt:new Date().toISOString(),browser:browser.version(),
    version:JSON.parse(await readFile('package.json','utf8')).version,
    scope:'Experimental desktop production preview; not merged to main or published online.',pass:true,cases},null,2)+'\n');
  console.log(JSON.stringify({cases:cases.length,pass:true}));
}finally{await browser.close();}
