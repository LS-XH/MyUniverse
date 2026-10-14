# 模型、Agent 与 ComfyUI

## 注册与存储

模型入口独立于设置，包含 LLM 连接、Stable Diffusion 工作流、Agent 集合。每项保留稳定 ID，可创建、命名、编辑和删除；工作流卡片标题固定类型，注册对象名作为参数/页面标识。

连接、图和 Agent 初始变量/记忆存 workspace.json，不写世界正文。API Key 输入隐藏，但本地 JSON 当前没有额外加密。删除引用对象后运行明确报失效，不自动选择另一个模型。旧模型 ID 与配置保留，缺失新集合初始化为空。

## LLM 连接与请求

OpenAI 兼容连接保存 baseUrl、model、apiKey、enabled，可覆盖 modelsUrl/chatUrl；默认追加 /models 和 /chat/completions，服务所需 /v1 由用户基础 URL 提供。

URL/密钥变化后约 800ms 防抖获取目录，取消旧请求防止覆盖；接受 data/models 数组，按 ID 去重排序。目录不支持或失败可手填 model，手动刷新。测试生成会真实请求并显示状态/服务响应，当前非流式。

可选 reasoningEffort、temperature、topP、maxTokens、timeoutSeconds、extraBody，未填由服务默认。最大输出发送 max_completion_tokens，旧服务可用 extraBody 配 max_tokens。调用器控制 model/messages/stream，聊天使用 true，运行面板和模型测试使用 false；参数支持性由所选服务决定。

模型请求发送标准 Messages/tool_calls 字段，过滤内部 mcp 元数据。Tool 描述由统一注册表与 Schema 适配；注册 Tool 名在一次提供集合内必须唯一。

## Agent 的执行模型

Agent 使用 Graph：数据线同时表达执行依赖，不增加独立执行线；全叶子反向深度优先、返回最后。顺序执行按端口序依次等待，惰性条件只读取选中分支，循环和 Method 方法变量持有可进入的内部无环图、共享工作变量池，合法边界和缓存规则见 [工作流类型](workflow-execution.md#流程控制与内部图)。世界、Function、SD、Tool、变量及旧兼容节点保持稳定身份与既有职责。

当前通用 Function 节点仍调用旧独立返回接口，没有提供具体成员 bindingPath。新 void/add Function 必须有绑定上下文，尚不能直接用于这些节点的世界写入；不能把旧返回节点与绑定成员扩展混为同一契约。详见 [Function 的执行边界](functions.md#执行环境flow-和编辑)。

配置含 enabled、callName、description、inputSchema 和 limits。旧 Agent 默认启用，调用名由稳定 ID 生成，默认参数为 required input:string。Schema 复用 Tool 校验并应用默认值；输入卡片可选参数字段，基础字段映射 STRING/NUMBER/BOOLEAN，复杂 JSON 用 ANY 通用端口，交给 Function 显式处理。聊天仅直接选择 {input:用户文字} 加默认值即可通过 Schema 的 Agent，其余显示原因，仍可被图或模型调用。

根运行上下文共享世界、会话、取消信号、事件与预算，默认调用深度 8、节点执行 10,000、模型/工具/子 Agent 总调用 128；根可配置，递归及 A→B→A 共享剩余预算，达到限制明确失败。每个调用实例有独立工作变量，未完成递归不共享可变对象。

子调用成功后暂存 memory，同一 Agent 后续调用读取已完成暂存值，多次完成以最后结果为准。失败调用及其后代暂存丢弃；根成功才统一检查所有涉及 Agent 的记忆基线、变量/图定义并提交，冲突拒绝覆盖并发修改。根失败/取消不提交。Tool 已发生世界写入保持独立事务，不随 Agent 记忆回滚。

新建 Agent 使用循环式基础 LLM 编排。已有用户图、旧显式上下文示例和已安装模板保留，不静默替换。

## 模型卡片与工具调用

### 基础 LLM 模型

kind=llmBasic，固定名称“LLM 模型”。输入 messages:MESSAGES 和可选 tools:TOOLS、agents:AGENTS，输出 value:MESSAGES，仅本次 assistant 消息。系统词由 Messages 管理，不附加卡片系统提示词，不继承模型默认 toolIds，不自动执行工具；不接 tools 即不提供工具。

发送前要求完整、非空 Messages，拒绝 toolResults 片段和尚未完成配对的 ToolUse；允许输出 content=null 且含 tool_calls 的 assistant 片段，交给下一步骤处理。

基础节点仅使用显式接入的 Tools/Agents，不继承模型默认工具、聊天系统词。extraBody 的 tools/tool_choice/parallel_tool_calls/functions/function_call 字段被过滤，不能绕过能力输入。Tool 与 Agent 转换为 function 描述，内部保持类别和稳定 ID，调用名在一次请求内唯一，冲突明确失败。

### 显式 ToolCalls

kind=toolCalls，输入 messages:MESSAGES 与 tools:TOOLS、可选 agents:AGENTS；查找未返回调用，按接入能力名、arguments/Schema 串行分派 Tool 或子 Agent，结果复用原调用 ID。输出所有 role=tool 的 `{type:'Messages',version:1,fragment:'toolResults',items}`。

它不再次请求模型，已返回调用不重执行。能力错误产生匹配调用 ID 的 isError 结果；预算耗尽及取消终止运行。先把结果合并原完整 ToolUse 上下文，再进入下一次基础模型请求。工具身份与工具返回内容不同。

### 兼容自动交流

旧 kind=llm 名称“LLM 模型（自动 ToolCalls）”，保留 prompt/context/卡片 systemPrompt 和 STRING value，同时 messages 输出本次 assistant/tool 交流。显式 tools 可覆盖，并可显式接入 agents；未提供 tools 时可沿用卡片或模型 toolIds，显式空集合禁用工具。未提供 agents 时沿用模型 agentIds，显式 Agents（含空集合）覆盖模型默认子 Agent；基础 LLM 仍仅使用显式接入。最多 16 轮自动请求/执行。

新基础节点与旧自动节点并存，升级不偷偷改变已保存图行为。聊天直连 LLM 也可按模型注册工具自动交流；不能把自动行为当作所有 LLM 卡片共有职责。

<a id="自带-tooluse-示例"></a>

## 自带 ToolUse 与 Multiagent 示例

“新建工具调用模板”创建独立可编辑的“LLM + ToolCalls · 查询世界类名”，选择首个可用模型，缺少模型时手选。首次安装仍由 toolUseTemplateInstalled 防止重复，用户图和已安装旧模板不覆盖；删除后不自动重建。

新模板先把 toolUseHistory 的系统词与用户输入保存到 Messages 变量，再进入内部循环（repeat=16 硬上限）。内部每轮读取历史 → 基础 LLM → 合并响应 → 存在待执行调用。IF 真分支执行 ToolCalls 并合并结果，假分支只选择合并响应；普通叶子将选择值显式写回历史。break 读取“存在待执行调用”的取反，没有调用时直接结束，不遍历 continue。循环后读取最新历史并返回最后文本。一个基础 LLM 支持连续多轮交流，不再使用 next/current 回边；模板不隐式裁剪历史，可自行接入 Messages.trim。

Tools.get 接入 builtin:list_classes；仅查询世界。模型是否请求工具由服务决定，模拟验收不能替代真实供应商验证。失败不提交记忆。

“新建 Multiagent 示例”创建两个可编辑 Agent：创作 Agent 将审校 Agent 的 Agents.get 同时接入 LLM 和 ToolCalls，模型可自主调用审校。调用 Schema、模型和预算可分别编辑。

## Stable Diffusion / ComfyUI

每个 SDWorkflow 保存 ComfyUI URL、可选密钥、超时和图。默认 localhost:8188；用户需运行外部 Python/GPU 服务，主程序不内置 GPU 执行环境。

### 节点目录与前处理

从 /object_info 读取服务实际安装的官方/自定义节点，按 category 建树。输入必选/可选、枚举、数字默认值及原生输出由目录定义；可生成基础文生图模板，用户选择 checkpoint。

本地主程序节点（输入、常量、世界、算术、拼接、Function、严格变量/成员）先求值为字面值，写入 Comfy 原生输入；原生节点间保持 [节点 ID,输出索引]。主程序不把自己的节点伪装为服务 class_type。模型和 Tool 编排应在 Agent 完成，不将它们任意塞进 SD 图。

### 导入、执行与取图

支持 MyUniverse 图导入/导出及 ComfyUI **API 格式 JSON**，API 导入先加载节点目录，缺节点报错。普通 ComfyUI 含 nodes 的前端布局 JSON 和嵌入官方前端尚未实现。API 导出先求值前处理。

提交 /prompt，轮询 /history/{id}，通过 /view 展示图片，需 SaveImage 等产生图片结果。服务错误、缺必填、超时、完成却无图明确反馈。停止等待不调用全局 interrupt，以免影响同服务其他任务；已提交任务可能继续执行。

WebSocket 执行事件按 prompt_id 过滤，桌面通过 Tauri 事件桥并支持 Bearer。服务不公开全部 Tensor 值时仅展示服务端类型，事件失败提示并继续 HTTP 查询。宿主值正常观察，详见 [工作流编辑器](../ui/workflow-editor.md#执行观察)。

## 聊天与传输

直连模型使用临时标准 Agent，显式接入模型的 Tools/Agents；自定义 Agent 使用自己的图与记忆。会话归属、协议、流式和取消见 [聊天功能](chat.md)，HTTP/SSE 与 ComfyUI 的接口速查见 [API 使用](api.md)。真实模型和 GPU 仍需服务联调，能力边界见 [开发与验证](../development.md)。
