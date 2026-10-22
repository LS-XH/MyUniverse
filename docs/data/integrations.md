# 模型、Agent 与插件配置数据

声明来自 [types.ts](../../src/model/types.ts)，这些配置全局注册，以稳定 ID 在不同世界使用；世界内容见 [world.md](world.md)。运行规则分别见 [Function](../features/functions.md)、[Tool](../features/tools.md)、[模型](../features/models.md)、[Agent](../features/agents.md)。

## 注册对象

| 对象 | 关键字段 | 存储与引用 |
| --- | --- | --- |
| FunctionScript | id/name、language:js/py/flow、code、flow?、apiVersion?、executionMode?、returnType?、folderId? | workspace.functions；Schema.functionIds 指向它；新建 apiVersion=2、executionMode=void，returnType 为旧接口兼容 |
| ToolDefinition | id/name、kind:js/http/builtin、callName/description/inputSchema/annotations、role?、enabled、code 或 url/method/apiKey/bodyMode、folderId | workspace.tools；Skill 专属 Tool 存技能包；ToolsValue 仅引用 ID |
| ModelConnection | id/name/model/baseUrl/apiKey/enabled、modelsUrl/chatUrl、reasoningEffort/temperature/topP/maxTokens/timeoutSeconds/extraBody、inputPrice/cachedInputPrice/outputPrice/priceCurrency、folderId | workspace.models；图 settings.modelId 引用；价格为每百万 Token 单价 |
| SDWorkflow | id/name、baseUrl/apiKey/timeoutSeconds、graph、variables?、folderId | workspace.sdWorkflows；graph 为 WorkflowGraph |
| AgentDefinition | id/name、agentType、preset?、config?、graph/variables/memory、enabled/callName/description/inputSchema/limits、folderId | workspace.agents；Conversation.target 或 AgentsValue 引用 |

Tool annotations 包含 title、readOnlyHint、destructiveHint、idempotentHint、openWorldHint。自带 Tool 实现来自应用注册表，工作区只允许覆盖 description 与 folderId，不允许存档替换其名称、调用名、Schema 或实现。

## Agent 类型、配置与记忆

agentType 为 workflow/react/advanced；preset 为 react/advanced/roleplay，表示应用生成的核心及特化。Workflow 保存可编辑图；预置核心运行前通过 presetDefinition 生成稳定的节点/变量 ID。

`AgentConfig = {systemPrompt,toolIds,agentIds,skillIds,maxRounds,manageAgents?,startupSkillIds?,toolFolderIds?,skillFolderIds?,capabilityDefaultsVersion?}`。skillIds 是自主许可范围，startupSkillIds 必须为其子集；用户强制技能是调用级配置，不永久改写它。config 的作用和工具权限见 [Agent](../features/agents.md)。

variables 为初始变量池；memory 是 scope → 变量池，其中 scope 为 worldId 或 global。预置 Agent 的会话协议存在 Conversation，不用共享 memory 保存聊天历史。limits 可设置 depth/nodes/calls；默认值和事务见 [执行边界](../features/workflow-execution.md)。

## 组织与主题

PluginFolder 使用 section=skills/functions/tools，ModelFolder 使用 section=llm/sd/agents；二者均保存 id/name/parentId，各条目通过 folderId 归属。Workspace.sidebarTreeOrder 保存跨目录项的持久排序键，未排序对象保留原有顺序；禁止跨分类移动或形成目录循环。虚拟文件夹不会改变物理保存目录。

Theme 保存 id/name/colors/builtin?；ThemeColors 的语义键、ARGB 与共享 CSS Token 见 [主题与样式](../ui/styles.md)。自带主题只读，自定义主题保存于 workspace.themes。

SkillDefinition 是独立包在内存中的目录，包含 id/name/description/content/enabled/directory、folderId、tools/references/assets/diskError。完整物理格式见 [Skill 包](skills.md)，workspaceArchive 会剥离 Workspace.skills。

## 兼容与一次性标志

| 字段 | 当前含义 |
| --- | --- |
| archiveVersion=2 | JSON 权威存档版本，桌面首次升级保留旧存档备份 |
| agentInstancesInitialized | 默认 ReAct/高级实例已初始化；删除后不重建，roleplay 系统实例仍由规范化保障 |
| systemSkillVersion=6 | 标准包与出厂创建器升级进度；仅匹配原出厂内容时升级，保留定制与删除 |
| toolCatalogVersion=2 | 删除九项旧工具与旧目录，保留并提升用户自建内容 |
| toolUseTemplateInstalled | 旧示例安装兼容状态，不代表新工作区自动安装示例 |
| World.relationGraphInstalled | 关系类型网默认安装状态，防止删除后重复补入 |

旧 ModelConnection 的 toolIds/agentIds/chatSystemPrompt 在 normalizeAgentModels 中迁到独立 Agent；旧自动 LLM 节点先固化能力配置。保留对象身份与会话引用。旧 Function 返回类型、旧 Tool/变量信封及循环回边的处理分别由所属专题维护。

AgentConfig.toolFolderIds / skillFolderIds 保存按目录选择，capabilityDefaultsVersion=1 记录默认能力首次初始化。运行时展开目录为具体身份并去重，子成员显式清空目录许可避免继承管理者默认组。ToolDefinition.role 可为 read/write/ask/action；应用项按固定语义确定，自建项可配置，readOnlyHint=false 同样进入写入确认。
