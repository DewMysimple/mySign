import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const hash = data => createHash('sha256').update(data).digest('hex');
const out = 'analysis/xingshu-v2/quality';
await mkdir(out, { recursive: true });
const ni = JSON.parse(await readFile('data/xingshu/v0.2.0/ni.json','utf8'));
const hao = JSON.parse(await readFile('data/xingshu/v0.2.0/hao.json','utf8'));
const strokes = [ni,hao].flatMap(g => g.strokes.map(s => ({...s, character:g.character})));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args:['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({viewport:{width:1000,height:1000}});
  await page.goto('http://127.0.0.1:5173/tests/fixtures/masks.html');
  const result = await page.evaluate(async strokes => {
    const {createStrokeVisual,setStrokeProgress} = await import('/src/handwriting/inkRenderer.js');
    const ns='http://www.w3.org/2000/svg', cell=220, cols=4, size=cell*cols, scale=1.8;
    const svg=document.createElementNS(ns,'svg');
    svg.setAttribute('width',size);svg.setAttribute('height',size);
    document.body.append(svg);
    const routes=strokes.map((s,i)=>{
      const group=document.createElementNS(ns,'g');
      group.setAttribute('transform',`translate(${i%cols*cell+16} ${Math.floor(i/cols)*cell+16}) scale(${scale})`);
      svg.append(group);
      return createStrokeVisual(group,{...s,engine:'hanzi'},i,'xingshu-audit');
    });
    const reference=`<svg xmlns="${ns}" width="${size}" height="${size}">${strokes.map((s,i)=>`<g transform="translate(${i%cols*cell+16} ${Math.floor(i/cols)*cell+16}) scale(${scale})"><path d="${s.outline}" fill="#3775be"/></g>`).join('')}</svg>`;
    async function render(text) {
      const im=new Image();im.src='data:image/svg+xml;base64,'+btoa(text);await im.decode();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);
      return {canvas,data:ctx.getImageData(0,0,size,size).data};
    }
    const ref=await render(reference), levels=[...Array.from({length:20},(_,i)=>i/20),0.995,1], renders=[];
    for(const p of levels){ routes.forEach(r=>setStrokeProgress(r,p));renders.push(await render(new XMLSerializer().serializeToString(svg))); }
    const geometric=strokes.map((s,i)=>{
      const shape=new Path2D(s.outline),ctx=document.createElement('canvas').getContext('2d'),route=routes[i].element;
      let inside=0, samples=0;
      for(let j=1;j<1000;j++){
        const p=route.getPointAtLength(route.getTotalLength()*j/1000);samples++;
        if(ctx.isPointInPath(shape,p.x,p.y))inside++;
      }
      return {inside,samples,ratio:inside/samples, actualCurveLength:route.getTotalLength(), authoredLength:s.length};
    });
    const results=strokes.map((s,i)=>{
      let difference=0,total=0;const areas=levels.map(()=>0);
      for(let y=Math.floor(i/cols)*cell;y<(Math.floor(i/cols)+1)*cell;y++)for(let x=i%cols*cell;x<(i%cols+1)*cell;x++){
        const n=(y*size+x)*4+3;total+=ref.data[n]/255;
        difference+=Math.abs(ref.data[n]-renders.at(-1).data[n]);
        renders.forEach((r,j)=>{areas[j]+=r.data[n]/255;});
      }
      const progressive=areas[0]===0 && areas.slice(0,-1).every((v,j)=>!j || v+1e-5>=areas[j-1]);
      return {character:s.character,segmentId:s.segmentId,role:s.role,logicalStrokeIds:s.logicalStrokeIds,
        ...geometric[i],levels,areas,completeAlphaDifference:difference,completeInkArea:total,
        progressive,completeOutlineExact:difference===0,nearEndJump:(areas.at(-1)-areas.at(-2))/areas.at(-1)};
    });
    const white=canvas=>{const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');ctx.fillStyle='#f3f3f1';ctx.fillRect(0,0,size,size);ctx.drawImage(canvas,0,0);return c.toDataURL();};
    return {results,reference:white(ref.canvas),partial:white(renders[10].canvas),complete:white(renders.at(-1).canvas)};
  },strokes);
  for(const name of ['reference','partial','complete']) await writeFile(`${out}/masks-${name}.png`,Buffer.from(result[name].split(',')[1],'base64'));
  const protectedPaths=['public/glyphs','data/glyphs','src/handwriting/generated/manifest.json','src/handwriting/glyphs.js','src/handwriting/signature.js','src/handwriting/inkRenderer.js'];
  execFileSync('git',['diff','--exit-code','b110742','--',...protectedPaths]);
  const failed=result.results.filter(r=>!r.progressive||!r.completeOutlineExact||r.ratio<0.999||Math.abs(r.actualCurveLength-r.authoredLength)>.03);
  await writeFile(`${out}/masks.json`,JSON.stringify({generatedAt:new Date().toISOString(),browser:browser.version(),
    sourceSHA256:hash(await readFile('data/xingshu/v0.2.0/artwork.json')),
    rendererSHA256:hash(await readFile('src/handwriting/inkRenderer.js')),
    formalLibraryProtection:{baseline:'b110742',paths:protectedPaths,unchanged:true},
    glyphCount:2,segments:strokes.length,progressLevels:22,pass:failed.length===0,failed,results:result.results},null,2)+'\n');
  console.log(JSON.stringify({segments:strokes.length,failed:failed.length,minCenterlineInside:Math.min(...result.results.map(r=>r.ratio)),maxFinalDifference:Math.max(...result.results.map(r=>r.completeAlphaDifference))}));
  if(failed.length)process.exitCode=1;
}finally{await browser.close();}
