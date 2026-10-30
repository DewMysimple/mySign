// Aggregates independently executed checks; never substitutes for running them.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const OUT='analysis/xingshu-v2',BASE='fed0c9600fabfe34ea8717cd4210dff13dce00ce',MAIN='b110742bb492233b061f899f0708faf965181b52';
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=async path=>JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const protectedMain=['public/glyphs','data/glyphs','src/handwriting/generated/manifest.json','src/handwriting/glyphs.js','src/handwriting/signature.js','src/handwriting/inkRenderer.js','src/scene'];
const protectedPrevious=['analysis/xingshu','data/xingshu/v0.1.0','public/experiments/xingshu-v0.1.0','src/animation/SignatureController.js','src/handwriting/motionRhythm.js','src/handwriting/writingPlan.js','src/handwriting/GlyphLoader.js','src/components','src/App.jsx'];
function protect(){
  assert.equal(git('diff','--name-only',MAIN,'--',...protectedMain),'','Stable library/English/renderer/scene changed');
  assert.equal(git('diff','--name-only',BASE,'--',...protectedPrevious),'','Round-one evidence or protected mechanisms changed');
  assert.equal(git('diff','--name-only',BASE,'--','src'),'src/handwriting/xingshuRegistry.js','Unexpected product source changes');
}
async function walk(path){const out=[];for(const e of await readdir(path,{withFileTypes:true})){
  const p=`${path}/${e.name}`;if(e.isDirectory())out.push(...await walk(p));else out.push(p);
}return out;}
protect();
if(process.argv.includes('--check')){
 const report=await json(`${OUT}/acceptance.json`);
 for(const f of report.fingerprints)assert.equal(hash(await readFile(f.path)),f.sha256,`Stale evidence/source ${f.path}`);
 assert.ok(report.gates.every(g=>g.pass));
 assert.equal(git('branch','--show-current'),report.branch);
 assert.equal(git('rev-parse',`${report.sourceRevision}:src/handwriting/xingshuRegistry.js`),git('rev-parse','HEAD:src/handwriting/xingshuRegistry.js'));
 console.log(JSON.stringify({pass:true,fingerprints:report.fingerprints.length,gates:report.gates.length}));
 process.exit(0);
}
const productPaths=['src','data/xingshu/v0.2.0','public/experiments/xingshu-v0.2.0','package.json','package-lock.json'];
assert.equal(git('diff','--name-only','HEAD','--',...productPaths),'','Commit the tested product before recording its revision');
assert.equal(git('ls-files','--others','--exclude-standard','--',...productPaths),'','Uncommitted product files');
const sourceRevision=git('rev-parse','HEAD'),branch=git('branch','--show-current');
assert.equal(branch,'feature/chinese-xingshu-prototype');
const records=await Promise.all(['browser/chromium-results.json','browser/desktop-browsers.json','quality/masks.json','performance/calibration.json','production/production.json',
 'browser/connections-shadow.json','browser/clean-lifts.json','browser/prototype-particles.json','browser/faults.json','browser/contact-fault.json','browser/unmount.json',
 'english/english-ink-diff.json','media-audit.json','comparison.json','redesign-audit.json','final/capture.json','review-page-smoke.json'].map(p=>json(`${OUT}/${p}`)));
const [chromium,desktop,masks,calibration,production,contacts,lifts,particles,faults,contactFault,unmount,english,media,comparison,audit,capture,review]=records;
const unit=await readFile(`${OUT}/unit-tests.tap`,'utf8');
assert.ok(/# tests 23\b/.test(unit)&&/# pass 23\b/.test(unit)&&/# fail 0\b/.test(unit));
const data=await Promise.all(['ni','hao'].map(n=>json(`data/xingshu/v0.2.0/${n}.json`)));
const artworkHash=hash(await readFile('data/xingshu/v0.2.0/artwork.json'));
assert.equal(masks.sourceSHA256,artworkHash);assert.equal(calibration.artworkSHA256,artworkHash);
assert.equal(calibration.limitsSHA256,hash(await readFile('src/handwriting/signatureLimits.json')));
assert.equal(masks.rendererSHA256,hash(await readFile('src/handwriting/inkRenderer.js')));
for(const g of data){assert.equal(g.sourceSHA256,artworkHash);assert.ok(!g.omittedLogicalStrokes.length&&!g.orderChanges.length);}
const beforePackage=JSON.parse(git('show',`${BASE}:package.json`)),pkg=await json('package.json');
assert.deepEqual(pkg.dependencies,beforePackage.dependencies);assert.deepEqual(pkg.devDependencies,beforePackage.devDependencies);
const gates=[];
const gate=(id,label,pass,evidence)=>{assert.ok(pass,`Gate failed: ${id}`);gates.push({id,label,pass:true,evidence});};
gate('baseline','真实浏览器冻结旧原型，三条牵丝与十三主体逐笔审查',audit.links.length===3&&audit.links.every(l=>l.actualPencil.sampleCount>0)&&audit.strokes.length===13,['prototype-1.2/capture.json','connection-review.md','redesign-audit.json']);
gate('redesign','十三中线和压力独立重画，主笔加按，女旁回绕删除',audit.strokes.every(s=>s.routeRedrawn&&s.pressureRedesigned)&&data.flatMap(g=>g.strokes).every(s=>s.role!=='connection'),['redesign-audit.json','final/artwork/strokes.png','visual-spec.md']);
gate('logic','保留13原逻辑笔画；12组、13段、零独立牵丝',data.reduce((n,g)=>n+g.logicalStrokes.length,0)===13&&data.reduce((n,g)=>n+g.visualActions.length,0)===12&&data.reduce((n,g)=>n+g.strokes.length,0)===13,['browser/connections-shadow.json','unit-tests.tap']);
gate('AB','A/B各有全字、分解、中线叠图与真实正常速度录制',media.bindings.filter(b=>['a','b'].includes(b.label)).length===6&&media.videos.filter(v=>['a','b'].includes(v.label)).every(v=>v.decodedAndSeeked),['a/artwork/strokes.png','a/artwork/overlay.png','a/live.webm','b/artwork/strokes.png','b/artwork/overlay.png','b/live.webm','visual-review.md']);
gate('comparison','五版相同尺度蓝墨、纸色、画布与字距；5段实际视频解码',comparison.variants.length===5&&comparison.uniform.emScale===3.5&&comparison.uniform.advance===110&&media.videos.length===5&&media.videos.every(v=>v.decodedAndSeeked)&&media.bindings.every(b=>b.validSvg&&b.outlines&&b.routes),['comparison.json','comparison.png','before-after.png','media-audit.json']);
gate('contours','13段×22进度，完整轮廓精确显现，中线采样均在轮廓内',masks.pass&&masks.segments===13&&masks.progressLevels===22&&masks.results.every(r=>r.ratio===1&&r.completeAlphaDifference===0&&r.progressive),['quality/masks.json']);
gate('synchrony','真实中线端点与3D笔尖同步，唯一接触点连续、接触阴影一致',contacts.done.logicalStrokeCount===13&&contacts.contacts.length===1&&contacts.contacts[0].gap<.002&&contacts.samples.filter(s=>s.error!==null).every(s=>s.error<.2),['browser/connections-shadow.json']);
gate('lifts','11次真实抬笔；删除三线的位置墨迹不变，阴影抬起',new Set(lifts.frames.map(s=>s.index)).size===11&&[1,3,8].every(i=>{const rows=lifts.frames.filter(s=>s.index===i);return rows.length>1&&new Set(rows.map(s=>JSON.stringify(s.ink))).size===1&&rows.every(s=>s.ink[i].opacity==='0')&&rows.some(s=>s.opacity<.41);})&&lifts.frames.every(s=>s.interpolationError<.002),['browser/clean-lifts.json']);
gate('particles','粒子从完整区域采样、清除、归位并再次写英文',particles.particleCheck.count>300&&particles.particleCheck.outside===0&&particles.particleCheck.offCenterline>30&&particles.final.particles===0&&particles.final.state==='idle',['browser/prototype-particles.json','final/particles.png']);
gate('models','23项模型、来源、曲线压力、六条件连带、预算和缓存',true,['unit-tests.tap']);
gate('chromium','Chromium完整交互21项通过',chromium.stats.expected===21&&!chromium.stats.unexpected&&!chromium.stats.flaky&&!chromium.stats.skipped&&!chromium.errors.length,['browser/chromium-results.json']);
gate('desktop','Edge、Firefox、WebKit关键回归3项通过',desktop.stats.expected===3&&!desktop.stats.unexpected&&!desktop.stats.flaky,['browser/desktop-browsers.json']);
gate('recovery','7类故障、自然接触处中断、卸载与恢复',faults.results.length===7&&faults.results.every(r=>!r.after.active&&!r.after.hasGlyphLease)&&contactFault.recovered.strokeCount===0&&unmount.cancelled.disposed,['browser/faults.json','browser/contact-fault.json','browser/unmount.json']);
gate('performance','正常速度9场景、13预算门禁与拒绝恢复',calibration.pass&&calibration.cases.length===9&&Object.values(calibration.gates).every(Boolean)&&calibration.rejections.length===5,['performance/calibration.json']);
gate('english','英文冻结签名蓝色墨迹像素差异0',english.pass&&english.differentInkPixels===0&&english.currentInkPixels===29777,['english/english-ink-diff.json']);
gate('production','真实生产构建、三个桌面DPR、源码许可与本地加载',production.pass&&production.cases.length===3&&production.cases.every(c=>c.completeContours===13&&!c.debugApiIncluded&&!c.errors.length&&c.distributedFiles.length===8),['build-output.txt','production/production.json']);
gate('protection','原正式3500字/manifest/英文/渲染/3D/粒子/GSAP和旧证据保留',true,['engineering-audit.md']);
gate('review','完整画面、单字、11关键帧、最终录制和可用审查页',capture.results.length===3&&capture.results[0].frames.length===11&&review.pass&&review.images.every(i=>i.width>0),['final/capture.json','final/keyframes.png','final/live.webm','review-page-smoke.json','review.html']);
const paths=[...(await walk('src')),...(await walk('data/xingshu/v0.2.0')),...(await walk('public/experiments/xingshu-v0.2.0')),
 ...(await walk(OUT)).filter(p=>!p.endsWith('/acceptance.json')&&!p.endsWith('/acceptance.md')&&!p.includes('/changed-files.')),
 'package.json','package-lock.json','prompt/prompt_04.txt','README.md','AGENTS.md','.gitattributes','playwright.config.js','playwright.desktop.config.js',
 ...(await walk('tests')).filter(p=>!p.endsWith('.pyc')),
 ...((await readdir('scripts')).filter(p=>/xingshu.*(v2|round2)|audit-xingshu-redesign|xingshu-connection-audit|serve-xingshu-study/.test(p)).map(p=>`scripts/${p}`))];
const fingerprints=await Promise.all([...new Set(paths)].sort().map(async path=>({path,sha256:hash(await readFile(path))})));
const changedFiles=[...new Set([...execFileSync('git',['diff','--name-only','-z',BASE],{encoding:'utf8'}).split('\0'),
 ...execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0'),`${OUT}/acceptance.json`,`${OUT}/acceptance.md`,`${OUT}/changed-files.json`,`${OUT}/changed-files.md`].filter(Boolean))].sort();
const nihao=calibration.cases.find(c=>c.id==='nihao');
const report={schema:'shakespread.xingshu.round2-acceptance/1',generatedAt:new Date().toISOString(),version:pkg.version,branch,sourceRevision,
 conclusion:'REDESIGN_AND_FUNCTIONAL_DELIVERY_COMPLETE_USER_AESTHETIC_REVIEW_PENDING',mainMerged:false,expandedCharacters:false,
 originalPrototypeRevision:BASE,stableMainBaseline:MAIN,protectedMain,protectedPrevious,dependenciesUnchanged:true,
 prototypes:{characters:['你','好'],logicalStrokes:13,visualActions:12,inkSegments:13,independentThreads:0,retainedDirectContacts:1,recommended:'B',status:'experimental-not-qualified-library'},
 tests:{node:23,chromium:21,otherDesktop:3,productionCases:3,normalPerformanceCases:9},
 metrics:{normalNihaoSeconds:nihao.actualSeconds,maxP95FrameMs:Math.max(...calibration.cases.map(c=>c.p95FrameMs)),maxSyncErrorCssPx:Math.max(...calibration.cases.map(c=>c.maxSyncError)),maxPeakHeap:Math.max(...calibration.cases.map(c=>c.peakHeap)),maxEraseMs:Math.max(...calibration.cases.map(c=>c.eraseMs)),
  particles:particles.particleCheck,inkAreaIncrease:audit.areas.find(a=>a.variant==='final').total/audit.areas.find(a=>a.variant==='prototype-1.2').total-1},
 environment:calibration.environment,limits:calibration.limits,artworkSHA256:artworkHash,gates,fingerprints,changedFiles,
 limitations:['User aesthetic approval remains pending; no main merge or expansion.','Desktop headless measurements with SwiftShader allowed; not a guarantee for every GPU.','No mobile-specific development, online deployment or human calligraphy certification.']};
await writeFile(`${OUT}/acceptance.json`,JSON.stringify(report,null,2)+'\n');
await writeFile(`${OUT}/changed-files.json`,JSON.stringify({base:BASE,files:changedFiles},null,2)+'\n');
await writeFile(`${OUT}/changed-files.md`,`# 本轮修改文件\n\n基于 ${BASE}，包括后续交付报告与工程记忆；实际最终 HEAD 以远程分支为准。共 ${changedFiles.length} 项。\n\n${changedFiles.map(p=>`- ${p}`).join('\n')}\n`);
const m=report.metrics;
await writeFile(`${OUT}/acceptance.md`,`# 「你好」第二轮硬笔行书交付\n\n已完成 prompt_04 的完整美术重构、A/B 比较与真实浏览器验证。推荐 B；用户最终审美待确认，仍是实验分支，未合 main、未扩字。\n\n版本 ${pkg.version}，已测产品提交 \`${sourceRevision}\`，分支 \`${branch}\`。报告及记忆提交不改变已测产品。\n\n[审查页](review.html) · [前后对比](before-after.png) · [五版比较](comparison.png) · [最终真实录制](final/live.webm) · [连笔审查](connection-review.md) · [视觉规范](visual-spec.md) · [修改清单](changed-files.md) · [JSON](acceptance.json)。\n\n## 字形与选择\n\n十三条主体中线、部件比例与各自压力曲线重新设计。三条旧牵丝全部删除；不是只隐藏 SVG，而是从数据、动作、笔尖轨迹和粒子采样一起移除。保留原 13 逻辑笔画、顺序和来源，最终 12 动作组 / 13 墨迹段 / 0 独立牵丝，仅子部 4→5 同点同向接触。\n\nA 是十三笔独立抬落；B 在子部保留自然圆转，选择 B。短化尔部返回的试画因仍成尖楔而弃用。女旁腰部与长撇重画，无右侧空心回环；主笔加按，点、竖、提各有不同起收。主笔饱满、收笔有变化；没有统一加宽、随机扰动或整体倾斜。完整观察见 [visual-review.md](visual-review.md)。\n\n五版静态图由真实产品渲染器在同一画布、字号、显示比例、蓝墨、纸色和字距下完成；A/B 各有完整字形、笔画分解、中线叠图和实际动画。5 段录制均实际解码并寻帧，12 组捕获 SVG 与对应数据逐段精确匹配。\n\n## 重新执行的验证 ${gates.length}/${gates.length}\n\n| 门禁 | 结果 | 证据 |\n| --- | --- | --- |\n${gates.map(g=>`| ${g.label} | 通过 | ${g.evidence.map(e=>`[${e}](${e})`).join('、')} |`).join('\n')}\n\n23 模型、21 Chromium、3 其他桌面浏览器、3 生产场景、9 正常速度校准场景均通过。13 段 ×22 进度，最终轮廓 alpha 差异 0，中线采样 100% 在轮廓内。唯一接触点间距 0；11 次实际抬笔均采到，三个删除位置抬笔期间墨迹保持不变。${m.particles.count} 个清除粒子均位于完整墨迹中。英文蓝色墨迹 29,777 像素与冻结基线相同。\n\n正常「你好」${m.normalNihaoSeconds.toFixed(3)} 秒；P95 帧间隔最大 ${m.maxP95FrameMs.toFixed(2)} ms，最大同步数学误差 ${m.maxSyncErrorCssPx.toFixed(7)} CSS px，峰值 JS 堆 ${(m.maxPeakHeap/1024**2).toFixed(2)} MiB，清除最大 ${m.maxEraseMs.toFixed(2)} ms。实际完整轮廓蓝色像素面积比旧原型增加约 ${(m.inkAreaIncrease*100).toFixed(1)}%，仅是同尺度图像测量，不是物理压力或审美认证。\n\n仍沿用 32 字符 / 140 墨迹段 / 40 秒 / 最小 scale 0.5 与实际单行宽度限制；输入法、原文保留和错误恢复不变。新版 15 字「你好」组合 98 段约 37.67 秒，16 字超 40 秒被拒绝；未为新画风放宽预算。\n\n## 工程保护与交付\n\n原 3500 字 / 33,959 笔 / 110 分片和正式 manifest、英文几何、renderer、Three 模型、粒子源码未改。相对本轮起点，SignatureController、motionRhythm、布局与输入组件完全不变；唯一 GSAP 时钟继续协调笔尖、轮廓、阴影和抬笔。运行时源码只切换两个实验 JSON 导入。没有新增运行时依赖或生产冗余控件。\n\n数据与源文件位于 data/xingshu/v0.2.0；独立 public/experiments/xingshu-v0.2.0 分发完整可编辑曲线压力、designs.mjs、审查规则记录、manifest、来源和 Arphic 原许可。旧原型及其分析、许可记录原样保留。\n\n[修改清单](changed-files.md) 包含本轮源码、配置、材料和工程记忆；JSON 保存 ${fingerprints.length} 个源码与证据 SHA256。\`node scripts/verify-xingshu-v2-acceptance.mjs --check\` 只读核对指纹和保护范围，不重新运行浏览器或代替测试。\n\n当前实测为 Windows 桌面，允许 SwiftShader；结果不代表所有 GPU。JS 1108.31 kB / gzip 348.64 kB，保留 Vite 大 chunk 警告。未做手机专项或公网发布。最终审美由用户确认，确认前不合 main、不扩展其他字。\n`);
console.log(JSON.stringify({gates:gates.length,fingerprints:fingerprints.length,files:changedFiles.length,sourceRevision}));
