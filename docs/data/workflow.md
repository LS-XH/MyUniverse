# 工作流图、变量与类型系统

本文件维护 Agent/SD 的数据契约。画布 UI 见 [工作流编辑器](../ui/workflow-editor.md)，基础 LLM/ToolCalls 的职责见 [模型与 Agent](../features/models-and-agents.md)。Function 的 TypedValue 独立，不能与此处信封混用。

## 数据层次

| 层次 | 内容 | 生命周期 |
| --- | --- | --- |
| WorkflowGraph | version=1、nodes、links、variableOrder、可选 scope | 持久图定义 |
| WorkflowNode | id/kind、x/y、settings、inputs/outputs、bindings、循环 body 等 | 类型、参数及布局 |
| WorkflowLink | id、from/output、to/input | 输出至输入有向关系 |
| Agent.variables | 初始变量声明和值 | 持久初始定义 |
| Agent.memory[worldId/global] | 最近成功的变量表 | 按世界持久记忆 |
| 执行缓存与变量副本 | 每节点结果、命名输出、工作变量 | 一次运行 |
| 选择、连接、历史、观察 | 编辑/运行状态 | 页面临时状态 |


循环持有 WorkflowNode.body（scope=loop）并仅在该图内连线；方法体持有于变量池 Method 值的 graph（scope=method）。内置 break/continue 或方法返回使用稳定节点 ID，复制循环递归重建内图节点和线身份，复制方法卡片保留方法变量身份。编辑这些定义仍保存于 workspace.json，不写世界 Markdown。

Graph 的求值、循环与记忆提交见 [工作流执行](../features/workflow-execution.md)。

## 类型信封与端口值

变量表按名称索引，持久化为 `{id?,type,value}`。新变量有稳定 ID；端口传 value，不传外层信封。

```json
{
  "title":{"id":"v1","type":"String","value":"下一章"},
  "count":{"id":"v2","type":"Number","value":3},
  "enabled":{"id":"v3","type":"Boolean","value":true},
  "history":{"id":"v4","type":"Messages","value":{"type":"Messages","version":1,"items":[]}},
  "cover":{"id":"v5","type":"Image","value":{"type":"Image","version":1,"url":""}},
  "tools":{"id":"v6","type":"Tools","value":{"type":"Tools","version":1,"toolIds":["builtin:list_classes"]}}
}
```

| 类型 | 端口 | 默认值与校验 |
| --- | --- | --- |
| String | STRING | 空字符串；只能 string |
| Number | NUMBER | 0；有限 number |
| Boolean | BOOLEAN | false；只能 boolean |
| Messages | MESSAGES | 空 items；角色与工具配对校验 |
| Image | IMAGE_OBJECT | 空 url；版本化资源引用 |
| Tools | TOOLS | 空 toolIds；唯一、非空注册 ID 数组 |
| Agents | AGENTS | 空 agentIds；唯一、非空 Agent 注册 ID 数组 |
| Method（方法） | 方法卡片为 ANY 控制桥；定义本身不作为业务端口值 | 默认带完成返回的 method 图，无参数或业务返回 |

禁止新建 ANY 变量。同名变量节点必须声明相同类型，运行前拒绝冲突。Number 可与 INT/FLOAT 兼容，但不将字符串、NaN/Infinity 当有效值。Tools、Agents 输入均严格拒绝 ANY 和其他身份类型，不能互相冒充。ANY 仅保留执行依赖、通用/旧接口和 SD 桥接等明确用途。

## 统一读写节点

kind=variable，settings.variableType 声明类型，settings.name 索引变量，variableId 保持绑定身份；value 输入/输出同型，after 是依赖。

- value 无连接、无本地字面量、无输入引用：读取当前工作变量，缺省取声明默认值。
- value 有连接、本地 port:value 或引用：校验后写入工作变量，再输出新值。
- 移除字面量可切换为读取；断开连接后按剩余输入状态决定。
- 方法计算新值，属性读取信息，不暗中改变持久变量。仅显式接入变量 value 或绑定输出才保存到运行副本。
- 复制变量卡片保留变量名，访问同一变量；要独立状态必须建立独立定义。

初始变量与当前 worldId/global 的已提交 memory 合成为工作副本。执行器返回结果与变量，由调用页在整次成功后提交 memory；失败/取消不提交局部记忆。已发生的 Tool 世界写入、网络请求和图片保存有各自边界，不回滚这些外部效果。

## 变量池与稳定身份

池维护稳定 id、可改 name、声明 type 和初始 value。新建、改名、改类型、改初始值、删除、清空、排序与绑定节点修改纳入编辑事务。

改名按 ID 更新节点、内嵌引用与各世界 memory；改类型同步变量 value 端口，能校验的值保留，不兼容恢复默认。既有连接保留，让校验明确报告类型错误。旧原生 string/number/boolean 可识别基础类型，复杂对象不猜测。

graph.variableOrder 保存池顺序的稳定 ID，不依赖对象数字键排序。删除移除定义、同名变量节点、关联线、引用和各世界记忆。清空恢复声明默认；修改初始值和清空同步重置已有世界值，避免旧记忆覆盖用户操作。清空事务携带临时 resetNames，即使默认值未变化也执行重置，该指令不持久化为图定义。

初始值与本次工作值在 UI 区分，运行中禁止编辑定义。池 UI 和排序动画见 [工作流编辑器](../ui/workflow-editor.md)。

方法图与循环图中的变量节点、绑定引用，改名、改类型和删除都按稳定变量 ID 递归更新；方法声明保留在变量池，多处调用共用其图。清空所有值跳过 Method 定义，避免把函数体当运行数据丢弃。

## 端口变量引用

WorkflowNode.bindings 用 `in:端口` / `out:端口` 保存 `{variableId,name,output?}`。入端口绑定读取变量，出端口绑定写入；语义配对入端口携带 output，执行完成后写回，表达引用传递。

配对由 workflowBindings.pairedOutput 定义：variable 的 value、更新同一主体的 valueMethod 的 self 可在输出 value 同型时配对。基础 LLM 输入完整上下文、输出 assistant 响应；ToolCalls 输入带请求的上下文、输出工具结果片段，均必须分行。Tools.get、Agents.get、Image.fromUrl/fromSD 是创建新对象，也不与 self 配对。Messages.user/merge 等输出更新后的完整上下文仍配对；Messages.count 的 Number 输出分开。类型一致只是必要条件，不能代替语义一致。

旧图迁移将上述分离节点的输入绑定移除 output 隐式写回字段，保留变量身份、独立输出绑定和连线。不自动把输入引用搬到输出引用，避免覆盖完整上下文；保存新结果需明确接出端口。

输入引用与连线共存：有线时先严格校验并写入绑定变量，再把同一值交给节点；无线时读取绑定变量，再沿用字面量/默认值。语义配对输入在完成后继续自动写回；独立输出绑定校验并更新变量，同时向所有下游传值。绑定、拖入、连线保留已有另一种关系，断线保留引用，解绑保留线。执行按稳定 ID 查变量，名称只用于同步与显示；需要明确数据链、顺序执行或兼容 after 保证副作用顺序。

拖动临时填入不写 bindings；有效释放才绑定。拖出引用移除绑定并生成对应变量节点，池定义保留。图移入/移出和撤销不直接修改世界对象。

## 方法与属性目录

kind=valueMethod/valueProperty；variableType 和 member 定义身份。self 接收所属类型，arg 按方法声明，value 为明确结果类型。

| 类型 | 属性 | 方法 |
| --- | --- | --- |
| String | 长度 | 首尾去空白、大/小写、追加、包含 |
| Number | 当前无专用属性 | 绝对值、四舍五入、向下取整、增加、小于、相等 |
| Boolean | 当前无专用属性 | 取反、与、或 |
| Messages | 存在待执行调用（Boolean）、数量、最后一条文本、待调用 JSON、下一个调用 ID/名称/参数 | 添加 system/user/assistant、ToolUse、工具返回、合并、清空、保留最近轮次 |
| Image | url、filename、width、height | 从 URL 建立、从 SD 结果取图、显示、保存 |
| Tools | 数量、说明与参数 JSON | 获取注册 Tool、合并去重集合、调用单个 Tool |
| Method | 无 | 调用内部无参图；无业务返回值 |
| Agents | 数量、说明与参数 JSON | 获取注册 Agent、合并去重集合、调用单个 Agent |

成员目录是类型的固定功能，不按卡片实例随意改名。Method 与这里的 valueMethod（类型的内置计算方法）不同：Method 是用户自定义无参程序图，无类型成员目录。方法/属性图标、目录和端口展示由工作流 UI 负责。

## Messages

```ts
interface MessageValue {
  type: 'Messages'; version: 1;
  items: ContextMessage[];
  fragment?: 'toolResults';
}
interface ContextMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string; name?: string;
}
interface ToolCall {
  id: string; type: 'function';
  function: { name: string; arguments: string };
  mcp?: { server: string; tool: string };
}
```

arguments 是有效 JSON 字符串。tool_calls 仅在 assistant，调用 ID 唯一；role=tool 对应一个先前尚未返回的 tool_call_id，不允许孤立和重复结果。mcp 保留来源信息，模型发送只包含标准调用字段，不将内部元数据传给兼容接口。

完整 Messages 可以保留尚待执行调用供 ToolCalls 处理；基础 LLM 请求前必须完成配对。ToolCalls 输出 `{fragment:'toolResults'}` 的 role=tool 片段，唯一调用 ID、字符串结果，无 assistant。该片段不能直接作为完整模型输入，要用 Messages.merge 与原 ToolUse 合并再校验。

trim 按 user 开始的完整轮次保留最近 N 轮，保留此前 system，不能按条数切断工具请求/返回。lastText 当前读取最后一项 content，空/null 返回空字符串，不扫描任意旧 assistant 文本。

系统词、用户词、助手和工具交流由 Messages 显式编排与保存。当前不含多模态 content parts 和各供应商专有字段；LLM/工具职责见 [模型与 Agent](../features/models-and-agents.md)。

## Image

```ts
interface ImageValue {
  type: 'Image'; version: 1; url: string;
  filename?: string; width?: number; height?: number; mimeType?: string;
}
```

允许 HTTP(S)、data:image 和 blob 引用，width/height 为非负有限元数据，未知属性读为 0。空 url 用于未初始化，显示/保存时报错。IMAGE_OBJECT 是资源对象，不等于 ComfyUI IMAGE Tensor；需要服务加载节点/桥接，不直接冒充张量。

URL 方法只封装引用，不自动下载/上传；fromSD 从服务返回数组按 index 取图片。显示在运行结果中渲染；保存下载后返回原 Image，浏览器下载、桌面写 user/images。文件名不接受路径、同名不覆盖，后端以 create_new 拒绝竞争覆盖。API Key 不存图片对象，blob 不适合作永久记忆。

尚无像素解码、尺寸探测、裁剪、缩放；资源节点不自动继承 SD 密钥。

## Tools

```ts
interface ToolsValue {
  type: 'Tools'; version: 1; toolIds: string[];
}
```

只保存统一注册表 ID，不复制脚本、配置或密钥。执行时解析官方/用户 JS/HTTP Tool；缺失、停用、重名调用明确报错。get 返回单项集合，merge 返回去重的新集合；execute 必须只有一个工具，arg 为参数 JSON 字符串，输出 STRING 结果。工具返回内容不携带 Tools 身份。

新 Agent“调用 Tool”服务卡片 tool:TOOLS、input:STRING、value:STRING；未接工具时可选注册 Tool，不再新建内联 HTTP。基础 LLM 使用 tools:TOOLS，不接即无工具；自动兼容卡片可沿用模型注册项。配置、自由参数与注册规则见 [脚本与 Tool](../features/tools.md)。

## Agents

封装为 `{type:'Agents',version:1,agentIds:string[]}`，只保存稳定注册 ID。默认空集合，get 取单项、merge 去重、count 和 metadata 读取数量/调用说明与参数 JSON，execute 要求集合恰好一个 Agent，arg 为 JSON 参数文本，返回可传输结果文本。Tools 与 Agents 保持独立类型，接入 LLM 时才统一转为 function 描述；同次请求调用名必须唯一。

## 兼容与迁移

Tool 旧类型统一迁移为 Tools，包括信封、封装值、variableType、TOOL 端口和端口本地 JSON；具体 Tool 定义、ID、MCP 调用名不变。workflowMigration 只用于工作流定义/记忆，不改世界正文及自由参数。

旧 getVariable/setVariable 不再出现在新节点库，仍可运行；用户显式选择类型迁移，保留卡片 ID、位置、名称、连线。基础旧值校验后封装，复杂 JSON 不猜类型；旧消息数组需转换为 Messages。旧 HTTP 节点保留原参数/返回兼容，新节点使用明确 Tools。

旧 title 留在序列化兼容，但展示、轨迹及错误使用类型固定名称。图版本仍为 1；加载规范化、编辑和执行均遵守迁移与校验。迁移不能自动清空用户内容或重命名变量。

## 代码入口与验证

workflowValues.ts：类型和值/成员；variablePool.ts：定义与记忆协调；workflowBindings.ts：端口引用；workflowMigration.ts：旧标签；workflows.ts：图校验；services/workflows.ts：运行工作副本；workflowTools.ts/workflowImages.ts：适配。

重点验证严格类型、同名冲突、显式读写、引用配对、改名/清空/删除、世界隔离、失败不提交及工具调用 ID。验收方法见 [开发与验证](../development.md)，具体历次结果见 [修改日志](../changelog/README.md)。

