import { chromium } from '@playwright/test';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const dir='analysis/xingshu-v2',hash=b=>createHash('sha256').update(b).digest('hex');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:1500,height:900},deviceScaleFactor:1});
 const image=async path=>'data:image/png;base64,'+(await readFile(path)).toString('base64');
 await page.setContent(`<html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font:18px 'Microsoft YaHei','Segoe UI',sans-serif;color:#37483d}#plate{width:1480px;padding:32px;background:#f3f3f1}h1{font-size:28px;font-weight:500;margin:0 0 14px}p{font-size:15px;color:#6b756f;margin:0 0 24px}.row{display:flex;gap:16px}.cell{width:700px}.cell img{width:700px;height:287px;display:block}.label{margin:8px 0}</style><div id="plate"><h1>「你好」· 第二轮硬笔行书重画</h1><p>相同 em / 画布 / 蓝墨 / 字距。保留全部 13 个逻辑笔画，删除三条返回线，逐笔重做压力与曲线。</p><div class="row"><div class="cell"><div class="label">修改前 · 1.2.0 原型</div><img src="${await image(`${dir}/prototype-1.2/normalized.png`)}"></div><div class="cell"><div class="label">最终推荐 · B，子部同点连写</div><img src="${await image(`${dir}/final/normalized.png`)}"></div></div></div>`);
 await page.evaluate(()=>Promise.all([...document.images].map(im=>im.decode())));
 await page.locator('#plate').screenshot({path:`${dir}/before-after.png`});
 const bindings=[];
 for(const [label,dataDir]of[['prototype-1.2','data/xingshu/v0.1.0'],['a','data/xingshu/v0.2.0/candidates/a'],['b','data/xingshu/v0.2.0/candidates/b'],['final','data/xingshu/v0.2.0']]){
   const glyphs=await Promise.all(['ni','hao'].map(async f=>JSON.parse(await readFile(`${dataDir}/${f}.json`,'utf8'))));
   for(const [name,indices]of[['nihao',[0,1]],['ni',[0]],['hao',[1]]]){
     const raw=await readFile(`${dir}/${label}/${name}.svg`,'utf8'),expected=indices.flatMap(i=>glyphs[i].strokes);
     const check=await page.evaluate(({raw,expected})=>{
       const doc=new DOMParser().parseFromString(raw,'image/svg+xml');
       const outlines=[...doc.querySelectorAll('[data-outline]')].map(p=>p.getAttribute('d'));
       const routes=[...doc.querySelectorAll('[data-route]')].map(p=>p.getAttribute('d'));
       return {validSvg:!doc.querySelector('parsererror'),outlines:JSON.stringify(outlines)===JSON.stringify(expected.map(s=>s.outline)),routes:JSON.stringify(routes)===JSON.stringify(expected.map(s=>s.d)),count:outlines.length};
     },{raw,expected});
     if(!check.validSvg||!check.outlines||!check.routes)throw new Error(`Capture/source mismatch ${label} ${name}`);
     bindings.push({label,name,...check,svgSHA256:hash(Buffer.from(raw)),data:await Promise.all(indices.map(async i=>({file:`${dataDir}/${i?'hao':'ni'}.json`,sha256:hash(await readFile(`${dataDir}/${i?'hao':'ni'}.json`))})))});
   }
 }
 await page.goto('http://127.0.0.1:5173/tests/fixtures/masks.html');
 const videos=[];
 for(const [label,path]of[['standard','../xingshu/baseline/nihao-standard.webm'],...['prototype-1.2','a','b','final'].map(v=>[v,`${v}/live.webm`])]){
   const result=await page.evaluate(async path=>{
     const v=document.createElement('video');v.muted=true;v.src=`/analysis/xingshu-v2/${path}`;document.body.replaceChildren(v);
     await new Promise((ok,fail)=>{v.onloadedmetadata=ok;v.onerror=()=>fail(Error('Video decode failed'));});
     const metadata={seconds:v.duration,width:v.videoWidth,height:v.videoHeight};v.currentTime=Math.min(3,v.duration/2);
     await new Promise((ok,fail)=>{v.onseeked=ok;v.onerror=()=>fail(Error('Video seek failed'));});
     const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);
     return {...metadata,frame:c.toDataURL()};
   },path);
   if(result.seconds<5||result.width!==1440||result.height!==900)throw new Error('Invalid video');
   const {frame,...metadata}=result;await writeFile(`${dir}/${label}/video-frame.png`,Buffer.from(frame.split(',')[1],'base64'));
   videos.push({label,path,...metadata,sha256:hash(await readFile(`${dir}/${path}`)),decodedAndSeeked:true});
 }
 await writeFile(`${dir}/media-audit.json`,JSON.stringify({generatedAt:new Date().toISOString(),browser:browser.version(),pass:true,bindings,videos},null,2)+'\n');
 const labels={standard:'1.1.0 标准字形','prototype-1.2':'1.2.0 原型',a:'A · 克制型',b:'B · 自然连带型',final:'最终推荐 · B'};
 const finalCapture=JSON.parse(await readFile(`${dir}/final/capture.json`,'utf8'));
 const frames=finalCapture.results[0].frames;
 await page.setViewportSize({width:1480,height:1800});
 await page.setContent(`<html><meta charset="utf-8"><style>body{margin:0;background:#f3f3f1;font:15px 'Microsoft YaHei',sans-serif;color:#3d4942}#frames{padding:20px;width:1480px;display:grid;grid-template-columns:repeat(3,480px)}figure{margin:0 0 14px}img{display:block;width:480px;height:300px}figcaption{padding:4px 12px}</style><div id="frames">${(await Promise.all(frames.map(async f=>`<figure><img src="${await image(`${dir}/final/${f.file}`)}"><figcaption>${f.file} · ${f.phase} / ${f.index} · p≈${f.pBeforeScreenshot.toFixed(2)}（截图前）</figcaption></figure>`))).join('')}</div>`);
 await page.evaluate(()=>Promise.all([...document.images].map(im=>im.decode())));
 await page.locator('#frames').screenshot({path:`${dir}/final/keyframes.png`});
 await writeFile(`${dir}/review.html`,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>你好 · 第二轮硬笔行书审查</title><style>
 body{margin:0;padding:40px;background:#f3f3f1;color:#34463b;font:16px/1.8 'Segoe UI','Microsoft YaHei',sans-serif}main{max-width:1240px;margin:auto}h1,h2{font-weight:500}h1{font-size:30px}h2{margin-top:42px;font-size:23px}img,video{display:block;width:100%;height:auto}a{color:#3775be}figure{margin:0}figcaption{margin:8px 0 22px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.note{color:#6b756f}details{margin:24px 0}summary{cursor:pointer}@media(max-width:800px){body{padding:20px}.grid{grid-template-columns:1fr}}
 </style><main><h1>「你好」· 第二轮硬笔行书</h1><p>推荐 B：主笔加按、女旁重画、删除三条旧牵丝，只保留子部自然同点连写。13 逻辑笔画 / 12 连续动作 / 13 实际墨迹段。</p><p class="note">本页为独立审查材料；产品没有增加模式或重播按钮。用户审美待确认，实验分支未合 main。</p><p><a href="http://127.0.0.1:4173/">打开产品预览，输入「你好」</a> · <a href="acceptance.md">验收报告</a> · <a href="connection-review.md">逐笔与连笔审查</a> · <a href="visual-spec.md">新版视觉规范</a></p>
 <img src="before-after.png" alt="修改前与最终推荐版本，同尺度蓝墨对比">
 <h2>A / B 两个候选</h2><div class="grid">${['a','b'].map(v=>`<figure><img src="${v}/normalized.png" alt="${labels[v]}完整字形"><figcaption>${labels[v]}：${v==='a'?'13 笔分别抬落，子部上折留出气口。':'12 组动作，子部横撇接竖钩；没有独立牵丝。'}</figcaption><video controls preload="metadata" src="${v}/live.webm"></video></figure>`).join('')}</div>
 <h2>最终版本真实网页录制</h2><p>正常速度依次输入「你好」「你」「好」，各自执行粒子清除与归位。约 5.5 秒写完「你好」；视频总时长还包括输入、停留和清除。</p><video controls preload="metadata" src="final/live.webm"></video>
 <h2>三条牵丝怎么处理</h2><p>三条全部改为实际抬笔。缩短尔部连接的试画仍形成尖楔，故弃用。图中的绿虚线只解释离纸移动，不是产品墨迹。</p><img src="connections.png" alt="三条返回线修改前后与抬笔位置">
 <h2>完整轮廓、逐笔与中线</h2><img src="final/artwork/strokes.png" alt="保留全部13逻辑笔画"><img src="final/artwork/overlay.png" alt="最终笔画轮廓与真实中线叠加"><div class="grid"><img src="final/ni-full.png" alt="你 实际完整场景"><img src="final/hao-full.png" alt="好 实际完整场景"></div>
 <details><summary>展开五版同尺度静态对比与旧录制</summary><img src="comparison.png" alt="标准、旧原型、A、B、最终版本等比例对比"><div class="grid">${videos.slice(0,2).map(v=>`<figure><video controls preload="metadata" src="${v.path}"></video><figcaption>${labels[v.label]}，原始真实浏览器录制</figcaption></figure>`).join('')}</div></details>
 <details><summary>展开 A/B 笔画分解与中线</summary>${['a','b'].map(v=>`<h2>${labels[v]}</h2><img src="${v}/artwork/strokes.png" alt="${labels[v]}笔画分解"><img src="${v}/artwork/overlay.png" alt="${labels[v]}中线叠加">`).join('')}</details>
 <details><summary>展开最终动画关键帧与清除</summary><img src="final/keyframes.png" alt="正常动画关键帧总览"><div class="grid">${frames.map((f,i)=>`<img src="final/${f.file}" alt="正常动画关键帧${i+1}">`).join('')}<img src="final/particles.png" alt="完整轮廓区域粒子清除"></div></details>
 <p class="note">统一比较图由实际 inkRenderer 在 Chromium 绘制：1000×410、每 em 3.5px、110 单位字距、相同纸色和蓝墨；实际产品截图与录制保持正常排版。A/B 选择来自 Codex 的静态与动画观察，最终审美仍由用户决定。</p></main></html>`);
 await page.goto('http://127.0.0.1:5173/analysis/xingshu-v2/review.html');
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 const smoke=await page.evaluate(()=>({title:document.title,images:[...document.images].map(i=>({src:i.getAttribute('src'),width:i.naturalWidth})),videos:[...document.querySelectorAll('video')].map(v=>({src:v.getAttribute('src'),controls:v.controls}))}));
 await writeFile(`${dir}/review-page-smoke.json`,JSON.stringify({generatedAt:new Date().toISOString(),pass:smoke.images.every(i=>i.width>0),...smoke},null,2)+'\n');
 console.log(JSON.stringify({videos:videos.length,sourceBindings:bindings.length,images:smoke.images.length}));
}finally{await browser.close();}
