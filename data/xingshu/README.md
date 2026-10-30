# 两字硬笔行书实验数据

当前仅包含「你」「好」，版本 `0.2.0-experimental`，不属于现有 3500 字的正式合格 manifest。第二轮默认选 B；其他 3498 字继续原标准字形。没有运行时模式开关或在线字体，用户审美确认前不合 main。

## 第二轮当前入口

| 文件 | 用途 |
| --- | --- |
| `v0.2.0/designs.mjs` | 当前手工制定的 A/B 完整三次曲线、逐笔压力、节奏、部件位置与推荐选择；主要编辑入口 |
| `v0.2.0/artwork.json` | 最终选定 B 的完整可编辑曲线 / 压力快照，不要把它误作生成器输入 |
| `v0.2.0/ni.json` / `hao.json` | 最终运行时完整闭合轮廓、中线、原逻辑映射与来源 |
| `v0.2.0/manifest.json` | 仅两字的实验文件哈希和字节长度 |
| `v0.2.0/candidates/a` / `b` | 两个内部候选完整源快照、独立字形和实验 manifest |
| `../../scripts/build-xingshu-v2.mjs` | 只构建 A、B 和最终两字，不写正式字库 |
| `../../scripts/xingshu-connection-audit.mjs` | 独立六条件连墨规则和已审查取舍，未审查的连续组不能进入生成 |
| `../../analysis/xingshu-v2/review.html` | 同尺度五版对比、真实录制、逐笔 / 中线与清除材料 |

十三个逻辑笔画和原始 HWD 来源哈希完整保留。三条旧牵丝全部删除；最终 12 连续组、13 墨迹段、0 独立牵丝。好 4→5 在 (69.4,35.6) 同点、同向、同宽接触；其他笔真实抬落。A 为十三笔全部独立，B 只保留这处自然接触。旧 v0.1.0 原样留档。

100 em、两字 advance 100 / baseline 88。逐笔主体主要为 3.8–5.6 单位；长竖、点、提与收笔各有独立压力序列。轮廓仍按弧长与连续压力法向生成，不是统一增加描边；详细规则见第二轮 visual-spec，全部十三笔前后数据见 redesign-audit.json。

```powershell
npm run glyphs:xingshu
node scripts/render-xingshu-round2.mjs  # 需要 dev：同尺度实际渲染器与 A/B 图集
npm run test:xingshu:masks
node scripts/capture-xingshu-round2.mjs final
```

A/B 真实 App 录制分别用独立研究服务 `node scripts/serve-xingshu-study.mjs a 5174` / `b 5175`，再执行 capture 脚本指定标签与地址。研究服务只在开发服务器替换两字 JSON 导入，不修改产品或增加 UI；最终版本直接运行正常 dev / build。

可编辑数据、designs.mjs、连带审查 JSON、来源和原 Arphic 许可随独立 `public/experiments/xingshu-v0.2.0` 分发。字体许可、正式 manifest、英文、3D 与粒子代码未改。当前验证见 `analysis/xingshu-v2/acceptance.md`，旧报告仅证明当时版本。

## 上一轮 0.1.0 历史资料

以下是冻结版本的结构说明，其 9 组 / 3 牵丝 / 16 段不再代表当前版本。历史脚本 `scripts/build-xingshu.mjs` / `render-xingshu-artwork.mjs` 对应旧数据，不应作为本轮构建入口。

## 可编辑数据与生成物

| 文件 | 用途 |
| --- | --- |
| `v0.1.0/artwork.json` | 人工制定的三次中线、各笔压力控制点、节奏、逻辑笔画、部件和连带意图 |
| `v0.1.0/ni.json` | 「你」的独立完整轮廓、中线及 7 笔逻辑 / 5 组视觉动作 |
| `v0.1.0/hao.json` | 「好」的独立完整轮廓、中线及 6 笔逻辑 / 4 组视觉动作 |
| `v0.1.0/manifest.json` | 实验版本、两文件字节长度与 SHA256；不改正式 manifest |
| `v0.1.0/stroke-studies.json` | 从实际两字提取的八类笔势研究，捺势为女字斜点末段；不是额外字形或逻辑笔画 |
| `../../scripts/build-xingshu.mjs` | 只生成两字及其图集、独立 public/experiments 的源码 / 许可副本 |

历史构建器为 `node scripts/build-xingshu.mjs`，只用于恢复冻结的 v0.1.0。当前使用上方第二轮命令；不要为两字原型运行正式 3500 字构建。

## 坐标与数据契约

100 单位 em，x 向右、y 向下；基线偏移分别为 88 与 87。每字保留 advance、四维 bounds、部件、修改来源和逻辑 / 视觉映射。排版层统一移动轮廓与中线，不做不相同的形变。

`logicalStrokes`：原始编号、原顺序、所属部件、HWD 固定版本和原笔画 SHA256。没有主体省略和顺序变更，`omittedLogicalStrokes` / `orderChanges` 均为空。

`visualActions`：连续动作组，列出原逻辑编号和实际墨迹 segmentId。`strokes` 是供现有协调层逐段执行的墨迹段，包含完整闭合 outline、三次 d、中线采样 median、start/end、length、bounds、maskWidth、起收笔形态、pressure、rhythm 和 pace。三个牵丝段没有冒充逻辑笔画，单独以 from/to 标注关系。好 4→5 直接同点接续，不新增牵丝。

每段完整轮廓由新中线和逐笔手定的宽度序列离线构造。按弧长重采样，以法向偏移构成左右边界；宽度点之间平滑插值。该算法只负责制作已重新设计的笔迹，不会把标准字体随机扭曲成行书。原正式轮廓没有复制进新数据。

## 来源、许可和质量

HWD 2.0.1 用作原始逻辑顺序与结构参考，原笔画哈希逐项保留。两字新中线、比例、完整轮廓和牵丝由本次任务中的 Codex 制作，非真人手写采集。保守遵循原结构参考的 Arphic Public License；原始许可、修改说明、可编辑源码和两字数据随 `public/experiments/xingshu-v0.1.0` 一并分发。

Long Cang 的官方 OFL 字体仅用于静态视觉研究，版本和文件指纹记录在 `analysis/xingshu/research`；未将其字模、中线或轮廓导入原型，未在产品中下载字体。原正式 Arphic 数据来源记录保持不变。

构建检查逻辑完整性、组内接触连续性。独立真实浏览器检查中线在完整轮廓内的关系、22 阶段完整显现以及三维同步，报告在 `analysis/xingshu/quality` 和 `analysis/xingshu/browser`。数据状态仍为 experimental，功能通过不能自动更改为正式 qualified。用户审美确认和人类书法专家认证均未冒充。
