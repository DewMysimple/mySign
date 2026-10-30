# Shakespread

可输入中英文、数字和常用标点，观看真实 3D 白色铅笔逐笔书写，再用橡皮擦清除的极简网页。React / Vite / Three.js / GSAP 实现，当前功能分支版本 **1.2.0-prototype.0**：输入「你好」即可体验两字独立硬笔行书原型；英文保留原有单线与连笔机制。

当前任务依据 [prompt_03](prompt/prompt_03.txt)，以**桌面单行签名**替代前一版多行产品范围。原 3500 个合格标准字形保持原样；本分支仅对「你」「好」覆盖为实验字形，其他 3498 字没有行书化。实验数据未冒充正式 qualified 字库，用户审美待确认，**未合并 main**。手机端完全不计入本轮优化和验收。

审计、风格规范、原型对照和新一轮结果入口为 [analysis/xingshu](analysis/xingshu/acceptance.md)，可编辑数据说明为 [data/xingshu](data/xingshu/README.md)。原始视频与中文扩展要求仍保留在 prompt_01 / prompt_02。

## 启动与操作

需要 Node.js 22.12+，首次在工程根目录执行：

```powershell
npm ci
npm run dev
```

打开终端地址（默认 `http://127.0.0.1:5173/`），也可在本功能分支的工作树运行 `runStart.cmd`。桌面 Enter 提交，Shift+Enter 不插入换行；输入法组合期间 Enter 留给输入法。圆形按钮可以提交，完成后变为橡皮擦。签名一直保留到清除，不增加重播按钮。

预检时锁定输入并显示加载；失败列出全部问题字符及从 1 开始的位置，保留原文并恢复编辑。粘贴换行会明确拒绝，textarea 保留全部原文，不静默删除；仅统一必要的 CRLF / CR 表示。输入区保持一行高度并可内部滚动，不折叠空格、替换标点、删字或自动简繁转换。

## 支持范围

- **2013《通用规范汉字表》一级 3500 字**，完整清单为 [targets.json](data/glyphs/targets.json)，实际注册表为 [manifest.json](public/glyphs/manifest.json)。这不是所有汉字：例如“曦、麟”不在首期一级集合，会明确拒绝。
- 原创 `A–Z`、`a–z`，数字 `0–9`、ASCII 空格；换行不属于本版支持范围。
- 常用中英文逗号、句号、顿号、问号、感叹号、分号、冒号、单双引号、圆括号、书名号，以及代码白名单中的少量符号；精确范围见 [symbols.js](src/handwriting/symbols.js)。其他字符需完成路径、顺序、度量及动画验证后加入注册表。

所有字符输出统一的墨迹、抬笔、字间移动、落笔和收笔计划。可接受英文姓名的原路径与原时序保持。签名区固定单行，不自动断行，不以多行或无限缩小字号容纳长文本。预检同时检查字符数、实际单行宽度、最小字号、墨迹段数与预计时长；失败保留原文。执行中 resize 只改变统一视口映射，不改既定笔序。

## 视觉与生命周期

暖灰白全屏纸面、蓝色笔迹和实时 Three.js 铅笔，保留原视频的大面积留白。铅笔以石墨端为旋转参考点，真实几何、正交相机与实时投影由同一动作进度驱动。柔影是实时阴影贴图的面积光近似。

中文每段通过中线遮罩揭示完整闭合轮廓，完成时释放遮罩以保全轮廓边缘；不是普通字体整段淡入。新「你」「好」重新制作了曲线、部件比例、起收笔和压力轮廓，保留全部 13 个逻辑笔画，形成 9 组连续动作、3 段细牵丝、16 段墨迹；没有用 CSS 倾斜、滤镜、随机扰动代替字形设计。

轮廓、中线、SVG 与 3D 共用局部、排版和视口三层坐标。SignatureController 仍是唯一 GSAP 时钟，逐段节奏曲线只改变这个共享进度。连带段实际接触点连续，不插入抬笔；跨组正常抬笔。窗口 resize 与逐帧尺寸检查保证 SVG viewBox 和相机在同一帧更新。

清除从完整笔画区域采样 Canvas 粒子，每笔依次启动，铅笔同步归位；清理后恢复输入。低动态偏好跟随系统并实时监听：当前动作安全完成，后续动作改用低动态参数，立即停止非核心粒子。清除中切换偏好不会恢复已经淡出的墨迹。

组件卸载会使异步任务失效，取消加载和 GSAP，释放临时墨迹、遮罩、粒子、事件与 WebGL 资源。已验证字形缓存可复用。故障时取消动作、清理不完整墨迹、复位铅笔，保留原文并允许再次书写。空闲与完成状态不持续渲染。

## 数据来源、许可与可复验管线

两字原型独立放在 `data/xingshu/v0.1.0`，每字保存完整轮廓、中线、逻辑编号、实际动作、连接关系、压力、节奏、度量与来源。HWD 仅作逻辑顺序 / 结构参考，没有复用标准轮廓；保守沿用 Arphic Public License。新数据、可编辑源码、修改说明及许可原文随 `public/experiments/xingshu-v0.1.0` 分发。Long Cang 仅用于合法字体视觉研究，其字模与字体文件没有进入产品。

```powershell
npm run glyphs:xingshu                 # 只构建两字，不重建正式字库
node scripts/render-xingshu-artwork.mjs
npm run test:xingshu:masks             # 先启动 dev，测试实际产品渲染器
node scripts/capture-xingshu-prototype.mjs # 实际浏览器截图、轨迹与 webm
```

以下为现有 1.1.0 正式字库的来源与维护流程。**本次原型不执行全量重建**；只有另行开展已授权的正式字库维护才使用这些命令。原型构建器不写入这些目录。

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
npm run test:production                # 当前实验生产构建，三个桌面 DPR 场景
python scripts/verify-visual-regression.py --current analysis/xingshu/english/desktop-written.png --out analysis/xingshu/english
node scripts/calibrate-xingshu.mjs     # 正常速度，含 140 段 / 32 字符 / 可读宽度边界
node scripts/verify-xingshu-acceptance.mjs # 聚合本轮证据和实际源码指纹，不代替执行测试
```

端到端优先使用本机 Chrome；可设 `CHROME_PATH` 或安装 Playwright Chromium。生产包不暴露开发诊断 / 故障注入入口。生产预览验证真实构建的混排、完整显现、清除、无效输入恢复、DPR 及本地数据许可。

当前上限为 **32 个可见字符（含空格）、140 段墨迹动作（含牵丝）、正常预计 40 秒、最小 scale 0.5**，并受实际单行宽度约束；配置在 [signatureLimits.json](src/handwriting/signatureLimits.json)。多个约束同时生效，32 字符不表示任意 32 个汉字都能在当前窗口容纳。

[单行校准](analysis/xingshu/performance/calibration.json) 包含 137 段原型长签名、140 段标准字形、32 字符、18 字最低宽度、原英文及超限拒绝的实际正常速度测量；最小 scale 对应中文约 44px em，原型长签名另有截图供目视判断。旧版多行 / 420 笔预算仅作为历史证据保留，不再作为当前产品要求。超限不会截断、换行或删除原文。

这是一组保守的产品边界：32 字符覆盖原有 31 字符长英文姓名的回归范围，并验证了 32 个数字的正常速度执行；137 段原型和 140 段标准字形均实测接近 40 秒，0.5 scale 有实际截图复核。不声称第 33 个字符本身会造成性能故障，也不把这些数值当作所有设备的物理极限。

两层 LRU 各有 2 MiB 的保守计费预算。活动任务持有的内容可暂超预算且受保护，释放后必须回到预算以内。持续慢帧只降低场景 DPR 和粒子规模，不改变笔顺、完整轮廓或笔尖同步。测试中的数学投影误差与抗锯齿视觉、所有设备的实际帧率是不同指标。

本轮新结果见 [硬笔行书原型验收](analysis/xingshu/acceptance.md) / [JSON](analysis/xingshu/acceptance.json)，功能验收与用户审美验收分别记录。已重跑模型、完整 Chromium、Edge / Firefox / WebKit、生产预览、同步 / 显现和英文墨迹差异检查；不把旧 17 项通过当作新版本自动通过。

旧版 [1.1.0 桌面验收](analysis/chinese/acceptance.md) 与全字库失败 / 修复记录原样保留。原英文 557 帧视频分析在 [视频逐帧分析](analysis/视频逐帧分析.md)，冻结基线在 [baseline/](analysis/chinese/baseline/)；`analysis/app/` 保留早期迭代记录。

Three.js 与两字实验数据包含在生产 JS 中，Vite 的大 chunk 提示仍需保留；本轮实测包体见构建输出和验收报告。3500 字标准字库仍为独立本地分片，不全部并入 JS。没有配置公网部署、账户或签名持久化，GitHub 用于源码管理。

## 工程入口与记忆

| 模块 | 职责 |
| --- | --- |
| `App.jsx` / `SignatureInput.jsx` | React 生命周期、textarea、IME、状态与无障碍播报 |
| `handwriting/glyphs.js` / `signature.js` | 原英文单线、连笔、真实 Bézier 边界与映射 |
| `handwriting/symbols.js` / `writingPlan.js` | 数字标点、注册表预检、单行预算和统一动作计划 |
| `handwriting/xingshuRegistry.js` / `motionRhythm.js` | 两字实验覆盖、不可变数据及逐动作单调节奏 |
| `handwriting/GlyphLoader.js` / `GlyphCache.js` | 本地分片完整性、解析、双层 LRU、取消及任务保护 |
| `handwriting/inkRenderer.js` | 完整轮廓、动态遮罩；只消费协调层给定的进度 |
| `animation/SignatureController.js` | 唯一 GSAP 时钟、3D / 墨迹同步、动态切换、恢复与清除 |
| `scene/` | 程序化铅笔、柔影、完整墨迹粒子及资源释放 |
| `scripts/build-xingshu.mjs` | 两字独立矢量生成、来源 / 许可副本与原型图集 |
| `scripts/build_glyphs.py` 等 | 现有正式字库维护工具，本次不重建 |

工程记忆为用户指定的 standard 模式，入口 [wiki_memory/README.md](wiki_memory/README.md)，协议 [wiki_memory/AGENTS.md](wiki_memory/AGENTS.md)。按照根目录 [AGENTS.md](AGENTS.md) 的持续授权，本任务所有源码、文档、记忆和必要证据提交并推送 [mySign](https://github.com/DewMysimple/mySign) 的 `feature/chinese-xingshu-prototype`，核对实际远程 SHA。本次 prompt_03 明确要求用户视觉确认前不合 main，因此保留主分支稳定版本。
