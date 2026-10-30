// Aggregate real saved runs and verify fingerprints; never substitutes for running tests.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const OUT='analysis/xingshu', baseline='b110742bb492233b061f899f0708faf965181b52';
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
async function fingerprint(paths){return Promise.all(paths.map(async file=>({file,sha256:hash(await readFile(file))})));}
async function walk(path){const result=[];for(const e of await readdir(path,{withFileTypes:true})){const p=`${path}/${e.name}`;result.push(...(e.isDirectory()?await walk(p):[p]));}return result.sort();}

if(process.argv.includes('--check')){
  const report=await json(`${OUT}/acceptance.json`);
  for(const r of [...report.sourceFiles,...report.evidenceFiles,...report.visualFiles])
    assert(hash(await readFile(r.file))===r.sha256,`Fingerprint changed: ${r.file}`);
  assert(report.functionalGates.every(g=>g.status==='passed'),'A functional gate failed');
  git('diff','--exit-code',baseline,'--',...report.protectedPaths);
  console.log(JSON.stringify({pass:true,sourceRevision:report.sourceRevision,fingerprints:report.sourceFiles.length+report.evidenceFiles.length+report.visualFiles.length,visualApproval:report.userVisualApproval}));
  process.exit(0);
}

const productPaths=['src','data/xingshu','public/experiments','package.json','package-lock.json','index.html','vite.config.js'];
assert(!git('diff','--name-only','HEAD','--',...productPaths),'Commit tested product files before generating the final acceptance report');
assert(!git('ls-files','--others','--exclude-standard','--',...productPaths),'Untracked product files remain');
const sourceRevision=git('log','-1','--format=%H','--',...productPaths);
const protectedPaths=['public/glyphs','data/glyphs','src/handwriting/generated/manifest.json','src/handwriting/glyphs.js','src/handwriting/signature.js','src/handwriting/inkRenderer.js','src/scene'];
git('diff','--exit-code',baseline,'--',...protectedPaths);
assert(!git('ls-files','--others','--exclude-standard','--',...protectedPaths),'Unexpected untracked file in the protected library');
const [chromium,desktop,masks,calibration,production,connections,particles,faults,thread,unmount,english,capture,videos,comparison]=await Promise.all([
  'browser/chromium-results.json','browser/desktop-browsers.json','quality/masks.json','performance/calibration.json','production/production.json',
  'browser/connections-shadow.json','browser/prototype-particles.json','browser/faults.json','browser/thread-fault.json','browser/unmount.json',
  'english/english-ink-diff.json','visual/capture.json','visual/video-audit.json','visual/comparison.json',
].map(p=>json(`${OUT}/${p}`)));
const unit=await readFile(`${OUT}/unit-tests.tap`,'utf8');
assert(/# tests 19\b/.test(unit)&&/# pass 19\b/.test(unit)&&/# fail 0\b/.test(unit),'Node test evidence is incomplete');
assert(chromium.stats.expected===20&&chromium.stats.unexpected===0&&chromium.stats.skipped===0&&chromium.errors.length===0,'Chromium evidence failed');
assert(desktop.stats.expected===3&&desktop.stats.unexpected===0&&desktop.stats.skipped===0&&desktop.errors.length===0,'Desktop evidence failed');
assert(masks.sourceSHA256===hash(await readFile('data/xingshu/v0.1.0/artwork.json')),'Stale mask source');
assert(masks.rendererSHA256===hash(await readFile('src/handwriting/inkRenderer.js')),'Stale mask renderer');
assert(calibration.artworkSHA256===masks.sourceSHA256,'Stale calibration drawing');
assert(calibration.limitsSHA256===hash(await readFile('src/handwriting/signatureLimits.json')),'Stale limits');
for(const r of capture.sourceFiles)assert(hash(await readFile(r.file))===r.sha256,`Stale visual capture ${r.file}`);
for(const r of videos.videos)assert(hash(await readFile(`${OUT}/${r.path}`))===r.sha256,'Stale video audit');
for(const r of comparison.sources)assert(hash(await readFile(`${OUT}/${r.path}`))===r.sha256,'Stale comparison');
for(const c of production.cases)for(const r of c.distributedFiles)assert(hash(await readFile(`public/${r.path}`))===r.sha256,'Stale production artifact');

const gates=[];
function gate(id,label,condition,evidence){assert(condition,label);gates.push({id,label,status:'passed',evidence});}
gate('scope','工程审计、冻结原效果和独立分支',git('branch','--show-current')==='feature/chinese-xingshu-prototype',['engineering-audit.md','baseline/capture.json']);
gate('protected','3500 字合格库、英文几何、渲染器与 3D / 粒子源码保持原样',masks.formalLibraryProtection.unchanged,['quality/masks.json']);
gate('models','19 项模型、字形映射、输入预算、缓存与逐段节奏',true,['unit-tests.tap']);
gate('contours','两字 16 段 ×22 进度完整轮廓与中线匹配',masks.pass&&masks.segments===16&&masks.results.every(r=>r.ratio===1&&r.completeAlphaDifference===0&&r.progressive),['quality/masks.json']);
gate('contacts','13 个原逻辑笔画、9 动作组、3 牵丝、7 个接触边界',connections.done.logicalStrokeCount===13&&connections.done.visualActions.length===9&&connections.contacts.length===7&&connections.contacts.every(c=>c.gap<.002),['browser/connections-shadow.json']);
const contactSamples=connections.samples.filter(s=>s.phase==='stroke');
gate('synchrony','实际 SVG 揭示端点与 3D 笔尖同步、接触和抬笔阴影',contactSamples.length>100&&Math.max(...contactSamples.map(s=>s.error))<.2&&connections.samples.some(s=>s.phase==='lift'&&s.opacity<.41),['browser/connections-shadow.json']);
gate('particles','实际完整轮廓区域采样、清除归位、再次书写',particles.particleCheck.count>300&&particles.particleCheck.outside===0&&particles.particleCheck.offCenterline>30&&particles.final.state==='idle',['browser/prototype-particles.json']);
gate('chromium','Chromium 20 项完整交互、IME、单行、原英文和资源回归',true,['browser/chromium-results.json']);
gate('desktop','Edge、Firefox、WebKit 关键回归各通过',true,['browser/desktop-browsers.json']);
gate('recovery','七类故障、真实牵丝中断和组件卸载恢复',faults.results.length===7&&faults.results.every(r=>!r.after.active&&!r.after.hasGlyphLease&&r.after.strokeCount===0)&&thread.recovered.strokeCount===0&&unmount.cancelled.disposed,['browser/faults.json','browser/thread-fault.json','browser/unmount.json']);
gate('performance','九组正常速度校准及 13 项预算',calibration.pass&&calibration.cases.length===9&&Object.values(calibration.gates).every(Boolean),['performance/calibration.json']);
gate('single-line','32 字符 / 140 段 / 40 秒 / 0.5 scale 和实际宽度拒绝',calibration.rejections.length===5&&calibration.rejections.every(r=>r.state==='idle'),['performance/calibration.json','browser/chromium-results.json']);
gate('english','原英文签名蓝色墨迹差异 0',english.pass&&english.differentInkPixels===0,['english/english-ink-diff.json']);
gate('production','生产构建、三个桌面 DPR、原型源码许可、本地加载与无调试入口',production.pass&&production.cases.length===3&&production.cases.every(c=>c.completeContours===16&&!c.debugApiIncluded&&!c.errors.length),['build-output.txt','production/production.json']);
gate('visual-artifacts','新旧完整场景、逐段轮廓、7 关键帧和可解码实时录制',videos.pass&&videos.videos.every(v=>v.decodedAndSeeked)&&capture.results[0].frames.length===7,['visual/capture.json','visual/video-audit.json','visual-review.md','review.html']);

const sourceFiles=await fingerprint([
  ...(await walk('src')),...(await walk('data/xingshu')),...(await walk('public/experiments')),
  'package.json','package-lock.json','index.html','vite.config.js',
]);
const evidenceNames=[
  'unit-tests.tap','quality/masks.json','artwork/geometry.json','browser/chromium-results.json','browser/desktop-browsers.json',
  'browser/connections-shadow.json','browser/prototype-particles.json','browser/faults.json','browser/thread-fault.json','browser/unmount.json',
  'browser/prototype-motion-resize.json','browser/resize-motion.json','browser/adaptive-quality.json',
  'performance/calibration.json','production/production.json','english/english-ink-diff.json','visual/capture.json',
  'visual/comparison.json','visual/video-audit.json','build-output.txt','engineering-audit.md','visual-spec.md','visual-review.md','review.html',
];
const evidenceFiles=await fingerprint(evidenceNames.map(p=>`${OUT}/${p}`));
const visualNames=[
  'visual/comparison.png','artwork/nihao.png','artwork/overlay.png','artwork/strokes.png','artwork/basic-strokes.png',
  ...Array.from({length:7},(_,i)=>`visual/keyframe-${i+1}.png`),
  'visual/nihao-full.png','visual/nihao-ink-only.png','visual/ni-full.png','visual/hao-full.png','visual/nihao-particles.png',
  'performance/near-duration-floor.png','production/desktop-dpr-1.png','production/desktop-dpr-3.png','english/english-ink-diff.png',
  'baseline/nihao-full.png','baseline/nihao-standard.webm','visual/nihao-prototype-live.webm',
];
const visualFiles=await fingerprint(visualNames.map(p=>`${OUT}/${p}`));
const report={schema:1,generatedAt:new Date().toISOString(),version:production.version,
  conclusion:'PROTOTYPE_FUNCTIONAL_PASSED_USER_VISUAL_REVIEW_PENDING',
  scope:'Two experimental hard-pen running-script glyphs and desktop single-line signature. Not a full-library style release.',
  branch:git('branch','--show-current'),sourceRevision,uncommittedProductChanges:false,
  stableMainBaseline:baseline,protectedPaths,qualifiedLibrary:{target:3500,unchanged:true,strokes:33959,shards:110},
  prototypes:{characters:['你','好'],logicalStrokes:13,visualActions:9,connections:3,inkSegments:16,status:'experimental-not-qualified-library'},
  userVisualApproval:'pending; do not merge main or expand the library before user review',
  visualReview:{reviewer:'Codex',method:'Actual image inspection and decoded recording evidence, documented in visual-review.md',humanCalligraphyExpertCertification:false},
  environment:{...calibration.environment,desktopBrowsers:await Promise.all(['edge','firefox','webkit'].map(async name=>{const r=await json(`${OUT}/browser/${name}-result.json`);return {name,version:r.version};}))},
  tests:{node:19,chromium:20,otherDesktop:3,productionCases:3,normalPerformanceCases:9},limits:calibration.limits,
  metrics:{normalNihaoSeconds:calibration.cases.find(c=>c.id==='nihao').actualSeconds,
    maxP95FrameMs:Math.max(...calibration.cases.map(c=>c.p95FrameMs)),maxSyncErrorCssPx:Math.max(...calibration.cases.map(c=>c.maxSyncError)),
    maxLoadMs:Math.max(...calibration.cases.map(c=>c.loadMs)),maxPlanMs:Math.max(...calibration.cases.map(c=>c.planMs)),
    maxPeakHeap:Math.max(...calibration.cases.map(c=>c.peakHeap)),maxEraseMs:Math.max(...calibration.cases.map(c=>c.eraseMs)),
    completedContourAlphaDifference:0,centerlineInsideRatio:1,groupContactGapCssPx:0,
    particleCount:particles.particleCheck.count,particlesOutside:particles.particleCheck.outside,
    englishDifferentInkPixels:english.differentInkPixels},
  functionalGates:gates,sourceFiles,evidenceFiles,visualFiles,
  changedFiles:git('diff','--name-only',baseline,'HEAD').split('\n'),
  limitations:[
    'Only 你 and 好 use the experimental running-script data. The other 3498 characters retain the original standard style.',
    'User aesthetic approval is pending. Codex review is not human calligraphy expert certification.',
    'The na pen-form study derives from the descending dot-tail in 女; it is not an extra logical stroke or a certified independent standard na.',
    'No mobile optimization, physical mobile-device certification, public hosting or persistence is included.',
    'Performance comes from this Windows desktop headless browser. SwiftShader is allowed; these are not all-device frame-rate guarantees.',
    'Mathematical pen projection error is distinct from antialiasing quality. Large chunk warning remains (JS 1131.62 kB, gzip 358.62 kB).',
  ],
};
await writeFile(`${OUT}/acceptance.json`,JSON.stringify(report,null,2)+'\n');
const m=report.metrics;
await writeFile(`${OUT}/acceptance.md`,`# 「你好」硬笔行书原型验收\n\n**结论：功能原型可交付审查；用户最终审美待确认。未合 main，未扩展其他汉字。**\n\n生成：${report.generatedAt}；版本 ${report.version}；已测产品提交 \`${sourceRevision}\`；分支 \`${report.branch}\`。产品源码无未提交变更。之后的验收 / 记忆提交不改变这些产品文件；最终交付 HEAD 以远程分支和最终回复为准。\n\n[打开审查页](review.html) · [新旧对比](visual/comparison.png) · [实时录制](visual/nihao-prototype-live.webm) · [视觉验收](visual-review.md) · [风格规范](visual-spec.md) · [数据说明](../../data/xingshu/README.md) · [JSON](acceptance.json)。\n\n## 实现与边界\n\n仅两个实验字：13 逻辑笔画、9 连续动作组、3 牵丝、16 段完整墨迹。原编号、顺序、部件、来源与完整中线 / 轮廓关系保留；没有主体省略。现有 3500 字 / 33,959 笔 / 110 分片，以及原英文几何、原渲染器、3D 与粒子源码保持原样。其他 3498 字没有行书化。\n\n桌面单行 Enter 提交，组合输入时交由 IME，Shift+Enter 不插入换行，粘贴换行明确拒绝且保留原文。无新增模式按钮或重播 UI。\n\n## 功能门禁 ${gates.length}/${gates.length}\n\n| 门禁 | 状态 | 证据 |\n| --- | --- | --- |\n${gates.map(g=>`| ${g.label} | 通过 | ${g.evidence.map(p=>`[${p}](${p})`).join('、')} |`).join('\n')}\n\n用户审美为独立待审项，不计作“已通过”；手机专项为本次范围外，不计作通过。\n\n## 关键实测\n\n- 19 模型、20 Chromium、3 其他桌面浏览器、3 生产场景通过，正常速度性能 9 场景 / 13 项预算通过。\n- 正常「你好」${m.normalNihaoSeconds.toFixed(3)} 秒；P95 帧间隔最大 ${m.maxP95FrameMs.toFixed(2)} ms，最大数学同步误差 ${m.maxSyncErrorCssPx.toFixed(7)} CSS px。\n- 加载最大 ${m.maxLoadMs.toFixed(2)} ms，计划最大 ${m.maxPlanMs.toFixed(2)} ms，峰值 JS 堆 ${(m.maxPeakHeap/1024**2).toFixed(2)} MiB，清除最大 ${m.maxEraseMs.toFixed(2)} ms。\n- 16 段 ×22 进度，最终独立完整轮廓 alpha 差异 0；中线采样全在轮廓内；7 组内边界间距 0。\n- ${m.particleCount} 粒子均在实际墨迹内；英文签名蓝色墨迹 29,777 像素一致，差异 0。此对比排除灰色笔影与输入区，不声称整页像素一致。\n- 140 段、32 字符及最小可读宽度边界均实际执行；141 段、33 字符、超宽、超时、换行拒绝并保留原文。\n\n输入预算：32 字符（含空格）、140 段（含牵丝）、预计 40 秒、最小 scale 0.5；实际单行宽度也必须满足。配置与测量指纹见 JSON，不是任意 32 个汉字均可在当前窗口容纳。\n\n## 交付材料与复验\n\n工程审计、风格规范、两字独立 ni.json / hao.json、可编辑 artwork.json、八类笔势研究、逐段图与中线叠图、七关键帧、新旧完整截图和可解码 webm 均已保存。捺势研究从女字斜点末段提炼，不另增逻辑笔画。源码与许可随独立 public/experiments 发布，原 Arphic 来源记录未改。\n\n所有当前源码、测试报告及主要视觉材料的 SHA256 与修改文件清单见 JSON。\`node scripts/verify-xingshu-acceptance.mjs --check\` 只读校验指纹和门禁，不重跑测试；实际执行命令见根 README。\n\n## 尚待用户确认与限制\n\nCodex 已逐项记录视觉观察，但不是人类书法专家认证。用户需审查细硬笔粗细、女旁返回线与整体笔势是否符合期望。按 prompt_03，确认前只推送功能分支，不合 main、不批量改造字库。\n\n测试环境为 Windows 桌面 Chrome ${report.environment.browser} / 1440×900 / DPR2，另有 Edge、Firefox、WebKit 与生产 DPR1/2/3。允许 SwiftShader，结果不代表所有 GPU；数学误差与像素抗锯齿分开。生产 JS 1131.62 kB / gzip 358.62 kB，保留 Vite 大 chunk 警告。没有手机、外网部署、账户或持久化。\n`);
console.log(JSON.stringify({functionalGates:gates.length,pass:true,sourceRevision,userVisualApproval:'pending'}));
