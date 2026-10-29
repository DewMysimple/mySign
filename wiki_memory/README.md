---
type: moc
status: active
updated: 2026-10-29
topic: memory-entry
sources:
  - "wiki_memory/.memory.json"
  - "wiki_memory/AGENTS.md"
  - "AGENTS.md"
---

# 工程记忆导航

模式为 **standard**，由用户于 2026-10-29 明确指定；依据是本次“构建标准工程记忆”的要求，不是按目录数量推断。配置以 [`.memory.json`](.memory.json) 为准。

新会话先读根目录项目指令、本页和维护协议，再依次读项目概览、当前约束、当前待办；涉及实现再读系统架构，排查边界再读已知问题。下方索引是事实页入口，本页不复制当前事实。查历史先定位主题或日志类型，不通读日志。

日常开发直接遵循项目内协议，不调用 wiki-memory Skill；只有用户明确要求配置、迁移、体检等记忆管理时才加载个人 Skill。维护工具已复制进项目，换机器不依赖原 Skill 安装位置。

- [记忆维护协议](AGENTS.md)
- [工作日志 MOC](日志/MOC_工作日志.md)

导航新增或变动后，在项目根目录统一运行 `python "wiki_memory/工具/memory.py" index --project . --apply`。记忆正文有修改时收尾运行一次 `check --project .`；初始化、迁移及模式升级使用 `check --project . --require-ready` 替代普通检查。完整命令与停止条件见维护协议。

<!-- wiki-memory:auto:start -->

## 当前状态

- [[当前状态/已知问题.md|已知问题]] — active
- [[当前状态/当前待办.md|当前待办]] — active
- [[当前状态/当前约束.md|当前约束]] — active
- [[当前状态/系统架构.md|系统架构]] — active
- [[当前状态/项目概览.md|项目概览]] — active

<!-- wiki-memory:auto:end -->
