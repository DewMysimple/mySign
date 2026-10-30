import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const OUT='analysis/xingshu-v2/browser';
const inspect=page=>page.evaluate(()=>window.__signatureDebug.inspect());
const state=(page,value)=>expect(page.locator('main')).toHaveAttribute('data-state',value);
async function launch(page){
  await mkdir(OUT,{recursive:true});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
  await page.goto('/');await page.waitForFunction(()=>window.__signatureDebug);return errors;
}
async function sign(page,text){await page.getByRole('textbox').fill(text);await page.getByRole('textbox').press('Enter');}
async function erase(page){await page.getByRole('button',{name:'Erase signature'}).click();await state(page,'idle');}
async function sample(page){
  return page.evaluate(()=>new Promise(resolve=>{
    const samples=[];
    function frame(now){
      const d=window.__signatureDebug.inspect();let error=null;
      if(d.phase==='stroke'){
        const r=document.querySelector(`[data-route="${d.strokeIndex}"]`),v=document.querySelector(`[data-outline="${d.strokeIndex}"]`)||r;
        const p=r.getPointAtLength(r.getTotalLength()-parseFloat(getComputedStyle(r).strokeDashoffset));
        const s=new DOMPoint(p.x,p.y).matrixTransform(v.getScreenCTM());
        error=Math.hypot(s.x-d.projectedTip.x,s.y-d.projectedTip.y);
      }
      samples.push({now,phase:d.phase,index:d.strokeIndex,p:d.strokeProgress,segment:d.currentSegment,
        tip:d.projectedTip,shadow:d.projectedShadowTip,opacity:d.shadowOpacity,error});
      if(d.state==='written')resolve(samples);else requestAnimationFrame(frame);
    }requestAnimationFrame(frame);
  }));
}

for(const [text,logical,segments]of[['你',7,7],['好',6,6]])test(`${text} independent experimental contours retain ${logical} logical strokes`,async({page})=>{
  const errors=await launch(page),initial=await inspect(page);
  await sign(page,text);await state(page,'writing');const samples=await sample(page);await state(page,'written');
  const written=await inspect(page);expect(written.logicalStrokeCount).toBe(logical);expect(written.strokeCount).toBe(segments);
  expect(written.prototypeCharacters).toEqual([text]);expect(samples.filter(s=>s.error!==null).length).toBeGreaterThan(100);
  expect(Math.max(...samples.map(s=>s.error||0))).toBeLessThan(.2);
  const full=await page.locator('[data-outline]').evaluateAll(nodes=>nodes.map(n=>({fill:n.getAttribute('fill'),stroke:n.getAttribute('stroke'),mask:n.getAttribute('mask'),opacity:n.style.opacity})));
  expect(full.length).toBe(segments);expect(full.every(s=>s.fill==='#3775be'&&s.stroke==='none'&&s.mask===null&&s.opacity==='1')).toBe(true);
  await erase(page);await expect(page.getByRole('textbox')).toHaveValue('');
  const after=await inspect(page);expect(after.geometries).toBe(initial.geometries);expect(after.particles).toBe(0);
  expect(errors).toEqual([]);
  await writeFile(`${OUT}/${text==='你'?'ni':'hao'}-test.json`,JSON.stringify({written,after,errors,samples},null,2));
});

test('你好 continuous groups use real curve endpoints, preserve logical order, lift between groups and move the same shadow',async({page})=>{
  const errors=await launch(page);await sign(page,'你好');await state(page,'writing');const samples=await sample(page);
  const done=await inspect(page);expect(done.logicalStrokeCount).toBe(13);expect(done.visualActions.length).toBe(12);expect(done.strokeCount).toBe(13);
  expect(done.logicalStrokes.filter(s=>s.character==='你').map(s=>s.originalNumber)).toEqual([1,2,3,4,5,6,7]);
  expect(done.logicalStrokes.filter(s=>s.character==='好').map(s=>s.originalNumber)).toEqual([1,2,3,4,5,6]);
  const contacts=await page.evaluate(()=>{
    const d=window.__signatureDebug.inspect(),results=[];
    for(const group of d.visualActions)for(let j=1;j<group.segmentIndices.length;j++){
      const a=group.segmentIndices[j-1],b=group.segmentIndices[j];
      const r1=document.querySelector(`[data-route="${a}"]`),r2=document.querySelector(`[data-route="${b}"]`);
      const v1=document.querySelector(`[data-outline="${a}"]`),v2=document.querySelector(`[data-outline="${b}"]`);
      const p1=r1.getPointAtLength(r1.getTotalLength()),p2=r2.getPointAtLength(0);
      const s1=new DOMPoint(p1.x,p1.y).matrixTransform(v1.getScreenCTM()),s2=new DOMPoint(p2.x,p2.y).matrixTransform(v2.getScreenCTM());
      results.push({id:group.id,a,b,gap:Math.hypot(s1.x-s2.x,s1.y-s2.y)});
    }return results;
  });
  expect(contacts.length).toBe(1);expect(Math.max(...contacts.map(c=>c.gap))).toBeLessThan(.002);
  for(const c of contacts)expect(samples.some(s=>s.phase==='lift'&&s.index===c.b)).toBe(false);
  const threads=samples.filter(s=>s.phase==='stroke'&&s.segment.role==='connection');expect(new Set(threads.map(s=>s.index)).size).toBe(0);
  const contact=samples.filter(s=>s.phase==='stroke');
  const lifted=samples.filter(s=>s.phase==='lift');expect(lifted.length).toBeGreaterThan(10);
  expect(lifted.some(s=>s.opacity<.41)).toBe(true);
  expect(contact.every(s=>Math.abs(s.opacity-.42)<1e-6)).toBe(true);
  const distance=s=>Math.hypot(s.shadow.x-s.tip.x,s.shadow.y-s.tip.y);
  expect(Math.max(...lifted.map(distance))).toBeGreaterThan(Math.max(...contact.map(distance))+3);
  expect(Math.max(...contact.map(s=>s.error))).toBeLessThan(.2);
  await page.waitForTimeout(100);expect((await inspect(page)).renderCount).toBe(done.renderCount);
  await erase(page);expect(errors).toEqual([]);
  await writeFile(`${OUT}/connections-shadow.json`,JSON.stringify({done,contacts,errors,samples},null,2));
});

test('prototype particles originate throughout actual filled ink, clear completely, then original English writes again',async({page})=>{
  const errors=await launch(page),initial=await inspect(page);await sign(page,'你好');await state(page,'written');
  await page.getByRole('button',{name:'Erase signature'}).click();await state(page,'erasing');
  const particleCheck=await page.evaluate(()=>{
    const d=window.__signatureDebug.inspect({particleOrigins:true}),ctx=document.createElement('canvas').getContext('2d');
    const shapes=[...document.querySelectorAll('[data-outline]')].map((el,index)=>{
      const route=document.querySelector(`[data-route="${index}"]`),centres=[];
      for(let i=0;i<=100;i++){const p=route.getPointAtLength(route.getTotalLength()*i/100);centres.push({x:p.x,y:p.y});}
      return {shape:new Path2D(el.getAttribute('d')),m:el.parentNode.transform.baseVal.getItem(0).matrix,centres};
    });
    let outside=0,offCenterline=0;
    for(const p of d.particleOrigins){
      const index=Math.round(p.delay/.42*shapes.length),{shape,m,centres}=shapes[index];
      const x=p.x-m.e,y=p.y-m.f;
      if(!ctx.isPointInPath(shape,x,y))outside++;
      let distance=Infinity;
      for(const r of centres)distance=Math.min(distance,Math.hypot(x-r.x,y-r.y));
      if(distance>.55)offCenterline++;
    }return {count:d.particleOrigins.length,outside,offCenterline};
  });
  expect(particleCheck.count).toBeGreaterThan(300);expect(particleCheck.outside).toBe(0);expect(particleCheck.offCenterline).toBeGreaterThan(30);
  await page.screenshot({path:`${OUT}/prototype-particles.png`});await state(page,'idle');
  expect((await inspect(page)).particles).toBe(0);await expect(page.locator('[data-stroke]')).toHaveCount(0);
  await page.emulateMedia({reducedMotion:'reduce'});await sign(page,'Shakespeare');await state(page,'written');
  expect((await inspect(page)).prototypeCharacters).toEqual([]);await erase(page);
  const final=await inspect(page);expect(final.geometries).toBe(initial.geometries);expect(final.textures).toBe(initial.textures);expect(errors).toEqual([]);
  await writeFile(`${OUT}/prototype-particles.json`,JSON.stringify({particleCheck,final,errors},null,2));
});

test('a fault during the retained same-point 子 fold cancels every contour and restores the pen/shadow before retry',async({page})=>{
  const errors=await launch(page),initial=await inspect(page);await sign(page,'你好');
  await page.evaluate(()=>new Promise(resolve=>{
    function frame(){const d=window.__signatureDebug.inspect();
      if(d.phase==='stroke'&&d.currentSegment?.visualActionId==='hao-4-5'&&d.currentSegment?.logicalStrokeIds.includes(5)){window.__signatureDebug.inject('stroke');resolve();}
      else requestAnimationFrame(frame);
    }requestAnimationFrame(frame);
  }));
  await state(page,'idle');await expect(page.getByRole('textbox')).toHaveValue('你好');
  const recovered=await inspect(page);expect(recovered.active).toBe(false);expect(recovered.strokeCount).toBe(0);expect(recovered.particles).toBe(0);expect(recovered.hasGlyphLease).toBe(false);
  expect(Math.hypot(recovered.projectedShadowTip.x-initial.projectedShadowTip.x,recovered.projectedShadowTip.y-initial.projectedShadowTip.y)).toBeLessThan(.01);
  await page.emulateMedia({reducedMotion:'reduce'});await sign(page,'你好');await state(page,'written');await erase(page);expect(errors).toEqual([]);
  await writeFile(`${OUT}/contact-fault.json`,JSON.stringify({initial,recovered,after:await inspect(page),errors},null,2));
});

test('live reduced-motion and desktop resize keep the prototype group order and current contact progress',async({page})=>{
  const errors=await launch(page);await sign(page,'你好');
  await page.waitForFunction(()=>{const d=window.__signatureDebug.inspect();return d.phase==='stroke'&&d.strokeIndex>2&&d.strokeProgress>.1;});
  const before=await inspect(page);await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1024,height:768});
  const samples=await sample(page);await state(page,'written');const done=await inspect(page);
  expect(done.lines).toEqual(['你好']);expect(done.logicalStrokeCount).toBe(13);expect(done.visualActions.map(g=>g.id)).toEqual(before.visualActions.map(g=>g.id));
  expect(done.reducedMotion).toBe(true);expect(done.pixelRatio).toBeLessThanOrEqual(1.25);
  const actual=samples.filter(s=>s.error!==null);expect(Math.max(...actual.map(s=>s.error))).toBeLessThan(.2);
  await erase(page);expect((await inspect(page)).particles).toBe(0);expect(errors).toEqual([]);
  await writeFile(`${OUT}/prototype-motion-resize.json`,JSON.stringify({before,done,samples,errors},null,2));
});

test('removed threads execute clean airborne moves: unchanged ink, interpolated tip, lifted shadow, no hidden connector route',async({page})=>{
  const errors=await launch(page);await sign(page,'你好');
  const frames=await page.evaluate(()=>new Promise(resolve=>{
    const frames=[];
    function frame(now){
      const d=window.__signatureDebug.inspect();
      if(d.phase==='lift'){
        const endpoint=(i,end)=>{
          const r=document.querySelector(`[data-route="${i}"]`),v=document.querySelector(`[data-outline="${i}"]`);
          const p=r.getPointAtLength(end?r.getTotalLength():0);return new DOMPoint(p.x,p.y).matrixTransform(v.getScreenCTM());
        };
        const a=endpoint(d.strokeIndex-1,true),b=endpoint(d.strokeIndex,false),p=d.strokeProgress;
        const ink=[...document.querySelectorAll('[data-outline]')].map((v,i)=>({opacity:v.style.opacity,mask:v.getAttribute('mask'),dash:document.querySelector(`[data-route="${i}"]`).style.strokeDashoffset}));
        frames.push({now,index:d.strokeIndex,p,tip:d.projectedTip,shadow:d.projectedShadowTip,opacity:d.shadowOpacity,
          interpolationError:Math.hypot(a.x+(b.x-a.x)*p-d.projectedTip.x,a.y+(b.y-a.y)*p-d.projectedTip.y),ink});
      }
      if(d.state==='written')resolve(frames);else requestAnimationFrame(frame);
    }requestAnimationFrame(frame);
  }));
  for(const index of [1,3,8]){
    const samples=frames.filter(s=>s.index===index);expect(samples.length).toBeGreaterThan(1);
    expect(samples.some(s=>s.opacity<.41)).toBe(true);
    expect(samples.every(s=>s.ink[index].opacity==='0')).toBe(true);
    const fingerprints=new Set(samples.map(s=>JSON.stringify(s.ink)));expect(fingerprints.size).toBe(1);
  }
  expect(new Set(frames.map(s=>s.index)).size).toBe(11);
  expect(Math.max(...frames.map(s=>s.interpolationError))).toBeLessThan(.002);
  expect((await inspect(page)).strokeCount).toBe(13);expect(await page.locator('[data-route]').count()).toBe(13);
  await erase(page);expect(errors).toEqual([]);
  await writeFile(`${OUT}/clean-lifts.json`,JSON.stringify({frames,errors},null,2));
});
