# 世界对象与类实例

类型声明入口：[types.ts](../../src/model/types.ts)。本文件负责对象身份和结构；存储布局见 [JSON](json-storage.md)，正文格式见 [Markdown](markdown.md)，执行类型见 [Function](../features/functions.md) 和 [工作流类型](workflow.md)。

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

TreeNode.parentId 是逻辑树组织；file.classId 指向类；数据视图的 parentId 指向对应源文件节点，配置按视图 ID 查询 World.views。视图与其配置在源文件下并列显示，配置使用同一视图 ID 和 config 选择状态，不创建第二份内容对象或 Markdown。集合是虚拟目录，树移动不移动磁盘文件。

## 身份与路径

名称用于展示和精确名称查询，允许改名；ID 用于引用、同步、绑定和配置身份。脚本支持 ID/名称，但名称重名必须报错，不静默取首个。Markdown 不直接写入所有 ID；加载解析结合既有文档和 Schema 尽量恢复原身份。

FieldValue.schemaId 指向声明；重复成员共享 schemaId、各有自己的成员 id。选择具体成员使用实例下的成员 ID 路径，选择当前实例同构成员使用 Schema ID 路径。投影视图区分这两种路径，见 [绑定解析](views.md#对象绑定)。

对象操作界面的属性筛选按实际成员 Key 收集递归选项，相同原始 Key 合并为一个条件，Value 使用原始值精确匹配，引用解析名称只用于显示。`AttributeFilter` 为页面会话中的 `{key,value?}`，缺省 value 表示所有值，空字符串则匹配实际空值。运行时匹配结果只保存可见成员 ID 集合，保留祖先及匹配对象子树，不裁剪或复制源字段用于写回；FieldEditor 通过 visibleIds 控制渲染，所有编辑回调仍持有完整原始字段。生成值隐藏开关先移除生成来源子树再匹配。实现见 [attributeFilter.ts](../../src/model/attributeFilter.ts)。

InstanceLabel 为 `{id,name,color}`，ClassDocument.labels 保存有序定义，entityLabels 为实例 ID → 标签 ID 的样式关联。一个实例使用一个标签颜色；改名不影响关联，复制实例可复制同类标签，删除定义清除对应关联。两者只保存在项目 workspace.json；Markdown 解析保留已有 JSON 样式，导出不添加标签标题、字段或颜色内容。

## 类与成员的类型

### Value

| 类型 | 语义 | 内容表示 |
| --- | --- | --- |
| Object | 固定 Schema 下的递归成员集合；可包含重复声明 | children，不是随意 JSON 属性 |
| Class | 当前世界内某类实例引用，classId 约束目标类 | JSON 内部保存实例链接，Markdown 展示纯名称 |
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

类结构随 ClassDocument.schema 存入 workspace.json，显式导出另写对应 schema.json；实例填写按结构同步。Object 子结构不是任意增删 JSON，新增与重复项由 Schema 的 repeatable 和 children 决定。引用输入和提示文本属于 UI 表达，详见 [页面 UI](../ui/pages.md)。

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

纯文本展示与来源保留规则由 [Markdown 格式](markdown.md#function-生成成员与来源元数据) 负责，添加范围、类型验证、调度与解绑清理由 [Function](../features/functions.md) 负责。组织仍使用 JSON，世界内容文件保持平铺，不迁移已有 user 目录。

functionOrigin 与 functionRuns 只保存在工作区 JSON，不将内部索引或过程导出到正文。无来源标记的填入与身份匹配见 [Markdown 生成成员](markdown.md#function-生成成员与来源元数据)，所有权清理按函数 ID 与绑定成员 ID 配对，见 [绑定生命周期](../features/functions.md#显示来源和绑定生命周期)。

## 应用配置与投影

FunctionScript、ToolDefinition、ModelConnection、AgentDefinition、虚拟目录与迁移标志统一见 [模型与插件配置](integrations.md)。SkillDefinition 是独立包的内存目录，文件格式见 [Skill 包](skills.md)。InterfaceView 的绑定与布局见 [视图数据](views.md)。

## 默认模板

模板入口：`src/model/templates.ts:createWorld`。每个世界生成自己的 Schema/成员身份；默认类 id 在世界内使用 people/relations/factions/places/events。默认类受保护，实例内容仍可编辑。

| 类名 / 文件 | 结构 |
| --- | --- |
| 人物 / 人物列表.md | 人物关系 Object：可重复 Class-人物 Key / Object Value，其中关系 Object 包含可重复 Class-关系 Key / Null Value，人物关系小故事 Object 包含可重复 Text-小故事名称 Key / Content Value；人物势力 Object：Class-势力名称、Text 势力地位；Text 人物性格、人物喜好 |
| 关系 / 关系类型.md | Text 关系描述；Object 关系推理：可重复 Class-关系 Key / Class-关系 Value |
| 势力 / 势力列表.md | Text 势力地点；Object 势力活动：可重复活动名称，每项含 Class-地点活动地点、Text 活动频率、Content 活动内容 |
| 地点 / 地点列表.md | Content 地点描述 |
| 事件 / 事件列表.md | Object 事件人物：可重复 Class-人物 Key / Null Value；Content 事件内容、事件结果 |

默认导航包含世界观（势力、地点、地图）、人物（人物、人物关系网、关系类型）、事件（事件类）、章节、插图和聊天。旧模板通过兼容与规范化补全视图，不以迁移为理由移动用户磁盘文件。

默认模板同时创建人物关系网和关系类型网；旧世界首次规范化安装关系类型网，World.relationGraphInstalled 标记完成，后续删除不自动恢复。

## 生命周期

JSON 启动加载 → 对象编辑/脚本事务 → 自动 JSON 存档；保存键显式导出 Markdown，导入 MD 按配置填入普通值，刷新键读取当前 MD 更新 JSON 并保留原有函数来源。Agent 工作变量、无效源码草稿和页面会话分别维护，不代替持久对象。完整读写规则见 [草稿、保存与刷新](../features/persistence.md)。聊天对象见 [聊天数据](chat.md)，视图对象见 [视图数据](views.md)。
