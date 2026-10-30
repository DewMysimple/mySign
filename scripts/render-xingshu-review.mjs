import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const dir='analysis/xingshu';
const hash=b=>createHash('sha256').update(b).digest('hex');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  const page=await browser.newPage({viewport:{width:1500,height:800}});
  for(const file of ['baseline/nihao','visual/nihao','visual/ni','visual/hao']){
    const raw=await readFile(`${dir}/${file}.svg`,'utf8');
    const svg=raw.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" ');
    await writeFile(`${dir}/${file}-standalone.svg`,svg);
  }
  const sourcePaths=['baseline/nihao-ink-only.png','visual/nihao-ink-only.png'];
  const sources=await Promise.all(sourcePaths.map(async path=>{const b=await readFile(`${dir}/${path}`);return {path,sha256:hash(b),uri:'data:image/png;base64,'+b.toString('base64')};}));
  await page.setContent(`<!doctype html><html><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#fff;font-family:'Segoe UI','Microsoft YaHei',sans-serif;color:#343c3a}
    #figure{padding:36px;width:1440px;background:#f3f3f1}h1{margin:0 0 12px;font-size:28px;font-weight:500}p{font-size:15px;color:#6d746e}
    .grid{display:flex;gap:24px}.panel{width:672px}.label{font-size:17px;margin:28px 0 10px}.crop{position:relative;width:660px;height:330px;overflow:hidden}
    .crop img{position:absolute;width:2160px;height:1350px;left:-765px;top:-420px;max-width:none}
  </style><div id="figure"><h1>「你好」· 标准字形与硬笔行书原型</h1><p>来自实际浏览器的完整墨迹，同一裁切、同一 1.5 倍展示；审查图暂时隐藏铅笔以免遮挡。</p><div class="grid">${sources.map((s,i)=>`<div class="panel"><div class="label">${i?'新原型 · 0.1.0 experimental':'原版 · 1.1.0 标准字形'}</div><div class="crop"><img src="${s.uri}"></div></div>`).join('')}</div><p>13 个逻辑笔画保留 · 9 组连续动作 · 3 段独立牵丝 · 用户审美验收待确认</p></div></html>`);
  await page.locator('#figure').screenshot({path:`${dir}/visual/comparison.png`});
  await writeFile(`${dir}/visual/comparison.json`,JSON.stringify({generatedAt:new Date().toISOString(),
    sources:sources.map(({uri,...s})=>s),crop:{x:510,y:280,width:440,height:220},displayScale:1.5,
    alterations:'Equal crop/enlargement only. Ink-only source captures temporarily hide the 3D layer; normal app and full captures retain it.',
    aestheticApproval:'pending-user'},null,2)+'\n');
  await page.goto('http://127.0.0.1:5173/tests/fixtures/masks.html');
  const videos=[];
  for(const path of ['baseline/nihao-standard.webm','visual/nihao-prototype-live.webm']){
    const result=await page.evaluate(async path=>{
      const v=document.createElement('video');v.muted=true;v.preload='auto';v.src=`/analysis/xingshu/${path}`;
      document.body.replaceChildren(v);
      await new Promise((resolve,reject)=>{v.onloadedmetadata=resolve;v.onerror=()=>reject(new Error('Video decode failed'));});
      const metadata={duration:v.duration,width:v.videoWidth,height:v.videoHeight};
      v.currentTime=Math.min(3,v.duration/2);
      await new Promise((resolve,reject)=>{v.onseeked=resolve;v.onerror=()=>reject(new Error('Video seek failed'));});
      const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);
      return {...metadata,frame:c.toDataURL()};
    },path);
    if(!Number.isFinite(result.duration)||result.duration<5||result.width!==1440||result.height!==900)throw new Error('Invalid recorded browser video');
    const frameName=path.startsWith('baseline')?'standard-video-frame.png':'prototype-video-frame.png';
    await writeFile(`${dir}/visual/${frameName}`,Buffer.from(result.frame.split(',')[1],'base64'));
    videos.push({path,sha256:hash(await readFile(`${dir}/${path}`)),duration:result.duration,width:result.width,height:result.height,decodedAndSeeked:true});
  }
  await writeFile(`${dir}/visual/video-audit.json`,JSON.stringify({generatedAt:new Date().toISOString(),browser:browser.version(),pass:true,videos},null,2)+'\n');
  await writeFile(`${dir}/review.html`,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shakespread · 你好硬笔行书原型审查</title><style>
  body{margin:0;padding:44px;background:#f3f3f1;color:#303934;font:16px/1.75 'Segoe UI','Microsoft YaHei',sans-serif}main{max-width:1200px;margin:auto}h1{font-size:30px;font-weight:500}h2{font-size:21px;font-weight:500;margin-top:38px}img,video{width:100%;height:auto;display:block}a{color:#3775be}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.note{color:#6b746d}figure{margin:0}figcaption{padding:8px 0} @media(max-width:800px){body{padding:20px}.grid{grid-template-columns:1fr}}
  </style><main><h1>「你好」硬笔行书 · 实验原型</h1><p class="note">功能测试与审美验收分开。本页是交付材料，不是产品新增 UI；原型尚待用户审美确认，没有合并 main，也没有扩展其他 3498 字。</p>
  <img src="visual/comparison.png" alt="同一裁切下的标准字形与新原型对比">
  <h2>实时网页录制</h2><p>新录制依次展示「你好」「你」「好」和各自清除；全部为正常速度的真实浏览器交互。原版录制单独保留。</p>
  <div class="grid"><figure><video controls preload="metadata" src="baseline/nihao-standard.webm"></video><figcaption>1.1.0 标准字形</figcaption></figure><figure><video controls preload="metadata" src="visual/nihao-prototype-live.webm"></video><figcaption>0.1.0 硬笔行书原型</figcaption></figure></div>
  <h2>完整场景</h2><div class="grid"><img src="baseline/nihao-full.png" alt="原版完整场景"><img src="visual/nihao-full.png" alt="新原型完整场景"></div>
  <h2>逐段轮廓与中线</h2><img src="artwork/strokes.png" alt="13 个逻辑笔画及 3 个牵丝段"><img src="artwork/overlay.png" alt="新原型中线和完整轮廓叠加"><img src="artwork/basic-strokes.png" alt="从两个字提炼的八类笔势研究">
  <h2>实际书写关键帧</h2><div class="grid">${[1,2,3,4,5,6,7].map(i=>`<img src="visual/keyframe-${i}.png" alt="实际动画关键帧 ${i}">`).join('')}<img src="visual/nihao-particles.png" alt="完整轮廓粒子清除"></div>
  <p><a href="acceptance.md">验收报告</a> · <a href="visual-spec.md">视觉规范</a> · <a href="engineering-audit.md">工程审计</a> · <a href="../../data/xingshu/README.md">数据说明</a></p>
  <p class="note">Codex 的视觉检查不等于人类书法专家认证；正式视觉取舍留给用户。原始截图、SVG、完整轨迹、视频与 JSON 报告均随分支保存。</p></main></html>`);
  console.log(JSON.stringify({comparison:true,videos}));
}finally{await browser.close();}
