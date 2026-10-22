# 聊天请求与会话生命周期

消息、提议与模型协议数据见 [聊天数据](../data/chat.md)，界面呈现见 [聊天 UI](../ui/chat.md)。

## 聊天与调用上下文

新会话左下角先选择 Agent，首次发送将目标固定至 Conversation.target；之后只显示而不能更换 Agent。右侧独立选择本次模型。target 使用 {kind:agent,id}，modelId 保存模型选择；旧模型目标迁移为对应 ReAct Agent。图中使用“系统默认模型”的 LLM 卡片读取发送时固定的 modelId，子调用沿用；明确指定模型的卡片优先使用自身设置。失效目标明确提示，不自动换模型。

模型只保存连接参数。ReAct/高级/多角色 Agent 从自身 config 取得系统词和允许的 Tools/Agents，高级 Agent 可按需加载获准 Skill。完整会话协议传入自带 Agent 的本次工作变量，成功后存回会话；不将它写成跨会话共享记忆。自定义 Agent 使用自身图与记忆。

聊天过程按时间记录，携带 runId、sequence、invocationId/parentInvocationId、节点与轮次。实时文字追加，最终答复以 Agent 返回值为准；思考只取服务返回的 reasoning_content/reasoning。协议仍保留原始文字，不从 Markdown 渲染或折叠内容重建上下文。事件保存节点标题及可读循环作用域，内部 ID 用于关联调用。取消/失败保留已显示内容，重启将未完成运行标为中断，不自动重放。Markdown、过程嵌套和折叠由 [聊天 UI](../ui/chat.md#消息过程与提议) 维护。

界面过程块与完整 ContextMessage[] 模型协议独立持久化，不从展示文字重建 ToolUse。更新固定发起世界/会话，50ms 批量合并高频事件到内存；通过 JSON 自动存档持久化。修改建议即时出现，图继续执行；差异卡片由用户随后采纳/拒绝，见 [官方 Tool](official-tools.md)。chat.files/skills 兼容保留，文件自动注入未实现；高级 Agent 的 Skill 目录与按需正文加载见 [Skill](skills.md)。

## 引用、观察与用量

引用标签保存可读 token 与稳定身份，发送解析实例事实资料和强制技能列表；启动和插话加载的技能在模型调用前加载正文及合法专属 Tool，明确要求遵循，而非仅提供候选目录。无效引用明确失败；Workflow 同样预加载技能说明，但不改写图，工具执行仍按 ToolCalls 连接。调用记录保存主 Agent 交付任务及成员输入快照，仅向用户展示。执行摘要由事件派生。用量事件沿原会话定位与批量保存队列写入，价格快照随运行留存，切换查看不重新计费。输入统计来自实际完整模型请求，无法将一个用户句子的 Token 从系统词、技能及历史中准确拆出。

聊天补全由 chatDirectives 在发送时解析：@ 选择强制技能或当前世界实例；实例只读取发起世界，将资料加入模型输入。失效、跨世界或停用引用明确失败。@ 和旧 / 技能引用先加载正文及受权限约束的专属工具，不修改 Agent 保存配置、不传给子调用。角色运行中插话可请求新技能，在下次主 Agent 决策前加载。Workflow 注入调用级系统说明，不改图和变量声明，仍由其显式 ToolCalls 控制执行。

## 多智能体会话

通用 AgentSession 维护公开消息总线与独立成员协议，管理接口及权限见 [Agent Manager](agents.md#通用会话-agent-manager)。用户输入按旁观或用户角色身份加入公开消息；成员每次仅接收未消费公开消息、姓名映射、自己的历史与本次任务。其他成员 system、工具协议及思考事件从不进入它的模型消息。成功且输出格式有效才同步私有历史和发布最终发言；根失败保留已完成成员输出，未完成调用不推进游标。State 按原世界/会话更新，切页不会写到新会话；删除原会话中止正在返回的状态更新。

主聊天显示公开 Agent 输出，私有过程可从会话树成员页面查看。运行器共享预算与取消；当前成员执行为串行，下一位由主 Agent 依据 Skill 和上下文决定，不固定 A→B→C→用户轮转；允许角色连续或多轮自主交流，明确需要用户回应、用户要求暂停或场景结束时停止。仍受根预算和交流轮数限制，达到上限明确暂停，不把最后一条 Tool JSON 当作最终正文。不提供后台无限驻留、并行调度或跨会话私有记忆。单个成员历史包括自己处理过的公开消息与工具协议，公开群聊自身始终只维护用户/成员最终内容。

## 运行中插话与调度

AppRoot 按世界/会话保存当前 AgentSession，生成中发送消息不会启动第二个根运行。插话立即进入消息和公开总线，通知当前请求取消：主 Agent 的未完成响应标为 discarded，按新输入重新请求；正在执行的成员使用独立取消信号中止，未完成结果不发布。主运行、预算与已完成发言保留。剩余旧 ToolCalls 不继续执行，返回“先处理最新输入”，使主 Agent 下一轮重新决策。

新输入作为真实 user 消息合入 Graph 的 Messages 并保存到完整协议；不是从 UI 重建。子调用仅同步公开输入，不读取其他成员的私有上下文。正在等待的问题可由插话回答；已被中断的子调用问题不再重复作答。停止按钮仍中止整个根运行。网络自身错误不触发重发；因用户主动改变输入而重算与格式纠正属于明确的新模型步骤，同样计入预算。

<a id="http-sse-与传输边界"></a>

## HTTP、SSE 与传输边界

图运行面板和模型测试保持非流式 HTTP。聊天所有模型请求（含子 Agent）使用 POST SSE，浏览器 fetch 读取响应流，桌面 reqwest 分块后通过 Tauri Channel 传递字节，共用 SSEDecoder。按 UTF-8 跨块、多种换行、注释、多行 data 解析，累计文字、实际思考字段和 tool_calls 参数增量，完整并校验后才执行能力。必须收到 [DONE]；格式错误、中断、异常结束和超时明确失败，不自动重试或降级重发。

桌面按 requestId 取消且限制窗口所有权，ready 握手处理请求启动期间取消，任务/通道结束清理。浏览器 CORS 由服务配置；仅 HTTP(S)，拒绝 URL 凭据和重定向，桌面超时上限 600 秒、响应上限 32 MB。图 HTTP 的旧原生请求停止等待仍可能继续；ComfyUI 不发送全局 interrupt。

远程 MCP、自动章节任务、插图归档和完整 ComfyUI 布局导入仍待实现。真实 LLM 协议与 GPU 出图需用户服务验收，构建和本地模拟不能替代。

实现入口：model/agents.ts、workflowControl.ts、workflowTemplates.ts、chatRuns.ts；services/agentRuntime.ts、workflowAgents.ts、workflows.ts、llm.ts、sse.ts、modelHttp.ts；src-tauri/src/model_stream.rs；AgentSettings、ModelSelector、ChatExecution、InstanceProposal。验收见 [开发与验证](../development.md)。

桌面 SSE 请求发送和响应读取错误须区分阶段，用中文概述连接失败、超时或响应流中断，并保留底层错误链（移除端点 URL）。error decoding response body 是传输层读取错误，不能直接认定为 JSON 或 Markdown 内容错误；单次截图不足以确定网络、代理或服务端原因。失败继续沿依赖图传递，不自动重发模型请求。

## 编辑重发

用户编辑消息时先填回输入框；确认后替换该消息并删除后续可见对话，使用 protocolBefore 恢复发送前协议，并由 sessionBefore 恢复成员和公开群聊快照。旧消息没有快照时只取编辑位置前完成的纯文本历史。重发不撤回已采纳世界修改或已提交 Agent 记忆。生成中不允许编辑消息，复制原始文字仍可使用。实现见 [AppRoot.tsx](../../src/ui/AppRoot.tsx)、[ChatPage.tsx](../../src/ui/ChatPage.tsx)。

## 提议采纳与持久化

工具提出建议时只发事件，pending 不代表世界已修改；用户采纳/拒绝/回退由 instanceProposals 处理，先更新内存。建议状态与会话内容自动存档到 JSON。批量原子采纳和冲突规则见 [官方 Tool](proposals.md#修改建议与用户采纳)。
