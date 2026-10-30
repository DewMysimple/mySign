# 两字硬笔行书实验数据

仅包含「你」「好」，版本 `0.1.0-experimental`，不属于现有 3500 字的正式合格 manifest。产品功能分支默认对这两字选择实验数据，其他 3498 字继续读取原合格标准字形。没有运行时模式开关或在线字体。

## 可编辑数据与生成物

| 文件 | 用途 |
| --- | --- |
| `v0.1.0/artwork.json` | 人工制定的三次中线、各笔压力控制点、节奏、逻辑笔画、部件和连带意图 |
| `v0.1.0/ni.json` | 「你」的独立完整轮廓、中线及 7 笔逻辑 / 5 组视觉动作 |
| `v0.1.0/hao.json` | 「好」的独立完整轮廓、中线及 6 笔逻辑 / 4 组视觉动作 |
| `v0.1.0/manifest.json` | 实验版本、两文件字节长度与 SHA256；不改正式 manifest |
| `v0.1.0/stroke-studies.json` | 从实际两字提取的八类笔势研究，捺势为女字斜点末段；不是额外字形或逻辑笔画 |
| `../../scripts/build-xingshu.mjs` | 只生成两字及其图集、独立 public/experiments 的源码 / 许可副本 |

构建：`npm run glyphs:xingshu`；接着 `node scripts/render-xingshu-artwork.mjs` 与 `npm run test:xingshu:masks`。后一个命令需要本地开发服务。不要为修改本原型运行正式 3500 字构建。

## 坐标与数据契约

100 单位 em，x 向右、y 向下；基线偏移分别为 88 与 87。每字保留 advance、四维 bounds、部件、修改来源和逻辑 / 视觉映射。排版层统一移动轮廓与中线，不做不相同的形变。

`logicalStrokes`：原始编号、原顺序、所属部件、HWD 固定版本和原笔画 SHA256。没有主体省略和顺序变更，`omittedLogicalStrokes` / `orderChanges` 均为空。

`visualActions`：连续动作组，列出原逻辑编号和实际墨迹 segmentId。`strokes` 是供现有协调层逐段执行的墨迹段，包含完整闭合 outline、三次 d、中线采样 median、start/end、length、bounds、maskWidth、起收笔形态、pressure、rhythm 和 pace。三个牵丝段没有冒充逻辑笔画，单独以 from/to 标注关系。好 4→5 直接同点接续，不新增牵丝。

每段完整轮廓由新中线和逐笔手定的宽度序列离线构造。按弧长重采样，以法向偏移构成左右边界；宽度点之间平滑插值。该算法只负责制作已重新设计的笔迹，不会把标准字体随机扭曲成行书。原正式轮廓没有复制进新数据。

## 来源、许可和质量

HWD 2.0.1 用作原始逻辑顺序与结构参考，原笔画哈希逐项保留。两字新中线、比例、完整轮廓和牵丝由本次任务中的 Codex 制作，非真人手写采集。保守遵循原结构参考的 Arphic Public License；原始许可、修改说明、可编辑源码和两字数据随 `public/experiments/xingshu-v0.1.0` 一并分发。

Long Cang 的官方 OFL 字体仅用于静态视觉研究，版本和文件指纹记录在 `analysis/xingshu/research`；未将其字模、中线或轮廓导入原型，未在产品中下载字体。原正式 Arphic 数据来源记录保持不变。

构建检查逻辑完整性、组内接触连续性。独立真实浏览器检查中线在完整轮廓内的关系、22 阶段完整显现以及三维同步，报告在 `analysis/xingshu/quality` 和 `analysis/xingshu/browser`。数据状态仍为 experimental，功能通过不能自动更改为正式 qualified。用户审美确认和人类书法专家认证均未冒充。
