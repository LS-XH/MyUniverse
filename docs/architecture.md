# MyUniverse 结构说明

更新日期：2026-10-09。需求与验收边界见 [Planning](../Planning.md)，界面规则见 [界面与交互](ui-interactions.md)，数据格式见 [Markdown 双向编辑](markdown-sync.md)。

## 项目目录与职责

| 目录或模块 | 职责 |
| --- | --- |
| `src/model/types.ts`、`templates.ts` | 世界、项目树、类、实例、属性结构及默认模板 |
| `src/model/markdown.ts`、`markdownParser.ts` | Markdown 双向序列化、引用、类型解析、实体与字段的源码行定位 |
| `src/model/merge.ts` | 基线、界面和磁盘三个版本的合并与冲突检测 |
| `src/model/graphGeometry.ts` | 多选整体位移、动态连线画布范围、边缘平移速度、光标锚点缩放 |
| `src/model/models.ts`、`themes.ts` | 模型连接配置、主题色、旧工作区兼容 |
| `src/services/storage.ts` | 加载、外部刷新、排队保存、导入替换与同步冲突处理 |
| `src/ui/AppRoot.tsx` | 页面切换、四种侧边栏、项目树、会话树与同步调度 |
| `src/ui/App.tsx` | 对象字段、实例列表、集合页、关系网和通用视图配置 |
| `src/ui/DocumentWorkspace.tsx`、`MarkdownSourceEditor.tsx` | MD 导入、可编辑双栏源码面板及固定顶栏标题、双向编辑与定位高亮 |
| `src/ui/SchemaEditor.tsx`、`SortHandle.tsx` | 属性结构编辑、属性和实例共用的指针排序 |
| `src/ui/GraphConfigPage.tsx`、`GraphEdge.tsx`、`ColorPicker.tsx` | 实例映射、线条填充与外边框、箭头、文字开关、背景域、自定义 ARGB 颜色预设网格 |
| `src/ui/ChatPage.tsx`、`ModelSelector.tsx`、`ModelsPage.tsx` | 实际模型/Agent 对话、模型选择及连接编辑 |
| `src/ui/SettingsPage.tsx`、`theme.css`、`style.css` | 主题设置、界面布局、滚动条与动画 |
| `src/ui/MapPage.tsx` | 占满操作区的地图示意界面 |
| `src-tauri/src/lib.rs` | 桌面文件读取、路径范围校验、写入前比较 |
| `src-tauri/icons` | 桌面程序静态图标 |
| `tests`、`scripts/test-markdown.mjs` | Markdown、同步、排序、模型和关系网测试 |

## 数据保存与数据源

正式桌面程序把生成的用户数据写入可执行文件同级的 `user` 文件夹；开发模式位于启动命令的工作目录。

```text
user/
  workspace.json
  worlds/<世界 ID>/
    人物列表.md
    人物列表.schema.json
    关系类型.md
    关系类型.schema.json
    势力列表.md
    势力列表.schema.json
    地点列表.md
    地点列表.schema.json
    事件列表.md
    事件列表.schema.json
    关系网.json
    地图配置.json
    聊天框配置.json
    <用户新建类的 Markdown 与属性配置>
```

Markdown 一级标题表示类、二级标题表示实例，后续标题表示属性；Class 引用为 Markdown 链接。`.schema.json` 保存键/值类型、可重复性、Class 指向及属性顺序。`workspace.json` 保存项目树、稳定 ID、主题、模型连接和完整状态缓存。关系网 JSON 保存位置、映射与背景域开关；聊天配置保存会话、当前会话、所选模型和 Agent/文件/Skill 配置。

启动时从 Markdown 还原实例，不能仅依赖缓存 JSON。文件操作页直接编辑对象或右侧源码，均解析为程序对象后进入同一保存流程。桌面版恢复焦点、可见性变化、定时检查及写入前重新读取磁盘；三方合并保留独立修改，冲突时提示选择。后端比较读取后与写入前的内容，避免覆盖期间出现的新编辑。详细边界见 [同步文档](markdown-sync.md)。

浏览器预览使用 localStorage，不具备持续读取桌面文件的能力。模型连接保存于工作区 JSON，API Key 输入隐藏，但本地保存没有实现额外加密。

## 模板与兼容

人物“人物关系”是 Object，其可重复子项的键引用人物实例，值为 Object；其中“关系”是 `Class-关系`，不能继续作为任意 Text。加载旧工作区时迁移这一类型，旧文字值匹配已有关系名称时转换为引用。人物势力包含 `Class-势力` 和文本地位，关系卡片从这两项读取副标题。

旧工作区补充空模型列表、会话默认值和主题缺失颜色。主题颜色采用 CSS 变量，ARGB 转换为浏览器颜色；“Markdown 当前行高亮”默认透明浅绿色，可在自建主题中修改。

## 界面与交互实现

- 创作、插件、模型、设置使用不同侧边栏。创作侧边栏的“我的项目”包含全部世界；选择世界打开自身集合页。
- 集合、文件与视图可折叠；会话和新建聊天位于聊天框树下。创建入口和项目树统一滚动；创作树使用右对齐的向下/向右展开箭头，单击打开页面与箭头/双击展开相互独立，引导线按父对象图标对齐，不延伸到侧边栏底部。
- 文件字段与实例名称直接编辑。属性和实例使用共用指针排序，提供随光标移动的副本、动态占位及其他项平滑让位，布局计算位于 `sortGeometry.ts`，避开 Tauri 原生拖放拦截；同父排序、取消及自动滚动见交互文档。
- Markdown 源码使用独立双栏布局，为编辑列留出空间；人物详情仍为右侧浮动面板。源码通过按钮或 Esc 关闭，空白点击保持打开。源码可编辑，标题分级放大加粗，左侧选中字段时按实际排版定位并高亮对应行。
- 关系网支持拖动画布保留选择、空白点击取消选择、拖动人物边缘自动平移、8%–300% 光标中心缩放、多选与整体拖动、连线预览和主语到目标的方向箭头。线条填充与外边框分层，箭头采用同一颜色和粗细，缩短线段避免重叠；悬停增强原样式。关系文字显示开关保存到配置。连线范围动态计算，支持远距离节点与负坐标。
- 导航指示条、按钮、集合和实例卡片有交互动画；滚动条通过 CSS 使用主题色和圆角滑块。
- 三种主题预设可直接使用，自建主题可编辑。模型树支持连接管理，聊天菜单选择启用的模型。

## 运行与验证

1. `npm install`：安装依赖。
2. `npm run dev`：浏览器预览。
3. `npm run tauri dev`：开发桌面程序。
4. `npm run build`：TypeScript 检查与前端构建。
5. `npm run tauri build -- --no-bundle`：生成桌面可执行文件；`npm run tauri build` 同时构建安装包。
6. `npm run desktop:build`：统一覆盖正式 exe 并更新项目根目录快捷方式。
7. `npm test`：运行当前测试集合（数量随新增用例变化）。
8. 在 `src-tauri` 中执行 `cargo test --release --lib`：后端文件比较与路径校验测试。

桌面交付使用 `scripts/build-desktop.ps1`：先在 `src-tauri/target-next` 构建，再覆盖 `src-tauri/target/release/my-universe.exe`，并更新项目根目录 `my-universe.exe - 快捷方式.lnk`。快捷方式的工作目录为 release 目录，用户数据仍位于 exe 同级 `user`。正在运行的程序无法覆盖时脚本提示关闭后重试，保留已构建文件，不自动结束应用、不增加版本后缀 exe。

## 当前边界

| 功能 | 状态 |
| --- | --- |
| 项目树、对象编辑、排序、MD 导入及双向同步 | 已实现 |
| 关系网选择、整体拖动、方向箭头、详情与基础样式 | 已实现 |
| 模型新增/编辑/停用/删除与聊天模型选择 | 已实现配置、自动发现与请求 |
| 聊天会话管理与用户消息保存 | 已实现会话及 LLM/Agent 回复 |
| 地图全操作区 UI、地图文件/图例配置 | 已实现界面，地图加载与交互待接入 |
| 关系线型、发光 | 划线类各自渲染，发光已应用；双实线待完善 |
| Function 函数 | 脚本管理、测试、属性绑定、自动运行、Markdown 双向解析及返回值引用已实现；依赖系统运行环境 |
| HTTP 工具 | 注册、配置、Agent 调用已实现 |
| 技能、插件安装 | 占位页面，功能待接入 |
| Agent 节点工作流、ComfyUI 绘图 | 执行器和接口已实现；真实服务出图待验收 |
| LangChain、LangGraph、多 Agent 协作、章节自动写作 | 后续目标 |

构建通过不等于桌面 UI 验收通过。当前浏览器已验证拖动、双向编辑、高亮跳转及关系箭头，桌面实际交互仍需使用新版程序验收。

## Function 模块

`src/model/functions.ts` 处理函数定义、输入、引用与删除；`src/services/functions.ts` 构建执行任务并校验过期结果。`FunctionContext` 共享注册函数，`FunctionBindings` 复用属性绑定，`DerivedReferenceSelect` 复用原值/返回值选择。`FunctionsPage` 提供脚本编辑和测试，`src-tauri/src/functions.rs` 调用 Node.js/Python 进程并处理超时、类型校验和临时文件清理。详细运行边界、数据格式和存储路径见 [Function](functions.md)。

## 插件文件夹与树视图

`src/model/pluginFolders.ts` 管理跨分类隔离的文件夹结构与路径；`PluginTree.tsx` 和 `PluginFolderContents.tsx` 共用树与集合展示。Workspace.pluginFolders 保存分类与 parentId，FunctionScript.folderId 保存所属文件夹；文件夹为逻辑组织结构，不改变脚本磁盘路径或函数 ID。删除时提升直接子项，保留脚本代码、引用与函数绑定。

## Flow 与对象 API

src/model/flow.ts 验证无环图并编译 JS；worldApi.ts 构建世界只读快照与稳定 ID 调用。FlowEditor 提供画布、端口和卡片库；ObjectPicker、FunctionCodeEditor 共享对象选择与调用插入。执行服务用函数内容和世界原始数据版本丢弃过期结果，排除布局变更及生成结果。Tauri 保存并加载 .flow JSON，编译后复用 JS 执行链；Node/Python 提供同一 world 接口。

## 关系网共同属性更新

model/bulkEdit.ts 按 schema ID 查找选中人物共有叶子属性，区分共同值与混合值，并使用各实例字段 ID 批量更新。GraphPage 复用 FieldEditor 呈现共同属性，排除不能唯一匹配的成员。graphGeometry.edgePanVelocity 接收卡片组边界，按距边缘距离计算速度；滚轮使用非 passive 原生监听，支持拖动期间缩放。

PageSession 按路由身份保存页面会话状态及滚动位置，usePageState 使用显式属性名缓存视图状态，卸载页面时释放拖动监听而不保留过期世界数据。SidebarActions 复用当前页面实际按钮，保持动作行为一致。

## 成员卡片、紧凑控件与顶栏复用

设计理由及参数详见 [设计原则](design-principles.md)。

- FieldCard.tsx：文件 FieldEditor 与属性 SchemaRow 共用视觉外壳，保留 data-field-id / data-sort-id。指针相对坐标写入局部 CSS 变量；动画不通过 React 状态改变世界或属性结构。最近的嵌套卡片独立激活，触摸不启用倾斜。样式作用域限制为 entity-fields 与 schema-editor-content。
- theme.css：成员编辑区取消 object-body / schema-children 层级线，收减缩进；通过主题色与 CSS 过渡实现卡片缩放、倾斜及添加按钮反馈。导航树的竖线保留。
- App.tsx / ReadOnlyFunctionValue.tsx：短文本使用隐藏内容测量层决定宽度，Content 保留多行宽幅输入；reference-picker 使用可换行的紧凑 flex 组，将 DerivedReferenceSelect 与引用按钮优先同排。
- PickerMenu.tsx：引用菜单脱离成员卡片和滚动容器，以页面浮层定位，不因倾斜或卡片边界截断选项。
- DocumentWorkspace.tsx：源码列在文档布局中分配宽度；文件名、保存状态和唯一 PanelRight 开关通过 portal 放入主顶栏。标题区宽度与源码列对应，按钮固定右上角，SidebarActions 仍复用此实际按钮。
- TreeDisclosure.tsx：独立管理右侧 22px 展开按钮的事件，阻止事件传播，展开使用 ChevronDown，收起使用 ChevronRight。页面选择与子树展开由调用方分别处理。

这些模块只调整界面呈现与动作入口，不增加保存格式，也不改变 Markdown 或 Function 类型协议。文档修改本身无需重新打包。

## 模型执行模块

`model/workflows.ts` 定义节点、端口、连线、DAG 校验和 Comfy API 图转换。`services/modelHttp.ts` 统一浏览器 fetch 与 Tauri 网络桥；`services/llm.ts` 实现模型发现与生成；`services/workflows.ts` 求值 Agent、编译绘图输入、提交及轮询 ComfyUI。`WorkflowEditor.tsx` 复用画布交互，`ModelWorkflowPage.tsx` 管理工作流与运行结果，`ToolsPage.tsx` 管理 HTTP 工具。后端 `model_http.rs` 使用 reqwest，支持 JSON 和带鉴权图片读取。配置、图和变量保存于 workspace.json，旧模型连接 ID 保留。详见 [模型与智能体](models-and-agents.md)。

## 顶栏动作复用

TopbarActions 读取当前页 heading-actions 或 editor-file-actions 中的真实按钮，以图标入口调用原按钮；监听页面按钮变化，同步禁用与开关状态。源按钮始终保留事件与确认逻辑，非文件夹页仅隐藏源按钮组，文件夹页保留两处入口。Markdown 标题开关仍固定右侧，顶栏动作组根据源码列宽度向左过渡。工作流工具栏通过 React toolbar 插槽接收配置与运行按钮，避免双工具栏。

## 打开文件所在位置（2026-10-09）

主顶栏动作组提供 FolderOpen（20px），用于在 Windows 资源管理器中定位并选中当前实际存储对象。点击前等待同一保存队列完成一次保存，确保新建文件已落盘；同步冲突或定位失败在同步提示区显示，不跳过已有冲突保护。

| 页面 | 实际位置 |
| --- | --- |
| 文件操作 | user/worlds/<世界 ID>/<类文件>.md |
| 属性配置 | 同目录的 <类文件>.schema.json |
| 世界/集合 | user/worlds/<世界 ID> 文件夹；集合是逻辑树，未建立独立实体目录 |
| 我的项目 | user/workspace.json |
| Function | user/functions/<函数 ID>.js、.py 或 .flow |
| Function 文件夹 | user/functions；插件文件夹为逻辑组织 |
| 模型、SD 工作流、Agent、Tool、主题 | user/workspace.json（当前统一持久化文件） |
| 关系网/地图/聊天配置 | 世界目录中的对应配置 JSON |
| 关系网、地图等操作画布 | 无对应独立内容文件，不显示按钮 |

按钮悬停提示实际相对路径。浏览器的配置位于 localStorage，不能打开系统资源管理器，因此按钮禁用并提示桌面版可用。后端只接受 user 目录内的独立路径组件，拒绝空路径、路径穿越、绝对路径、不存在文件以及解析后指向目录外的链接；资源管理器使用独立进程参数，不经过 shell。包含中文和空格文件名的解析、越界及缺失路径拒绝已通过 Rust 测试。

## 工作流类型与编辑层（2026-10-09）

`model/workflowValues.ts` 定义变量类型、信封、Messages/Image、类型成员目录与校验；`services/workflows.ts` 根据声明执行并维护命名输出与成功运行变量克隆。`services/workflowImages.ts` 负责保存适配，桌面 `save_workflow_image` 在 user/images 内创建新文件，拒绝路径和同名覆盖。

`model/graphEditing.ts` 负责片段复制、ID 重建、删除关联线、矩形相交与双向端口规范化。`ui/useGraphEditing.ts` 负责剪贴板与图快照历史，`ui/useCanvasEditing.ts` 负责选区、组拖动、连接手势与快捷键。Agent/SD 与 Function Flow 复用交互层，保留独立图 schema。详见 [workflow-types.md](workflow-types.md)。


## 工作流运行观察与变量池（2026-10-09）

执行状态独立于持久化图定义：节点依次发出 waiting、running、complete，异常标记 error，取消标记 cancelled。运行面板将当前执行节点高亮；每条实际经过的连线记录本次输出及实际类型，显示紧凑摘要，悬停查看完整值。观察事件使用副本，不能改变程序数据。编辑器播放在节点开始时短暂停留，普通调用不附加展示延迟。

变量池维护 `{id,type,value}` 类型信封。id 是稳定身份，name 是可编辑的索引；节点通过下拉列表选择兼容类型的变量。新建、改名、改类型、初始值编辑和绑定节点修改纳入同一撤销快照。改名同步节点绑定以及各世界的 Agent memory；改类型同步 value 端口，兼容值保留，不兼容值恢复类型默认值。连接保留，运行校验提示不兼容类型。旧的原生值可以推断基础类型，无法推断的对象需明确指定类型。

运行使用工作副本，变量池实时显示变量写入结果；成功后提交 Agent 记忆，失败或取消不提交临时值。变量池显示最近运行值时，初始值编辑仍明确标注，避免混淆。运行中禁用图定义与变量编辑，保留平移、缩放、查看完整值及面板开关。

ComfyUI 原生节点的执行通过 WebSocket 按 prompt_id 过滤，桌面端使用原生连接并通过 Tauri 事件桥接，支持 Bearer 认证。浏览器使用 WebSocket。原生 ComfyUI 公开事件不包含所有 Tensor 的实际值，因此对应连线显示“服务端数据 · 类型”；不会编造 Tensor 数值。宿主节点的值正常展示。事件通道不可用时提示并继续 HTTP history 查询。真实模型与 GPU 联调仍需要实际服务。

节点库与变量池都采用固定 header 加独立滚动内容区。节点库标题、收起按钮和工具栏保持顶边对齐，滚动只作用于搜索与分类列表；此结构同步用于 Function Flow。变量池位于画布右下方，可用分页按钮滑动收起。

最新图标规范覆盖早期方案：模型入口 Sparkles，插件 Puzzle；LLM 使用与模型项一致的 Bot，SD 项及节点使用 SquareSparkles，工具独立分类 Wrench；String 为 Letters，Boolean 为 Binary，其他变量类型 ScanBox，方法 FileCodeCorner，属性 FileBox。缺少的 Lucide 图标使用本地官方 SVG 与 ISC 授权，无运行时下载。


## 界面操作类型的对象投影（2026-10-09）

采用 `World.views[id]: InterfaceView`，每个视图必选父 ClassDocument，显示元素由稳定 ID 路径绑定，支持当前实例与固定对象、Markdown 序列化文本与内容值。关系网和地图共享绑定解析器；源对象编辑写回原 Markdown，布局独立保存到 `<view-id>.view.json`。集合层级是 JSON 虚拟组织，所有文件继续平铺在原 world 目录，另输出 world-index.json 组织清单；旧项目自动补默认绑定，不移动文件。视图配置纳入读取、三方合并与写前竞态检查。详细结构、上下文和兼容边界见 [界面操作类型与数据结构](interface-views.md)。
