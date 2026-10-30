# 「你好」第二轮硬笔行书交付

已完成 prompt_04 的完整美术重构、A/B 比较与真实浏览器验证。推荐 B；用户最终审美待确认，仍是实验分支，未合 main、未扩字。

版本 1.2.0-prototype.1，已测产品提交 `87b79069d45e45d755d0f8035b4d25d60de8cae0`，分支 `feature/chinese-xingshu-prototype`。报告及记忆提交不改变已测产品。

[审查页](review.html) · [前后对比](before-after.png) · [五版比较](comparison.png) · [最终真实录制](final/live.webm) · [连笔审查](connection-review.md) · [视觉规范](visual-spec.md) · [修改清单](changed-files.md) · [JSON](acceptance.json)。

## 字形与选择

十三条主体中线、部件比例与各自压力曲线重新设计。三条旧牵丝全部删除；不是只隐藏 SVG，而是从数据、动作、笔尖轨迹和粒子采样一起移除。保留原 13 逻辑笔画、顺序和来源，最终 12 动作组 / 13 墨迹段 / 0 独立牵丝，仅子部 4→5 同点同向接触。

A 是十三笔独立抬落；B 在子部保留自然圆转，选择 B。短化尔部返回的试画因仍成尖楔而弃用。女旁腰部与长撇重画，无右侧空心回环；主笔加按，点、竖、提各有不同起收。主笔饱满、收笔有变化；没有统一加宽、随机扰动或整体倾斜。完整观察见 [visual-review.md](visual-review.md)。

五版静态图由真实产品渲染器在同一画布、字号、显示比例、蓝墨、纸色和字距下完成；A/B 各有完整字形、笔画分解、中线叠图和实际动画。5 段录制均实际解码并寻帧，12 组捕获 SVG 与对应数据逐段精确匹配。

## 重新执行的验证 18/18

| 门禁 | 结果 | 证据 |
| --- | --- | --- |
| 真实浏览器冻结旧原型，三条牵丝与十三主体逐笔审查 | 通过 | [prototype-1.2/capture.json](prototype-1.2/capture.json)、[connection-review.md](connection-review.md)、[redesign-audit.json](redesign-audit.json) |
| 十三中线和压力独立重画，主笔加按，女旁回绕删除 | 通过 | [redesign-audit.json](redesign-audit.json)、[final/artwork/strokes.png](final/artwork/strokes.png)、[visual-spec.md](visual-spec.md) |
| 保留13原逻辑笔画；12组、13段、零独立牵丝 | 通过 | [browser/connections-shadow.json](browser/connections-shadow.json)、[unit-tests.tap](unit-tests.tap) |
| A/B各有全字、分解、中线叠图与真实正常速度录制 | 通过 | [a/artwork/strokes.png](a/artwork/strokes.png)、[a/artwork/overlay.png](a/artwork/overlay.png)、[a/live.webm](a/live.webm)、[b/artwork/strokes.png](b/artwork/strokes.png)、[b/artwork/overlay.png](b/artwork/overlay.png)、[b/live.webm](b/live.webm)、[visual-review.md](visual-review.md) |
| 五版相同尺度蓝墨、纸色、画布与字距；5段实际视频解码 | 通过 | [comparison.json](comparison.json)、[comparison.png](comparison.png)、[before-after.png](before-after.png)、[media-audit.json](media-audit.json) |
| 13段×22进度，完整轮廓精确显现，中线采样均在轮廓内 | 通过 | [quality/masks.json](quality/masks.json) |
| 真实中线端点与3D笔尖同步，唯一接触点连续、接触阴影一致 | 通过 | [browser/connections-shadow.json](browser/connections-shadow.json) |
| 11次真实抬笔；删除三线的位置墨迹不变，阴影抬起 | 通过 | [browser/clean-lifts.json](browser/clean-lifts.json) |
| 粒子从完整区域采样、清除、归位并再次写英文 | 通过 | [browser/prototype-particles.json](browser/prototype-particles.json)、[final/particles.png](final/particles.png) |
| 23项模型、来源、曲线压力、六条件连带、预算和缓存 | 通过 | [unit-tests.tap](unit-tests.tap) |
| Chromium完整交互21项通过 | 通过 | [browser/chromium-results.json](browser/chromium-results.json) |
| Edge、Firefox、WebKit关键回归3项通过 | 通过 | [browser/desktop-browsers.json](browser/desktop-browsers.json) |
| 7类故障、自然接触处中断、卸载与恢复 | 通过 | [browser/faults.json](browser/faults.json)、[browser/contact-fault.json](browser/contact-fault.json)、[browser/unmount.json](browser/unmount.json) |
| 正常速度9场景、13预算门禁与拒绝恢复 | 通过 | [performance/calibration.json](performance/calibration.json) |
| 英文冻结签名蓝色墨迹像素差异0 | 通过 | [english/english-ink-diff.json](english/english-ink-diff.json) |
| 真实生产构建、三个桌面DPR、源码许可与本地加载 | 通过 | [build-output.txt](build-output.txt)、[production/production.json](production/production.json) |
| 原正式3500字/manifest/英文/渲染/3D/粒子/GSAP和旧证据保留 | 通过 | [engineering-audit.md](engineering-audit.md) |
| 完整画面、单字、11关键帧、最终录制和可用审查页 | 通过 | [final/capture.json](final/capture.json)、[final/keyframes.png](final/keyframes.png)、[final/live.webm](final/live.webm)、[review-page-smoke.json](review-page-smoke.json)、[review.html](review.html) |

23 模型、21 Chromium、3 其他桌面浏览器、3 生产场景、9 正常速度校准场景均通过。13 段 ×22 进度，最终轮廓 alpha 差异 0，中线采样 100% 在轮廓内。唯一接触点间距 0；11 次实际抬笔均采到，三个删除位置抬笔期间墨迹保持不变。3001 个清除粒子均位于完整墨迹中。英文蓝色墨迹 29,777 像素与冻结基线相同。

正常「你好」5.513 秒；P95 帧间隔最大 5.90 ms，最大同步数学误差 0.0010620 CSS px，峰值 JS 堆 34.02 MiB，清除最大 1314.30 ms。实际完整轮廓蓝色像素面积比旧原型增加约 72.8%，仅是同尺度图像测量，不是物理压力或审美认证。

仍沿用 32 字符 / 140 墨迹段 / 40 秒 / 最小 scale 0.5 与实际单行宽度限制；输入法、原文保留和错误恢复不变。新版 15 字「你好」组合 98 段约 37.67 秒，16 字超 40 秒被拒绝；未为新画风放宽预算。

## 工程保护与交付

原 3500 字 / 33,959 笔 / 110 分片和正式 manifest、英文几何、renderer、Three 模型、粒子源码未改。相对本轮起点，SignatureController、motionRhythm、布局与输入组件完全不变；唯一 GSAP 时钟继续协调笔尖、轮廓、阴影和抬笔。运行时源码只切换两个实验 JSON 导入。没有新增运行时依赖或生产冗余控件。

数据与源文件位于 data/xingshu/v0.2.0；独立 public/experiments/xingshu-v0.2.0 分发完整可编辑曲线压力、designs.mjs、审查规则记录、manifest、来源和 Arphic 原许可。旧原型及其分析、许可记录原样保留。

[修改清单](changed-files.md) 包含本轮源码、配置、材料和工程记忆；JSON 保存 289 个源码与证据 SHA256。`node scripts/verify-xingshu-v2-acceptance.mjs --check` 只读核对指纹和保护范围，不重新运行浏览器或代替测试。

当前实测为 Windows 桌面，允许 SwiftShader；结果不代表所有 GPU。JS 1108.31 kB / gzip 348.64 kB，保留 Vite 大 chunk 警告。未做手机专项或公网发布。最终审美由用户确认，确认前不合 main、不扩展其他字。
