# 第二轮工程审计

任务来源为 prompt/prompt_04.txt 和用户两张审查图片：少连笔、重笔势、加强主笔、重新设计女旁。用户要求直接完成美术重构、真实浏览器验证和交付，审美确认前维持实验分支。

起点为 feature/chinese-xingshu-prototype 的 fed0c9600fabfe34ea8717cd4210dff13dce00ce；开始真实 ls-remote 同时核实 origin 功能分支为 fed0c96、main 为 b110742。工作树最初只有用户新添的 prompt_04.txt，已保全并纳入任务。原 main 工作树未修改。

已读上一轮 acceptance、visual-review、visual-spec、数据 README、两字实际数据、registry、motionRhythm 和 SignatureController。任务书中简写 data/xingshu/ni.json / hao.json，仓库实际版本路径为 v0.1.0；本轮新数据独立放 v0.2.0，旧数据与旧分析目录原样保留。

先重新录制现有原型，随后独立制作 A/B。十三笔中线和压力全部重画，删除三个旧返回段；不是隐藏线条，也不是统一增加 stroke-width。候选服务仅在独立 Vite 研究服务器替换两字导入，实际复用 App、GlyphLoader、动作计划、Controller、3D、渲染和粒子；不会进入生产包或加入产品按钮。实际捕获 SVG 与候选数据另行精确比对。

运行时源码仅修改 xingshuRegistry 的两个 JSON 导入。原正式字库、manifest、英文几何与机制、renderer、scene、粒子源码保留；唯一 GSAP 协调器与 motionRhythm 相对本轮起点完全不变。3500 字无需全量重建，本轮针对实际改变的 13 段及相关生命周期重验。

数据继续沿用 Arphic Public License。独立发布目录 public/experiments/xingshu-v0.2.0 包含完整曲线压力 JSON、designs.mjs、六条件审查记录、manifest、来源和许可原文。旧许可及 Long Cang 研究记录未改；未引入任何字体文件、运行时依赖或其他字形。

Chromium 完整回归中原英文测试原先写向旧证据目录；本轮已把这次产物保全到新目录、恢复旧目录并修正后续输出位置。仅改变测试产物路径，不改变测试或产品行为。旧轮报告不会被新结果冒充替换。

最终自动化结果、源码和材料指纹、修改清单见 acceptance.json。用户审美、其他字扩展、手机和 main 合并均不从功能通过自动推定。
