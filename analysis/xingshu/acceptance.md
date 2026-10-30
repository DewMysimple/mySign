# 「你好」硬笔行书原型验收

**结论：功能原型可交付审查；用户最终审美待确认。未合 main，未扩展其他汉字。**

生成：2026-10-30T05:54:59.607Z；版本 1.2.0-prototype.0；已测产品提交 `8073018f482df9ff58fa665315b8b4acf79c665c`；分支 `feature/chinese-xingshu-prototype`。产品源码无未提交变更。之后的验收 / 记忆提交不改变这些产品文件；最终交付 HEAD 以远程分支和最终回复为准。

[打开审查页](review.html) · [新旧对比](visual/comparison.png) · [实时录制](visual/nihao-prototype-live.webm) · [视觉验收](visual-review.md) · [风格规范](visual-spec.md) · [数据说明](../../data/xingshu/README.md) · [JSON](acceptance.json)。

## 实现与边界

仅两个实验字：13 逻辑笔画、9 连续动作组、3 牵丝、16 段完整墨迹。原编号、顺序、部件、来源与完整中线 / 轮廓关系保留；没有主体省略。现有 3500 字 / 33,959 笔 / 110 分片，以及原英文几何、原渲染器、3D 与粒子源码保持原样。其他 3498 字没有行书化。

桌面单行 Enter 提交，组合输入时交由 IME，Shift+Enter 不插入换行，粘贴换行明确拒绝且保留原文。无新增模式按钮或重播 UI。

## 功能门禁 15/15

| 门禁 | 状态 | 证据 |
| --- | --- | --- |
| 工程审计、冻结原效果和独立分支 | 通过 | [engineering-audit.md](engineering-audit.md)、[baseline/capture.json](baseline/capture.json) |
| 3500 字合格库、英文几何、渲染器与 3D / 粒子源码保持原样 | 通过 | [quality/masks.json](quality/masks.json) |
| 19 项模型、字形映射、输入预算、缓存与逐段节奏 | 通过 | [unit-tests.tap](unit-tests.tap) |
| 两字 16 段 ×22 进度完整轮廓与中线匹配 | 通过 | [quality/masks.json](quality/masks.json) |
| 13 个原逻辑笔画、9 动作组、3 牵丝、7 个接触边界 | 通过 | [browser/connections-shadow.json](browser/connections-shadow.json) |
| 实际 SVG 揭示端点与 3D 笔尖同步、接触和抬笔阴影 | 通过 | [browser/connections-shadow.json](browser/connections-shadow.json) |
| 实际完整轮廓区域采样、清除归位、再次书写 | 通过 | [browser/prototype-particles.json](browser/prototype-particles.json) |
| Chromium 20 项完整交互、IME、单行、原英文和资源回归 | 通过 | [browser/chromium-results.json](browser/chromium-results.json) |
| Edge、Firefox、WebKit 关键回归各通过 | 通过 | [browser/desktop-browsers.json](browser/desktop-browsers.json) |
| 七类故障、真实牵丝中断和组件卸载恢复 | 通过 | [browser/faults.json](browser/faults.json)、[browser/thread-fault.json](browser/thread-fault.json)、[browser/unmount.json](browser/unmount.json) |
| 九组正常速度校准及 13 项预算 | 通过 | [performance/calibration.json](performance/calibration.json) |
| 32 字符 / 140 段 / 40 秒 / 0.5 scale 和实际宽度拒绝 | 通过 | [performance/calibration.json](performance/calibration.json)、[browser/chromium-results.json](browser/chromium-results.json) |
| 原英文签名蓝色墨迹差异 0 | 通过 | [english/english-ink-diff.json](english/english-ink-diff.json) |
| 生产构建、三个桌面 DPR、原型源码许可、本地加载与无调试入口 | 通过 | [build-output.txt](build-output.txt)、[production/production.json](production/production.json) |
| 新旧完整场景、逐段轮廓、7 关键帧和可解码实时录制 | 通过 | [visual/capture.json](visual/capture.json)、[visual/video-audit.json](visual/video-audit.json)、[visual-review.md](visual-review.md)、[review.html](review.html) |

用户审美为独立待审项，不计作“已通过”；手机专项为本次范围外，不计作通过。

## 关键实测

- 19 模型、20 Chromium、3 其他桌面浏览器、3 生产场景通过，正常速度性能 9 场景 / 13 项预算通过。
- 正常「你好」5.174 秒；P95 帧间隔最大 5.90 ms，最大数学同步误差 0.0010310 CSS px。
- 加载最大 10.20 ms，计划最大 5.20 ms，峰值 JS 堆 34.28 MiB，清除最大 1403.70 ms。
- 16 段 ×22 进度，最终独立完整轮廓 alpha 差异 0；中线采样全在轮廓内；7 组内边界间距 0。
- 1577 粒子均在实际墨迹内；英文签名蓝色墨迹 29,777 像素一致，差异 0。此对比排除灰色笔影与输入区，不声称整页像素一致。
- 140 段、32 字符及最小可读宽度边界均实际执行；141 段、33 字符、超宽、超时、换行拒绝并保留原文。

输入预算：32 字符（含空格）、140 段（含牵丝）、预计 40 秒、最小 scale 0.5；实际单行宽度也必须满足。配置与测量指纹见 JSON，不是任意 32 个汉字均可在当前窗口容纳。

## 交付材料与复验

工程审计、风格规范、两字独立 ni.json / hao.json、可编辑 artwork.json、八类笔势研究、逐段图与中线叠图、七关键帧、新旧完整截图和可解码 webm 均已保存。捺势研究从女字斜点末段提炼，不另增逻辑笔画。源码与许可随独立 public/experiments 发布，原 Arphic 来源记录未改。

所有当前源码、测试报告及主要视觉材料的 SHA256 与修改文件清单见 JSON。`node scripts/verify-xingshu-acceptance.mjs --check` 只读校验指纹和门禁，不重跑测试；实际执行命令见根 README。

## 尚待用户确认与限制

Codex 已逐项记录视觉观察，但不是人类书法专家认证。用户需审查细硬笔粗细、女旁返回线与整体笔势是否符合期望。按 prompt_03，确认前只推送功能分支，不合 main、不批量改造字库。

测试环境为 Windows 桌面 Chrome 156.0.8078.48 / 1440×900 / DPR2，另有 Edge、Firefox、WebKit 与生产 DPR1/2/3。允许 SwiftShader，结果不代表所有 GPU；数学误差与像素抗锯齿分开。生产 JS 1131.62 kB / gzip 358.62 kB，保留 Vite 大 chunk 警告。没有手机、外网部署、账户或持久化。
