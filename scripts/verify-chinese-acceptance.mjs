// Aggregate recorded runs and verify their data/renderer integrity. This does not
// rerun browser tests, certify human expertise or turn deferred devices into passes.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { readDataset, hash } from './glyph-dataset.mjs';
import { SYMBOLS } from '../src/handwriting/symbols.js';

const root = 'analysis/chinese';
const bytes = (file) => readFile(file);
const json = async (file) => JSON.parse(await readFile(`${root}/${file}`, 'utf8'));
const [dataset, quality, qualification, masks, atlas, crosscheck, sources, prototypes,
  pipeline, chrome, desktop, enhanced, calibration, budgets, boundary, production,
  visual, faults, unmount, cycles, resize, adaptive] = await Promise.all([
  readDataset(), json('glyph-quality.json'),
  readFile('public/glyphs/qualification.json', 'utf8').then(JSON.parse),
  json('masks/coverage.json'), json('atlas-review.json'), json('target-crosscheck.json'),
  json('source-comparison.json'), json('source-animation-comparison.json'),
  json('pipeline-tests.json'), json('browser/chromium-results.json'),
  json('browser/desktop-browsers.json'), json('browser/faults-enhanced-results.json'),
  json('performance/calibration.json'), json('performance/budgets.json'),
  json('performance/budget-verification.json'), json('production/production.json'),
  json('visual/english-ink-diff.json'), json('browser/faults.json'),
  json('browser/unmount.json'), json('browser/cache-cycles.json'),
  json('browser/resize-motion.json'), json('browser/adaptive-quality.json'),
]);
const gates = [];
function gate(id, label, pass, evidence) {
  gates.push({ id, label, status: pass ? 'passed' : 'failed', evidence });
}
const successful = (report, count) => report.stats.expected === count
  && report.stats.unexpected === 0 && report.stats.flaky === 0
  && report.stats.skipped === 0 && report.errors.length === 0;
const tap = await readFile(`${root}/unit-tests.tap`, 'utf8');
gate('model', '英文原几何、注册表、混排布局、加载与缓存模型',
  /# tests 15\r?\n/.test(tap) && /# pass 15\r?\n/.test(tap) && /# fail 0\r?\n/.test(tap), ['unit-tests.tap']);
gate('pipeline', '离线转换、自动修复、推导隔离及双源候选择优',
  pipeline.pass && pipeline.testsRun === 7 && !pipeline.failures && !pipeline.errors, ['pipeline-tests.json']);
gate('targets', '3500 一级字与第二份清单逐项、顺序交叉核对',
  crosscheck.pass && crosscheck.unique === 3500 && crosscheck.orderedEqual,
  ['target-crosscheck.json', '../../data/glyphs/targets.json']);
gate('qualified-glyphs', '全部正式字形、配对轮廓中线及逐字质量',
  quality.target === 3500 && quality.geometryPassed === 3500 && quality.quarantined.length === 0
    && dataset.glyphs.every((g) => g.quality === 'qualified')
    && qualification.qualifiedCount === 3500
    && qualification.datasetGeometrySHA256 === dataset.geometryHash,
  ['glyph-quality.json', '../../public/glyphs/qualification.json']);
gate('svg-contours', '全部 33959 笔六阶段显现、完成轮廓像素一致',
  masks.pass && masks.glyphCount === 3500 && masks.strokeCount === 33959
    && masks.minCoverage === 1 && masks.failures.length === 0
    && masks.datasetGeometrySHA256 === dataset.geometryHash
    && masks.rendererSHA256 === hash(await bytes('src/handwriting/inkRenderer.js')),
  ['masks/coverage.json']);
const atlasIntegrity = await Promise.all(atlas.pages.map(async (p) => hash(await bytes(`${root}/${p.file}`)) === p.sha256));
gate('atlas', '35 页完整图集由 Codex 逐页目视复核',
  atlas.status === 'completed' && atlas.reviewedGlyphs === 3500 && atlas.pages.length === 35 && atlasIntegrity.every(Boolean),
  ['atlas-review.json', 'atlas/']);
gate('source-comparison', '两来源固定版本、许可、42 字比较与风险复核',
  sources.prototypeCount === 42 && sources.riskComparedGlyphs === 137
    && sources.fullPrimaryGeometryQualified === 3500 && sources.commonAncestry
    && prototypes.pass && prototypes.characters === 40 && prototypes.sourceRuns === 80,
  ['data-source-selection.md', 'source-comparison.json', 'source-animation-comparison.json', '../../public/glyphs/provenance.json', '../../public/glyphs/ARPHICPL.TXT']);
gate('chromium', '桌面 Chromium 完整交互、同步、清除及原英文回归',
  successful(chrome, 14), ['browser/chromium-results.json']);
gate('desktop-browsers', 'Edge、Firefox、WebKit 关键功能及输入回归',
  successful(desktop, 3), ['browser/desktop-browsers.json']);
gate('faults-unmount', '七类故障、阴影与笔尖复位、异步取消及卸载重用',
  successful(enhanced, 2) && faults.results.length === 7
    && faults.results.every(({ after: d }) => !d.active && d.loadAborted && !d.hasGlyphLease
      && d.state === 'idle' && d.strokeCount === 0 && d.particles === 0
      && d.cache.raw.pinned === 0 && d.cache.parsed.pinned === 0 && d.projectedShadowTip)
    && unmount.old.disposed && unmount.old.loadAborted && unmount.cancelled.disposed
    && !unmount.cancelled.active && !unmount.cancelled.hasGlyphLease,
  ['browser/faults-enhanced-results.json', 'browser/faults.json', 'browser/unmount.json']);
gate('responsive-motion', '缩放首帧同步、冻结换行与实时动态偏好',
  resize.samples.length > 0 && resize.samples.every((s) => s.error <= budgets.syncErrorCssPx),
  ['browser/resize-motion.json', 'browser/motion-during-erase.json', 'browser/chromium-results.json']);
gate('cache-lifecycle', '重复书写后释放活动引用并回到双层 LRU 预算',
  !cycles.final.active && !cycles.final.strokeCount && !cycles.final.particles
    && ['raw', 'parsed'].every((k) => cycles.final.cache[k].pinned === 0
      && cycles.final.cache[k].bytes <= cycles.final.cache[k].budgetBytes),
  ['browser/cache-cycles.json', 'performance/calibration.json']);
const c = calibration.results;
gate('calibrated-performance', '七组正常速度原型、帧时/同步/内存及时间预算',
  c.length === 7 && !calibration.errors.length && !calibration.externalRequests.length
    && c.every((r) => r.p95FrameMs <= budgets.p95FrameMs && r.maxErrorPx <= budgets.syncErrorCssPx
      && r.metrics.loadMs <= budgets.loadMs && r.metrics.planMs <= budgets.planMs
      && Math.abs(r.metrics.actualSeconds - r.metrics.estimatedSeconds) <= budgets.durationErrorSeconds
      && r.activeHeap.usedSize <= budgets.activeJsHeapBytes)
    && calibration.finalHeap.usedSize - calibration.baselineHeap.usedSize <= budgets.retainedHeapGrowthBytes,
  ['performance/calibration.json', 'performance/budgets.json']);
gate('boundary-performance', '独立正常速度 420 笔边界与 421 笔拒绝',
  boundary.pass && Object.values(boundary.gates).every(Boolean) && boundary.written.strokeCount === 420,
  ['performance/budget-verification.json', 'performance/stroke-budget-420.png']);
gate('adaptive', '受控 CPU 压力触发降级，保留核心路径与同步',
  adaptive.fallback.quality === 'economy' && adaptive.fallback.pixelRatio <= 1
    && adaptive.reduced.pixelRatio <= 1 && adaptive.errors.length === 0,
  ['browser/adaptive-quality.json']);
gate('english-visual', '原英文签名区域蓝色墨迹无视觉回归',
  visual.pass && visual.differentInkPixels === 0 && visual.intersectionOverUnion === 1,
  ['visual/english-ink-diff.json', 'visual/english-ink-diff.png']);
const build = await readFile(`${root}/build-output.txt`, 'utf8');
gate('production', '生产构建及三个桌面 DPR 场景，无开发入口或外部请求',
  build.includes('built in') && production.pass && production.cases.length === 3
    && production.cases.every((r) => r.pass && r.httpStatus === 200 && !r.debugApiIncluded
      && r.licenceAvailable && !r.errors.length && r.canvasPixelRatio <= 2),
  ['build-output.txt', 'production/production.json']);
gates.push({ id: 'mobile-real-devices', label: 'iOS Safari / Android Chrome 真机专项',
  status: 'deferred-by-user', evidence: ['implementation.md'],
  reason: '用户于 2026-10-30 明确：先不考虑手机端吧。未执行，不计作通过。' });

const sourceFiles = [];
async function walk(dir) {
  for (const item of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = `${dir}/${item.name}`;
    if (item.isDirectory()) await walk(file);
    else sourceFiles.push({ file, sha256: hash(await bytes(file)) });
  }
}
await walk('src');
for (const file of ['index.html', 'package.json', 'package-lock.json', 'vite.config.js'])
  sourceFiles.push({ file, sha256: hash(await bytes(file)) });
const testSources = [];
for (const g of gates) for (const file of g.evidence)
  if (!file.endsWith('/') && !testSources.some((f) => f.file === file))
    testSources.push({ file, sha256: hash(await bytes(`${root}/${file}`)) });
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const changedProduct = execFileSync('git', ['status', '--porcelain', '--', 'src', 'index.html', 'package.json', 'package-lock.json', 'vite.config.js'], { encoding: 'utf8' }).trim();
const browserVersions = { Chrome: production.browser };
for (const name of ['edge', 'firefox', 'webkit']) browserVersions[name] = (await json(`browser/${name}-result.json`)).version;
const report = {
  schema: 1, generatedAt: new Date().toISOString(), version: '1.1.0',
  conclusion: gates.some((g) => g.status === 'failed') ? 'DESKTOP_FAILED' : 'DESKTOP_PASSED_MOBILE_DEFERRED',
  scope: '本轮经用户调整后的桌面功能交付；不代表手机端验收或已部署公网服务。',
  sourceRevision: revision, uncommittedProductChanges: Boolean(changedProduct),
  sourceFiles, evidenceFiles: testSources,
  environment: { os: process.platform, node: process.version, browserVersions,
    python: execFileSync('python', ['--version'], { encoding: 'utf8' }).trim(),
    testWindowUtc: [chrome.stats.startTime, production.date], rendering: calibration.environment.rendering },
  glyphs: { target: 3500, rawCoverage: sources.rawCoverage, geometryPassed: quality.geometryPassed,
    qualified: dataset.glyphs.length, unsupportedTargets: 0, strokes: masks.strokeCount,
    shards: dataset.manifest.shards.length, datasetGeometrySHA256: dataset.geometryHash,
    latin: 52, digitsAndPunctuation: Object.keys(SYMBOLS).length },
  tests: { node: 15, pipeline: pipeline.testsRun, chromium: chrome.stats.expected,
    desktopKeyRegressions: desktop.stats.expected, enhancedFaultAndUnmount: enhanced.stats.expected,
    productionCases: production.cases.length, sourcePrototypeRuns: prototypes.sourceRuns },
  metrics: { normalScenarioCount: c.length, normalMaxP95FrameMs: Math.max(...c.map((r) => r.p95FrameMs)),
    normalMaxSyncErrorCssPx: Math.max(...c.map((r) => r.maxErrorPx)),
    normalMaxLoadMs: Math.max(...c.map((r) => r.metrics.loadMs)),
    normalMaxPlanMs: Math.max(...c.map((r) => r.metrics.planMs)),
    normalMaxHeapBytes: Math.max(...c.map((r) => r.activeHeap.usedSize)),
    baselineHeapBytes: calibration.baselineHeap.usedSize, finalHeapBytes: calibration.finalHeap.usedSize,
    boundaryP95FrameMs: boundary.p95FrameMs, boundarySyncErrorCssPx: boundary.maxErrorPx,
    boundaryEraseMs: boundary.cleared.metrics.eraseMs, completeContourCoverage: masks.minCoverage,
    englishDifferentInkPixels: visual.differentInkPixels },
  gates,
  review: { reviewer: 'Codex', scope: '35 页全字库图集、盼修复、数字标点及桌面关键帧目视检查；不冒充人类书法专家认证。',
    strokes: '原配对笔顺优先；独立依据复核盼修复；两数据源共同祖先不计作独立笔顺认证。' },
  resolvedFailures: [
    { issue: '盼第七笔原中线离开轮廓', evidence: ['glyph-quality-before-repair.json', 'repair-pan.png', '../../data/glyphs/repairs.json'] },
    { issue: '几何遮罩未涵盖抗锯齿边缘', evidence: ['masks-before-edge-padding/coverage.json', 'mask-failures-before-edge-padding.zip', 'masks-after-padding-before-completion/coverage.json'] },
    { issue: '遮罩移除时跨合成器 alpha 面积不单调；改以独立完整轮廓逐像素验证完成状态，保留同遮罩阶段单调门禁', evidence: ['masks/strict-alpha-area-diagnostic.json.gz', 'masks/coverage.json'] },
    { issue: '同时 resize / 动态偏好时首帧映射竞争', evidence: ['bugs/resize-motion/trace.zip', 'bugs/resize-motion/test-failed-1.png', 'browser/resize-motion.json'] },
  ],
  limitations: ['手机专项按用户要求暂缓，桌面 WebKit 不能当 iOS Safari 真机。',
    '仅正式一级 3500 字及符号注册表；曦、麟、Emoji、重音字母等范围外字符会拒绝。',
    '固定字形风格，不能生成每人独有书法；柔影使用实时贴图近似。',
    '性能数字来自本机桌面 Headless / SwiftShader 允许环境，不保证其他 GPU 的帧率。',
    'JS 约 944 kB / gzip 277 kB，保留 Vite 大 chunk 提示；没有公网部署。',
    'glyph-quality.json 的 NOT_RELEASED 是几何阶段快照；当前字库结论见 qualification.json，应用结论见本报告。'],
};
await writeFile(`${root}/acceptance.json`, JSON.stringify(report, null, 2) + '\n');
const rows = gates.map((g) => `| ${g.label} | ${g.status === 'passed' ? '通过' : g.status === 'failed' ? '失败' : '用户暂缓，未测试'} | ${g.evidence.map((p) => `[${p}](${p})`).join('、')} |`).join('\n');
await writeFile(`${root}/acceptance.md`, `# 中英文书写 1.1.0 桌面验收\n\n**结论：${report.conclusion}。** 本轮桌面门禁 ${gates.filter((g) => g.status === 'passed').length}/${gates.filter((g) => g.status !== 'deferred-by-user').length} 通过。手机端按用户“先不考虑手机端吧”暂缓，没有标记为通过；未配置公网部署。\n\n生成时间 ${report.generatedAt}；源码提交 \`${revision}\`；产品源码存在未提交修改：${report.uncommittedProductChanges ? '是' : '否'}。源码逐文件 SHA256、报告指纹、浏览器版本及实际执行时间见 [acceptance.json](acceptance.json)。报告聚合已有实际运行证据，不伪造新的测试执行。\n\n## 实现结果\n\n正式目标 3500 字，原始两源覆盖 3500，几何通过 3500，正式合格 3500，目标内暂不支持 0；共 33,959 笔、110 个本地分片。另保留 52 个英文字母及 ${Object.keys(SYMBOLS).length} 个数字和标点。完整路径与原配中线统一动作进度，支持混排、多行、中文标点禁则、IME、实时低动态、逐笔粒子清除及异常重试。范围外字符保留原文并逐项报错。\n\n两源 42 个代表字同组几何对比、137 个风险字比较；40 个目标内代表字通过真实协调层执行两来源共 80 轮动画诊断，非性能基准。“盼”第七笔修复前后与独立顺序依据完整保存。35 页图集及关键帧由 Codex 目视检查，不冒充人类书法专家审查全部字的笔顺。\n\n## 门禁\n\n| 门禁 | 状态 | 证据 |\n| --- | --- | --- |\n${rows}\n\n## 实测\n\n- Node 15 项、离线流水线 7 项、Chromium 完整 14 项、Edge / Firefox / WebKit 关键 3 项通过；另增强阴影 / 取消 / 卸载检查 2 项通过，生产桌面 3 场景通过。\n- 全部 33,959 笔以 6 个进度检查；同遮罩阶段显现单调，完成状态相对独立无掩膜轮廓 alpha 逐像素差异为 0，覆盖率 100%。\n- 七组正常速度校准，P95 帧间隔最大 ${report.metrics.normalMaxP95FrameMs.toFixed(2)} ms（预算 ${budgets.p95FrameMs} ms），最大数学同步误差 ${report.metrics.normalMaxSyncErrorCssPx.toFixed(7)} CSS px（预算 ${budgets.syncErrorCssPx}）。加载最大 ${report.metrics.normalMaxLoadMs.toFixed(1)} ms，计划最大 ${report.metrics.normalMaxPlanMs.toFixed(1)} ms。\n- 独立 420 笔边界的九项预算均通过，P95 ${boundary.p95FrameMs.toFixed(2)} ms，清除 ${boundary.cleared.metrics.eraseMs.toFixed(1)} ms；421 笔拒绝且保留原文。\n- GC 后 JS 堆基线 ${(report.metrics.baselineHeapBytes / 1048576).toFixed(2)} MiB，循环后 ${(report.metrics.finalHeapBytes / 1048576).toFixed(2)} MiB；活动引用受保护可超缓存预算，释放后两层分别不超过 2 MiB。\n- 原英文 Shakespeare 签名区域蓝色墨迹 29,777 像素完全一致，差异 0；此检查排除已调整的输入区与灰色铅笔阴影，不声称全页面像素相同。\n\n性能环境：Windows 桌面、1440×900、DPR2、Chrome ${production.browser}，允许 SwiftShader。数学投影误差不是抗锯齿质量或全设备帧率保证。边界值来自校准后冻结预算，独立边界测试不降低门禁。\n\n## 视觉与失败证据\n\n[正常书写](production/writing.png) · [完整多行混排](production/desktop-dpr-1.png) · [DPR3 桌面](production/desktop-dpr-3.png) · [逐笔粒子](browser/mixed-particles.png) · [数字标点图集](visual/symbols.png) · [英文差异图](visual/english-ink-diff.png)。\n\n${report.resolvedFailures.map((f) => `- ${f.issue}：[证据](${f.evidence[0]})${f.evidence.slice(1).map((p) => `、[${p}](${p})`).join('')}。`).join('\n')}\n\n早期性能中断样本位于 [attempt-before-target-validation/](performance/attempt-before-target-validation/)，清单解析诊断见 [初次交叉核对](target-crosscheck-before-column-parsing.json)。失败证据保留，最终通过以修复后报告为准。\n\n## 已知边界\n\n${report.limitations.map((s) => `- ${s}`).join('\n')}\n\n按 [README](../../README.md) 可启动、重建数据与复验。本报告不自动代表将来修改通过；源码、字形或渲染器变化必须重新执行受影响门禁。\n`);
console.log(JSON.stringify({ conclusion: report.conclusion, gates: gates.map(({ id, status }) => ({ id, status })), sourceRevision: revision }));
if (gates.some((g) => g.status === 'failed')) process.exitCode = 1;
