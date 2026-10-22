# 架构与源码导航

React 19 + TypeScript + Vite 构建前端，Tauri 2 提供文件、Python 子进程和网络桥。项目使用自己的 Graph 执行器；LangGraph 图标不表示引入该 SDK。规则主体按 [UI](ui/README.md)、[数据](data/README.md)、[功能](features/README.md) 维护，本文件只说明实现关系。逐文件入口见 [源码索引](source-map.md)。

## 分层

| 层 | 入口 | 职责 |
| --- | --- | --- |
| 启动与状态 | [main.tsx](../src/main.tsx)、[AppRoot](../src/ui/AppRoot.tsx) | 加载、Workspace、运行归属、主机绑定、导航与自动存档 |
| 结构与纯计算 | [types.ts](../src/model/types.ts)、src/model | Schema、Markdown、引用、图校验、投影、三方合并及兼容 |
| 服务 | src/services | 存储队列、脚本草稿、Worker、Graph、模型、Skill 和会话执行 |
| UI | src/ui | 对象编辑、共享控件、页面会话、观察与拖动 |
| 桌面 | src-tauri/src | JSON/导出、受管包、Python、HTTP/SSE、ComfyUI WebSocket |
| 支撑 | scripts、tests、src/assets | 构建交付、内存夹具、回归、离线图标与授权 |

## 工作区恢复与保存

~~~mermaid
flowchart LR
  JSON[workspace.json] --> Load[storage.loadWorkspace]
  Load --> Normalize[后台规范化]
  Packages[user/skills] --> Catalog[skillStorage 包目录]
  Normalize --> State[内存 Workspace]
  Catalog --> State
  State --> Archive[checkpointWorkspace]
  Archive --> Strip[剥离内存 skills 并编码]
  Strip --> JSON
  Archive --> Packages
  State --> Export[显式 saveWorkspace]
  Export --> Files[MD / Schema / 视图 / 脚本导出]
  Files --> Import[显式导入或刷新]
  Import --> State
~~~

normalizeWorkspace 串联官方工具安装、Agent 旧配置迁移、工作流类型迁移、视图安装、聊天运行中断和函数来源清理。readArchive 另加载技能并执行精确出厂升级；稳定标志见 [配置数据](data/integrations.md)。源码导出文件不参与启动恢复。

useWorkspaceArchive 约 250ms 合并写入，storage 串行队列先保存变更技能，再编码完整 JSON；显式导出投影不会覆盖权威 JSON。useDiskMarkdown 只在预览可见时读原文，后台任务生成源码/位置/差异，不导入对象。DocumentFileActions 统一对象页与关系图源类的导入/填入/重算，DocumentWorkspace 负责编辑和预览。

## 对象编辑与页面状态

AppRoot 统一持有 Workspace，latest 引用供异步回调定位最新状态；对象更新协调变更实例的函数来源。App.tsx 包含实例与关系图页面，SchemaEditor 适配声明变更，instanceEditing/bulkEdit/attributeFilter 处理稳定身份下的副本、批改和局部呈现。

PageSession 使用对象 ID 保存滚动、搜索、选择、视角、展开及历史；useVisitHistory 单独保存路由快照。treeMoves/treeOrder 提交组织和真实 DOM 顺序，useTreeDrag 呈现固定命中坐标、占位与 FLIP；SortHandle 处理实例/Schema 及选中组排序。TopbarActions/SidebarActions 复用真实页面按钮及禁用状态。

## 脚本执行链

Function: FunctionsPage/Schema 绑定 → recompute 或 functionExecutor → background → services/functions → beginScript/createHostWorldApi → add 校验 → 按实例三方合并与 functionRuns 提交。FlowGraph 先由 model/flow 编译为 JS。Python 经 run_function → functions.rs 子进程 → 操作日志 → 同一世界门面重放；JS 正常路径不需要 Node 子进程。

Tool: runTool → canonicalTool → Schema 校验 → builtin 分派 / HTTP / JS Worker。JS 先检验可传输结果再提交草稿；只读提示限制门面写入。Skill 专属 JS Tool 使用同一运行器，但不进入全局工具集合。

## Graph 与模型调用链

model/workflows、workflowControl、workflowScopes 负责图定义、端口及内部作用域校验；services/workflows 负责全叶子依赖求值、惰性条件、顺序、loop.body 和 Method.graph。variablePool/workflowBindings 管理稳定变量身份、绑定、定义和记忆同步；编辑使用 WorkflowEditor/WorkflowPorts/useCanvasEditing/useVariableDrag。

runAgent 建立根 agentRuntime，子调用共享预算、世界、取消及事件，各有独立变量；返回暂存 memoryChanges，由 AppRoot 或工作流运行页在根成功后 commitAgentMemory。基础 LLM 调用 llm/modelHttp 一次，ToolCalls 分派已接入能力；旧自动 LLM 保留 16 轮兼容循环。

llm 负责连接参数、标准消息、工具描述、增量合并和用量快照；modelHttp 经浏览器 fetch 或 Rust model_http/model_stream，SSEDecoder 统一解析字节。SD 本地求值后构造原生 Comfy prompt，服务端执行 Tensor，通过 history/view 取图、WebSocket 观察。

## 聊天、成员与技能

AppRoot 按发起 worldId/conversationId 管理根请求，将事件批量并入 chatRuns；Conversation.modelMessages 保留完整协议，ChatExecution 展示调用树。ChatComposerInput/composerDom 处理原生光标、IME 和原子标签，chatDirectives 解析身份与调用级强制技能。

预置 Agent 经 presetDefinition 生成只读核心图。AgentSkillManager 每次调用独立发现、激活技能与注册工具；Runtime 文件工具经 services/runtimeSkills → skillToFiles/skillFromDisk → checkpointWorkspace → skillStorage 保存。文件读取不代表技能激活或许可。

AgentSession 经管理 Tool 创建临时高级成员，保存各自私有协议、公开消息和游标；仅合法完成输出公开。插话中断当前主请求或成员，保留根预算与已完成发言，再由主 Agent 决策。structuredOutput 使用终结工具和一次强制纠正，不把未校验正文公开。角色与旁白策略在标准包，RoleplayOutput 只负责呈现。

instanceProposals 产生并定位 pending 提议，AppRoot 接受用户决定；proposalMerge 做成员及文本冲突合并，采纳/回退进入 JSON 自动存档。ChatUsage/ChatUsagePanel 汇总模型事件，不估算正文 Token。

## 投影、样式与运行日志

interfaceViews 统一 current Schema 路径和 fixed 成员路径，人物与关系类型网投影源对象，地图独立位置覆盖。graphLayout/graphGeometry 处理布局、曲线、聚焦和连线几何；视角和拖动预览不重复计算内容投影，释放后提交布局。

main 单次加载 styles/index.css：语义主题 → Token → 家族皮肤 → 布局 → 现代组合层。FieldCard、ReferencePicker/ReferenceOption、Select/PickerMenu、ConfigCard、ColorPicker 和 portalTheme 提供复用；图标离线打包，授权保留在 assets。

runtimeLog 是独立限量外部存储，主线程、Worker 和 Python 回传日志；RuntimeLogPanel 为覆盖层，不写 Workspace。运行日志与 docs/changelog 的开发历史是两种记录。

## 提交与取消边界

| 操作 | 提交单位 | 失败或取消 |
| --- | --- | --- |
| 一次 Function/JS Tool | 草稿世界或目标实例，冲突校验后提交 | 本次未提交草稿丢弃，外部副作用不回滚 |
| 批量函数/正文导入 | 已完成实例；导入末尾再应用删除和顺序 | 保留已完成项，不承诺跨实例事务 |
| 官方提议批量采纳/回退 | 一批内存修改 | 任一冲突整批不提交 |
| 自定义 Agent 记忆 | 根成功后的全部暂存记忆 | 基线/定义冲突、失败或取消不提交 |
| 成员发言 | 通过输出校验的单次成员历史、发言、游标 | 未完成不发布，已完成可在根后续失败时保留 |
| JSON/文件导出/包写入 | 单文件替换 | 没有跨文件事务，可能已有部分文件写入 |

JS Worker 可终止同步任务；Python/普通原生 HTTP 取消主要停止等待及拒绝晚到提交；SSE 可按请求取消；ComfyUI 停止等待不撤回服务任务。精确限制分别见 [Function](features/functions.md)、[Tool](features/tools.md)、[聊天](features/chat.md) 和 [保存](features/persistence.md)。

## 扩展入口

新增对象先明确身份、类型、恢复来源、写入范围和复用载体，再扩展模型/服务/UI 与对应专题；官方工具保持稳定 ID。开发命令与夹具见 [开发指南](development.md)，未实现项见 [总体设计](../Planning.md#实现边界)，历史原因见 [日志](changelog/README.md)。
