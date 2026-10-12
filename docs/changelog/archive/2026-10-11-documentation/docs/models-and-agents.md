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

Agent 使用 Graph：数据线同时表达执行依赖，在同一画布展示循环体与回边，不增加独立执行线。返回依赖驱动执行，支持惰性条件与后判断循环，合法边界和缓存规则见 [工作流类型](workflow-types.md#流程控制与作用域)。世界、Function、SD、Tool、变量及旧兼容节点保持稳定身份与既有职责。

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

新模板以 toolUseHistory 的系统词与用户输入启动 Messages 循环：current → 基础 LLM → 合并响应 → 存在待执行调用。真分支执行 ToolCalls 并合并结果，假分支直接选择合并的响应；选择值反馈 next，存在待执行调用反馈 continue。结束后保存完整上下文并返回最后文本。一个基础 LLM 同时支持连续多轮工具交流，默认 16 轮，模板不隐式裁剪历史，可自行接入 Messages.trim。

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

WebSocket 执行事件按 prompt_id 过滤，桌面通过 Tauri 事件桥并支持 Bearer。服务不公开全部 Tensor 值时仅展示服务端类型，事件失败提示并继续 HTTP 查询。宿主值正常观察，详见 [工作流编辑器](workflow-editor.md#执行观察)。

## 聊天与调用上下文

左下角统一分组选择“模型 / Agent”，使用 {kind,id} 目标。迁移旧配置优先有效 Agent，否则保留 modelId；失效目标明确提示，不自动换模型。Agent 使用图内模型和显式 Messages 记忆，聊天不会额外为它选模型。

模型配置的“聊天系统提示词”仅在直接调用模型时使用。直连通过临时标准 Agent 编排，读取完整会话协议、系统词及模型 toolIds/agentIds，将 Tools 和 Agents 分别显式接入基础 LLM 与 ToolCalls，以循环完成工具和子 Agent 交流；图内基础 LLM 不继承它。

聊天过程按时间记录，携带 runId、sequence、invocationId/parentInvocationId、节点与轮次。实时文字追加，最终答复以 Agent 返回值为准。助手正文和思考采用 Markdown/GFM 展示，流式未闭合代码围栏可持续渲染；存储及模型协议仍保留原始文字，不以渲染后的 HTML 重建上下文。只展示服务返回的 reasoning_content/reasoning，折叠思考和工具参数/结果；子 Agent 按调用树嵌套，节点/循环/分支收入可展开过程区，事件保存节点标题及可读循环作用域；内部稳定 ID 仅用于关联，不作为用户进度文字。取消/失败保留已显示内容，重启将未完成运行标为中断，不自动重放。

界面过程块与完整 ContextMessage[] 模型协议独立持久化，不从展示文字重建 ToolUse。更新固定发起世界/会话，50ms 批量合并高频事件并沿用保存队列。修改建议即时出现，图继续执行；差异卡片由用户随后采纳/拒绝，见 [官方 Tool](official-tools.md)。chat.files/skills 兼容保留，文件/Skill 自动注入仍未实现。

## HTTP、SSE 与传输边界

图运行面板和模型测试保持非流式 HTTP。聊天所有模型请求（含子 Agent）使用 POST SSE，浏览器 fetch 读取响应流，桌面 reqwest 分块后通过 Tauri Channel 传递字节，共用 SSEDecoder。按 UTF-8 跨块、多种换行、注释、多行 data 解析，累计文字、实际思考字段和 tool_calls 参数增量，完整并校验后才执行能力。必须收到 [DONE]；格式错误、中断、异常结束和超时明确失败，不自动重试或降级重发。

桌面按 requestId 取消且限制窗口所有权，ready 握手处理请求启动期间取消，任务/通道结束清理。浏览器 CORS 由服务配置；仅 HTTP(S)，拒绝 URL 凭据和重定向，桌面超时上限 600 秒、响应上限 32 MB。图 HTTP 的旧原生请求停止等待仍可能继续；ComfyUI 不发送全局 interrupt。

远程 MCP、自动章节任务、插图归档和完整 ComfyUI 布局导入仍待实现。真实 LLM 协议与 GPU 出图需用户服务验收，构建和本地模拟不能替代。

实现入口：model/agents.ts、workflowControl.ts、workflowTemplates.ts、chatRuns.ts；services/agentRuntime.ts、workflowAgents.ts、workflows.ts、llm.ts、sse.ts、modelHttp.ts；src-tauri/src/model_stream.rs；AgentSettings、ModelSelector、ChatExecution、InstanceProposal。验收见 [开发与验证](development.md)。

桌面 SSE 请求发送和响应读取错误须区分阶段，用中文概述连接失败、超时或响应流中断，并保留底层错误链（移除端点 URL）。error decoding response body 是传输层读取错误，不能直接认定为 JSON 或 Markdown 内容错误；单次截图不足以确定网络、代理或服务端原因。失败继续沿依赖图传递，不自动重发模型请求。
