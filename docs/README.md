# MyUniverse 文档

文档按当前对象与职责组织，主模块为 UI、数据结构、功能。先读 [总体设计](../Planning.md)，再进入所属专题；追查需求、修改顺序和测试结果读 [日志](changelog/README.md)。现行规则按仓库代码核对，设计缺口在各专题注明。

## UI

| 子对象 | 文档 | 内容 |
| --- | --- | --- |
| 总设计理念 | [设计原则](ui/design-principles.md) | 同源对象、布局、命令复用、拖动和会话 |
| 主题与共享控件 | [样式复用](ui/styles.md) | 语义颜色、CSS 家族、Portal、引用、配置卡片和旧类映射 |
| 应用与创作页面 | [页面交互](ui/pages.md) | 树、实例、Schema、未保存提示、Markdown 双栏、视图和设置 |
| 工作流编辑 | [工作流 UI](ui/workflow-editor.md) | 停靠区、节点库、变量池、端口、拖放、编辑和性能 |
| 聊天呈现 | [聊天 UI](ui/chat.md) | 输入、消息、过程、工具组、提议与用户消息操作 |

## 数据结构

| 子对象 | 文档 | 内容 |
| --- | --- | --- |
| 世界与类实例 | [世界对象](data/world.md) | Workspace/World、Schema、类型、身份、默认模板、生成来源 |
| JSON 保存结构 | [JSON 存储](data/json-storage.md) | 文件布局、真实读写角色、样式/运行元数据及结构示例 |
| Markdown 保存结构 | [Markdown 格式](data/markdown.md) | 标题、递归成员、引用、重复项、Content、来源注释和解析边界 |
| 界面投影 | [视图数据](data/views.md) | InterfaceView、current/fixed 路径、GraphStyle 和布局 |
| 工作流 | [图与类型](data/workflow.md) | 图定义、七型信封、端口引用、消息/图片/能力集合及迁移 |
| 聊天 | [聊天数据](data/chat.md) | 消息、运行状态、模型协议、提议快照与编辑上下文 |

## 功能

| 子对象 | 文档 | 内容 |
| --- | --- | --- |
| 数据生命周期 | [保存与刷新](features/persistence.md) | 内存草稿、当前/全部提交、显式读取、基线和失败 |
| Function | [函数设计](features/functions.md) | void/add、类型化参数、绑定作用域、所有权、重算、JS/Python/Flow |
| Tool | [脚本与工具](features/tools.md) | 自由参数、事务、HTTP/JS、取消、MCP 内部适配 |
| 官方工具 | [工具与建议](features/official-tools.md) | 九项调用、查询、新增/修改提议、批量采纳及回退 |
| 界面操作 | [人物关系网与地图](features/interface-views.md) | 人物专用关系、个人聚焦、过滤、源数据写回和地图 |
| 工作流运行 | [执行设计](features/workflow-execution.md) | 依赖求值、循环、惰性条件、观察、取消与记忆 |
| 模型能力 | [模型与 Agent](features/models-and-agents.md) | LLM、ToolCalls、子 Agent、模板和 ComfyUI |
| 聊天运行 | [聊天功能](features/chat.md) | SSE、发起会话定位、协议、重发、提议与持久化 |
| API | [接口使用](features/api.md) | 世界门面、脚本入口、模型/ComfyUI 请求和桌面桥 |

## 实现与维护

- [架构与代码入口](architecture.md)：分层、调用链和执行边界。
- [开发与验证](development.md)：命令、交付、测试夹具、验收方法和未实现能力。
- [文档维护规则](documentation-guide.md)：主题归属、当前规范与过程记录的分工。
- [修改日志](changelog/README.md)：按日期记录工作，保存历次原文。
- [本次整理与原文索引](changelog/documentation-reorganization.md)：旧文件去向、拆分/合并、核对入口及原文哈希。

格式定义放数据模块，交互表现放 UI，执行行为与接口放功能。一个规则只在主负责文档完整维护，其他位置以摘要和链接引用。历史规划副本、旧样式盘点、聊天顺序与验收数字仅供日志追溯。
