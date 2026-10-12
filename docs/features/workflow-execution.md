# 工作流执行、循环与记忆

Graph/变量/消息结构见 [工作流数据](../data/workflow.md)，画布手势见 [工作流编辑器](../ui/workflow-editor.md)，LLM/ToolCalls 与子 Agent 接入见 [模型与 Agent](models-and-agents.md)。

## 求值与依赖

Agent 图按返回依赖求值，允许由循环节点管理的反馈；切断进入循环 next/continue 的反馈后必须为 DAG。缓存以调用实例、循环作用域、轮次和节点区分，同一轮共享依赖只运行一次，循环外依赖复用。after 表示显式顺序，不以画布位置或数组顺序决定副作用。Agent 必须只有一个返回节点；SD 与 Function Flow 保持各自执行契约。

## 流程控制与作用域

右侧“流程控制”提供循环与条件，只用于 Agent。T 可选七种严格类型，循环默认 Messages，条件默认 String。

| 节点 | 输入 | 输出 | 规则 |
| --- | --- | --- | --- |
| 循环 | initial:T、next:T、continue:Boolean | current:T、iteration:Number、result:T | 首轮 current=initial，iteration=1；先 next 再判断 continue，false 输出 next，true 将 next 带到下一轮 |
| 条件 | condition:Boolean、trueValue:T、falseValue:T | value:T | 先读取条件，仅求值被选输入的依赖 |

循环至少一轮；continue 未接默认为 false，next 必须有来源。最大轮次默认 16，可设 1–10,000；上限时仍要求继续则失败。current/iteration 仅在循环体消费，result 仅在结束后供外部消费。允许结构明确的嵌套，拒绝绕过循环节点的环、交叉边界和循环体向外泄漏中间结果。控制节点不预读全部输入，未选分支不请求模型、不调用工具、不写变量；每轮只计算 next/continue 所需依赖。

循环 current/iteration 的输出绑定每轮更新；结束后 result 可继续绑定和分发。轨迹和观察事件携带调用身份、轮次及分支，重复运行不以节点 ID 覆盖历史记录。

## 副作用与记忆提交

变量节点和输出绑定只写当前调用的工作副本；方法返回新值不会自动保存。工作变量由初始定义与当前 worldId/global 的 memory 合成；根 Agent 成功后统一调用 commitAgentMemory，校验所有子调用记忆基线与定义，失败或取消丢弃暂存记忆。Tool 世界写入按每次脚本事务提交内存，网络与图片输出不随整图失败回滚。详见 [Agent 执行模型](models-and-agents.md#agent-的执行模型)。

## 观察与取消

运行事件是执行值的副本，包含调用、循环轮次与分支身份。图定义不保存观察值；聊天可以保存 run.events 作为历史。运行面板非流式，聊天请求使用 SSE；ComfyUI 按 prompt_id 观察，事件失败仍轮询 history。取消停止当前等待和可取消通道，不保证撤回已提交的远程任务。

## 实现与验证入口

[workflowControl.ts](../../src/model/workflowControl.ts) 校验控制边界；[workflows.ts](../../src/services/workflows.ts) 求值；[agentRuntime.ts](../../src/services/agentRuntime.ts) 管理预算与记忆；[workflowExecution.ts](../../src/services/workflowExecution.ts) 管理观察事件。测试覆盖惰性分支、循环反馈/上限/嵌套、共享缓存、失败不提交、递归预算与记忆冲突；方法见 [开发与验证](../development.md)。
