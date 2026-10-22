# LLM 模型连接与请求

模型只负责连接、参数和本地价格配置；Agent 负责能力与策略。配置结构见 [模型与插件数据](../data/integrations.md)，模型页面见 [管理界面](../ui/libraries.md)。

## 连接与请求

OpenAI 兼容连接保存 baseUrl、model、apiKey、enabled，可覆盖 modelsUrl/chatUrl；默认追加 /models 和 /chat/completions，服务所需 /v1 由用户基础 URL 提供。

模型仅负责 Chat Completions 连接及请求参数，不保存系统提示词、工具或子 Agent 接入。LLM 卡片 modelId 可明确指向模型，也可为 `$chat-model`（使用系统默认模型）；后者从本次根调用的 defaultModelId 解析，聊天发送时固定为右侧模型菜单所选项，子调用沿用。图中明确指定的模型优先，缺失选择明确失败，不回退其他连接。

URL/密钥变化后约 800ms 防抖获取目录，取消旧请求防止覆盖；接受 data/models 数组，按 ID 去重排序。目录不支持或失败可手填 model，手动刷新。测试生成会真实请求并显示状态/服务响应，当前非流式。

可选 reasoningEffort、temperature、topP、maxTokens、timeoutSeconds、extraBody，未填由服务默认。最大输出发送 max_completion_tokens，旧服务可用 extraBody 配 max_tokens。调用器控制 model/messages/stream，聊天使用 true，运行面板和模型测试使用 false；参数支持性由所选服务决定。

模型请求发送标准 Messages/tool_calls 字段，过滤内部 mcp 元数据。Tool 描述由统一注册表与 Schema 适配；注册 Tool 名在一次提供集合内必须唯一。

### 用量与计价

连接配置可设每百万输入缓存命中、输入未命中、输出的单价及货币；这些是本地计价元数据，不发送到模型。HTTP 读取 response.usage，SSE 请求 stream_options.include_usage=true，并在 choices 为空的用量包中也解析 usage。支持 prompt_tokens/completion_tokens、prompt_tokens_details.cached_tokens 及兼容服务 prompt_cache_hit_tokens；异常负值或超出输入的命中值视为不可用。每个请求回调写入模型事件，协议 Messages 不混入计价字段。工具循环、结构化纠正和子 Agent 共用此链。

接口流被中断时可能没有最终 usage，不自动重试或估算成准确用量。依据 [OpenAI 流式用量契约](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events)。

## 工作流模型节点

### 基础 LLM 模型

kind=llmBasic，固定名称“LLM 模型”。输入 messages:MESSAGES 和可选 tools:TOOLS、agents:AGENTS，输出 value:MESSAGES，仅本次 assistant 消息。系统词由 Messages 管理，不附加卡片系统提示词，不继承模型默认 toolIds，不自动执行工具；不接 tools 即不提供工具。

发送前要求完整、非空 Messages，拒绝 toolResults 片段和尚未完成配对的 ToolUse；允许输出 content=null 且含 tool_calls 的 assistant 片段，交给下一步骤处理。

基础节点仅使用显式接入的 Tools/Agents，不继承模型默认工具、聊天系统词。extraBody 的 tools/tool_choice/parallel_tool_calls/functions/function_call 字段被过滤，不能绕过能力输入。Tool 与 Agent 转换为 function 描述，内部保持类别和稳定 ID，调用名在一次请求内唯一，冲突明确失败。

### 显式 ToolCalls

kind=toolCalls，输入 messages:MESSAGES 与 tools:TOOLS、可选 agents:AGENTS；查找未返回调用，按接入能力名、arguments/Schema 串行分派 Tool 或子 Agent，结果复用原调用 ID。输出所有 role=tool 的 `{type:'Messages',version:1,fragment:'toolResults',items}`。

它不再次请求模型，已返回调用不重执行。能力错误产生匹配调用 ID 的 isError 结果；预算耗尽及取消终止运行。先把结果合并原完整 ToolUse 上下文，再进入下一次基础模型请求。工具身份与工具返回内容不同。

### 兼容自动交流

旧 kind=llm 名称“LLM 模型（自动 ToolCalls）”，保留 prompt/context/卡片 systemPrompt 和 STRING value，同时 messages 输出本次 assistant/tool 交流。显式 tools/agents 可覆盖卡片 settings 中的 toolIds/agentIds，显式空集合禁用能力。连接本身不再提供默认能力。最多 16 轮自动请求/执行。

新基础节点与旧自动节点并存，升级保留旧图的显式行为。聊天通过选中的 Agent 编排交流；自动行为不属于模型连接职责。

## 传输与失败

HTTP/SSE 统一经过 [modelHttp.ts](../../src/services/modelHttp.ts)，请求体由 [llm.ts](../../src/services/llm.ts) 构建。HTTP 返回 JSON；SSE 累积正文、思考和工具参数，必须收到完成标记。浏览器使用 fetch，桌面使用 Rust 桥；两者取消能力有差异，见 [聊天传输](chat.md#http-sse-与传输边界)。接口路径和调用示例见 [API](api.md#模型-http-与-sse)。
