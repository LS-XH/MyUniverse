# Agent 类型、能力与会话管理

Agent 的配置结构见 [模型与插件数据](../data/integrations.md)，Graph 求值见 [工作流执行](workflow-execution.md)，管理页面见 [插件与模型界面](../ui/libraries.md)。

## Agent 的执行模型

### 三种类型与实例

agentType 为 workflow/react/advanced；createAgentTemplate 从所选类型创建唯一 ID、独立配置及核心流程实例。Workflow 编辑自定义图；ReAct/高级类型通过 preset 指向共享核心，仅编辑配置，不显示内部图。节点/变量身份包含实例 ID，不共享未完成运行状态。旧 Workflow 补 workflow 类型，旧 ReAct/高级及角色扮演记录保持身份、配置和聊天引用；角色扮演归高级类型的特化。默认实例仅为兼容示例，类型模板始终可创建。agentInstancesInitialized 防止删除后在规范化/重启时复活；已有会话目标保持失效引用，不能静默换 Agent。多角色扮演的旧默认高级基底在实例缺失时仅复用内存类型核心，不向工作区补建实例。

Agent 集合及侧栏提供三种创建入口。三种模板及已有实例在 capabilityDefaultsVersion 首次迁移时，默认接入 Object Manager、Skill Manager、Agent Manager、Runtime Tool、Interaction Manager 五个目录，以及 Runtime Skills 中的有效技能；用户之后的取消选择不再补回。Tool 许可按文件夹整组选取，运行时展开并去重；普通自建工具仍可单独选择。Runtime 技能是自主可用范围，不等于启动时强制加载。默认 ReAct/高级实例仍可命名、删除；仅多角色扮演特化受保护。

多角色扮演为特化系统实例，其系统词、工具/Agent/Skill、启动技能和轮次配置只读展示；只展示所需能力，角色工作策略仍由可编辑 Skill 定义。普通实例的 Tool/Skill 等许可使用纵向列表。明确 Skill 强制加载不等于修改模型自主许可，见技能文档。

### 自带 Agent 与配置迁移

固定身份 `builtin-agent:react`、`builtin-agent:advanced`、`builtin-agent:roleplay` 分别为 ReAct 智能体、高级智能体、多角色扮演。三者的图由应用生成，隐藏且不可编辑，全部 LLM 节点使用系统默认模型。配置页编辑 systemPrompt、toolIds、agentIds、maxRounds；高级/多角色 Agent 另有 skillIds、startupSkillIds 和 manageAgents，可按需发现和加载独立技能包，激活后由 Tool Manager 注册包内 scripts 工具。轮次为 1–128 的硬上限，默认 ReAct 为 16，其余为 32；深度、节点与调用预算继续受根运行上下文限制。所有能力必须明确勾选，未接入调用返回匹配原调用 ID 的错误结果。

配置生成的流程复用基础 LLM、ToolCalls、条件及内部循环。自带 Agent 的工作变量每次重建，会话历史通过独立协议记录传入，不写按世界共享的 history 记忆，避免不同会话串用上下文。自定义图及子 Agent 的原记忆事务保持原契约。

旧模型的聊天系统词、Tools/Agents 迁移为 ReAct 配置；首次迁移的首份配置进入默认 ReAct，额外配置保留为独立的“模型名 · ReAct”配置 Agent。旧模型目标迁移到对应 Agent，同时保留独立模型选择。旧自动交流卡片从模型继承的能力先写入卡片 settings，再移除连接字段；已有用户图不被默认图覆盖。迁移幂等，图中节点/变量身份稳定。Skill 管理、标准目录包和动态工具注册规则见 [Skill](skills.md)。

Agent 使用 Graph：数据线同时表达执行依赖，不增加独立执行线；全叶子反向深度优先、返回最后。顺序执行按端口序依次等待，惰性条件只读取选中分支，循环和 Method 方法变量持有可进入的内部无环图、共享工作变量池，合法边界和缓存规则见 [工作流类型](workflow-execution.md#流程控制与内部图)。世界、Function、SD、Tool、变量及旧兼容节点保持稳定身份与既有职责。

当前通用 Function 节点仍调用旧独立返回接口，没有提供具体成员 bindingPath。新 void/add Function 必须有绑定上下文，尚不能直接用于这些节点的世界写入；不能把旧返回节点与绑定成员扩展混为同一契约。详见 [Function 的执行边界](functions.md#执行环境flow-和编辑)。

配置含 enabled、callName、description、inputSchema 和 limits。旧 Agent 默认启用，调用名由稳定 ID 生成，默认参数为 required input:string。Schema 复用 Tool 校验并应用默认值；输入卡片可选参数字段，基础字段映射 STRING/NUMBER/BOOLEAN，复杂 JSON 用 ANY 通用端口，交给 Function 显式处理。聊天仅直接选择 {input:用户文字} 加默认值即可通过 Schema 的 Agent，其余显示原因，仍可被图或模型调用。

根运行上下文共享世界、会话、取消信号、事件与预算，默认调用深度 8、节点执行 10,000、模型/工具/子 Agent 总调用 128；根可配置，递归及 A→B→A 共享剩余预算，达到限制明确失败。每个调用实例有独立工作变量，未完成递归不共享可变对象。

子调用成功后暂存 memory，同一 Agent 后续调用读取已完成暂存值，多次完成以最后结果为准。失败调用及其后代暂存丢弃；根成功才统一检查所有涉及 Agent 的记忆基线、变量/图定义并提交，冲突拒绝覆盖并发修改。根失败/取消不提交。Tool 已发生世界写入保持独立事务，不随 Agent 记忆回滚。

新建 Agent 使用循环式基础 LLM 编排。已有用户图、旧显式上下文示例和已安装模板保留，不静默替换。

## 通用会话 Agent Manager

选中 Agent Manager 目录或启用 config.manageAgents 的 Agent 接入会话管理工具。AgentSession 管理成员注册、公开群聊和独立协议；Skill Manager 决定加载哪些操作规范，Tool Manager 执行获准能力，State Manager 保存成员历史/游标与公开输出，Policy Manager 校验 Schema、能力、实体绑定、取消及共享根预算，ReAct Core 决定下一次调用。

管理工具为 agent_list_members、agent_create_member、agent_run_member、agent_set_human，置于 Tool 的 Agent Manager 文件夹。管理模式的预置图不把 config.agentIds 另行提供为直接 Agent 函数，统一经管理工具创建/调用；非管理模式保持原有直接子 Agent 能力。创建只接受 config.agentIds 中启用的高级 Agent 作为基底，最多 16 位成员；toolIds/skillIds 必须为管理者获准集合的子集且仍有效，成员不授予管理权限或任意子 Agent。成员配置独立，只有公开身份、名称和发言可被 list_members 查询，不返回私有 system/history。运行沿用本次模型、世界、SSE、取消和根预算，不创建第二套无限预算。

这是管理者以 Tool 调用独立成员的编排方式，参考 [OpenAI 管理者模式](https://openai.github.io/openai-agents-js/guides/multi-agent/) 与 [Claude 独立子会话](https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration)。项目没有引入对应 SDK，运行契约仍由自身 Graph/Tool/Skill 实现。

多角色扮演仅预置通用协调系统词、能力白名单与启动 Skill；角色资料读取、何时创建、发言顺序及旁白选择写在 roleplay-manager 中。单角色使用高级智能体加 character-performance Skill，五字段输出 Schema 来自 Skill metadata.output-schema，在创建及返回时通用校验，不通过解析自然语言硬编码角色查询路径。Skill 内容可编辑，运行器负责权限和状态边界。Skill 规则见 [技能](skills.md)。

## 工具参数式结构化输出

配置 outputSchema 或加载 output-schema Skill 的调用，动态加入终结工具 agent_return_result，其参数直接复用 Schema。模型可以先使用查询工具，最终通过终结工具提交；运行器读取并校验参数，将其规范化为最终 assistant JSON 值，不执行世界 Tool，也不保留悬空 ToolUse。合法的旧正文 JSON 继续兼容。

正文或终结参数不合法时，仅作一次明确的格式纠正：只提供终结工具，并在 HTTP/SSE 的 tool_choice 指定该函数。仍未调用或校验失败则拒绝本次发言，未验证的 JSON 正文不流入公开聊天；服务返回的思考保留在私有过程。强制选择不能被连接 extraBody 绕过，不支持 Tool Calling 的服务明确报错，不静默降级。此方式参考 [LangChain ToolStrategy](https://reference.langchain.com/javascript/langchain/index/toolStrategy)，使用现有运行器而非引入其 SDK。格式纠正与插话请求均计入既有调用预算。

<a id="自带-tooluse-示例"></a>

## 自带 ToolUse 与 Multiagent 示例

“新建工具调用模板”创建独立可编辑的“LLM + ToolCalls · 查询世界类名”，选择首个可用模型，缺少时使用系统默认模型。新工作区不再自动安装额外示例；已有示例及用户图不覆盖，删除后不自动重建。

新模板先把 toolUseHistory 的系统词与用户输入保存到 Messages 变量，再进入内部循环（repeat=16 硬上限）。内部每轮读取历史 → 基础 LLM → 合并响应 → 存在待执行调用。IF 真分支执行 ToolCalls 并合并结果，假分支只选择合并响应；普通叶子将选择值显式写回历史。break 读取“存在待执行调用”的取反，没有调用时直接结束，不遍历 continue。循环后读取最新历史并返回最后文本。一个基础 LLM 支持连续多轮交流，不再使用 next/current 回边；模板不隐式裁剪历史，可自行接入 Messages.trim。

Tools.get 接入 builtin:list_classes；仅查询世界。模型是否请求工具由服务决定，模拟验收不能替代真实供应商验证。失败不提交记忆。

“新建 Multiagent 示例”创建两个可编辑 Agent：创作 Agent 将审校 Agent 的 Agents.get 同时接入 LLM 和 ToolCalls，模型可自主调用审校。调用 Schema、模型和预算可分别编辑。

## 模型、技能与聊天

根调用的 defaultModelId 沿子调用传递，图中显式模型优先。聊天在创建会话时固定 Agent，后续可另选模型；执行归属见 [聊天](chat.md)。技能发现、启动及用户强制加载见 [Skill](skills.md)，不会通过模型连接配置授予能力。
