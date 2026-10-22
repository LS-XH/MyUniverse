# 聊天、运行记录与修改建议数据

声明入口为 [types.ts](../../src/model/types.ts)，协议值见 [工作流 Messages](workflow.md#messages)。

## 聊天与修改建议

World.chat 保存 target:{kind:agent,id}、独立 modelId、conversations 和 activeConversationId；旧 kind:model 目标迁移到 ReAct Agent，保留模型 ID，旧 agent 字段兼容保留。ChatMessage 保持 user/assistant 和旧 proposal，新增 run:{id,target,status,events,error?}。状态为 running/complete/error/cancelled/interrupted，未完成重启转 interrupted，不重放。过程事件保存调用树、顺序、轮次、文字、实际思考、能力结果和 proposal ID。Conversation.target 在创建后固定，chatKind 为 standard/roleplay；旧会话优先由首条 run.target 恢复，否则使用原默认目标，模型旧目标迁移为 ReAct。World.chat.target 仅作为新建默认选择，modelId 仍独立可变。Conversation.modelMessages 独立保存完整模型协议，不能由过程展示文字重建。更新定位稳定世界/会话/消息 ID，删除原会话不得写入其他会话。

建议保存原世界/类/实例 ID、修改前后 Markdown、Schema 签名以及 pending/saved/rejected 状态。内部 reason 字段用于显示说明，不属于公开 Tool 输入参数。采纳按提议类型新增实例或匹配成员内容合并，保存真实前后快照以支持逆向回退，批量操作原子提交。详见 [官方 Tool 的确认流程](../features/proposals.md#修改建议与用户采纳)。

## 请求用量与价格快照

ModelConnection 增加 inputPrice、cachedInputPrice、outputPrice（每百万 Token）和 priceCurrency（默认 CNY）。留空为未知，0 为免费。模型事件可保存 usage:{input,cached,output,total,cost?,currency,modelName}，按请求 ID 合并、替换累计 usage，不能逐 chunk 相加。cost 在响应时按当前模型价格计算并持久化，改价不重算历史；取消或丢弃输出不删除已返回的已消费用量。缺失 usage 保持未知，旧记录不伪造。

汇总按模型请求事件计算，输入缓存命中是 input 的子集。费用=(input-cached)×inputPrice/1e6+cached×cachedInputPrice/1e6+output×outputPrice/1e6；仅实际非零类别需要配置价格，否则费用未知。币种分组相加。Agent 事件的 inputContext 是本次传给成员的私有历史和公开消息更新快照，parameters 保存主 Agent 任务；不转发给其他成员。

## 会话成员与公开消息

Conversation.session 保存 participants、publicMessages 和可选 human:{mode:observer|character,name?}。World.chat.participation 保存新会话的人类参与默认值；首次发送复制入 session，之后以会话身份为准。参与者包括稳定 id、显示 name、用于模型协议的 protocolName、baseAgentId、自己的 systemPrompt、toolIds/skillIds、可选 outputSchema 与实体绑定、私有 history、已消费公开消息的 cursor。protocolName 为 member_ 加去短横线 UUID，满足兼容服务名称字符约束；公开成员表建立它与中文显示名的对应。公开消息仅含 id、可选 participantId/name、content、createdAt；新用户输入按身份使用 observer 或 human 作为协议 name，旧无 name 输入仍可读；成员最终输出带协议 name，不含 tool_calls、system 或 reasoning。

私有协议只保存在对应成员 history，不能由公开群聊或其他成员查询接口读取。每次调用只同步 cursor 之后公开消息，作为带 name 的 user 消息保留发言者身份，自己的上次最终答复已在私有协议中，不重复注入。独立角色为高级智能体配置实例，不写入全局 Agent 集合，不共享世界 Agent 变量记忆。

成功且格式有效的成员发言、私有协议和 cursor 一起更新，失败/取消不提交本次成员结果；已完成发言在根后续失败时保留。过程仍在原 run.events 中，通过 session-member:<id> 与调用树定位成员；UI 选择、展开和滚动属于页面状态，不存成员协议。

## 运行中插话

ChatMessage.interjectionRunId 指向正在执行的回复；其 run.events 保存 userInput（id 与用户消息 ID 相同、content、可选显示 name）。AppRoot 为观察事件分配 displaySequence，更新已合并的完成事件时保留最新展示序号；原 sequence 仍代表执行事件身份。主聊天按完成/插话的展示顺序排列，过程树仍按调用关系展示。

插话的待消费队列、版本和取消监听器只存在内存。用户消息及公开消息先保存，再通知运行器中断旧请求；已完成发言保持，未完成成员不提交私有历史或输出。成员 cursor 仅推进到本次启动时已读取的公开消息位置，后续同步排除自己的最终发言，避免错过执行中到达的输入。重启不重放未完成队列，消息原文保留，可继续发送。

## 编辑重发与提议快照

用户 ChatMessage.sessionBefore 保存发送前成员/公开消息快照，编辑重发同时恢复它，避免保留被截去的角色发言；编辑插话还会截断所属 run 的后续事件，保留之前已完成输出；旧消息无成员快照时保持原数据。用户 ChatMessage.protocolBefore 可选保存发送前完整模型协议快照，用于编辑重发时恢复精确上下文并移除后续对话。旧消息无快照时只使用编辑位置之前已完成的纯文本历史，不尝试从界面过程重建工具协议。编辑聊天不会撤销已提交的 Agent 记忆或已采纳世界修改。

InstanceChangeProposal.baselineEntity 可选保存生成时实例快照，保留成员稳定身份，采纳时仅合并 before/after 中变更成员；旧建议无快照时从 before Markdown 恢复。冲突与唯一内容匹配规则见官方 Tool 文档。

InstanceChangeProposal.kind 为可选 modify/add（旧记录按 modify），新增实例提议 before 为空，baselineEntity 保存待创建实例身份。保存时记录 savedBefore/savedAfter 与有序 savedAt，支持冲突检查和逆向回退。采纳/回退均先更新内存对象，再由自动 JSON 存档持久化；保存键负责显式导出 Markdown；回退成功状态返回 pending。

## 提问与显式引用

执行事件增加 question（id、question、options、可选 answer），携带既有 runId/调用身份/顺序信息；回答按问题 ID 合并回原时间位置。等待回调仅存在内存，不持久化 Promise 或重启重放；恢复时由运行中断状态禁用交互。

用户 ChatMessage.directives 可保存技能 ID 或世界/class/entity 稳定 ID 与可读 token。正文保留用户文字，执行上下文另行附加当前实例 Markdown；编辑恢复引用元数据，发送仅解析正文仍存在的 token，不从任意手写名称猜测身份。

显式 Skill 引用支持 @ 与旧 / 标签；手写 @ 名称只在用户原始提示词及根用户配置系统词中精确匹配已安装技能，不扫描附加世界资料、工具结果或自动生成成员提示词。技能许可和瞬时强制列表分开保存。

ChatDirective 为技能 {kind:'skill',id,token}，或实例 {kind:'instance',worldId,classId,entityId,token}。引用标签保存身份，单纯手写任意实例名称不会建立该引用；手写技能名有精确解析规则。

## 展示与执行的分工

`Conversation.messages` 是用户可见消息及过程；`modelMessages` 是完整模型协议。`run.events` 用 invocationId/parentInvocationId 关联嵌套调用，不能从折叠卡片文字重建工具协议。`pending/saved/rejected` 为提议处理状态，saved 表示内存已采纳，并不保证磁盘已写入。读写行为见 [聊天功能](../features/chat.md)，采纳与回退见 [官方 Tool](../features/official-tools.md)。

文件提议沿用 InstanceChangeProposal，额外 fileChange={path,skillId,baseline?,savedBefore?,saved?} 保存稳定技能身份和包快照；worldId/conversationId 仍固定原聊天。文件 before/after 为原文差异，不解释为世界 Markdown。Tool 事件可保存 toolRole，跨重启使用同一职能图标。
