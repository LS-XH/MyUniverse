# 工作流执行、循环与记忆

Graph/变量/消息结构见 [工作流数据](../data/workflow.md)，画布手势见 [工作流编辑器](../ui/workflow-editor.md)，LLM/ToolCalls 与子 Agent 接入见 [模型与 Agent](models-and-agents.md)。

## 反向深度优先与叶子调度

Agent 是无环依赖图。每个节点反向递归读取输入来源，完成依赖后执行自身。每个作用域先按 nodes 存储顺序遍历没有下游连线的普通叶子，再遍历返回；不能只从返回开始，孤立输出或未接返回的副作用叶子同样执行。返回卡片必须唯一且最后完成，方法内部返回只表示完成。数据线同时表示依赖，不增加独立执行线。

普通节点先读取所有 condition 前缀输入，再兼容 after 输入，然后按端口声明顺序读取其他输入。条件、顺序执行、循环具有专门规则，禁止通用预读全部输入。条件先读取 Boolean condition，仅递归选中的 trueValue/falseValue，不执行另一分支；有独立下游叶子的分支仍是独立任务。共享祖先在同一作用域执行缓存中只求值一次；布局坐标和连线数组排序不作为顺序约定。有先后要求须使用数据依赖或顺序执行，而不能依赖画布位置。

## 流程控制与内部图

右侧“流程控制”提供循环、条件、顺序执行，仅用于 Agent。所有作用域均禁止回边，自身连接与跨图连线不可建立。旧 initial/next/continue → current/iteration/result 循环保留原序列化数据供用户查看或导出，但执行明确报错，不兼容运行、不静默重写。用户需要重新建立内部循环并用变量池传递轮次状态。

| 节点 | 输入 | 输出 | 规则 |
| --- | --- | --- | --- |
| 条件（IF） | condition:Boolean、trueValue:T、falseValue:T | value:T | 先 condition，再选中分支；T 默认 ANY，也可选择已有严格值类型 |
| 顺序执行 | branch1…branchN:ANY | 同名对应输出:ANY | 按输入声明顺序逐一等待依赖完成，所有分支完成后发布全部原值；N 为 1–64 |
| 循环 | value:ANY | value:ANY | 外部只配置 repeat（1–10,000，默认 1）；最多 repeat 轮，输入原样输出，不把内部成员值当返回值 |
| break（循环内部） | condition:Boolean，默认 false | 无 | 普通叶子完成后检查，true 立即结束，跳过 continue 的整个依赖递归 |
| continue（循环内部） | condition:Boolean，默认 true | 无 | break=false 后检查；true 且未达到 repeat 才进入下一轮，false 提前结束 |

repeat 是用户确认的硬上限，达到次数正常结束，不因 continue=true 额外执行或报上限失败。每轮依次执行普通叶子、break、continue；循环体不放返回卡片，两个内置终止卡片不能删或复制。内部没有参数输入节点；通过变量池读取和显式写回状态。循环 value 在进入内部前求值，外部 value 输出保持同一值。嵌套循环持有各自独立 body DAG，不泄漏内部分支线。

## 方法变量

Method 是第八种变量类型，封装 `{type:'Method',version:1,graph}`，graph.scope=method。方法定义存变量池，以稳定变量 ID 绑定方法卡片；多张卡片调用同一方法定义。内部无参数、无业务返回值，只有一个完成返回卡片，叶子先执行、返回最后。方法与循环共享当前 Agent 调用的工作变量，不复制另一份池；修改仍通过显式 value 或端口绑定写入，不创建 Function 世界写入接口。

方法卡片只有 ANY value 输入输出，用于等待两侧依赖，执行完内部后输出同一输入值。每次方法卡片调用建立独立缓存；同一卡片在同一作用域仍只执行一次，在不同循环轮次重新执行。方法递归受根运行 depth 限制（默认 8），节点与外部调用预算共用根 Agent 预算，失败和取消遵循整次记忆事务。方法定义始终来自当前初始声明，旧记忆不能覆盖新编辑的定义；清空运行值不会清空方法体。

## 缓存与观察

缓存按 Agent 调用实例、内部调用路径、循环轮次、节点区分。循环每轮建立新缓存与输入解析表；方法每次进入独立缓存，与外部缓存隔离。当前作用域共享依赖只执行一次，变量工作副本跨这些作用域共享。事件和轨迹保留 frame、节点身份与可读 scopeLabel，聊天记录按调用/作用域合并，循环与方法的重入不会覆盖另一轮历史。编辑器节点状态展示最近执行状态，不把观察值写入图定义。

## 副作用与记忆提交

变量节点和输出绑定只写当前调用的工作副本；方法返回新值不会自动保存。工作变量由初始定义与当前 worldId/global 的 memory 合成；根 Agent 成功后统一调用 commitAgentMemory，校验所有子调用记忆基线与定义，失败或取消丢弃暂存记忆。Tool 世界写入按每次脚本事务提交内存，网络与图片输出不随整图失败回滚。详见 [Agent 执行模型](models-and-agents.md#agent-的执行模型)。

## 观察与取消

运行事件是执行值的副本，包含调用、循环轮次与分支身份。图定义不保存观察值；聊天可以保存 run.events 作为历史。运行面板非流式，聊天请求使用 SSE；ComfyUI 按 prompt_id 观察，事件失败仍轮询 history。取消停止当前等待和可取消通道，不保证撤回已提交的远程任务。

## 实现与验证入口

[workflowControl.ts](../../src/model/workflowControl.ts) 校验控制边界；[workflows.ts](../../src/services/workflows.ts) 求值；[agentRuntime.ts](../../src/services/agentRuntime.ts) 管理预算与记忆；[workflowExecution.ts](../../src/services/workflowExecution.ts) 管理观察事件。测试覆盖全叶子及返回顺序、惰性分支、顺序分支、内部循环/硬上限/嵌套、方法共享池与深度、共享缓存、失败不提交、递归预算与记忆冲突；方法见 [开发与验证](../development.md)。
