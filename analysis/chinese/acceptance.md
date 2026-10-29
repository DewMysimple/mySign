# 中英文书写 1.1.0 桌面验收

**结论：DESKTOP_PASSED_MOBILE_DEFERRED。** 本轮桌面门禁 17/17 通过。手机端按用户“先不考虑手机端吧”暂缓，没有标记为通过；未配置公网部署。

生成时间 2026-10-29T18:34:45.364Z；源码提交 `cc47a1b29e385261197a5899a2d3c8b3690b2ad3`；产品源码存在未提交修改：否。源码逐文件 SHA256、报告指纹、浏览器版本及实际执行时间见 [acceptance.json](acceptance.json)。报告聚合已有实际运行证据，不伪造新的测试执行。

## 实现结果

正式目标 3500 字，原始两源覆盖 3500，几何通过 3500，正式合格 3500，目标内暂不支持 0；共 33,959 笔、110 个本地分片。另保留 52 个英文字母及 46 个数字和标点。完整路径与原配中线统一动作进度，支持混排、多行、中文标点禁则、IME、实时低动态、逐笔粒子清除及异常重试。范围外字符保留原文并逐项报错。

两源 42 个代表字同组几何对比、137 个风险字比较；40 个目标内代表字通过真实协调层执行两来源共 80 轮动画诊断，非性能基准。“盼”第七笔修复前后与独立顺序依据完整保存。35 页图集及关键帧由 Codex 目视检查，不冒充人类书法专家审查全部字的笔顺。

## 门禁

| 门禁 | 状态 | 证据 |
| --- | --- | --- |
| 英文原几何、注册表、混排布局、加载与缓存模型 | 通过 | [unit-tests.tap](unit-tests.tap) |
| 离线转换、自动修复、推导隔离及双源候选择优 | 通过 | [pipeline-tests.json](pipeline-tests.json) |
| 3500 一级字与第二份清单逐项、顺序交叉核对 | 通过 | [target-crosscheck.json](target-crosscheck.json)、[../../data/glyphs/targets.json](../../data/glyphs/targets.json) |
| 全部正式字形、配对轮廓中线及逐字质量 | 通过 | [glyph-quality.json](glyph-quality.json)、[../../public/glyphs/qualification.json](../../public/glyphs/qualification.json) |
| 全部 33959 笔六阶段显现、完成轮廓像素一致 | 通过 | [masks/coverage.json](masks/coverage.json) |
| 35 页完整图集由 Codex 逐页目视复核 | 通过 | [atlas-review.json](atlas-review.json)、[atlas/](atlas/) |
| 两来源固定版本、许可、42 字比较与风险复核 | 通过 | [data-source-selection.md](data-source-selection.md)、[source-comparison.json](source-comparison.json)、[source-animation-comparison.json](source-animation-comparison.json)、[../../public/glyphs/provenance.json](../../public/glyphs/provenance.json)、[../../public/glyphs/ARPHICPL.TXT](../../public/glyphs/ARPHICPL.TXT) |
| 桌面 Chromium 完整交互、同步、清除及原英文回归 | 通过 | [browser/chromium-results.json](browser/chromium-results.json) |
| Edge、Firefox、WebKit 关键功能及输入回归 | 通过 | [browser/desktop-browsers.json](browser/desktop-browsers.json) |
| 七类故障、阴影与笔尖复位、异步取消及卸载重用 | 通过 | [browser/faults-enhanced-results.json](browser/faults-enhanced-results.json)、[browser/faults.json](browser/faults.json)、[browser/unmount.json](browser/unmount.json) |
| 缩放首帧同步、冻结换行与实时动态偏好 | 通过 | [browser/resize-motion.json](browser/resize-motion.json)、[browser/motion-during-erase.json](browser/motion-during-erase.json)、[browser/chromium-results.json](browser/chromium-results.json) |
| 重复书写后释放活动引用并回到双层 LRU 预算 | 通过 | [browser/cache-cycles.json](browser/cache-cycles.json)、[performance/calibration.json](performance/calibration.json) |
| 七组正常速度原型、帧时/同步/内存及时间预算 | 通过 | [performance/calibration.json](performance/calibration.json)、[performance/budgets.json](performance/budgets.json) |
| 独立正常速度 420 笔边界与 421 笔拒绝 | 通过 | [performance/budget-verification.json](performance/budget-verification.json)、[performance/stroke-budget-420.png](performance/stroke-budget-420.png) |
| 受控 CPU 压力触发降级，保留核心路径与同步 | 通过 | [browser/adaptive-quality.json](browser/adaptive-quality.json) |
| 原英文签名区域蓝色墨迹无视觉回归 | 通过 | [visual/english-ink-diff.json](visual/english-ink-diff.json)、[visual/english-ink-diff.png](visual/english-ink-diff.png) |
| 生产构建及三个桌面 DPR 场景，无开发入口或外部请求 | 通过 | [build-output.txt](build-output.txt)、[production/production.json](production/production.json) |
| iOS Safari / Android Chrome 真机专项 | 用户暂缓，未测试 | [implementation.md](implementation.md) |

## 实测

- Node 15 项、离线流水线 7 项、Chromium 完整 14 项、Edge / Firefox / WebKit 关键 3 项通过；另增强阴影 / 取消 / 卸载检查 2 项通过，生产桌面 3 场景通过。
- 全部 33,959 笔以 6 个进度检查；同遮罩阶段显现单调，完成状态相对独立无掩膜轮廓 alpha 逐像素差异为 0，覆盖率 100%。
- 七组正常速度校准，P95 帧间隔最大 27.80 ms（预算 33.4 ms），最大数学同步误差 0.0008303 CSS px（预算 0.2）。加载最大 45.6 ms，计划最大 4.5 ms。
- 独立 420 笔边界的九项预算均通过，P95 27.70 ms，清除 1305.5 ms；421 笔拒绝且保留原文。
- GC 后 JS 堆基线 12.98 MiB，循环后 16.59 MiB；活动引用受保护可超缓存预算，释放后两层分别不超过 2 MiB。
- 原英文 Shakespeare 签名区域蓝色墨迹 29,777 像素完全一致，差异 0；此检查排除已调整的输入区与灰色铅笔阴影，不声称全页面像素相同。

性能环境：Windows 桌面、1440×900、DPR2、Chrome 156.0.8078.48，允许 SwiftShader。数学投影误差不是抗锯齿质量或全设备帧率保证。边界值来自校准后冻结预算，独立边界测试不降低门禁。

## 视觉与失败证据

[正常书写](production/writing.png) · [完整多行混排](production/desktop-dpr-1.png) · [DPR3 桌面](production/desktop-dpr-3.png) · [逐笔粒子](browser/mixed-particles.png) · [数字标点图集](visual/symbols.png) · [英文差异图](visual/english-ink-diff.png)。

- 盼第七笔原中线离开轮廓：[证据](glyph-quality-before-repair.json)、[repair-pan.png](repair-pan.png)、[../../data/glyphs/repairs.json](../../data/glyphs/repairs.json)。
- 几何遮罩未涵盖抗锯齿边缘：[证据](masks-before-edge-padding/coverage.json)、[mask-failures-before-edge-padding.zip](mask-failures-before-edge-padding.zip)、[masks-after-padding-before-completion/coverage.json](masks-after-padding-before-completion/coverage.json)。
- 遮罩移除时跨合成器 alpha 面积不单调；改以独立完整轮廓逐像素验证完成状态，保留同遮罩阶段单调门禁：[证据](masks/strict-alpha-area-diagnostic.json.gz)、[masks/coverage.json](masks/coverage.json)。
- 同时 resize / 动态偏好时首帧映射竞争：[证据](bugs/resize-motion/trace.zip)、[bugs/resize-motion/test-failed-1.png](bugs/resize-motion/test-failed-1.png)、[browser/resize-motion.json](browser/resize-motion.json)。

早期性能中断样本位于 [attempt-before-target-validation/](performance/attempt-before-target-validation/)，清单解析诊断见 [初次交叉核对](target-crosscheck-before-column-parsing.json)。失败证据保留，最终通过以修复后报告为准。

## 已知边界

- 手机专项按用户要求暂缓，桌面 WebKit 不能当 iOS Safari 真机。
- 仅正式一级 3500 字及符号注册表；曦、麟、Emoji、重音字母等范围外字符会拒绝。
- 固定字形风格，不能生成每人独有书法；柔影使用实时贴图近似。
- 性能数字来自本机桌面 Headless / SwiftShader 允许环境，不保证其他 GPU 的帧率。
- JS 约 944 kB / gzip 277 kB，保留 Vite 大 chunk 提示；没有公网部署。
- glyph-quality.json 的 NOT_RELEASED 是几何阶段快照；当前字库结论见 qualification.json，应用结论见本报告。

按 [README](../../README.md) 可启动、重建数据与复验。本报告不自动代表将来修改通过；源码、字形或渲染器变化必须重新执行受影响门禁。
