// Consistent-scale real-browser static comparison, using actual inkRenderer.
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const dir='analysis/xingshu-v2';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});
  const formal=JSON.parse(await readFile('public/glyphs/manifest.json','utf8'));
  const variants=[];
  for(const [id,label,dataDir]of[['standard','1.1.0 标准字形',null],['prototype-1.2','1.2.0 原型','data/xingshu/v0.1.0'],['a','A · 克制型','data/xingshu/v0.2.0/candidates/a'],['b','B · 自然连带型','data/xingshu/v0.2.0/candidates/b'],['final','最终推荐','data/xingshu/v0.2.0']]){
    const glyphs=[];
    for(const [ch,file] of [['你','ni'],['好','hao']]){
      const g=dataDir?JSON.parse(await readFile(`${dataDir}/${file}.json`,'utf8')):
        JSON.parse(await readFile(`public/glyphs/${formal.shards[formal.characters[ch]].file}`,'utf8')).glyphs[ch];
      glyphs.push({...g,character:ch});
    }
    await page.goto('http://127.0.0.1:5173/tests/fixtures/masks.html');
    const result=await page.evaluate(async ({glyphs,label})=>{
      const {createStrokeVisual,setStrokeProgress}=await import('/src/handwriting/inkRenderer.js');
      document.body.style.cssText='margin:0;background:#f3f3f1';document.body.replaceChildren();
      const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
      svg.setAttribute('width','1000');svg.setAttribute('height','410');svg.setAttribute('viewBox','0 0 1000 410');
      document.body.append(svg);
      const all=[];
      glyphs.forEach((g,gi)=>{
        const group=document.createElementNS(ns,'g');group.setAttribute('transform',`translate(${140+gi*385} 24) scale(3.5)`);svg.append(group);
        g.strokes.forEach((s,i)=>{
          const stroke={...s,engine:'hanzi',d:s.d||s.median.map(([x,y],i)=>`${i?'L':'M'} ${x} ${y}`).join(' ')};
          const route=createStrokeVisual(group,stroke,i,`${label}-${gi}`);setStrokeProgress(route,1);all.push(route);
        });
      });
      return {svg:new XMLSerializer().serializeToString(svg),count:all.length};
    },{glyphs,label});
    await mkdir(`${dir}/${id}`,{recursive:true});
    await page.locator('svg').screenshot({path:`${dir}/${id}/normalized.png`});
    await writeFile(`${dir}/${id}/normalized.svg`,result.svg);
    variants.push({id,label,segments:result.count,image:`${id}/normalized.png`,sha256:createHash('sha256').update(await readFile(`${dir}/${id}/normalized.png`)).digest('hex')});
    if(['a','b','final'].includes(id))for(const file of ['nihao','strokes','overlay']){
      await page.setContent(await readFile(`${dir}/${id}/artwork/${file}.svg`,'utf8'));
      await page.locator('svg').screenshot({path:`${dir}/${id}/artwork/${file}.png`});
    }
  }
  await page.setViewportSize({width:1120,height:2600});
  await page.setContent(`<html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#f3f3f1;color:#3d4942;font:18px 'Segoe UI','Microsoft YaHei',sans-serif}#plate{width:1080px;padding:30px 40px}h1{font-weight:500;font-size:28px;margin:0 0 12px}p{font-size:15px;margin:0 0 28px}.label{margin:16px 0 2px}img{display:block;width:1000px;height:410px}</style><div id="plate"><h1>「你好」第二轮硬笔行书</h1><p>真实渲染器 · 每 em 3.5px · 相同 1000×410 画布 / 110 单位字距 / 蓝墨 / 纸色 · 仅统一摆放，没有改笔画</p>${variants.map(v=>`<div class="label">${v.label}</div><img src="data:image/png;base64,${Buffer.from([])}" data-id="${v.id}">`).join('')}</div>`);
  for(const v of variants)await page.locator(`[data-id="${v.id}"]`).evaluate((el,src)=>el.src=src,'data:image/png;base64,'+(await readFile(`${dir}/${v.image}`)).toString('base64'));
  await page.evaluate(()=>Promise.all([...document.images].map(im=>im.decode())));
  await page.locator('#plate').screenshot({path:`${dir}/comparison.png`});
  await writeFile(`${dir}/comparison.json`,JSON.stringify({generatedAt:new Date().toISOString(),browser:browser.version(),
    uniform:{canvas:[1000,410],emScale:3.5,glyphOrigins:[140,525],advance:110,background:'#f3f3f1',ink:'#3775be',dpr:1},
    scope:'Actual createStrokeVisual/setStrokeProgress in Chromium. Common placement isolates structure and stroke weight; unmodified-app full scenes/recordings are separate.',variants},null,2)+'\n');
  console.log(JSON.stringify({variants:variants.length,normalized:true}));
}finally{await browser.close();}
