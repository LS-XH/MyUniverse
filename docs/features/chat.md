# 聊天请求与会话生命周期

消息、提议与模型协议数据见 [聊天数据](../data/chat.md)，界面呈现见 [聊天 UI](../ui/chat.md)。

## 聊天与调用上下文

左下角统一分组选择“模型 / Agent”，使用 {kind,id} 目标。迁移旧配置优先有效 Agent，否则保留 modelId；失效目标明确提示，不自动换模型。Agent 使用图内模型和显式 Messages 记忆，聊天不会额外为它选模型。

模型配置的“聊天系统提示词”仅在直接调用模型时使用。直连通过临时标准 Agent 编排，读取完整会话协议、系统词及模型 toolIds/agentIds，将 Tools 和 Agents 分别显式接入基础 LLM 与 ToolCalls，以循环完成工具和子 Agent 交流；图内基础 LLM 不继承它。

聊天过程按时间记录，携带 runId、sequence、invocationId/parentInvocationId、节点与轮次。实时文字追加，最终答复以 Agent 返回值为准；思考只取服务返回的 reasoning_content/reasoning。协议仍保留原始文字，不从 Markdown 渲染或折叠内容重建上下文。事件保存节点标题及可读循环作用域，内部 ID 用于关联调用。取消/失败保留已显示内容，重启将未完成运行标为中断，不自动重放。Markdown、过程嵌套和折叠由 [聊天 UI](../ui/chat.md#消息过程与提议) 维护。

界面过程块与完整 ContextMessage[] 模型协议独立持久化，不从展示文字重建 ToolUse。更新固定发起世界/会话，50ms 批量合并高频事件到内存；明确保存才持久化。修改建议即时出现，图继续执行；差异卡片由用户随后采纳/拒绝，见 [官方 Tool](official-tools.md)。chat.files/skills 兼容保留，文件/Skill 自动注入仍未实现。

## HTTP、SSE 与传输边界

图运行面板和模型测试保持非流式 HTTP。聊天所有模型请求（含子 Agent）使用 POST SSE，浏览器 fetch 读取响应流，桌面 reqwest 分块后通过 Tauri Channel 传递字节，共用 SSEDecoder。按 UTF-8 跨块、多种换行、注释、多行 data 解析，累计文字、实际思考字段和 tool_calls 参数增量，完整并校验后才执行能力。必须收到 [DONE]；格式错误、中断、异常结束和超时明确失败，不自动重试或降级重发。

桌面按 requestId 取消且限制窗口所有权，ready 握手处理请求启动期间取消，任务/通道结束清理。浏览器 CORS 由服务配置；仅 HTTP(S)，拒绝 URL 凭据和重定向，桌面超时上限 600 秒、响应上限 32 MB。图 HTTP 的旧原生请求停止等待仍可能继续；ComfyUI 不发送全局 interrupt。

远程 MCP、自动章节任务、插图归档和完整 ComfyUI 布局导入仍待实现。真实 LLM 协议与 GPU 出图需用户服务验收，构建和本地模拟不能替代。

实现入口：model/agents.ts、workflowControl.ts、workflowTemplates.ts、chatRuns.ts；services/agentRuntime.ts、workflowAgents.ts、workflows.ts、llm.ts、sse.ts、modelHttp.ts；src-tauri/src/model_stream.rs；AgentSettings、ModelSelector、ChatExecution、InstanceProposal。验收见 [开发与验证](../development.md)。

桌面 SSE 请求发送和响应读取错误须区分阶段，用中文概述连接失败、超时或响应流中断，并保留底层错误链（移除端点 URL）。error decoding response body 是传输层读取错误，不能直接认定为 JSON 或 Markdown 内容错误；单次截图不足以确定网络、代理或服务端原因。失败继续沿依赖图传递，不自动重发模型请求。

## 编辑重发

用户编辑消息时先填回输入框；确认后替换该消息并删除后续可见对话，使用 protocolBefore 恢复发送前协议。旧消息没有快照时只取编辑位置前完成的纯文本历史。重发不撤回已采纳世界修改或已提交 Agent 记忆。生成中不允许编辑消息，复制原始文字仍可使用。实现见 [AppRoot.tsx](../../src/ui/AppRoot.tsx)、[ChatPage.tsx](../../src/ui/ChatPage.tsx)。

## 提议采纳与持久化

工具提出建议时只发事件，pending 不代表世界已修改；用户采纳/拒绝/回退由 instanceProposals 处理，先更新内存。建议状态与会话内容同样需明确保存。批量原子采纳和冲突规则见 [官方 Tool](official-tools.md#修改建议与用户采纳)。
