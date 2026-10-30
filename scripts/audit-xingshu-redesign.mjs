import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { connectionReview } from './xingshu-connection-audit.mjs';
const dir='analysis/xingshu-v2';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const old=await Promise.all(['ni','hao'].map(f=>read(`data/xingshu/v0.1.0/${f}.json`)));
const final=await Promise.all(['ni','hao'].map(f=>read(`data/xingshu/v0.2.0/${f}.json`)));
const capture=await read(`${dir}/prototype-1.2/capture.json`);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:1160,height:1500}});
 await page.goto('http://127.0.0.1:5173/tests/fixtures/masks.html');
 const links=await page.evaluate(({old,capture})=>{
   const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');document.body.append(svg);
   const route=s=>{const p=document.createElementNS(ns,'path');p.setAttribute('d',s.d);svg.append(p);return p;};
   const dot=(a,b)=>a.x*b.x+a.y*b.y,norm=a=>Math.hypot(a.x,a.y);
   const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,dot(a,b)/norm(a)/norm(b))))*180/Math.PI;
   const vector=(p,end)=>{const l=p.getTotalLength(),a=p.getPointAtLength(end?l-.2:0),b=p.getPointAtLength(end?l:.2);return{x:b.x-a.x,y:b.y-a.y};};
   return old.flatMap((g,gi)=>g.strokes.filter(s=>s.role==='connection').map((s,ci)=>{
     const before=g.strokes.find(t=>t.logicalStrokeIds[0]===s.connection.from),after=g.strokes.find(t=>t.logicalStrokeIds[0]===s.connection.to);
     const a=route(before),p=route(s),b=route(after),len=p.getTotalLength();
     const signed=[],points=Array.from({length:101},(_,i)=>p.getPointAtLength(len*i/100));
     for(let i=1;i<points.length-1;i++){
       const u={x:points[i].x-points[i-1].x,y:points[i].y-points[i-1].y},v={x:points[i+1].x-points[i].x,y:points[i+1].y-points[i].y};
       signed.push(Math.atan2(u.x*v.y-u.y*v.x,dot(u,v))*180/Math.PI);
     }
     const index=old.slice(0,gi).reduce((n,g)=>n+g.strokes.length,0)+g.strokes.indexOf(s);
     const samples=capture.results[0].samples.filter(r=>r.phase==='stroke'&&r.index===index);
     return {number:gi===0?`T${ci+1}`:'T3',character:g.character,from:s.connection.from,to:s.connection.to,
       oldSegmentIndex:index,start:s.start,end:s.end,d:s.d,length:len,
       vectorStart:vector(p,false),vectorEnd:vector(p,true),entryTurnDegrees:angle(vector(a,true),vector(p,false)),exitTurnDegrees:angle(vector(p,true),vector(b,false)),
       netInternalTurnDegrees:signed.reduce((a,b)=>a+b,0),absoluteInternalTurnDegrees:signed.reduce((a,b)=>a+Math.abs(b),0),
       actualPencil:{sampleCount:samples.length,maxSyncError:Math.max(...samples.map(s=>s.error||0)),first:samples[0],last:samples.at(-1)},
       width:s.pressure,logicalOrderRetained:true};
   }));
 },{old,capture});
 for(const link of links){
   const id=link.character==='你'?`ni-thread-${link.from}-${link.to}`:'hao-thread-1-2';
   Object.assign(link,connectionReview[id],{finalInkConnection:false,finalMotion:'lift, linear airborne XY move with sine lift height, then land',
     finalInkSegments:final.find(g=>g.character===link.character).strokes.length});
 }
 const notes={
   '你':['亻撇重画两段弧度；中段加按，尾部向左释放，取消反向回线。','竖单独落笔，窄身微弓，主体饱满，末端圆收。','右撇缩短出锋；和横钩保持空间呼应，尖楔试画被淘汰。','横钩右肩上扬，圆转时按压，短钩内收；不重复上升连接。','竖钩以独立长弧承重，钩前按压，左上收锋。','短撇紧凑且起笔有力，尾段加速，与长撇区分。','点由轻入转为饱满斜点，尾端小幅圆收，不拉细长尾巴。'],
   '好':['女第一笔重画腰部圆折和斜点，收于右下后真实抬笔；无回绕。','女长撇重新落笔；向左舒展并穿过斜点，保留清楚的两笔交叉。','提画在腰部上方右扬；末端指向子部，但两部件不实际连墨。','子横撇上扬后折入较短斜段；尾端向下自然圆转。','竖钩和横撇在同点同切线接续，压力接头均 1.9；下部加按后向左回收。','长横低于女提并呼应其方向，主体丰满；末端短收，避免针状长尖。']
 };
 const strokes=final.flatMap((g,gi)=>g.strokes.map((s,i)=>{
   const before=old[gi].strokes.find(t=>t.logicalStrokeIds[0]===i+1);
   return {character:g.character,logical:i+1,name:g.logicalStrokes[i].name,component:g.logicalStrokes[i].component,
     before:{d:before.d,pressure:before.pressure,entry:before.entry,exit:before.exit},
     after:{d:s.d,pressure:s.pressure,entry:s.entry,exit:s.exit,rhythm:s.rhythm,pace:s.pace},
     analysis:notes[g.character][i],routeRedrawn:s.d!==before.d,pressureRedesigned:JSON.stringify(s.pressure)!==JSON.stringify(before.pressure)};
 }));
 const areas=[];
 for(const variant of ['standard','prototype-1.2','a','b','final']){
   const raw=await readFile(`${dir}/${variant}/normalized.png`);
   const pixels=await page.evaluate(async uri=>{
     const im=new Image();im.src=uri;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;
     const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data,n=[0,0];
     for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(data[i+2]>data[i]+20&&data[i+2]>data[i+1]+5&&data[i]<200)n[x<500?0:1]++;}
     return n;
   },'data:image/png;base64,'+raw.toString('base64'));
   areas.push({variant,ni:pixels[0],hao:pixels[1],total:pixels[0]+pixels[1],sha256:createHash('sha256').update(raw).digest('hex')});
 }
 const panel=(g,highlight)=>g.strokes.map(s=>`<path d="${s.outline}" fill="#3775be"/>${highlight&&s.role==='connection'?`<path d="${s.d}" stroke="#d76b42" fill="none" stroke-width=".6"/>`:''}`).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="1130" viewBox="0 0 1120 1130"><rect width="1120" height="1130" fill="#f3f3f1"/><g font-family="Microsoft YaHei,sans-serif" fill="#3d4942"><text x="36" y="40" font-size="24">三条旧牵丝 → 真实抬笔；主体笔画全部保留</text><text x="100" y="78" font-size="18">1.2.0 原型（橙色标出审查线）</text><text x="620" y="78" font-size="18">最终 B（绿色虚线为离纸移动示意）</text>${links.map((l,i)=>{
   const gi=l.character==='你'?0:1,from=final[gi].strokes.find(s=>s.logicalStrokeIds[0]===l.from).end,to=final[gi].strokes.find(s=>s.logicalStrokeIds[0]===l.to).start;
   return `<text x="32" y="${120+i*330}" font-size="17">${l.number} · ${l.character} ${l.from}→${l.to}</text><g transform="translate(110 ${130+i*330}) scale(2.8)">${panel(old[gi],false)}<path d="${l.d}" stroke="#d76b42" stroke-width=".8" fill="none"/></g><g transform="translate(630 ${130+i*330}) scale(2.8)">${panel(final[gi],false)}<path d="M ${from.x} ${from.y} L ${to.x} ${to.y}" stroke="#55816c" stroke-dasharray="1.3 1.3" stroke-width=".5" fill="none"/></g>`;
 }).join('')}</g></svg>`;
 await writeFile(`${dir}/connections.svg`,svg);await page.setContent(svg);await page.locator('svg').screenshot({path:`${dir}/connections.png`});
 await writeFile(`${dir}/redesign-audit.json`,JSON.stringify({generatedAt:new Date().toISOString(),reviewer:'Codex; user aesthetic approval pending',links,strokes,areas,
   sixConditionReview:connectionReview,rejectedShortShoulder:'rejected-shoulder/normalized.png',recommended:'B: all three old threads removed; one same-point tangent-continuous 子 contact',
   comparisonScope:'Ink area counts at identical 3.5 scale and canvas; not a physical pen pressure measurement'},null,2)+'\n');
 await writeFile(`${dir}/connection-review.md`,`# 逐笔与连笔审查\n\n审查者：Codex，2026-10-30。先实际运行原型、重新录制，再比对同尺度 A/B 字形与正常动画；最终审美由用户确认。完整数据见 [redesign-audit.json](redesign-audit.json)。\n\n## 三条旧牵丝\n\n| 编号 | 起终点 / 方向 / 曲率 | 空间和连续性问题 | 实际 3D 与处置 |\n| --- | --- | --- | --- |\n${links.map(l=>`| ${l.number} ${l.character} ${l.from}→${l.to} | (${l.start.x},${l.start.y})→(${l.end.x},${l.end.y})，长度 ${l.length.toFixed(2)}；接入转向 ${l.entryTurnDegrees.toFixed(1)}°，接出 ${l.exitTurnDegrees.toFixed(1)}° | ${l.number==='T1'?'由撇的左下终点向右上反走，曲线与撇近似平行，形成亻内多余细楔；细线回到较粗竖画，视觉方向中断。':l.number==='T2'?'短曲线斜向右上、曲率较小，但几乎反转上一撇。缩短并圆转的试画仍留下尖楔；不是线够短就自然。':'从女旁右下斜点回到右上，曲线向右鼓出；返回方向与下一撇相反，在主体右侧围出不属于女的细环。'} | 原网页中铅笔确实走过该线，${l.actualPencil.sampleCount} 帧实采；同步误差最大 ${l.actualPencil.maxSyncError.toFixed(7)} px。${l.number==='T2'?'先试 C 重画，静态对比拒绝；最终 B 删除。':'B 删除。'}改为实际抬笔 / 移动 / 落笔。 |`).join('\n')}\n\nT1、T2 都在你字内部，并非跨亻与尔的一条真实墨迹；它们和右部偏轻的主笔合在一起，使整体显得松散。本次把亻压紧、竖加按、尔的重心略向中宫收回，左右仍以空间和方向呼应。女旁保留三条主体笔画；取消返回线后，以腰部圆折、长撇和右扬提画形成结构，没有删主体笔画来藏问题。\n\n[修改前后示意](connections.png) 中橙线标出旧牵丝，绿虚线只解释离纸移动，产品不绘制它。尔部的 [被拒绝试画](rejected-shoulder/normalized.png) 连同编辑数据保留；它不进入候选 B 或最终数据。\n\n## 六条件独立审查\n\n| 墨迹接触 | 方向合理 | 收笔导向下一笔 | 区域合理 | 无多余回绕 | 可辨认 | 优于抬笔 | 决定 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| T1 亻返回 | 否 | 否 | 是 | 否 | 是 | 否 | 删除 |\n| T2 尔返回（含短化试画） | 否 | 否 | 是 | 试画仍显尖楔 | 是 | 否 | 删除 |\n| T3 女返回 | 否 | 否 | 否 | 否 | 受干扰 | 否 | 删除 |\n| 好 4→5 直接接触 | 是 | 是 | 是 | 是 | 是 | 是 | 保留并重画，无额外牵丝 |\n\n唯一保留接触点为 (69.4,35.6)。横撇尾切线 (-1.3,3.9)，竖钩入切线 (-0.7,2.1)，共线同向；连接宽度两端均 1.9 单位。转折位于子内，不添回环。A 版将两笔分开落笔，留下较明显气口；B 版的这个圆转更连贯，因此推荐 B。上述审美判断是 Codex 的取舍，不替代用户。\n\n可执行规则位于 scripts/xingshu-connection-audit.mjs，与笔顺分开。未审查的连接或连续组不能进入生成；原逻辑编号、来源和先后顺序完整保留。当前三条旧线在实际数据、动作计划、3D 轨迹和粒子输入中同时消失。\n\n## 十三笔独立重画\n\n| 字 / 原编号 | 原笔名 | 重画与笔势 | 起 / 最大 / 收宽度 |\n| --- | --- | --- | --- |\n${strokes.map(s=>`| ${s.character} ${s.logical} | ${s.name} | ${s.analysis} | ${s.after.pressure[0][1]} / ${Math.max(...s.after.pressure.map(p=>p[1]))} / ${s.after.pressure.at(-1)[1]} |`).join('\n')}\n\n每笔的原 / 新三次曲线、压力控制点、起收说明和节奏均在 JSON 中；不是统一加 stroke-width、随机扭曲或整体倾斜。\n`);
 console.log(JSON.stringify({links:links.map(l=>({number:l.number,length:l.length,entryTurn:l.entryTurnDegrees,exitTurn:l.exitTurnDegrees,samples:l.actualPencil.sampleCount})),areas}));
}finally{await browser.close();}
