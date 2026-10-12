# MyUniverse 文档

[Planning](../Planning.md) 维护总体设计：产品目标 → UI → 数据结构 → 功能 → 实现边界。专题文档按功能归属维护当前规则，不按聊天先后追加；历史过程见 [修改日志](changelog/README.md)。

## UI 设计

| 文档 | 负责内容 |
| --- | --- |
| [设计原则](design-principles.md) | 主题、布局、对象身份、交互反馈、拖动不变性、复用边界 |
| [页面与通用交互](ui-interactions.md) | 应用框架、创作/插件/模型/设置页面、树与列表、会话恢复 |
| [工作流编辑器](workflow-editor.md) | 节点库、变量池、端口、卡片、拖动转换、选择与右键操作 |

## 数据结构

| 文档 | 负责内容 |
| --- | --- |
| [数据模型](data-model.md) | Workspace/World、类与实例、Schema/成员、稳定身份、默认模板 |
| [Markdown 与存储](markdown-sync.md) | Markdown 格式、往返转换、磁盘布局、双向同步、冲突处理 |
| [工作流类型](workflow-types.md) | Graph 控制边界、七种类型、inline 共存、Messages/Image/Tools/Agents、记忆与迁移 |

## 功能设计

| 文档 | 负责内容 |
| --- | --- |
| [对象投影视图](interface-views.md) | 当前/固定对象绑定、关系网、地图、源数据写回、布局 |
| [Function](functions.md) | void/add 契约、类型化添加参数、来源与绑定生命周期、JS/Python/Flow |
| [脚本与 Tool](script-runtime-and-tools.md) | 主程序世界门面、修改事务、自由参数、MCP 元数据、模型桥梁 |
| [官方 Tool](official-tools.md) | 八项只读模板、查询契约、聊天修改建议与用户采纳 |
| [模型与 Agent](models-and-agents.md) | LLM 连接、显式模型/ToolCalls、ToolUse 示例、聊天、ComfyUI |

## 实现与维护

- [架构与代码入口](architecture.md)：模块职责、数据流和执行边界。
- [开发与验证](development.md)：运行、测试、桌面交付、验收范围和未实现能力。
- [文档维护规则](documentation-guide.md)：如何更新设计、记录改动、标注状态和交接上下文。
- [修改日志](changelog/README.md)：按日期记录需求、原因、改动与验证；含重整前原文归档。

## 阅读与查找

理解产品先读 Planning 和数据模型；修改界面读对应页面与工作流编辑器；修改运行逻辑读对应功能契约和架构代码入口。查找“为什么改过、上次验证过什么”时进入修改日志。

[workflow-structure-update.md](workflow-structure-update.md) 仅保留旧链接入口，内容已归入工作流编辑器、工作流类型和模型设计。`Planning - 副本.md`、修改日志归档、测试 Markdown 样例及图标授权说明均有各自用途，不与当前设计并列。

- [UI 样式分类与复用](ui-styles.md)：家族基础、变体、旧类映射、主题颜色与验收入口。
