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
| `src/ui/AppRoot.tsx` | 页面切换、三种侧边栏、项目树、会话树与同步调度 |
| `src/ui/App.tsx` | 对象字段、实例列表、集合页、关系网和通用视图配置 |
| `src/ui/DocumentWorkspace.tsx`、`MarkdownSourceEditor.tsx` | MD 导入、可编辑双栏源码面板及固定顶栏标题、双向编辑与定位高亮 |
| `src/ui/SchemaEditor.tsx`、`SortHandle.tsx` | 属性结构编辑、属性和实例共用的指针排序 |
| `src/ui/GraphConfigPage.tsx`、`GraphEdge.tsx`、`ColorPicker.tsx` | 实例映射、线条填充与外边框、箭头、文字开关、背景域、自定义 ARGB 颜色预设网格 |
| `src/ui/ChatPage.tsx`、`ModelSelector.tsx`、`ModelsPage.tsx` | 本地对话、模型选择及连接编辑 |
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

- 创作、插件、设置使用不同侧边栏。创作侧边栏的“我的项目”包含全部世界；选择世界打开自身集合页。
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
| 模型新增/编辑/停用/删除与聊天模型选择 | 已实现配置，未发起模型请求 |
| 聊天会话管理与用户消息保存 | 已实现本地功能，未生成模型回复 |
| 地图全操作区 UI、地图文件/图例配置 | 已实现界面，地图加载与交互待接入 |
| 关系线型、发光 | 划线类各自渲染，发光已应用；双实线待完善 |
| Function 函数 | 脚本管理、测试、属性绑定、自动运行、Markdown 双向解析及返回值引用已实现；依赖系统运行环境 |
| 技能、工具、插件安装 | 占位页面，功能待接入 |
| LangChain、LangGraph、多 Agent、插图生成及章节自动写作 | 后续目标，尚未接入 |

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
