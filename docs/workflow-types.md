# 工作流编辑与严格类型变量

更新：2026-10-09。本文件是 Agent / SD 的变量与上下文设计规范；Function Flow 复用画布编辑交互，仍使用自己的 Function 编译和返回契约。

## 设计原则

变量是具有明确类型的程序对象，不是把任意 JSON 放在一个 ANY 容器中。变量的读和写是同一个节点的两个状态：可以接受新值，也可以输出当前值。方法节点操作该类型的值，属性节点读取值的成员；它们与变量节点分别承担计算和保存状态的职责。

Messages 和 Image 是封装类型。它们的结构必须保留语义，不能通过 stringify 混同为普通 String。模型卡片负责一次调用；上下文的构造、裁剪、工具调用配对和跨运行保存由显式节点完成。图中每条线既表示数据来源，也决定执行依赖。

UI 保持画布为主要工作区。节点库沿用侧栏的文件夹树、缩进线与右侧展开箭头；辅助操作使用紧凑工具栏，不通过大标题挤压画布。

## 数据层次

| 层次 | 保存内容 | 生命周期 |
| --- | --- | --- |
| WorkflowGraph | version=1、nodes、links | 持久化工作流定义 |
| WorkflowNode | id、kind、title、x/y、settings、inputs/outputs | 定义与布局 |
| WorkflowLink | id、from/output、to/input | 始终保存输出到输入的有向关系 |
| Agent.variables | 用户配置的初始变量 | 运行的初始状态 |
| Agent.memory[worldId 或 global] | 最近成功运行的变量表 | 按世界隔离的持久状态 |
| 执行 cache / outputs | 每个节点的计算结果与命名输出 | 一次运行内共享计算 |
| selection / connection / history | 节点与连线 ID、待连接端点、编辑快照 | 当前编辑页的临时交互状态 |

变量表按名称保存带类型的信封，而图上端口传递类型对应的值：

```json
{
  "title": {"type":"String","value":"下一章"},
  "count": {"type":"Number","value":3},
  "enabled": {"type":"Boolean","value":true},
  "history": {"type":"Messages","value":{"type":"Messages","version":1,"items":[]}},
  "cover": {"type":"Image","value":{"type":"Image","version":1,"url":""}}
}
```

外层 type 表示变量声明；内层 Messages/Image 是独立可传递的封装值。这样变量、方法参数、函数返回桥接和持久化层不会混淆。String/Number/Boolean 的端口值分别是 JS string、有限 number、boolean。Messages/Image 的端口值是下文定义的对象。Function 的 Text/Object/Class 等原有 TypedValue 契约保持独立，通过现有 Function 节点显式调用，不把这两套类型自动混为一体。

新变量默认使用带随机后缀的独立名称。复制卡片保留名称，因此复制变量卡片会访问同一份变量；需要独立状态时修改名称。同名新变量节点必须声明相同类型，运行前会拒绝冲突。

## 合并读写的变量节点

kind=`variable`，settings.variableType 是 String/Number/Boolean/Messages/Image，settings.name 是存储身份。value 输入和 value 输出使用同一种具体端口类型，after 是只承担顺序约束的执行依赖。

- value 没有连线且未设置字面量：读取变量；不存在时使用该类型默认值。
- value 有连线或存在 `settings["port:value"]`：校验并写入，再输出写入值。
- 设置过字面量后可点“切换为读取”移除它；断开 value 连线后恢复读取。
- after 先求值，随后才读取或写入，可用于确保另一张变量卡片的保存先完成。
- 方法节点返回新值，不暗中修改已保存变量。把新值接到变量的 value 才会保存。
- 执行在初始变量/当前世界记忆的克隆上进行；只在整次 Agent 成功后由页面提交记忆。失败不部分覆盖原记忆。网络、图片保存等外部副作用不属于这个内存事务。

默认值：String 空字符串；Number 0；Boolean false；Messages 空 items；Image 空 url。空图片可作为未初始化状态，显示/保存时会明确报错。

## 校验与兼容

新变量和成员节点在连接时比较具体端口类型。NUMBER 可与 INT/FLOAT 对接，但运行仍必须是有限数字；错误字符串、NaN、Infinity、不匹配布尔等不自动转换。旧通用或服务 ANY 输出允许接入桥接节点，实际值在执行时严格检查。ANY 仅用于执行依赖、旧节点兼容、工具服务接口和 SD 数组桥接，不再作为新变量的类型。

旧 getVariable/setVariable 保留读取能力以避免旧项目突然失效，但不再出现在节点库。打开旧卡片可选择“迁移为类型变量”：保留 id、位置、名称与原连线，改为同一个双向节点，并明确选择类型。既有基础原始值第一次经类型节点读取时校验并装入信封；复杂旧 JSON 不猜类型，需要用户整理为 Messages/Image 结构。旧读取节点遇到新信封会取 value；旧写入节点写入新信封时也必须通过已有声明的类型校验。

不自动改变已有变量名称或清空用户数据。迁移前后仍需通过运行检查；旧 Messages 数组需要转换成封装对象再接入新的类型方法。

## 方法与属性

kind=`valueMethod` / `valueProperty`；settings.variableType、settings.member 确定所属类型和成员身份。self 输入接收该类型的值，arg 输入只在方法需要参数时出现，value 输出使用方法声明的结果类型。

| 类型 | 属性 | 方法 |
| --- | --- | --- |
| String | 长度 | trim、upper、lower、追加、包含 |
| Number | — | abs、round、floor、增加 |
| Boolean | — | not、and、or |
| Messages | 消息数、最后文本、待执行工具 JSON、下一个工具 ID/名称/参数 JSON | 添加 system/user/assistant、添加 ToolUse、添加工具返回、合并、清空、按用户轮次保留最近上下文 |
| Image | url、filename、width、height | 从 URL 建立、从 SD 数组取指定图片、显示、保存 |

属性也是独立节点，可参与连线。方法从输入值计算新值；不存在隐式共享对象突变。

## Messages 结构与工具调用

```ts
interface MessageValue {
  type: 'Messages';
  version: 1;
  items: ContextMessage[];
}
interface ContextMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}
interface ToolCall {
  id: string;
  type: 'function';
  function: {name: string; arguments: string};
  mcp?: {server: string; tool: string};
}
```

工具 arguments 是有效 JSON 的字符串，不是直接嵌入的原生对象。调用 ID 必须唯一；tool_calls 只允许在 assistant 中；tool 消息必须匹配之前尚未返回的 tool_call_id，不能孤立或重复返回。mcp 字段保留来源服务器与工具名，供后续调度使用；发送兼容模型请求时只传标准 tool_calls 字段，不把内部 MCP 来源元数据发送给模型接口。当前实现保存和传递该上下文，尚未提供 MCP 服务器连接与自动工具循环；已有 HTTP Tool 节点可执行显式接入的工具服务。

LLM 保留兼容的 value:STRING 文本输出，新增 messages:MESSAGES 输出，保存本次完整 assistant 消息（包括 content=null 的工具请求和 tool_calls）。聊天的 callLLM 文本接口继续可用；工作流通过 callLLMMessage 获取结构化消息。模型的附加请求 JSON 可携带兼容服务要求的 tools 配置。

推荐一次对话的显式数据流：

1. Messages 变量读取历史 → 添加用户消息（必要时先添加 system）。
2. 新历史连接 LLM.context，prompt 留空，避免重复追加同一用户输入。
3. 新历史与 LLM.messages 连接“合并消息上下文”。
4. 若助手请求工具，从下一个工具 ID/名称/参数属性读取信息，显式调用工具。
5. 将工具输出作为文本接入“添加工具返回”的 arg，工具 ID 接入 callId，名称可接入 toolName。这两个值可连线，也兼容卡片内设置。
6. 完整历史接下一次 LLM.context；最终合并并接变量 value 保存，通过返回 after 确保保存执行。

裁剪按 user 开始的完整轮次保留，并保留之前的 system；不会仅按数组条数随意切断 assistant ToolUse 与 tool 返回。待处理调用允许存在于 Messages 中，以便工具步骤继续执行；发送给真实服务的完整工具交流仍需按服务协议编排。

兼容消息协议参考：[Chat Completions API](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)。未加入多模态 content parts、流式输出、自动循环与所有供应商的专有消息字段。

## Image 结构与资源职责

```ts
interface ImageValue {
  type: 'Image';
  version: 1;
  url: string;
  filename?: string;
  width?: number;
  height?: number;
  mimeType?: string;
}
```

Image 封装值使用 IMAGE_OBJECT 端口，与 ComfyUI 的原生 IMAGE 张量端口明确区分；资源引用不能直接冒充服务器张量输入，需要 ComfyUI 的加载/转换节点或专用接口桥接。允许 HTTP(S)、data:image、blob 资源，不执行任意 URI。URL 建立节点只封装资源引用，不自动上传或下载；SD 桥接节点从现有图片描述数组按 index 取图片。width/height 读取已有元数据，未知时为 0，尚不提供像素解码、尺寸探测或裁剪缩放。

显示节点的输出在运行记录中渲染为图片；不弹出另外的窗口。保存节点下载图片后保留原 Image 返回值：浏览器使用下载，桌面写入当前 user/images。文件名不接受路径；已存在同名文件不覆盖，明确报错。原生保存命令检查 user 内目录范围，使用 create_new 防止覆盖竞争。保存路径不进入变量值，也不在图片对象中存储 API Key。需要鉴权的图片服务应提供可访问资源或通过已有服务流程取得 data URL；新 Image 节点不自动继承 SD 的接口密钥。blob URL 只在当前浏览器生命周期有效，不适合作为跨启动记忆的永久地址。

## 编辑交互

Agent、SD、Function Flow 共用 useCanvasEditing/useGraphEditing：

| 操作 | 行为/快捷键 |
| --- | --- |
| Shift + 空白拖动 | 矩形框选相交卡片，坐标按当前 pan/scale 还原 |
| Ctrl + 点击卡片 | 加入/移出选择；Ctrl+Shift 框选与已有集合合并 |
| 拖动任意已选卡片标题 | 同时移动整组，保持相对位置 |
| 空白拖动 / 单击 | 移动视角并保留选择 / 清除选择 |
| 复制/粘贴/剪切 | Ctrl+C / Ctrl+V / Ctrl+X；工具栏提供同样按钮 |
| 撤销/重做 | Ctrl+Z / Ctrl+Y；最多 100 个图快照 |
| 删除 | Del 删除选中节点或连线；关联线一并移除 |
| 节点库 | Tab 或 PanelRight 按钮 |
| 连接 | 点击两端或从任一端拖线，Esc 取消 |

完整一次拖动是一个历史步骤，持续指针移动不会产生上百次撤销记录。复制保留所选节点内部的连线，丢弃通向未复制节点的线；粘贴生成新的节点与线 ID，并每次偏移 36 个世界坐标单位。变量名称保持不变。输入/返回也可以复制删除，运行前仍须满足各图类型的入口/出口契约。

剪贴板为带 myUniverseGraphClipboard 标记的 JSON，优先使用同一应用的复制缓存，并尽力写入系统剪贴板；系统读取仅接受相同图族和有效图结构。Agent/SD 共用 workflow 图族，Function Flow 是独立图族，不混粘两套 schema。文本框和代码编辑器获得焦点时，快捷键保留文字编辑语义，Tab 也不劫持文本输入。

临时连接端点为 {id,port,direction}，无论从 input 还是 output 起笔，都规范为 WorkflowLink 的 from/output → to/input；同方向端口、自连接、环和重复输入按图校验拒绝。拖线显示透明预览，松手在相反端口才提交，空白松手不产生孤立边。

## UI 与图标

工具栏和节点库 header 使用同一 44px 高度，位于同一顶边；节点库保留滑入滑出动画。树行采用统一字号、无边框背景、缩进竖线和右对齐箭头。新增编辑动作以图标按钮出现在工具栏右侧。

String/Number/Boolean 图标分别采用 codicon:symbol-string、ix:data-type-integer、at-icons:boolean，SVG 本地保存，无运行时网络依赖。方法 SquareFunction，属性 FileBox，文件夹 Folder，运算/文字 Sigma，世界/Function Database，输入输出 ArrowDownUp。

## 验证与边界

自动测试覆盖复制片段与身份、删除关联边、双向规范化连接、矩形相交、严格端口和运行校验、类型信封、Messages 工具配对与轮次裁剪、完整助手工具请求输出、Image 桥接和保存/显示调用。已有业务测试继续通过。浏览器的独立内存测试页验证 Ctrl 多选、整体拖动与一次撤销、工具栏复制粘贴和重做、输入端口起笔点击/拖线、Del 删除连线、Tab 节点库及 44px 对齐；不创建用户持久化项目，也不调用真实模型或 GPU。

撤销只恢复图定义，不能撤回网络请求、已保存图片或已成功提交的 Agent 记忆。当前执行图仍是无环的数据流；在多轮运行之间使用变量保存状态。真实供应商 ToolUse 与 ComfyUI GPU 出图需要实际服务验证。

本次验收：72 项前端自动测试通过，14 项 Rust release 测试通过；前端生产构建通过。桌面仍使用固定 my-universe.exe 与项目根目录快捷方式，构建后覆盖更新。


## 工作流运行观察与变量池（2026-10-09）

执行状态独立于持久化图定义：节点依次发出 waiting、running、complete，异常标记 error，取消标记 cancelled。运行面板将当前执行节点高亮；每条实际经过的连线记录本次输出及实际类型，显示紧凑摘要，悬停查看完整值。观察事件使用副本，不能改变程序数据。编辑器播放在节点开始时短暂停留，普通调用不附加展示延迟。

变量池维护 `{id,type,value}` 类型信封。id 是稳定身份，name 是可编辑的索引；节点通过下拉列表选择兼容类型的变量。新建、改名、改类型、初始值编辑和绑定节点修改纳入同一撤销快照。改名同步节点绑定以及各世界的 Agent memory；改类型同步 value 端口，兼容值保留，不兼容值恢复类型默认值。连接保留，运行校验提示不兼容类型。旧的原生值可以推断基础类型，无法推断的对象需明确指定类型。

运行使用工作副本，变量池实时显示变量写入结果；成功后提交 Agent 记忆，失败或取消不提交临时值。变量池显示最近运行值时，初始值编辑仍明确标注，避免混淆。运行中禁用图定义与变量编辑，保留平移、缩放、查看完整值及面板开关。

ComfyUI 原生节点的执行通过 WebSocket 按 prompt_id 过滤，桌面端使用原生连接并通过 Tauri 事件桥接，支持 Bearer 认证。浏览器使用 WebSocket。原生 ComfyUI 公开事件不包含所有 Tensor 的实际值，因此对应连线显示“服务端数据 · 类型”；不会编造 Tensor 数值。宿主节点的值正常展示。事件通道不可用时提示并继续 HTTP history 查询。真实模型与 GPU 联调仍需要实际服务。

节点库与变量池都采用固定 header 加独立滚动内容区。节点库标题、收起按钮和工具栏保持顶边对齐，滚动只作用于搜索与分类列表；此结构同步用于 Function Flow。变量池位于画布右下方，可用分页按钮滑动收起。

最新图标规范覆盖早期方案：模型入口 Sparkles，插件 Puzzle；LLM 使用与模型项一致的 Bot，SD 项及节点使用 SquareSparkles，工具独立分类 Wrench；String 为 Letters，Boolean 为 Binary，其他变量类型 ScanBox，方法 FileCodeCorner，属性 FileBox。缺少的 Lucide 图标使用本地官方 SVG 与 ISC 授权，无运行时下载。

本次验证：77 项前端测试、14 项 Rust 业务测试与 1 项原生 WebSocket 回环测试通过。浏览器验证节点库滚动后标题保持 top=0，变量创建/重命名/类型菜单和本地 Agent 执行高亮、连线值、变量实时值通过。生产构建与桌面打包成功，同名 exe SHA256 校验一致，根目录快捷方式已更新。未调用真实 LLM 或 GPU 服务。


2026-10-09 图标渲染修正：Letters、ScanBox、FileCodeCorner、SquareSparkles 的官方 Lucide 路径通过 createLucideIcon 生成内联 SVG，与内置 Binary 等图标使用相同渲染机制。移除带背景的 span/CSS mask；节点库仅文字 span 扩展，SVG 固定尺寸且不收缩，描边使用 currentColor，避免黑色矩形和 WebView 外部遮罩兼容问题。SD 列表、模型导航、节点库、画布与变量类型菜单共用这些组件。
