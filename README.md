# Shakespread

可输入中英文、数字和常用标点，观看真实 3D 白色铅笔逐笔书写，再用橡皮擦清除的极简网页。React / Vite / Three.js / GSAP 实现，当前版本 **1.1.0**。中文采用完整笔画轮廓与对应中线；英文沿用原有原创单线与连笔机制。

依据 `prompt/prompt_01.txt` 的视频效果，以及 `prompt/prompt_02.txt` 的中文扩展要求。用户于 2026-10-30 补充“先不考虑手机端吧”，本轮按桌面端验收；手机专项和 iOS / Android 真机不计作已验收。

## 启动与操作

需要 Node.js 22.12+，首次在工程根目录执行：

```powershell
npm ci
npm run dev
```

打开终端地址（默认 `http://127.0.0.1:5173/`），也可运行原有 `runStart.cmd`。桌面 Enter 提交、Shift+Enter 换行；输入法组合期间 Enter 留给输入法。圆形按钮可以提交，完成后变为橡皮擦。签名一直保留到清除，不增加重播按钮。

预检时锁定输入并显示加载；失败列出全部问题字符及从 1 开始的位置，保留原文并恢复编辑。仅统一 CRLF / CR 为 LF，不折叠空格、替换标点、删字或自动简繁转换。输入区可增长到高度上限后内部滚动，签名区独立排版。

## 支持范围

- **2013《通用规范汉字表》一级 3500 字**，完整清单为 [targets.json](data/glyphs/targets.json)，实际注册表为 [manifest.json](public/glyphs/manifest.json)。这不是所有汉字：例如“曦、麟”不在首期一级集合，会明确拒绝。
- 原创 `A–Z`、`a–z`，数字 `0–9`，ASCII 空格及手动换行。
- 常用中英文逗号、句号、顿号、问号、感叹号、分号、冒号、单双引号、圆括号、书名号，以及代码白名单中的少量符号；精确范围见 [symbols.js](src/handwriting/symbols.js)。其他字符需完成路径、顺序、度量及动画验证后加入注册表。

所有字符输出统一的笔画、抬笔、字间移动、换行、落笔和收笔计划。短英文姓名的原路径与原时序保持；长英文达到字号下限后也会换行。中文标点遵循行首 / 行尾禁则，空白行也占据真实行框。计划确定后缩放只更新坐标映射，保持原字符顺序与换行结果；大幅缩小窗口时字号可能继续缩小，重新提交才按新窗口重新排版。

## 视觉与生命周期

暖灰白全屏纸面、蓝色笔迹和实时 Three.js 铅笔，保留原视频的大面积留白。铅笔以石墨端为旋转参考点，真实几何、正交相机与实时投影由同一动作进度驱动。柔影是实时阴影贴图的面积光近似。

中文每笔通过中线遮罩揭示完整轮廓，完成时释放该笔遮罩以保全轮廓边缘；不是普通字体整段淡入，也不是用一条细线代替最终汉字。完整轮廓、中线、SVG 与 3D 共用局部、排版和视口三层坐标。窗口 resize 与逐帧尺寸检查保证 SVG viewBox 和相机在同一帧更新。

清除从完整笔画区域采样 Canvas 粒子，每笔依次启动，铅笔同步归位；清理后恢复输入。低动态偏好跟随系统并实时监听：当前动作安全完成，后续动作改用低动态参数，立即停止非核心粒子。清除中切换偏好不会恢复已经淡出的墨迹。

组件卸载会使异步任务失效，取消加载和 GSAP，释放临时墨迹、遮罩、粒子、事件与 WebGL 资源。已验证字形缓存可复用。故障时取消动作、清理不完整墨迹、复位铅笔，保留原文并允许再次书写。空闲与完成状态不持续渲染。

## 数据来源、许可与可复验管线

主来源 **Hanzi Writer Data 2.0.1**，备用 **Make Me a Hanzi `bddc96d…`**。二者有共同来源，不能当作独立笔顺认证。[选型与质量说明](analysis/chinese/data-source-selection.md)、[42 字同组比较及 137 字风险比较](analysis/chinese/source-comparison.json) 保留选择依据。

本地 110 个分片随构建发布，按需读取，运行时不联系外部字库 API、不下载字体、不上传输入。每字保存来源、版本、许可、原配对哈希、轮廓、中线、笔顺、度量、评分、修复和审查状态。原坐标统一归一化，轮廓不与另一来源的中线拼接。

中文字形数据使用 **Arphic Public License**，完整原文在 [ARPHICPL.TXT](public/glyphs/ARPHICPL.TXT)，修改说明与来源在 [provenance.json](public/glyphs/provenance.json)。修改后的字形数据依原许可提供。原创英文 / 数字 / 标点与应用代码是独立部分，不误标为该字体许可。

```powershell
python -m pip install -r scripts/glyph-requirements.txt
node scripts/fetch-glyph-sources.mjs    # 固定来源版本并校验 npm 包，构建时使用
npm run glyphs:build                   # 全量转换、硬检查、隔离和 35 页图集
python scripts/compare_glyph_sources.py
python scripts/verify_glyph_pipeline.py # 生成、修复、隔离及候选择优的故障夹具检查
node scripts/verify-source-prototypes.mjs # 两来源通过真实协调层播放，诊断速率不当性能基准
node scripts/verify-glyph-masks.mjs     # 先启动 dev；用产品实际渲染函数验证全部笔画
```

转换首先生成候选数据，不自动宣称正式通过。完成图集审查、代表性动画检查后，`node scripts/qualify-glyphs.mjs` 会核对证据及几何指纹，才能标为合格分片。重建或修改字形后必须重新完成受影响的门禁，不把旧报告当新证据。

缺失或不合格中线会尝试有界的栅格骨架推导，但只生成隔离候选，不能以“位于轮廓内”代替真实笔顺依据。候选必须经过独立复核、动画和同步验证，再作为有版本的修复记录进入下一轮检查。确定性的重复相邻点可自动去重并复验。

初检曾隔离“盼”的第七笔：两源原中线均离开轮廓。原失败报告、修复前后叠图和独立笔顺依据保存在 [修复记录](data/glyphs/repairs.json)。修复复验后实际 3500 字 / 33,959 笔通过；完整图集由 Codex 目视检查，不冒充人类书法专家认证。

## 验证与预算

```powershell
npm test
npm run test:e2e                       # Chromium 完整行为 / 同步 / 故障与卸载回归
npx playwright install firefox webkit  # 首次需要；Edge 使用本机安装
npm run test:desktop                   # Edge、Firefox、WebKit 关键回归
npm run build
npm run preview                       # 另开终端，默认 4173
node scripts/verify-chinese-production.mjs
python scripts/verify-visual-regression.py
node scripts/verify-chinese-acceptance.mjs # 聚合既有证据并校验数据 / 渲染器指纹，不代替重新测试
```

端到端优先使用本机 Chrome；可设 `CHROME_PATH` 或安装 Playwright Chromium。生产包不暴露开发诊断 / 故障注入入口。生产预览验证真实构建的混排、完整显现、清除、无效输入恢复、DPR 及本地数据许可。

[性能预算](analysis/chinese/performance/budgets.json) 来自本机原型测量，另有独立的 420 笔边界检查。当前预检上限为 420 笔、正常动作预计 95 秒、8 行，字号缩放下限 0.36；不按固定字符数截断。超限保留原文并提示分段或扩大窗口。

两层 LRU 各有 2 MiB 的保守计费预算。活动任务持有的内容可暂超预算且受保护，释放后必须回到预算以内。持续慢帧只降低场景 DPR 和粒子规模，不改变笔顺、完整轮廓或笔尖同步。测试中的数学投影误差与抗锯齿视觉、所有设备的实际帧率是不同指标。

本轮 [桌面验收报告](analysis/chinese/acceptance.md) 和 [JSON 报告](analysis/chinese/acceptance.json) 汇总 17 项桌面门禁全部通过、手机端按用户要求暂缓的结果。机器报告、截图、失败及修复证据集中在 [analysis/chinese/](analysis/chinese/)，不能用历史英文报告或单项通过替代本轮完整验收。原英文 557 帧视频分析在 [视频逐帧分析](analysis/视频逐帧分析.md)，原英文基线冻结在 [baseline/](analysis/chinese/baseline/)；`analysis/app/` 仍保留早期迭代记录。

构建 JS 约 944 kB / gzip 277 kB，Three.js 占主要部分；Vite 仍会提示超过 500 kB 的 chunk。整个字库是独立本地分片，不全部并入 JS。没有配置公网部署、账户或签名持久化，GitHub 用于源码管理。

## 工程入口与记忆

| 模块 | 职责 |
| --- | --- |
| `App.jsx` / `SignatureInput.jsx` | React 生命周期、textarea、IME、状态与无障碍播报 |
| `handwriting/glyphs.js` / `signature.js` | 原英文单线、连笔、真实 Bézier 边界与映射 |
| `handwriting/symbols.js` / `writingPlan.js` | 数字标点、注册表预检、布局和统一动作计划 |
| `handwriting/GlyphLoader.js` / `GlyphCache.js` | 本地分片完整性、解析、双层 LRU、取消及任务保护 |
| `handwriting/inkRenderer.js` | 完整轮廓、动态遮罩；只消费协调层给定的进度 |
| `animation/SignatureController.js` | 唯一 GSAP 时钟、3D / 墨迹同步、动态切换、恢复与清除 |
| `scene/` | 程序化铅笔、柔影、完整墨迹粒子及资源释放 |
| `scripts/build_glyphs.py` 等 | 离线转换、候选比较、图集、合格门禁和验收工具 |

工程记忆为用户指定的 standard 模式，入口 [wiki_memory/README.md](wiki_memory/README.md)，协议 [wiki_memory/AGENTS.md](wiki_memory/AGENTS.md)。按照根目录 [AGENTS.md](AGENTS.md) 的持续授权，每次完整对话产生的项目修改都提交并推送至 [mySign](https://github.com/DewMysimple/mySign)，核对真实远程引用；功能开发先在独立分支，门禁通过后才合并主分支。
