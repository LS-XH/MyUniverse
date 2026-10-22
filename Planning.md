# MyUniverse 总体设计

MyUniverse 把小说世界建模为按项目隔离的类、实例和递归成员。用户定义结构、编辑内容，并通过关系网、地图、Function、Tool 和 Agent 使用同一份对象。完整规范从 [文档目录](docs/README.md) 进入；本文件只维护产品全貌。

## UI

四个主入口为创作、插件、模型、设置。侧栏组织对象，顶栏展示路径和当前页面动作，主区编辑对象；页面会话保留滚动、搜索、选择和画布视角。界面使用语义主题颜色、共享控件家族与统一手势，树拖动预览与最终落点保持一致。

创作区包含实例与属性配置、只读 Markdown 差异预览、人物关系网、关系类型网、地图和聊天。Function/Tool 使用脚本编辑器，Agent/SD 使用工作流画布；ReAct 和高级 Agent 通过配置页使用应用生成的核心流程。详情见 [UI 模块](docs/ui/README.md)。

## 数据结构

Workspace 保存世界及全局配置，World 隔离导航、类文档、视图和聊天。ClassDocument 通过 FieldSchema 约束 Entity 的 FieldValue；实例、成员、绑定和来源使用稳定身份。世界成员类型、Function 类型值、工作流八型变量分别定义。

workspace.json 是世界及应用配置的权威恢复来源；Markdown、Schema 和视图文件用于显式交换。Skill 使用独立目录包，内存 Workspace.skills 不写入工作区 JSON。虚拟集合和文件夹只组织导航。格式与示例见 [数据模块](docs/data/README.md)。

## 功能

对象编辑自动存档 JSON，保存命令显式导出，刷新、导入、填入分别有明确范围和来源规则。绑定 Function 通过受限 void/add 契约扩展可重复结构；Tool 使用自由 JSON Schema，官方世界修改能力先生成提议供用户采纳。

工作流按依赖求值，使用惰性条件、顺序、内部循环及方法编排。模型只负责连接；Agent 负责策略、能力和执行，Skill 提供按需规则与专属工具。聊天固定 Agent 身份，支持流式过程、会话成员、插话、引用、用量和提问。SD 图交给外部 ComfyUI 执行。功能规则及调用方法见 [功能模块](docs/features/README.md)。

## 实现边界

外部技能下载与安装、插件发现安装、自动章节写作与插图归档、远程及对外 MCP、图片像素加工、完整 ComfyUI 前端布局导入尚未实现。通用工作流 Function 节点缺少 bindingPath，不能直接运行新 void 函数写世界。对象事务、Agent 记忆事务与磁盘单文件替换范围不同，详见 [架构边界](docs/architecture.md#提交与取消边界)。

源码导航见 [架构](docs/architecture.md)，开发和验收方法见 [开发指南](docs/development.md)。追加需求和历次验证放入 [日志](docs/changelog/README.md)，现行专题按对象章节更新。
