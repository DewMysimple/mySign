# prompt_04 完成核对

核对对象为本轮实际工作树与产品提交 87b7906，不沿用旧轮绿色结果。功能和材料交付已完成，最终用户审美明确待确认。

| 任务书要求 | 当前证据与结论 |
| --- | --- |
| 阅读旧报告、规范、数据与实际源码，实际打开旧原型 | 工程审计记录实际版本路径；prototype-1.2/capture.json 保存新采的旧原型真实运行与逐帧轨迹，非仅阅读 JSON。 |
| 3 条牵丝逐条编号；起终点、方向、曲率、空间、视觉及3D分析 | connection-review.md 与 redesign-audit.json 为 T1/T2/T3 的完整分析，记录实际路径、转向角、原笔尖样本和处置。T1/T3 删除，T2 重画试验后仍不自然，最终删除。 |
| 优先解决你字亻/尔关系和好字女旁返回环 | 两部件比例、重心与中线重新设计；三条返回线从数据中删除，女旁仍保留原三主笔。connections.png 与最终静态 / 逐笔图可复核。 |
| 逐笔压力、不同起笔、连续行笔、自然收笔，不使用统一加粗或随机扰动 | 十三笔都有不同中线与压力序列、入收说明和节奏。模型测试独立核对每笔曲线和压力均改变、倍率并非统一；renderer 文件保持原样。 |
| 你 / 好独立重构；亻、尔、女、子都有设计 | designs.mjs 的两字八个主要部件处理与13笔记录；visual-spec.md 和逐笔审查说明实际形体取舍。两个最终 JSON 独立分发。 |
| 六条件连笔机制，笔顺/来源完整，删除后动作/笔尖/粒子同步 | 独立 connection-audit 准入拒绝旧线和未知组；13 原逻辑哈希与顺序保留。12组 / 13段 / 零牵丝，仅子4→5自然共点共向共宽。实际计划、粒子、clean-lifts / contacts测试证明删除不是隐藏。 |
| A / B各有全字、分解、中线叠图、真实录制，不增模式按钮 | a/ 与 b/ 下各有 normalized.png、artwork/strokes.png、artwork/overlay.png、live.webm；12组捕获SVG全部与实际候选数据对应。运行时源码仅换两条 JSON 导入，产品组件与控件不变。 |
| 单一GSAP、真实中线、抬笔停墨、不同长短节奏、转折按停、同步阴影/粒子与归位 | Controller / motionRhythm / 3D / 粒子源码相对本轮起点完全不变，使用新数据的独立节奏。接触、11次抬笔、同步、轮廓、完整区域清除、故障和资源门禁重新通过。沿用写完保留签名、清除后归位的既有完整交互周期。 |
| 五版真实浏览器静态对比一致尺度/画布/墨色/背景/字距，实际录制 | comparison.json 固定1000×410、scale3.5、DPR1、110单位字距、蓝墨和纸色；实际 inkRenderer 绘制。5段真实录制均实际解码和寻帧，旧1.1.0录制原样保留，旧1.2.0本轮重新录制，A/B/最终均本轮正常速度录制。 |
| 动画无异常连接或笔墨分离，抬笔干净 | 同步采样与媒体实际观察结合；唯一同点边界gap0，三删除位置抬笔时墨迹完全不变，11空中移动XY与计划一致、阴影实际抬起。关键帧和视频另行目视检查，不把数学误差当像素抗锯齿误差。 |
| 保护正式3500字、manifest、英文、3D、渲染、GSAP、粒子、许可，无扩字/新依赖/手机专项/冗余UI | 原正式保护路径相对b110742、原型机制与旧数据/材料相对fed0c96的Git差异检查；原英文蓝墨像素差异0；依赖声明未改。未改变任何其他汉字，也未合main。 |
| 重新跑全部受影响测试与构建 | 23模型、21Chromium、3其他桌面、13段×22进度显现、9正常速度校准、3实际生产场景和英文像素回归均通过；详细18项门禁见acceptance。 |
| 更新规范和工程记忆，提交推送实验分支 | 当前visual-spec、数据README、根README及五张当前状态页更新；新增一份UI任务日志。memory index与普通check各执行一次，12页、错误0、警告0，启动读取11063字符。提交推送最终状态以本轮Git交付记录和远程引用核对为准。 |

## 九项交付定位

1. 最终两字数据：data/xingshu/v0.2.0/ni.json、hao.json；完整源为 designs.mjs / artwork.json，来源与APL另行分发。
2. 连笔改前改后：connections.png / SVG、connection-review.md、redesign-audit.json。
3. A/B风格比较：review.html、comparison.png，a/ 和 b/ 的全字、分解、叠加及实时录制。
4. 最终静态截图：final/nihao-full.png、ni-full.png、hao-full.png，去笔层的ink-only图和同尺度normalized.png另存。
5. 真实动画：final/live.webm；A/B、旧1.2.0和原1.1.0录制同时保留，媒体审计见media-audit.json。
6. 笔画与中线：final/artwork/strokes.png、overlay.png及独立SVG。
7. 自动化报告：acceptance.json / md、unit-tests.tap、browser/、quality/、performance/、production/ 和英文差异报告。
8. 修改清单：changed-files.json / md，相对本轮起点fed0c96，包含交付文档和工程记忆。
9. 视觉规范与工程记忆：visual-spec.md、visual-review.md、根 / 数据README、wiki_memory当前状态五页与UI任务日志。

候选选择是 Codex 在授权范围内作出的设计推荐，没有替用户作最终审美通过决定。用户确认前维持实验分支，不扩字、不合main。
