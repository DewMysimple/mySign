# Shakespread

一个可输入英文姓名、观看真实 3D 铅笔逐笔书写、再用橡皮擦让蓝色笔迹消散的极简网页。依据 `prompt/prompt_01.txt`、两张参考图和 `source/` 中的视频在当前目录新建；原目录没有应用代码、`package.json` 或现有页面。原始提示词和视频均未修改。

## 本地启动

需要 Node.js 22.12+（本机使用 24.16.0）。在本目录执行：

```powershell
npm install
npm run dev
```

打开终端显示的地址，默认是 [http://127.0.0.1:5173/](http://127.0.0.1:5173/)。输入英文姓名后按 Enter 或点击圆形确认按钮。书写完成后点击橡皮擦，清除后可以继续输入。

```powershell
npm run build       # 生成 dist/
npm run preview     # 预览生产构建，默认端口 4173
npm test            # 字母覆盖、输入边界、笔画顺序和布局测试
npm run test:e2e    # 实际 Chrome / Chromium 中的交互验收
```

端到端测试优先使用本机已安装的 Chrome。其他环境可以设置 `CHROME_PATH`，或先运行 `npx playwright install chromium`。

## 已完成的效果

- 暖灰白全屏背景，大面积留白，仅保留签名、白色铅笔和胶囊输入框。
- Three.js 实时几何铅笔：笔杆、笔尾、削尖部分和细小石墨端；正交相机、细腻白色材质、真实投影及随距离扩大的柔影采样。
- 原创单线字形覆盖 `A–Z`、`a–z` 和空格；独立处理点、横画、抬笔、字宽、连笔、基线和实际 Bézier 边界。
- 单一 GSAP Timeline 同步 SVG 的 `stroke-dashoffset`、路径采样点、3D 笔尖和阴影。书写时不是逐字出现，也不描普通字体外轮廓。
- React 管理 `idle → writing → written → erasing → idle`；同步状态锁阻止重复提交；按钮含加载和橡皮擦状态。
- Canvas 根据实际 SVG 笔画采样生成蓝色细粒，清除时轻微扩散并消失；铅笔同步归位，再清空输入并恢复焦点。
- 写到一半调整窗口也会重新映射当前路径和正交相机；兼容窄屏、长姓名和 `prefers-reduced-motion`。
- 场景按组件生命周期建立并复用，StrictMode 清理后重建时不会叠加画布；空闲和完成状态不持续渲染；卸载时清理 Timeline、ResizeObserver、媒体查询监听、材质、几何体、阴影贴图和 WebGL 上下文。

## 文件分工

| 文件 | 职责 |
| --- | --- |
| `src/App.jsx` | React 状态、场景生命周期、姓名校验及提交 |
| `src/components/SignatureInput.jsx` | 输入、确认、加载与橡皮擦按钮；无额外视觉 UI |
| `src/handwriting/glyphs.js` | 52 个原创单线字母及真实的笔画顺序 |
| `src/handwriting/signature.js` | 字母排版、连笔、Bézier 极值、居中及坐标映射 |
| `src/animation/SignatureController.js` | 统一的时间线和书写、抬笔、清除、归位流程 |
| `src/scene/PencilScene.js` | 3D 几何、灯光、相机、投影、资源回收 |
| `src/scene/softPaperShadow.js` | 在真实阴影贴图上做面积光近似，靠近笔尖清晰、远处柔和 |
| `src/scene/InkParticles.js` | 单 Canvas 的路径采样与粒子消散 |
| `src/styles.css` | 极简布局、响应式及低动态样式 |
| `scripts/analyze_video.py` | 解码全部 557 帧并生成连续图组、关键帧和逐帧数据 |
| `tests/`、`playwright.config.js` | 模型边界和真实浏览器验收 |
| `analysis/视频逐帧分析.md` | 对视频动作、时序、构图和实现选择的具体分析 |
| `analysis/verification/` | 截图、同步误差采样、响应式与测试原始结果 |

构建配置为 `package.json`、`package-lock.json`、`vite.config.js`、`index.html`；页面入口为 `src/main.jsx`，图标为 `public/favicon.svg`。没有覆盖其他页面。

## 依赖与原因

运行依赖只有 React / React DOM（界面与状态）、Three.js（实时 3D、灯光、投影）和 GSAP（统一动画时间线）。Vite / React 插件用于本地开发及构建；Playwright 只作为开发依赖用于实际浏览器验收。没有新增字体、3D 模型、图标或粒子库。

Three.js 的 WebGL 渲染器占据主要包体；生产构建的 JS 约 851 kB、gzip 约 238 kB，Vite 会提示单个 chunk 超过 500 kB。此提示不影响构建和运行。场景限制设备像素比至 2，并且不在静止时持续渲染。

## 笔迹实现的边界

本实现是**真正的单线笔画路径方案**，没有使用字体遮罩降级。所有字母来自本项目原创 SVG 中心线路径，能够按照落笔顺序追踪并与笔尖对齐。字体轮廓资源并不能直接表达笔顺，因此没有从普通字体提取外轮廓，也不依赖外部字体文件。

字形是固定的一套英文手写风格，并不生成每个用户独有的书法，也不保证与视频中未知字形逐像素相同。目前支持 ASCII 英文字母和空格；中文、重音字符、数字、连字符及其他符号会通过输入校验提示。超长输入会按宽度缩小，仍可完整书写，但可读性会随长度降低。

柔影是实时方向光阴影贴图上的面积光近似，并非离线路径追踪。数学采样误差、实际显示像素的抗锯齿效果和不同设备帧率是三个不同指标，验收数据只代表本机测试环境。

## 验证结果

5 项模型测试和 3 项真实浏览器测试通过，生产构建通过。浏览器验收包括空输入、Enter/按钮、Shakespeare 全程、重复提交、完整停留、粒子清除、归位、再次输入 Amy、书写/清除中缩放、长姓名、全部大小写字母、点横画、连续六次清除重写、无效输入恢复、低动态设置和资源数量稳定性。

逐帧同步测试独立读取**实际 SVG dash 端点**并转换到屏幕坐标，再与 3D 笔尖投影比较；桌面采样 1337 帧，最大数学投影误差约 **0.0011 CSS px**。响应式采样 262 帧，最大误差约 **0.00064 CSS px**。控制台没有应用错误、WebGL 着色器错误或警告。原始结果保存在 `analysis/verification/synchronization.json`、`responsive.json` 和 `playwright-results.json`。

另外启动了实际生产构建预览，在设备像素比 2 下检查桌面/手机尺寸、完整书写、清除及生产包不暴露调试接口，全部通过。结果为 `analysis/verification/production-smoke.json`，截图为 `production-desktop.png`、`production-mobile.png`。需要复验时先运行 `npm run build` 和 `npm run preview`，再在另一终端运行 `node scripts/verify-production.mjs`；该脚本还生成了用于人工核对全部字形的 `glyph-atlas.svg` / `glyph-atlas.png`。

视频分析工具另需 Python、OpenCV、NumPy、Pillow；这些是分析脚本的可选依赖，网页运行不需要 Python：

```powershell
python scripts/analyze_video.py
```

## 工程记忆与版本管理

工程记忆采用用户指定的 standard 模式，入口为 [wiki_memory/README.md](wiki_memory/README.md)，维护协议为 [wiki_memory/AGENTS.md](wiki_memory/AGENTS.md)。五份当前状态页记录项目概览、架构、约束、待办和已知问题；历史按六类日志归档。普通开发按项目内协议维护，无需重新调用个人 Skill。

源码远程为 [DewMysimple/mySign](https://github.com/DewMysimple/mySign)，默认交付分支为 `main`。按照用户持续要求，每次完整对话产生的项目修改，都应完成适当验证、提交并推送；具体收尾与远程核对规则见根目录 [AGENTS.md](AGENTS.md)。
