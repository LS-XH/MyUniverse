# 主程序脚本与 Tool

## 职责分工

世界对象、Markdown 转换与存储只维护一套。JS Function/Tool 在主程序执行，以稳定 ID 门面读取按需数据；不每次导出整世界 Markdown 到 Node/Worker 再实现一套读取器。

| 功能 | Function | Tool |
| --- | --- | --- |
| 使用者 | 世界成员、对象类调用 | 大模型或工作流 |
| 入口 | transform(self,input)，固定包装 | execute(params)，自由参数 |
| 输入 | FunctionContext/TypedValue | object 根 JSON Schema |
| 返回 | void；通过 add 的 TypedValue 参数添加世界内容 | 字符串/JSON 可传输值，无 Function 返回类型 |
| 配置 | 绑定上下文、语言、类型化输入和 add 接口 | 调用名、描述、Schema、MCP annotations、执行方式 |
| 世界交互 | 共用主程序门面与会话 | 共用主程序门面与会话 |

具体 Function 规则见 [Function](functions.md)。绑定 Function 没有业务返回结果；旧独立返回接口的结果大小限制不套用于 Tool。JS 脚本源码和共用异步等待仍有执行器约束。无限返回是“不限定业务类型”，不意味着绕过 JSON 传输要求。

## 世界对象 API

Function 与 JS Tool 共用稳定 ID 门面，接口和示例统一维护于 [API 使用方法](api.md#世界对象门面)。绑定 Function 只有受限 add 权限，用户 Tool 使用通用门面。

## 一次执行的修改事务

ScriptHost 从当前主程序获取世界 base，维护不可变 draft 和 open 状态。脚本门面读写该会话草稿；执行完成且添加结构或 Tool 返回通过各自契约校验后，与运行期间最新 UI 世界三方合并，同一内容冲突拒绝提交。异常、取消、Schema/类型/JSON 错误丢弃草稿。

Function 内部执行状态可与 add 新增字段原子提交，不将函数返回变成 Markdown 成员。主程序关闭隐式落盘，新增内容作为未保存草稿，用户明确保存时调用 saveWorkspace 串行写入当前快照，不读取或合并旧 Markdown。`await app.storage.save()` 只记录保存请求；当前 AppRoot 绑定 autoSave:false，成功提交后也不会隐式写盘。

内存已提交但磁盘失败时保留本地修改，报告统一同步错误；不声称落盘成功，不回滚其他用户编辑。Tool 提交是一次调用事务，不能等同于整次 Agent 成功才提交的局部记忆。

## 环境、缓存与取消

JS/Flow 共用有限编译缓存，运行于主程序 WebView/浏览器，不需桌面 Node，不提供 CommonJS require。它们不是权限沙箱；用户代码自行访问全局对象/fetch 等造成的效果不在草稿回滚范围内。

共用执行器限制脚本源码 1 MB、异步等待 5 秒。停止等待后会话接口失效；主线程同步死循环不能靠计时器中断。取消与超时不能承诺撤销远端请求。

Python 保留桌面 Python 3 子进程与硬超时，接收只读数据快照，输出 set_value/set_markdown/delete/add 日志（旧追加别名兼容），由主程序门面重放、验证和提交。它不重新实现 Markdown 或磁盘保存；本轮结构读取仍是快照，完整写后结构需下一轮读取。

## 用户 Tool

### 定义与配置

工具页提供 JS/HTTP、新建/删除/启停、代码或 URL/GET/POST/密钥/bodyMode，以及调用名、description、inputSchema、annotations。配置放“配置”浮层，编辑主体和对象助手与 Function 一致；测试世界和参数在独立测试面板。

Tool 参数 Schema 根必须 object，字段和 required 自由编写。Ajv JSON Schema 2020-12 校验，不加载外部引用。调用名允许 1–64 字母、数字、下划线和短横线；同次提供给模型的工具名称必须唯一。

annotations 包括 title、readOnlyHint、destructiveHint、idempotentHint、openWorldHint。readOnlyHint=true 同时限制共用门面写入；其他注释供模型理解，不是独立权限沙箱。普通返回可为字符串或 JSON 可传输值，循环对象/BigInt 等不可序列化值在提交草稿前失败。

### HTTP 和兼容

HTTP Tool 复用 modelRequest，bodyMode=input 包装 input，raw 使用原参数，GET 不发送请求体。配置及代码存 workspace.json，虚拟文件夹不改变实际存储。

旧未声明 Schema 的 HTTP 工具保留原工作流输入兼容。新工作流先注册工具，再通过 Tools ID 获取/消费；旧内联 HTTP 卡片保留已有数据，不让旧项目突然失效。

## 官方注册表

registeredTools 合并程序冻结模板与用户定义，builtin: 命名空间保留；伪造同 ID 不能覆盖官方版本。侧栏、编辑页、模型选择和工作流使用同一个注册表。官方模板不能改、删、移，调用上下文与测试参数仍可设置。契约由 [官方 Tool](official-tools.md) 负责。

## Agent 调用与 Tool 事务

Agents 为独立严格类型，复用 Tool 的调用名、说明、参数 Schema 与可传输返回规则。模型请求将两类转 function 描述，内部保留稳定类别/ID，重名明确失败。子 Agent 共享根世界、会话、取消与预算，独立变量和暂存记忆；根统一成功提交记忆，Tool 世界写入保持本文件的独立事务。递归预算和调用 Schema 见 [模型与 Agent](models-and-agents.md#agent-的执行模型)。

## 模型与 MCP 桥梁

toolSpec/mcpToolResult 输出 MCP 风格描述与 text/structuredContent；modelToolSpec 转为 Chat Completions function 工具格式。annotations 以说明进入 description，不把兼容服务不认识的字段直接发送。

模型调用解析 arguments JSON，校验 Schema，通过统一注册/运行器执行，并用原 tool_call_id 返回结果。工具错误产生对应 isError 结果，取消终止等待。聊天及兼容自动 LLM 可按选中的 toolIds 自动交流，最多 16 轮；基础 LLM 与显式 ToolCalls 分工见 [模型与 Agent](models-and-agents.md)。

工作流传递 Tools 身份对象，仅存注册 ID，不存密钥或定义副本。工具返回内容不是 Tools 身份。Messages 保存原 assistant ToolUse 和配对工具结果；工具建议 pending 需等待用户，不能描述为已修改世界。

当前是程序内部注册工具到模型的适配，没有对外 MCP 服务器、MCP 网络传输或远程服务器连接；MCP 字段不等于这些能力已完成。

## 实现与验证入口

hostWorldApi.ts/scriptHost.ts：门面与会话；tools.ts：Schema、运行、结果；workflowTools.ts：Tools 解析；llm.ts：模型交流；builtinTools.ts：官方注册/处理；ToolsPage.tsx：编辑；AppRoot.tsx：主程序绑定。

验证读取懒转换、写入/删除、冲突、失败回滚、取消失效、显式刷新 Function 新增字段与执行状态原子提交、JSON 参数、工具调用 ID 与 Python 日志。真实供应商 ToolUse 需实际服务，详见 [开发与验证](../development.md) 和 [修改日志](../changelog/README.md)。
