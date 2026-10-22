# MyUniverse 文档

现行规范按对象与职责分为 **UI、数据结构、功能**。每项规则在所属专题完整维护，其他位置引用；新增工作直接合入对应章节。聊天顺序、修改经过、测试结果、截图及旧方案统一放入 [日志](changelog/README.md)。

初读从 [总体设计](../Planning.md) 了解产品，再按下表进入。源码分层见 [架构](architecture.md) 和 [逐文件索引](source-map.md)，命令与验收方法见 [开发指南](development.md)。

## UI

| 子对象 | 内容 |
| --- | --- |
| [总体设计](ui/design-principles.md) | 同源对象、布局、命令复用、主题、反馈、拖动、键盘与页面会话 |
| [主题与样式复用](ui/styles.md) | 语义颜色、ARGB、CSS 家族/Token、Portal、控件、图标和旧类映射 |
| [导航与创作页面](ui/pages.md) | 项目树、路径、历史、文件操作、实例/Schema、Markdown 与视图 |
| [插件与模型管理](ui/libraries.md) | Function/Tool 编辑器、Skill 子页、LLM、Agent、SD 与设置 |
| [工作流 UI](ui/workflow-editor.md) | 停靠区、节点库、变量池、端口、内部画布、拖动及观察 |
| [聊天 UI](ui/chat.md) | 输入和引用、成员、消息/过程、插话、提议、问题、用量及定位 |

分目录入口：[UI](ui/README.md)。

## 数据结构

| 子对象 | 内容 |
| --- | --- |
| [世界对象](data/world.md) | Workspace/World、类/实例/Schema/成员、身份、生成来源与模板 |
| [JSON 存储](data/json-storage.md) | 权威存档、导出文件布局、示例和内存状态边界 |
| [Markdown 格式](data/markdown.md) | 标题层次、纯文本引用、重复项、Content、来源与解析模式 |
| [视图配置](data/views.md) | current/fixed 路径、图/地图布局、样式与引用 |
| [工作流图和值](data/workflow.md) | FlowGraph/WorkflowGraph、八型变量、信封、端口绑定和协议消息 |
| [聊天数据](data/chat.md) | 可见消息、模型协议、成员、插话、用量、提议与快照 |
| [模型与插件配置](data/integrations.md) | Function/Tool/模型/Agent、目录、记忆、迁移标志 |
| [Skill 包格式](data/skills.md) | YAML、目录、工具 manifest、资源、修订和恢复 |

分目录入口：[数据结构](data/README.md)。

## 功能

| 子对象 | 内容 |
| --- | --- |
| [世界与实例编辑](features/editing.md) | 结构同步、筛选、批量、副本身份、标签与历史 |
| [保存与刷新](features/persistence.md) | 自动 JSON、限定导出、MD 导入/填入、来源、渐进提交与取消 |
| [Function](features/functions.md) | void/add、绑定范围、所有权、重算、JS/Python/Flow 与模板 |
| [Tool 执行器](features/tools.md) | JSON Schema、JS/HTTP、草稿事务、取消和模型适配 |
| [官方工具目录](features/official-tools.md) | 17 项分组、调用名、参数、上下文与兼容 |
| [修改提议](features/proposals.md) | 定向提议、冲突合并、批量采纳与回退 |
| [关系网与地图](features/interface-views.md) | 源写回、逐值关系、聚焦/筛选、布局与配置 |
| [工作流执行](features/workflow-execution.md) | 依赖、惰性、顺序、内部循环、Method、预算及记忆 |
| [LLM 模型](features/models.md) | 连接、参数、用量、基础 LLM/ToolCalls 与兼容自动交流 |
| [Agent](features/agents.md) | 类型/实例、能力、迁移、子调用、成员管理和结构化输出 |
| [Skill 加载与文件维护](features/skills.md) | 发现/激活、强制技能、专属 Tool、Runtime 文件版本与保存 |
| [聊天生命周期](features/chat.md) | SSE、发起会话归属、成员交流、插话、编辑重发和持久化 |
| [ComfyUI](features/comfyui.md) | SD API 图、节点目录、执行观察、轮询和图片保存 |
| [API 参考](features/api.md) | 世界门面、脚本入口、存储服务、HTTP/SSE 和 Tauri 桥 |
| [运行日志](features/runtime-log.md) | 来源、限量、过滤、覆盖层与诊断边界 |

分目录入口：[功能](features/README.md)。

## 维护与追溯

- [文档归属规则](documentation-guide.md)：更新顺序、状态区分、归档及检查。
- [修改日志](changelog/README.md)：历次需求、实测证据和原文归档。
- [本次整理记录](changelog/2026-10-21-documentation.md)：拆分/合并去向、源码修正和原文快照。

Planning 是产品摘要，本页是总目录，architecture 是实现导航；三者不重复参数明细。旧入口 ui-styles、workflow-structure-update、models-and-agents 仅指向现行专题。
