# 数据模型

类型声明入口：`src/model/types.ts`。本文件负责对象身份和结构；序列化见 [Markdown 与存储](markdown-sync.md)，执行类型见 [Function](functions.md) 和 [工作流类型](workflow-types.md)。

## 工作区与世界

| 对象 | 主要内容 | 职责 |
| --- | --- | --- |
| Workspace | worlds、activeWorldId、themes、models、functions、tools、pluginFolders、sdWorkflows、agents、sidebarTreeOrder | 全应用配置和逻辑组织 |
| World | id/name、nodes、documents、views、graph/map 兼容字段、chat | 隔离创作项目 |
| TreeNode | id/name、type、parentId、classId、viewType、protected | collection/file/view 导航，不保存实例内容 |
| ClassDocument | id/name/fileName、schema、entities、protected、labels、entityLabels | 一个类及其结构、实例和样式标签 |
| Entity | id/name、fields | 一个类实例 |
| FieldSchema | id、keyType/key、valueType、classId、children、repeatable、placeholder、functionIds | 成员声明与函数绑定 |
| FieldValue | id、schemaId、key/value、children、functionOrigin、functionRuns | 实例的具体成员数据 |

Workspace 中模型、函数、工具是注册对象，不复制到每个世界。引用和调用通过稳定 ID 解析。世界切换改变调用上下文，不改变这些对象的定义。

TreeNode.parentId 是集合组织；file.classId 指向类；view 的配置按节点 ID 查询 World.views。配置页是其附属入口，不是另一份内容对象。集合是虚拟目录，树移动不移动磁盘文件。

## 身份与路径

名称用于展示和精确名称查询，允许改名；ID 用于引用、同步、绑定和配置身份。脚本支持 ID/名称，但名称重名必须报错，不静默取首个。Markdown 不直接写入所有 ID；加载解析结合既有文档和 Schema 尽量恢复原身份。

FieldValue.schemaId 指向声明；重复成员共享 schemaId、各有自己的成员 id。选择具体成员使用实例下的成员 ID 路径，选择当前实例同构成员使用 Schema ID 路径。投影视图区分这两种路径，见 [绑定解析](interface-views.md#对象绑定)。

InstanceLabel 为 `{id,name,color}`，ClassDocument.labels 保存有序定义，entityLabels 为实例 ID → 标签 ID 的样式关联。一个实例使用一个标签颜色；改名不影响关联，复制实例可复制同类标签，删除定义清除对应关联。两者只保存在项目 workspace.json；Markdown 解析保留已有 JSON 样式，导出不添加标签标题、字段或颜色内容。

## 类与成员的类型

### Value

| 类型 | 语义 | 内容表示 |
| --- | --- | --- |
| Object | 固定 Schema 下的递归成员集合；可包含重复声明 | children，不是随意 JSON 属性 |
| Class | 当前世界内某类实例引用，classId 约束目标类 | Markdown 实例链接 |
| Data | 日期，保留既有类型名 | YYYYMMDD 文本 |
| Text | 短文本，可嵌入引用 | 字符串 |
| Content | 长正文，可嵌入引用 | 字符串，允许 Markdown |
| Integer | 整数 | 字符串存储，类型化读取时验证 |
| Decimal | 有限小数 | 字符串存储，类型化读取时验证 |
| Null | 无 Value，可形成只含 Key 的列表项 | 标题下无正文 |

普通 FieldValue.value 使用字符串；Object 的真实结构是 children。空内容与 Null 声明不同：空 Integer/Class 等可在类型化转换中变为 Null，空 Text/Content 仍是空字符串。

### Key

- Const：结构中定义的常量名，实例不能随意更改。
- Text：实例可编辑文本键；placeholder 保存提示，不将提示当真实 Key。
- Class：指向指定类实例的键，可用于“事件人物”等引用列表。

类结构保存在对应 schema.json；实例填写按结构同步。Object 子结构不是任意增删 JSON，新增与重复项由 Schema 的 repeatable 和 children 决定。# 引用输入和提示文本属于 UI 表达，详见 [页面 UI](ui-interactions.md)。

## 三种类型体系

| 层次 | 代表结构 | 使用场景 |
| --- | --- | --- |
| 世界对象 | FieldSchema + FieldValue + Entity | 文件内容、类约束、关系与视图 |
| Function 值 | TypedValue、TypedMember、FunctionContext | 固定 self/input 与类型化添加参数 |
| 工作流值 | StoredVariable、MessageValue、ImageValue、ToolsValue | 节点连线、变量引用与 Agent 记忆 |

TypedValue 使用世界 ValueType：Object 的 members 为数组并保留重复键，Class 保存 classId/entityId。工作流基础值 String/Number/Boolean 分别为原生值，封装值保留自己的 type/version。Function 节点显式完成桥接，不把 String 自动等同于所有世界文本/数字类型，也不把 Tools 身份等同于 Tool 返回内容。

## Function 上下文与生成成员

| 结构 | 主要字段 | 语义 |
| --- | --- | --- |
| FunctionContext | self:{classId,entityId}、input:TypedValue、bindingPath? | 调用实例身份、原始输入快照及具体 FieldValue ID 路径；void 调用需要绑定路径 |
| TypedValue / TypedMember | type、类型对应内容；Object.members 中的 schemaId、key、value | 显式类型信封；数组保留重复成员，schemaId 匹配已有声明 |
| FieldValue.functionOrigin | functionId、name、bindingFieldId | 添加成员的来源；函数和具体绑定成员 ID 决定所有权，名称用于来源提示 |
| FieldValue.functionRuns | functionId、name、input、source?、contextKey?、error? | 内部调度状态，不存返回值，不导出 Markdown 成员 |

生成成员仍是普通 FieldValue，但用户控件只读，保留独立 id 和既有 schemaId。新 Object 初始化的子成员继承来源。复制实例时重建递归成员 ID，并同步重映射 functionOrigin.bindingFieldId；不能把副本的所有权指回原实例。旧 functionResults 仅为历史读取兼容，工作区规范化清除，不作为新数据写出。

来源注释由 [Markdown 格式](markdown-sync.md#function-生成成员与来源元数据) 负责，添加范围、类型验证、调度与解绑清理由 [Function](functions.md) 负责。组织仍使用 JSON，世界内容文件保持平铺，不迁移已有 user 目录。

## 应用配置对象

FunctionScript 保存 id/name、language、code、folderId、flow、apiVersion、executionMode。新建项为 apiVersion=2、executionMode=void；可选 returnType 仅用于旧独立返回接口兼容，不是当前绑定函数的返回声明。ToolDefinition 保存执行方式、自由参数 Schema、描述、annotations、代码或 HTTP 请求配置；官方定义来自程序，不由 Workspace 覆盖。

ModelConnection 保存 URL、模型标识、密钥和可选参数/toolIds/agentIds，以及只用于聊天直连的 chatSystemPrompt。SDWorkflow 保存连接和 WorkflowGraph；AgentDefinition 保存图、初始变量、按 worldId/global 分隔的 memory，以及 enabled/callName/description/inputSchema/limits。图定义和运行观察状态分别管理。

Theme 保存语义颜色，预设 builtin 为只读。PluginFolder 按 section 维护 parentId；sidebarTreeOrder 维护插件文件夹与项的混合顺序，旧工作区可缺省。

InterfaceView 的 parentClassId 指定数据源类，bindings 指定显示来源；地图可配置，人物关系网固定为 people 并由程序推导路径。graph/map 保存布局与样式。完整投影结构由 [界面功能文档](interface-views.md) 负责。

## 聊天与修改建议

World.chat 保存 target:{kind:model|agent,id}、conversations 和 activeConversationId；旧 modelId/agent 仅兼容迁移。ChatMessage 保持 user/assistant 和旧 proposal，新增 run:{id,target,status,events,error?}。状态为 running/complete/error/cancelled/interrupted，未完成重启转 interrupted，不重放。过程事件保存调用树、顺序、轮次、文字、实际思考、能力结果和 proposal ID。Conversation.modelMessages 独立保存完整模型协议，不能由过程展示文字重建。更新定位稳定世界/会话/消息 ID，删除原会话不得写入其他会话。

建议保存原世界/类/实例 ID、修改前后 Markdown、Schema 签名以及 pending/saved/rejected 状态。内部 reason 字段用于显示说明，不是官方第九项 Tool 的输入参数。采纳按提议类型新增实例或匹配成员内容合并，保存真实前后快照以支持逆向回退，批量操作原子提交。详见 [官方 Tool 的确认流程](official-tools.md#修改建议与用户采纳)。

## 默认模板

模板入口：`src/model/templates.ts:createWorld`。每个世界生成自己的 Schema/成员身份；默认类 id 在世界内使用 people/relations/factions/places/events。默认类受保护，实例内容仍可编辑。

| 类名 / 文件 | 结构 |
| --- | --- |
| 人物 / 人物列表.md | 人物关系 Object：可重复 Class-人物 Key，含关系 Object（可重复 Class-关系 Key / Null Value）与可重复小故事 Content；人物势力 Object：Class-势力名称、Text 势力地位；Text 人物性格、人物喜好 |
| 关系 / 关系类型.md | Text 关系描述；Object 关系推理：可重复 Class-关系 Key / Class-关系 Value |
| 势力 / 势力列表.md | Text 势力地点；Object 势力活动：可重复活动名称，每项含 Class-地点活动地点、Text 活动频率、Content 活动内容 |
| 地点 / 地点列表.md | Content 地点描述 |
| 事件 / 事件列表.md | Object 事件人物：可重复 Class-人物 Key / Null Value；Content 事件内容、事件结果 |

默认导航包含世界观（势力、地点、地图）、人物（人物、关系网、关系类型）、事件（事件类）、章节、插图和聊天。旧模板通过兼容与规范化补全视图，不以迁移为理由移动用户磁盘文件。

## 数据生命周期

启动规范化工作区并读取文档 → UI/脚本在主程序对象上形成修改 → 公用校验与合并 → 统一保存。运行草稿、Agent 工作变量、画布会话和无效 Markdown 草稿都有自己的生命周期，不替代持久对象。模块连接和事务边界见 [架构](architecture.md)。

用户 ChatMessage.protocolBefore 可选保存发送前完整模型协议快照，用于编辑重发时恢复精确上下文并移除后续对话。旧消息无快照时只使用编辑位置之前已完成的纯文本历史，不尝试从界面过程重建工具协议。编辑聊天不会撤销已提交的 Agent 记忆或已采纳世界修改。

InstanceChangeProposal.baselineEntity 可选保存生成时实例快照，保留成员稳定身份，采纳时仅合并 before/after 中变更成员；旧建议无快照时从 before Markdown 恢复。冲突与唯一内容匹配规则见官方 Tool 文档。

InstanceChangeProposal.kind 为可选 modify/add（旧记录按 modify），新增实例提议 before 为空，baselineEntity 保存待创建实例身份。保存时记录 savedBefore/savedAfter 与有序 savedAt，支持冲突检查和逆向回退。保存/回退均持久化；回退成功状态返回 pending。

### 关系样式可见性

`GraphStyle.visible?: boolean` 在关系连线格式中控制关系类型是否参与显示，未设置视为 true。该状态保存在视图 JSON 的 `graph.lineStyles`，不会改变人物 Markdown 或结构类型。重复关系按值过滤后的首个可见引用用于样式选择；详细投影契约见 [个人关系网与格式可见性](interface-views.md#人物个人关系网与格式可见性)。个人网络布局与返回快照保存在页面会话中，不写入全图 `graph.positions`。

### Function 来源身份的 JSON 存储

生成成员的 `FieldValue.functionOrigin` 及绑定成员的 `functionRuns` 保存在工作区 JSON；不将 ID 索引、运行过程或执行状态导出到 Markdown。正文仅在生成成员标题末尾附加 `<!-- 函数名 -->`。读取以正文重建键、值、子成员和来源标记，JSON 辅助保持身份；没有身份记录时根据当前实例的绑定作用域重建，歧义报错。解绑和重算清理按函数 ID 与绑定成员 ID 配对执行，不按可见名称批量误删其他绑定。

## 手动持久化边界

全部界面操作先修改内存 JSON；设置、插件和模型也不自动保存。正文仅在启动及明确刷新时读取，保存只写当前对象，不读取或合并 Markdown。Ctrl+S/Ctrl+R 用于当前文件或配置，保存全部统一提交。函数提交和脚本保存请求不隐式写盘。未保存标记比较序列化内容与成功读写基线。完整规则见 [Markdown 与存储](markdown-sync.md#手动读写边界与版本基线)。
