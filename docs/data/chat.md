# 聊天、运行记录与修改建议数据

声明入口为 [types.ts](../../src/model/types.ts)，协议值见 [工作流 Messages](workflow.md#messages)。

## 聊天与修改建议

World.chat 保存 target:{kind:model|agent,id}、conversations 和 activeConversationId；旧 modelId/agent 仅兼容迁移。ChatMessage 保持 user/assistant 和旧 proposal，新增 run:{id,target,status,events,error?}。状态为 running/complete/error/cancelled/interrupted，未完成重启转 interrupted，不重放。过程事件保存调用树、顺序、轮次、文字、实际思考、能力结果和 proposal ID。Conversation.modelMessages 独立保存完整模型协议，不能由过程展示文字重建。更新定位稳定世界/会话/消息 ID，删除原会话不得写入其他会话。

建议保存原世界/类/实例 ID、修改前后 Markdown、Schema 签名以及 pending/saved/rejected 状态。内部 reason 字段用于显示说明，不属于公开 Tool 输入参数。采纳按提议类型新增实例或匹配成员内容合并，保存真实前后快照以支持逆向回退，批量操作原子提交。详见 [官方 Tool 的确认流程](../features/official-tools.md#修改建议与用户采纳)。

## 编辑重发与提议快照

用户 ChatMessage.protocolBefore 可选保存发送前完整模型协议快照，用于编辑重发时恢复精确上下文并移除后续对话。旧消息无快照时只使用编辑位置之前已完成的纯文本历史，不尝试从界面过程重建工具协议。编辑聊天不会撤销已提交的 Agent 记忆或已采纳世界修改。

InstanceChangeProposal.baselineEntity 可选保存生成时实例快照，保留成员稳定身份，采纳时仅合并 before/after 中变更成员；旧建议无快照时从 before Markdown 恢复。冲突与唯一内容匹配规则见官方 Tool 文档。

InstanceChangeProposal.kind 为可选 modify/add（旧记录按 modify），新增实例提议 before 为空，baselineEntity 保存待创建实例身份。保存时记录 savedBefore/savedAfter 与有序 savedAt，支持冲突检查和逆向回退。采纳/回退均先更新内存草稿，明确保存后持久化；回退成功状态返回 pending。

## 展示与执行的分工

`Conversation.messages` 是用户可见消息及过程；`modelMessages` 是完整模型协议。`run.events` 用 invocationId/parentInvocationId 关联嵌套调用，不能从折叠卡片文字重建工具协议。`pending/saved/rejected` 为提议处理状态，saved 表示内存已采纳，并不保证磁盘已写入。读写行为见 [聊天功能](../features/chat.md)，采纳与回退见 [官方 Tool](../features/official-tools.md)。

执行事件增加 question（id、question、options、可选 answer），携带既有 runId/调用身份/顺序信息；回答按问题 ID 合并回原时间位置。等待回调仅存在内存，不持久化 Promise 或重启重放；恢复时由运行中断状态禁用交互。

