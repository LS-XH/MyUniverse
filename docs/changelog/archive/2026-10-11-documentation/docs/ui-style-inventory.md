# 迁移前 UI 样式盘点（历史基准）

盘点日期：2026-10-10。范围：`src/ui` 全部组件、两个全局 CSS、主题定义，以及组件和拖动代码产生的交互样式。下文记录迁移前状态，不代表当前文件位置与复用结构；当前实现见 [UI 样式维护指南](ui-styles.md)。

这是源码审计，不是逐页浏览器实测；下文的“无按下效果”指没有找到该对象自身的按下视觉规则，仍可能受祖先元素的动画影响。原生 select 展开后的选项、checkbox、range 的具体外观还受操作系统和浏览器影响。文末提供全量 CSS 类名索引，布局类与业务状态类也在其中，方便补查。

## 1. 先澄清当前的复用方式

入口 `src/main.tsx` 依次加载 `style.css`、`theme.css`。前者提供基础尺寸、布局和大量固定颜色，后者提供主题覆盖、页面特化和多轮追加覆盖。**最终表现需要结合选择器优先级、源码顺序、DOM 结构、状态类和 JS 一起判断，不能只看某个同名 class 的第一段定义。**

当前已存在部分共享载体：`TreeDisclosure`、`FieldCard`、`PickerMenu`、`ObjectPicker`、`ColorPicker`、`WorkflowIcon`、`LibraryFolder`。但共享组件与共享视觉规则尚未完全对应：树行共用 `.tree-row`，工作流库行却主要用 `.flow-library-folder/.flow-palette-item`；图标按钮的按下效果仍散落在特定容器和特化类里。

这里的“父 CSS”建议理解为**同类元素共同使用的基础类**，而不是 DOM 父元素。CSS 的背景、边框、阴影、transform 不会自然继承；需要让每个元素显式使用基础类，再由修饰类覆盖必要细节。业务容器只负责布局，避免换个容器就改变按钮的反馈。

来源：`src/main.tsx:4`；`src/ui/style.css:2`；`src/ui/theme.css:314`、`:343`、`:705`、`:955`。

## 2. 你已有清单中需要修正的地方

| 对象 | 当前真正的表现 | 和原描述的差异 |
|---|---|---|
| `.heading-actions` 按钮 | 悬停上移 1px，阴影增大；按下缩放 .96，阴影减小；primary 有单独颜色规则 | 容器规则作用于所有 button，不仅 ghost；部分对象页面的这组按钮还被隐藏并由顶栏承接 |
| 普通 `.ghost` | 普通按钮底色、边框；悬停 `hover`；自身没有缩放规则 | 放入 heading/editor 容器后，会获得额外反馈 |
| `.icon-button` | 透明无边框；悬停 `hover`、文字变主文字色 | 通用类没有按下缩放；顶栏、插件添加等特化位置才有；也没有统一的按下阴影 |
| `.collection-card` | 悬停 `hover`、上移 1px、增加阴影；按下 .975 | 边框最终为 `accent` 45% 与 `border` 混合，而不是纯 `accent` |
| `.round-add` | 常态无边框；悬停上移 1px、内阴影模拟边框、强调色外发光；按下 .94 和渐变背景 | 悬停用的是 `active`，并非 `hover`；按下没有独立缩小阴影的声明；默认形状是圆角矩形 |
| `.add-inline` | 全局仅文字变强调色；成员/Schema 区域悬停 `hover`，按下 `active` + .98 | 两种行为由祖先容器决定；`.add-schema` 在这些区域共享同一套反馈 |
| `.text-reference-short/content` | short 用隐藏伪元素量宽；content 占满可用宽度 | 两者主要决定布局；输入框颜色和 focus 来自 `.field input/textarea` 等规则 |
| `.flow-library-search-area` | 搜索区的间距和背景容器 | 内部复用了 `.entity-search`，不能把它当成另一种输入框 |
| `.field-depth-1` 等 | 深度间距调整 | 3D 反馈来自 `.field-card`、限定祖先和 `FieldCard.tsx`；不由 depth 类提供 |
| `.flow-input/output-row` | 悬停强调色 outline + 浅发光；没有位移缩放 | 还有 `.flow-input-output-row`，应一起归类；内嵌变量另有突出/按下反馈 |

来源：`theme.css:54–57`、`:314–317`、`:343–347`、`:700–714`、`:769–772`、`:955–964`、`:1010`；`WorkflowEditor.tsx`、`FlowEditor.tsx` 的搜索区结构。

## 3. 导航、树、可选择列表

| 类型 / 现有选择器 | 形态与交互 | 合并判断 |
|---|---|---|
| 主导航 `.rail button/.rail-selection` | 方形圆角图标项；悬停选中底色和强调文字；当前项由一个背景块滑动到对应位置，带侧边指示条 | 共享导航项基础，滑动指示器保留为导航特化 |
| 通用树行 `.tree-row/.tree-main` | 紧凑圆角行，文本省略；常态 treeItem；悬停 hover + text；选中 treeSelected + accent | 创作、插件、模型树已有部分共享，可作为树行基础 |
| 树根 / 标题 `.world-row/.projects-heading/.create-entry/.plugin-root-row` | 调整高度、字重、图标与辅助数量；active-world 有选中底色 | 基础树行上的 root/heading/create 修饰 |
| 树分支 `.tree-node/.tree-branch/.plugin-tree-branch/.settings-tree-branch/.workflow-library-branch/.flow-library-branch` | 结构包装与缩进；多数连接边线为透明或伪元素已关闭 | node/branch 本身不是另一套交互皮肤；统一缩进变量和分支结构 |
| 树配置 / 行内动作 `.config-row/.tree-config/.plugin-folder-add/.chat-record-delete` | 小一号配置行；部分动作平时隐藏，行悬停或聚焦时出现；插件添加按下 .9 | 共用行内 action，统一 hover/focus-visible 的显隐约定 |
| 展开按钮 `.tree-disclosure` | 透明小图标按钮；悬停 hover；按下 .92；键盘强调色轮廓 | 图标按钮的 disclosure 变体，业务保留展开状态 |
| 设置分组 `.settings-tree-heading` | 较粗的标题行；悬停和 active 都用 hover 背景 | 与通用树行选中表现不同，应统一 active 语义 |
| 模型导航 `.model-nav-row` | 悬停 hover + text；active 用 active + accent；模型树父级又覆盖尺寸和背景 | 合入树行，保留 meta 数量与尺寸差异 |
| 主题导航 `.theme-nav-row/.sidebar-add` | 圆角行、图标/缩略图；悬停 hover，当前主题 active；添加文字强调色 | 行皮肤共用；缩略图保留 |
| 插件导航 `.plugin-nav` | 悬停与选中均为 active + accent | 与 tree-row 不一致；需要确认实际页面使用范围 |
| 工作流目录 `.flow-library-folder` | 32px 左右的圆角标题行；悬停 hover；点击展开/收起 | 可复用树行皮肤，展开命令仍由目录组件负责 |
| 工作流库项 `.flow-palette-item` | 紧凑图标文字行；悬停 hover，按下 .97；grab；端口签名在 hover/focus 时滑入 | 树叶皮肤 + draggable 修饰；签名动画单独保留 |
| 聊天目录 / 会话 `.sidebar-folder/.conversation-row/.chat-record-row` | 圆角行；悬停 hover；选中 active；删除动作悬停出现 | 合入可选择行 / 树行基础 |
| 返回与新会话 `.sidebar-back/.sidebar-primary` | 返回只变文字；新会话为整行带边框按钮，悬停 hover | 分别合入文字按钮和普通按钮 |

注意：创作树的“点击打开、箭头或双击展开”和 `LibraryFolder` 标题整行点击展开不是同一个命令契约。统一视觉后仍需明确哪些行可导航、可展开、可拖动。

来源：`theme.css:67–104`、`:153–171`、`:247–263`、`:350–362`、`:488–495`、`:682–690`、`:717`、`:832–839`、`:971–973`；`TreeDisclosure.tsx`、`LibraryFolder.tsx`。

## 4. 按钮与动作控件

| 类型 / 选择器 | 当前表现 | 建议基础 |
|---|---|---|
| 普通 `.ghost` | button/buttonText、border、圆角；悬停 hover；无自身按下缩放 | Button + ghost |
| 强调 `.primary/.primary.big` | accent/accentText；悬停亮度 1.12；big 改尺寸 | Button + primary + size |
| 标题动作 `.heading-actions button` | 180ms 颜色/阴影、140ms 位移；上浮 1px；按下 .96，阴影收小 | 显式 elevated 修饰，避免由所在位置决定 |
| 图标 `.icon-button/.icon-button.subtle` | 无边框透明；悬停 hover；subtle 降透明度 | Button + icon + size/subtle |
| 特化图标 `.sidebar-toggle/.topbar-markdown-toggle/.topbar-page-actions .icon-button` | 悬停 hover；按下 .94；部分有 focus-visible 轮廓 | 图标基础 + pressed；尺寸交给变量 |
| 编辑工具栏 `.editor-actions button` | 悬停和 aria-pressed 用 hover；按下 .96 | Button + toggle/pressed |
| 图工具 `.graph-tools button/.canvas-controls button/.map-zoom button` | 紧凑圆角图标/文字；悬停 hover；tool-active 强调选中 | 普通或图标基础；选中状态独立 |
| 添加 `.round-add` | 无边框、圆角矩形；悬停上浮/发光，按下 .94 | Button + add + elevated |
| 添加 `.mini-add` | 小按钮、透明无边框、强调文字；悬停 active；无自身缩放 | icon/add 的小尺寸变体 |
| 内联 `.add-inline/.add-schema` | 文字加图标；成员/Schema 中共享 hover 和 .98 按下；其他区域仍有旧皮肤 | Button + inline；整行宽度是布局修饰 |
| 引用触发 `.reference-trigger` | 输入框形按钮；悬停边框 accent；自身无缩放 | Field 基础 + picker-trigger |
| 模型触发 `.chat-model-trigger` | 透明圆角文字图标；悬停/展开 hover + text；按下 .97 | Button + ghost/compact + expanded |
| 类型触发 `.variable-type-picker` | 小尺寸透明按钮；悬停 hover；无自身缩放 | picker-trigger 的 compact 变体 |
| 颜色触发 `.color-trigger/.color-done` | 色块 + ARGB；悬停边框 accent；完成按钮 accent | 前者 Field/picker，后者 primary |
| 发送 `.send-button` | 32px 强调方形按钮；disabled 透明度 .35；无自身 hover/按下规则 | primary + icon |
| 文本命令 `.code-api-tools button/.entity-search-empty>button` | API 项只 hover；清空搜索按钮 hover 并按下 .96 | text/ghost 基础，统一 press 策略 |
| 排序 `.sort-handle/.schema-grip/.variable-drag-handle` | grab/grabbing；部分悬停 active；部分按下变 accent | 图标基础 + drag-handle，不套普通 click 缩放 |
| 端口 `.flow-port` | 圆形连接点，悬停填充并扩散强调光圈 | 保留连接控件特化，不能只因 HTML 是 button 就套按钮位移 |
| 危险 `.danger/.project-delete/.model-delete` 等 | 多组不同固定红色；部分 !important 覆盖 | danger 是语义修饰，不应再定义完整按钮皮肤 |

全局 `button:disabled`：透明度 .4、not-allowed；工作流菜单、发送按钮、只读引用又各有覆盖。hover 的 disabled 排除也不一致，需要统一规则。

## 5. 菜单、选择器、弹出列表

| 类型 / 选择器 | 表现与状态 | 复用边界 |
|---|---|---|
| 对象右键 `.sidebar-object-menu` | 固定定位、228px、panel/border、阴影、可滚动、标题；菜单项 hover，按下 .97；危险项红色 | Menu 容器 + MenuItem + pressable |
| 工作流右键 `.workflow-context-menu` | 固定定位、188px、panel/border、阴影；菜单项 hover；无按下缩放；禁用灰化 | 同一 Menu 基础，静态 press 策略 |
| 引用 `.picker-menu/.floating-picker-menu` | 带边框浮层、圆角、滚动与阴影；项 hover；搜索 focus 带光圈 | 浮层基础 + 搜索型选择菜单 |
| 模型 `.chat-model-menu` | 输入区上方展开；160ms 淡入上移；hover/focus 同色；aria-checked 用 active/accent；附设置入口 | 同一选择菜单，保留锚点方向和双行条目 |
| 变量类型 `.variable-type-menu` | 固定 180px；hover；当前项由 JSX 的勾选标志表达 | Menu + selectable item；可补统一 selected 底色 |
| 补全 `.code-completions` | 代码区右下的圆角列表；当前索引 active；键盘选取由编辑器处理 | MenuItem 皮肤 + completion 行为 |
| 原生 `select` | ObjectPicker、Schema、函数设置、图映射/样式、视图绑定、聊天 agent、Tool 配置等 | 共用 Select 基础；不是每个容器一份皮肤 |
| 特化原生 `select` | 视图绑定/创建视图关闭原生外观，以 CSS 渐变画箭头；focus 带强调光圈；其他选择框多数保留原生箭头 | 箭头与 focus 应统一；原生弹出选项不能保证跨平台完全一致 |
| 颜色 `.color-popover` | 固定浮层、ARGB 滑条/数字/十六进制、预设、确认；色块 hover 放大 1.14 + 轮廓 | 浮层基础；颜色编辑内容特化 |

`PickerMenu` 已在 portal 后复制触发区域 CSS 变量，并跟踪滚动、缩放/窗口 resize、外部点击与 Esc；`VariableTypePicker` 也传递 portalTheme。合并 CSS 时需要保留这些行为，不能只抽取圆角与背景。

来源：`theme.css:43–48`、`:123–147`、`:384–399`、`:514–516`、`:637–644`、`:874–879`、`:918–927`、`:974–976`；`PickerMenu.tsx`、`VariableTypePicker.tsx`、`WorkflowContextMenu.tsx`。

## 6. 输入、只读值、编辑器

| 类型 / 选择器 | 当前表现 | 建议 |
|---|---|---|
| 标准输入 | `.field`、config、schema、style-row、model-form、modal、function-edit、object-picker、flow-node 中多份 input/textarea/select 规则；input 背景、border、text、7/8px 圆角；focus 部分仅边框，部分带光圈 | 统一 Field，尺寸/宽度由修饰覆盖 |
| 短文本 `.text-reference-short` | 隐藏 after 量宽，同格 input，最小宽度受容器限制 | Field + content-width |
| 多行 `.text-reference-content/.field textarea` | 全宽、多行、可纵向 resize，普通字段最小 91px | Field + multiline；最小高度是用途差异 |
| 名称 `.entity-name/.entity-header input` | 无边框透明；编辑图标 hover/focus 出现 | Field + bare + inline-name |
| 搜索 `.sidebar-search/.entity-search` | 图标 + 透明内部 input；entity-search focus-within 有 accent + 14% 光圈，sidebar-search 没有同样反馈；清除按钮 hover | SearchField 共用外壳和内部输入 |
| 搜索 `.workflow-library-search/.floating-picker-menu input` | 前者独立输入规则；后者主题输入 + 15% focus 光圈；节点库当前另用 entity-search | 收敛 SearchField；保持紧凑尺寸 |
| 密钥 `.model-key-input` | 普通输入，右侧显示/隐藏图标，占位 padding | Field 的 trailing-action 插槽 |
| 数字 / 范围 / 勾选 | schema repeat、setting/model enabled、颜色滑条、图样式数字；部分 accent-color 仍是固定值 | 独立 Checkbox、Range、Number 基础，不强套文本输入尺寸 |
| 引用 / 派生 `.reference-picker/.derived-reference-select` | 内容宽度按钮，类型标签与图标；派生结果 select 自适应宽度 | Field + reference 内容；宽度规则共用 |
| 只读 `.function-readonly-value` | 输入仍可选中文本；引用 disabled 特化为 opacity 1、default cursor | readonly 与 disabled 分开表达 |
| 代码 `.function-code/.flow-code-body textarea` | 等宽字体、行距 1.7、不同最小高度；function tab-size 4；独立页面中全高、无边框、禁 resize | CodeEditor 基础 + embedded/fullpage |
| Markdown `.markdown-code-editor/.markdown-line-overlay` | textarea 与当前行覆盖层对齐，等宽 12px/24px、tab-size 2，caret text；当前行主题高亮 | 单独编辑器，共享字体/背景 token，不强行与普通 textarea 合并 |
| 聊天 `.modern-composer` | 大圆角带阴影外壳；focus-within 边框强调；内部 textarea 无边框、最小 52px | Composer 使用 Field 外壳的特化 |
| 变量编辑 `.variable-name-editor/.variable-pool-value-detail textarea` | 紧凑名称编辑和多行值编辑；名称正常态是可拖动按钮 | Field compact + 可编辑标签组件 |
| 展示文本 `.generated-flow-code/.workflow-result/.function-result pre/.proposal-comparison pre` | input/surface 背景、等宽或继承字体、换行和滚动；本身无编辑反馈 | CodeBlock / ValueDisplay，区别于输入框 |

重要缺口：全局 `input,textarea,select{outline:none}`，但不是所有变体都有替代的键盘焦点提示；合并时统一 focus-visible/focus-within 契约。

## 7. 卡片、面板、徽标

| 类型 / 选择器 | 当前表现 | 合并判断 |
|---|---|---|
| 可点击集合 `.collection-card` | 图标 + 标题/摘要，边框圆角；hover 上浮/阴影/混合强调边框；按下 .975 | Card + clickable/elevated |
| 实例容器 `.entity-card` | 可编辑标题 + 折叠成员；hover 上浮与阴影；标题按下 .992；focus-within 混合强调边框；entity-focused 整卡高亮 | Card + editable；整卡上浮可能连带移动内部控件，需要明确是否保留 |
| 字段 `.field-card` | panel 边框；hover JS 加状态类，scale 1.008、光标跟随 ±1.6° 倾斜、浅强调混色与双层阴影；仅最内层倾斜；触摸不触发 | TiltCard；FieldCard 组件与 CSS 配套保留 |
| Schema `.schema-panel/.schema-line/.schema-row` | 面板容器、字段行、子成员缩进；field-card 提供反馈；drag-over 有强调顶部边线 | Panel + FieldCard + sortable row |
| 端口行 `.flow-input-row/.flow-output-row/.flow-input-output-row` | 圆角、34px 最小高度；hover 强调 outline 和 8px 发光；无位移 | Card/Row + outline-highlight |
| 内嵌变量 `.flow-inline-variable` | 紧凑透明值；hover 3D 前移 8px + scale 1.025、hover 底色/阴影；按下回落到前移 4px + scale 1.01 | 引用行 + elevated/press；与端口行保持语义区分 |
| 变量池 `.variable-pool-row` | 混合 surface/panel 背景、边框圆角；hover hover + 阴影；拖动原项 .18 透明度 | Card + compact/draggable |
| 模型 `.model-card` | panel 边框圆角；selected 70% accent 混色边框与 12% 光圈；没有集合卡片上浮 | Card + selected |
| 主题 `.theme-preview` | 主题缩略图 + 名称；selected 纯 accent 边框与 1px 光圈；无自身 hover 动画 | Card + selectable；缩略图使用被预览主题的颜色 |
| 静态 `.theme-editor/.object-call-assistant/.workflow-settings/.workflow-run-panel` | 边框、圆角、面板/背景、分组内容；通常无 hover | Panel 基础，布局差异保留 |
| 提示 `.empty-card/.hint-card/.function-contract-guide` | 空状态居中虚线卡片；提示横排图标文字；guide 可原生 details 折叠 | Panel + empty/hint；折叠控件单独复用 |
| 审批提案 `.instance-proposal/.proposal-comparison` | 带边框卡片、两列前后值、details、操作按钮；小屏改单列 | Panel + comparison 布局 |
| 标签 `.entity-tag/.reference-class/.function-chip/.model-status/.workspace-label` | 小字体圆角标签；引用/entity 用 active+accent；function-chip 用 hover；status 用边框/次文字 | Badge 基础 + semantic/tone/size |
| 辅助值 `.null-value/.mixed-value/.muted/.picker-empty/.settings-tree-empty` | 次文字、空值/混合值说明，部分斜体 | 统一文字语义 token 和空态排版 |
| 图标底座 `.collection-icon/.empty-icon/.welcome-symbol/.chat-welcome-icon/.assistant-avatar` | active+accent，圆角图标块；大小不同 | IconSurface 基础 + size |
| 头像 `.user-avatar/.top-avatar/.node-avatar` | 圆形或圆角文本头像；节点头像可随关系网配置颜色 | Avatar 基础；用户配置颜色为内容例外 |

`FieldCard` 样式只在 `.entity-fields/.schema-editor-content` 内激活，不是任何 `.field-card` 都自动倾斜。其效果没有通用按下缩放规则。

## 8. 浮层、抽屉、页面框架与聊天

| 类型 / 选择器 | 当前表现 | 建议 |
|---|---|---|
| 模态 `.modal-backdrop/.modal` | 全屏暗遮罩 + 5px blur；居中 panel 边框圆角、深阴影；import/code/interface 对话框覆盖宽高 | Dialog + size；遮罩、层级、滚动共用 |
| 编辑抽屉 `.editor-drawer` | 编辑区绝对定位；panel、边框、圆角、阴影；180ms 淡入水平移动；工作流调整到左侧或避开库 | Drawer + placement，避免重写皮肤 |
| 关系网检查器 `.graph-inspector` | 右侧滑入，opacity/visibility/pointer-events 协调，280ms；顶栏让出空间 | SidePanel + placement |
| 工作流库 `.flow-library/.workflow-library-panel` | 右侧滑入，310px、panel/border；父面板含节点库和变量池 | 同一 SidePanel；内容高度分配独立 |
| 变量池 `.variable-pool` | 基础是向上浮入浮层；当前库内覆盖为真实布局的 44px/360px 高度展开，内容淡入 | SidePanel 内部 collapsible 区，不套旧浮层皮肤 |
| Markdown `.markdown-preview` | 存在旧浮动滑入定义；document-workspace 内最终为 width 0→主题会话宽度的真实双栏，带边线 | SplitPane；不能按旧定义记成浮动窗口 |
| 侧栏 `.sidebar-region/.sidebar-toggle` | 宽度展开/收拢，按钮跟随位置；transition；隐藏时 visibility/pointer-events 协调 | CollapsibleSidebar |
| 顶栏 `.topbar/.topbar-page-actions/.markdown-top-header` | 面包屑与动作；Markdown 标题区伸展，动作随之让位；部分旧页内按钮隐藏 | 页面框架布局，不决定按钮交互皮肤 |
| 标题 `.page-heading/.eyebrow/.panel-title/.editor-toolbar` | 标题、说明、动作分区；部分 sticky、部分固定；字号/间距不同 | Typography + PageHeading/PanelHeading |
| 聊天 `.message/.message-content/.message.user` | 用户消息右对齐、chatMessage 背景边框圆角；助手消息普通文本+图标头像 | Message 内容特化，共用文字/圆角 token |
| 错误与提示 `.document-error/.markdown-sync-banner/.markdown-edit-error/.function-error/.flow-error/.editor-error` | 行提示、卡片或底部浮层；文字/边框多处固定警告/红色；可有详情和动作 | Alert + severity + placement |
| 空态/加载 `.welcome/.loading/.entity-search-empty/.chat-welcome` | 图标文字、居中留白；搜索空态 220ms 淡入上移 | EmptyState + Loading；保留用途文案 |
| 滚动条 | 8px、透明轨道、muted 混色滑块；hover 更实，按下 muted；Firefox fallback | 全局基础设施，不按页面重写 |

来源：`theme.css:286–341`、`:630–674`、`:734–793`、`:858–886`、`:936–947`；`style.css:4`。

## 9. 画布对象与拖动反馈

| 类型 | 当前表现 | 统一边界 |
|---|---|---|
| 关系网 `.graph-canvas/.graph-transform/.person-node` | 点阵背景、平移缩放；节点圆角阴影、可拖；selected 强调边框/光圈，connecting 强调色；颜色可来自视图配置 | Canvas/Node 基础，数据配置颜色保留 |
| 关系边 `.graph-edge/.edge-hit/.edge-fill` | 扩大命中区；hover JS filter 亮度 1.22、饱和 1.2；填充发光取配置；保留颜色、线宽、虚线 | 不用通用按钮颜色覆盖关系样式 |
| 分区 `.domain`、框选 `.marquee/.flow-selection-box` | 分区虚线圆角；框选强调色半透明 | SelectionOverlay / Region |
| 工作流 `.flow-canvas/.flow-node` | 点阵画布、panel 节点；selected/connecting 边框+光圈；标题 grab/grabbing | 节点基础，标题动作复用按钮 |
| 执行 `.execution-running/waiting/complete/error/cancelled` | running 1.3s 脉冲强调光圈；waiting 混色；complete 固定绿色混色；error 固定红色发光；cancelled .75 透明度 | 统一 status token；运行语义保留 |
| 工作流连线 `.flow-edge-line/.flow-edge-preview/.flow-edge-hit` | accent 曲线、预览虚线、扩大命中区；selected 加粗+发光 | Edge 基础的工作流变体 |
| 连接值 `.workflow-edge-value/.flow-connected-value/.flow-variable-placeholder` | 标签/输入槽；placeholder 虚线；兼容投放目标 active+accent | Badge/ValueDisplay/DropSlot |
| 地图 `.full-map/.map-terrain/.bound-map-pin/.map-location` | 地图图层、标记圆角阴影；绑定标记 selected 强调光圈；图层可用用户图片 | MapPin 复用卡片皮肤，位置/底图内容特化 |
| 树拖动 `.tree-drag-card/.tree-drop-placeholder/.tree-drop-inside` | 跟随光标的同宽卡片、虚线占位、内部投放 outline；占位展开动画 160ms；JS 邻项位移 180ms | 拖动基础外壳 + tree 形态 |
| 排序 `.sort-ghost/.sort-placeholder/.sort-before/.sort-after/.sort-lifted` | 原项隐藏、浮动克隆、虚线占位、插入线、挤开反馈 | 与树共用语义 token，列表布局逻辑保留 |
| 工作流 `.workflow-drag-preview/.workflow-drag-visual/.workflow-drag-body` | 一个预览外壳在行/节点/内嵌引用/虚线空白节点间变形；宽高与形态 220ms，吸附位置 180ms | DragPreview + mode，不用两份对象交叉淡入 |
| 投放 `.variable-drop-target/.is-drop-preview/.is-drag-origin/.is-dragging` | 兼容槽强调背景/轮廓；原项或预览槽隐藏；拖动原项降透明 | shared drag states，避免父子重复高亮 |

工作流图标主要使用 `WorkflowIcon` 和本地图标组件，颜色可沿 currentColor 继承；对图标做盘点时需要把资源本身与容器皮肤分开。

## 10. 颜色与动画的共同问题

### 现有主题共 23 个字段

`rail`、`sidebar`、`surface`、`canvas`、`panel`、`input`、`border`、`text`、`muted`、`accent`、`accentText`、`hover`、`active`、`navItem`、`button`、`buttonText`、`treeItem`、`treeSelected`、`graphNode`、`chatMessage`、`composer`、`mapPin`、`markdownHighlight`。

主题定义和设置标签集中在 `src/model/themes.ts:6`、`:14`，通过 `themeStyle` 转成 CSS 自定义属性。普通 UI 基本使用主题，但还没有颜色以外的圆角、阴影、动画时长、尺寸、缩放幅度等统一 token。

### 应收敛的固定颜色

| 范围 | 示例 | 处理建议 |
|---|---|---|
| 删除 / 错误 | project-delete、model-delete、sidebar 菜单 danger、顶栏 danger、workflow-result、function-error、执行 error 各用不同红色 | 增加主题 danger/dangerText，统一危险修饰 |
| 成功 / 保存 | save-dot 的绿/黄/红、execution-complete 固定绿 | 增加 success/warning/error 或共用状态 token |
| 警告 | document-error / markdown-sync-banner 固定橙色 | warning token |
| 阴影 / 遮罩 | 大量 `#0002/#0005/#0008`、modal 遮罩固定深色 | shadowColor/scrim + 几档共享阴影 |
| 导航指示 | rail-selection 指示条 `#fff` | 从 accent/accentText/text 中确认语义后选用 |
| Markdown 高亮 | 已有 markdownHighlight，但 CSS 仍有固定 rgba fallback | 统一主题默认值来源 |
| 旧基础规则 | style.css 中大量固定底色/边框/文字；部分由 theme.css 覆盖，部分如 tree-config/repeat-toggle 等仍需逐项追踪 | 将基础皮肤直接改为变量，再删除冗余颜色覆盖 |

不宜直接清除的颜色：主题缩略图展示的另一套主题、颜色选择器的预设与透明棋盘、用户配置的关系网/地图样式、用户图片和图标资源。它们是正在展示或编辑的内容；外层控件仍应共用主题皮肤。

### 动画与状态

目前 hover/press 的常见时长是 120–220ms，侧栏 260–300ms，但并无统一来源。按下比例同时存在 .9/.92/.94/.96/.97/.975/.98/.992；不同对象可以有不同强度，但应有命名档位和默认值。

区分两个 active：`:active` 是鼠标按住时的瞬时状态，`.active/.selected/[aria-pressed=true]` 是持久选中/开关状态。统一时应命名为 pressed、selected、expanded、disabled、readonly、dragging、drop-target、running 等，避免混用。

项目已有多段 prefers-reduced-motion 覆盖，但不是所有对象都覆盖完整；`transition:none` 也不会自动取消 `transform`。例如标题按钮仍有静态上移/缩放定义，而 FieldCard 明确取消 transform。建议按动画策略集中控制。

## 11. 建议最终收敛为的共享家族

| 基础家族 | 覆盖现有对象 | 合法特化 |
|---|---|---|
| Button | ghost、primary、icon、add、inline、工具栏、发送、文字动作 | variant、size、elevated、pressable、danger、selected |
| Tree / SelectableRow | 创作/插件/模型/设置树、库目录/库项、会话行 | root、branch、leaf、draggable、meta、inline-action |
| Field / SearchField / Select | 普通输入、多行、搜索、数字、引用触发、原生选择 | compact、bare、readonly、multiline、leading/trailing 插槽 |
| Checkbox / Range | 勾选和滑条 | size、disabled；使用主题 accent |
| Menu / MenuItem / Popover | 两类右键、引用/模型/变量菜单、补全、颜色浮层 | placement、search、selected、danger、pressable |
| Card / Panel / RowCard | 集合、实例、模型、主题、静态配置、端口行、变量池 | clickable、selected、compact、outline-highlight、editable |
| TiltCard | FieldCard | 嵌套最内层反馈；参数化角度/突出量 |
| Badge / Avatar / IconSurface | 类型标签、状态、引用、数量、头像、图标底座 | semantic、tone、size；内容颜色例外 |
| Dialog / Drawer / SidePanel / SplitPane | 弹窗、编辑抽屉、检查器、节点库、Markdown | placement、width、collapsible |
| Alert / EmptyState / ValueDisplay / CodeBlock | 错误、警告、空态、加载、结果 | severity、placement、可折叠详情 |
| CodeEditor / Composer | Function/Tool/Markdown 编辑器、聊天输入 | fullpage/embedded、tabSize、当前行、补全 |
| Canvas / Node / Edge / Port / DropSlot / DragPreview | 关系网、工作流、地图、拖动预览 | 内容样式、执行状态、预览形态 |

这是一份目标分类，不表示已经实施。共同的颜色、边框、字体、圆角、阴影与 hover/focus/press 写在基础类中；页面特化只覆盖布局和确实必要的变量。

建议顺序：先建立主题状态色与尺寸/动效 token，再统一 Button、Field/Search/Select、Menu；随后收敛 Tree/Row 与 Card；最后整理 Drawer、画布和 DragPreview。先处理覆盖最广的组件，可以减少同时修改许多页面的成本。

第一轮应明确的设计选择：普通 ghost 是否保留“无按下视觉”；所有 icon 是否统一 .94 按下；所有悬停是否使用 hover（round-add 当前使用 active）；集合卡是否使用纯 accent 边框；选中状态是否允许 treeSelected 与 active 保持不同；哪些容器允许整体上浮；危险/成功/警告颜色是否加入主题编辑器。

## 12. 全量 CSS 类名索引

以下索引由当前两个 CSS 自动提取：包括视觉基础、布局类、页面特化与状态类。它是查漏与定位工具，不代表每个类都是独立 UI 类型，也不代表没有 TSX 命中的类一定无用（JS 动态类、DOM 克隆或父结构都可能使用）。行号指类名首次出现在相应 CSS 的位置。媒体查询和伪状态的完整上下文以源文件为准。

共提取 **496** 个 CSS 类名。组件列为源码文本命中，包含动态类和选择器引用，不等于运行时使用确认。

| 类名 | CSS 首次位置 | UI 源码命中 |
|---|---|---|
| `active` | `style.css:2`、`theme.css:4` | AppRoot.tsx、FunctionCodeEditor.tsx、ModelsSidebar.tsx、PluginTree.tsx、SettingsSidebar.tsx、SortHandle.tsx、useTreeDrag.ts |
| `active-world` | `theme.css:84` | AppRoot.tsx |
| `add-inline` | `style.css:2`、`theme.css:38` | App.tsx、FlowEditor.tsx、SchemaEditor.tsx |
| `add-schema` | `style.css:2`、`theme.css:60` | SchemaEditor.tsx、SidebarActions.tsx |
| `ai` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `app-shell` | `style.css:2`、`theme.css:1` | AppRoot.tsx、SortHandle.tsx |
| `assistant-avatar` | `theme.css:195` | ChatPage.tsx |
| `big` | `style.css:2` | AppRoot.tsx |
| `bound-map` | `theme.css:895` | MapPage.tsx |
| `bound-map-image` | `theme.css:897` | MapPage.tsx |
| `bound-map-pin` | `theme.css:898` | MapPage.tsx |
| `bound-map-transform` | `theme.css:896` | MapPage.tsx |
| `brand-mark` | `style.css:2`、`theme.css:6` | AppRoot.tsx |
| `breadcrumb-part` | `style.css:7` | AppRoot.tsx |
| `breadcrumbs` | `style.css:2`、`theme.css:18` | AppRoot.tsx |
| `bulk-field` | `theme.css:580` | App.tsx |
| `bulk-field-title` | `theme.css:581` | App.tsx |
| `canvas-controls` | `style.css:2`、`theme.css:225` | App.tsx |
| `canvas-hint` | `style.css:2`、`theme.css:224` | App.tsx |
| `capital` | `theme.css:209` | 未直接命中；需核对动态类/旧规则 |
| `channel-number` | `theme.css:136` | ColorPicker.tsx |
| `chat-agent-select` | `theme.css:732` | ChatPage.tsx |
| `chat-bottom` | `theme.css:196` | ChatPage.tsx |
| `chat-bubble` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `chat-compose` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `chat-model-menu` | `theme.css:389` | ModelSelector.tsx |
| `chat-model-menu-title` | `theme.css:390` | ModelSelector.tsx |
| `chat-model-selector` | `theme.css:383` | ModelSelector.tsx |
| `chat-model-settings` | `theme.css:398` | ModelSelector.tsx |
| `chat-model-trigger` | `theme.css:384` | ModelSelector.tsx |
| `chat-new-row` | `theme.css:269` | AppRoot.tsx |
| `chat-page` | `theme.css:171` | ChatPage.tsx |
| `chat-page-header` | `theme.css:185` | ChatPage.tsx |
| `chat-record-delete` | `theme.css:270` | AppRoot.tsx |
| `chat-record-row` | `theme.css:269` | AppRoot.tsx |
| `chat-sidebar` | `theme.css:67` | 未直接命中；需核对动态类/旧规则 |
| `chat-sidebar-content` | `theme.css:152` | 未直接命中；需核对动态类/旧规则 |
| `chat-welcome` | `theme.css:173` | ChatPage.tsx |
| `chat-welcome-icon` | `theme.css:174` | ChatPage.tsx |
| `code-api-tools` | `theme.css:510` | FunctionCodeEditor.tsx |
| `code-completions` | `theme.css:514` | FunctionCodeEditor.tsx |
| `collection-card` | `style.css:2`、`theme.css:27` | App.tsx、AppRoot.tsx、FunctionsPage.tsx、ModelWorkflowPage.tsx、PluginFolderContents.tsx、ToolsPage.tsx |
| `collection-grid` | `style.css:2`、`theme.css:652` | App.tsx、AppRoot.tsx、FunctionsPage.tsx、ModelWorkflowPage.tsx、ToolsPage.tsx |
| `collection-icon` | `style.css:2`、`theme.css:29` | App.tsx、PluginFolderContents.tsx |
| `color-channels` | `theme.css:132` | ColorPicker.tsx |
| `color-control` | `theme.css:122` | ColorPicker.tsx |
| `color-dismiss` | `theme.css:127` | ColorPicker.tsx |
| `color-done` | `theme.css:139` | ColorPicker.tsx |
| `color-hex` | `theme.css:137` | ColorPicker.tsx |
| `color-popover` | `theme.css:128` | ColorPicker.tsx |
| `color-popover-head` | `theme.css:129` | ColorPicker.tsx |
| `color-presets` | `theme.css:434` | ColorPicker.tsx |
| `color-preview` | `theme.css:131` | ColorPicker.tsx |
| `color-swatch` | `theme.css:126` | ColorPicker.tsx |
| `color-trigger` | `theme.css:123` | ColorPicker.tsx |
| `com` | `style.css:1` | 未直接命中；需核对动态类/旧规则 |
| `composer-footer` | `theme.css:181` | ChatPage.tsx |
| `config-empty` | `style.css:2` | GraphConfigPage.tsx |
| `config-form` | `style.css:2`、`theme.css:33` | App.tsx、InterfaceConfigPage.tsx |
| `config-row` | `style.css:5`、`theme.css:74` | AppRoot.tsx |
| `connect-mode` | `theme.css:262` | App.tsx |
| `connected` | `theme.css:537` | FlowEditor.tsx |
| `connecting` | `style.css:2`、`theme.css:530` | App.tsx、FlowEditor.tsx |
| `connection-preview` | `theme.css:261` | App.tsx |
| `conversation-delete` | `theme.css:168` | 未直接命中；需核对动态类/旧规则 |
| `conversation-list` | `theme.css:161` | 未直接命中；需核对动态类/旧规则 |
| `conversation-row` | `theme.css:162` | 未直接命中；需核对动态类/旧规则 |
| `create-entry` | `theme.css:78` | AppRoot.tsx |
| `create-interface-dialog` | `theme.css:894` | CreateInterfaceDialog.tsx |
| `create-world` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `creation-sidebar` | `theme.css:67` | AppRoot.tsx |
| `current-line` | `theme.css:414` | MarkdownSourceEditor.tsx |
| `danger` | `style.css:2`、`theme.css:480` | App.tsx、AppRoot.tsx、ChatPage.tsx、CreateInterfaceDialog.tsx、FlowEditor.tsx、FunctionsPage.tsx、InterfaceConfigPage.tsx、ModelsPage.tsx、ModelWorkflowPage.tsx、SettingsPage.tsx、SidebarActions.tsx、ToolsPage.tsx、TopbarActions.tsx、VariablePool.tsx、ViewBindingPicker.tsx、WorkflowEditor.tsx |
| `derived-reference-select` | `theme.css:699` | DerivedReferenceSelect.tsx |
| `document-error` | `theme.css:294` | DocumentWorkspace.tsx、ModelsPage.tsx |
| `document-operation` | `theme.css:279` | DocumentWorkspace.tsx |
| `document-workspace` | `theme.css:278` | DocumentWorkspace.tsx |
| `domain` | `style.css:2` | App.tsx、InterfaceConfigPage.tsx |
| `drag-over` | `theme.css:51` | 未直接命中；需核对动态类/旧规则 |
| `edge-arrow` | `theme.css:433` | GraphEdge.tsx |
| `edge-fill` | `theme.css:428` | GraphEdge.tsx |
| `edge-hit` | `theme.css:432` | GraphEdge.tsx |
| `edge-inspector` | `style.css:3`、`theme.css:34` | App.tsx |
| `edge-layer` | `style.css:2`、`theme.css:330` | App.tsx |
| `editor-actions` | `theme.css:738` | FunctionsPage.tsx、SidebarActions.tsx、ToolsPage.tsx |
| `editor-drawer` | `theme.css:746` | FunctionsPage.tsx、ModelWorkflowPage.tsx、ToolsPage.tsx |
| `editor-error` | `theme.css:752` | ModelWorkflowPage.tsx |
| `editor-file-actions` | `theme.css:774` | AppRoot.tsx、FunctionsPage.tsx、ModelWorkflowPage.tsx、SidebarActions.tsx、TopbarActions.tsx |
| `editor-page` | `theme.css:734` | FunctionsPage.tsx、ModelWorkflowPage.tsx、ToolsPage.tsx |
| `editor-primary` | `theme.css:743` | FunctionsPage.tsx、ModelWorkflowPage.tsx、ToolsPage.tsx |
| `editor-source-heading` | `theme.css:774` | FunctionsPage.tsx、ModelWorkflowPage.tsx |
| `editor-toolbar` | `theme.css:735` | FunctionsPage.tsx、ToolsPage.tsx |
| `editor-workspace` | `theme.css:742` | FunctionsPage.tsx、ModelWorkflowPage.tsx、ToolsPage.tsx |
| `empty-card` | `style.css:2`、`theme.css:27` | App.tsx、AppRoot.tsx、ModelsPage.tsx、ModelWorkflowPage.tsx |
| `empty-conversation` | `theme.css:172` | ChatPage.tsx |
| `empty-icon` | `style.css:2`、`theme.css:29` | App.tsx |
| `entity-card` | `style.css:2`、`theme.css:27` | App.tsx |
| `entity-fields` | `style.css:2`、`theme.css:32` | App.tsx、FieldCard.tsx |
| `entity-focused` | `theme.css:636` | App.tsx |
| `entity-header` | `style.css:2`、`theme.css:28` | App.tsx |
| `entity-list` | `style.css:2`、`theme.css:576` | App.tsx、PageSession.tsx、SortHandle.tsx |
| `entity-list-page` | `theme.css:574` | App.tsx |
| `entity-name` | `theme.css:254` | App.tsx |
| `entity-search` | `theme.css:797` | App.tsx |
| `entity-search-empty` | `theme.css:810` | App.tsx |
| `entity-search-empty-icon` | `theme.css:811` | App.tsx |
| `entity-tag` | `style.css:2`、`theme.css:41` | App.tsx |
| `entity-toggle` | `style.css:2` | App.tsx |
| `execution-cancelled` | `theme.css:852` | 未直接命中；需核对动态类/旧规则 |
| `execution-complete` | `theme.css:850` | 未直接命中；需核对动态类/旧规则 |
| `execution-error` | `theme.css:851` | 未直接命中；需核对动态类/旧规则 |
| `execution-running` | `theme.css:848` | 未直接命中；需核对动态类/旧规则 |
| `execution-waiting` | `theme.css:849` | 未直接命中；需核对动态类/旧规则 |
| `eyebrow` | `style.css:2`、`theme.css:22` | App.tsx、AppRoot.tsx、DocumentWorkspace.tsx、FunctionsPage.tsx、GraphConfigPage.tsx、InterfaceConfigPage.tsx、MapPage.tsx、ModelsPage.tsx、ModelWorkflowPage.tsx、SchemaEditor.tsx、SettingsPage.tsx、ToolsPage.tsx |
| `field` | `style.css:2`、`theme.css:34` | App.tsx、DerivedReferenceSelect.tsx、DocumentWorkspace.tsx、FunctionsPage.tsx、ReadOnlyFunctionValue.tsx、SchemaEditor.tsx |
| `field-card` | `theme.css:711` | FieldCard.tsx |
| `field-card-hovered` | `theme.css:712` | FieldCard.tsx |
| `field-depth-1` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `field-depth-2` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `field-depth-3` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `field-head` | `style.css:2`、`theme.css:584` | App.tsx、ReadOnlyFunctionValue.tsx |
| `field-key` | `style.css:2` | App.tsx、ReadOnlyFunctionValue.tsx |
| `field-key-wrap` | `style.css:2` | App.tsx、DocumentWorkspace.tsx、ReadOnlyFunctionValue.tsx |
| `field-label` | `style.css:2`、`theme.css:33` | App.tsx、ReadOnlyFunctionValue.tsx |
| `file` | `style.css:2`、`theme.css:30` | App.tsx、AppRoot.tsx、DocumentWorkspace.tsx、FunctionsPage.tsx、ModelWorkflowPage.tsx |
| `floating-picker-menu` | `theme.css:46` | PickerMenu.tsx |
| `flow-canvas` | `theme.css:522` | FlowEditor.tsx、FunctionsPage.tsx、ModelWorkflowPage.tsx、WorkflowEditor.tsx |
| `flow-code-body` | `theme.css:548` | FlowEditor.tsx |
| `flow-code-modal` | `theme.css:562` | FlowEditor.tsx |
| `flow-code-modal-title` | `theme.css:563` | FlowEditor.tsx |
| `flow-connected-value` | `theme.css:545` | FlowEditor.tsx、WorkflowPorts.tsx |
| `flow-edge-hit` | `theme.css:527` | FlowEditor.tsx、WorkflowEditor.tsx |
| `flow-edge-line` | `theme.css:525` | FlowEditor.tsx、WorkflowEditor.tsx |
| `flow-edge-preview` | `theme.css:525` | FlowEditor.tsx、WorkflowEditor.tsx |
| `flow-edges` | `theme.css:524` | FlowEditor.tsx、WorkflowEditor.tsx |
| `flow-editor-layout` | `theme.css:521` | FlowEditor.tsx、WorkflowEditor.tsx |
| `flow-error` | `theme.css:560` | FlowEditor.tsx、WorkflowEditor.tsx |
| `flow-inline-variable` | `theme.css:953` | DragCardPreview.tsx、WorkflowPorts.tsx |
| `flow-input-output-row` | `theme.css:955` | WorkflowPorts.tsx |
| `flow-input-row` | `theme.css:540` | FlowEditor.tsx、WorkflowPorts.tsx |
| `flow-library` | `theme.css:551` | FlowEditor.tsx、libraryDrop.ts、PageSession.tsx、useVariableDrag.ts、WorkflowEditor.tsx |
| `flow-library-branch` | `theme.css:554` | 未直接命中；需核对动态类/旧规则 |
| `flow-library-folder` | `theme.css:553` | LibraryFolder.tsx |
| `flow-library-scroll` | `theme.css:844` | FlowEditor.tsx、WorkflowEditor.tsx |
| `flow-library-search-area` | `theme.css:1010` | WorkflowEditor.tsx |
| `flow-library-title` | `theme.css:788` | FlowEditor.tsx、VariablePool.tsx、WorkflowEditor.tsx |
| `flow-node` | `theme.css:529` | DragCardPreview.tsx、FlowEditor.tsx、FunctionsPage.tsx、ModelWorkflowPage.tsx、useCanvasEditing.ts、useDragCardSize.ts、useVariableDrag.ts、WorkflowEditor.tsx |
| `flow-node-hint` | `theme.css:546` | FlowEditor.tsx、WorkflowEditor.tsx |
| `flow-output-row` | `theme.css:535` | FlowEditor.tsx、WorkflowPorts.tsx |
| `flow-palette-item` | `theme.css:555` | DragCardPreview.tsx、FlowEditor.tsx、WorkflowEditor.tsx、WorkflowPorts.tsx |
| `flow-port` | `theme.css:536` | FlowEditor.tsx、WorkflowPorts.tsx |
| `flow-port-caption` | `theme.css:960` | WorkflowPorts.tsx |
| `flow-port-name` | `theme.css:605` | FlowEditor.tsx |
| `flow-selection-box` | `theme.css:831` | FlowEditor.tsx、WorkflowEditor.tsx |
| `flow-stage` | `theme.css:523` | FlowEditor.tsx、WorkflowEditor.tsx |
| `flow-template-ghost` | `theme.css:561` | 未直接命中；需核对动态类/旧规则 |
| `flow-toolbar` | `style.css:16`、`theme.css:518` | FlowEditor.tsx、SidebarActions.tsx、WorkflowEditor.tsx |
| `flow-value` | `theme.css:547` | FlowEditor.tsx、WorkflowEditor.tsx |
| `flow-variable-placeholder` | `theme.css:1038` | WorkflowEditor.tsx |
| `flow-workbench` | `theme.css:517` | FlowEditor.tsx、WorkflowEditor.tsx |
| `flow-zoom` | `theme.css:559` | FlowEditor.tsx、WorkflowEditor.tsx |
| `full` | `style.css:2` | App.tsx、ColorPicker.tsx |
| `full-map` | `theme.css:200` | MapPage.tsx |
| `function-bindings` | `theme.css:468` | FunctionBindings.tsx |
| `function-chip` | `theme.css:470` | FunctionBindings.tsx |
| `function-code` | `theme.css:481` | FunctionCodeEditor.tsx |
| `function-code-editor` | `theme.css:578` | 未直接命中；需核对动态类/旧规则 |
| `function-code-input` | `theme.css:502` | FunctionCodeEditor.tsx |
| `function-code-workbench` | `theme.css:501` | FunctionCodeEditor.tsx |
| `function-context-picker` | `theme.css:658` | FunctionsPage.tsx |
| `function-contract-guide` | `theme.css:659` | FunctionsPage.tsx |
| `function-edit` | `theme.css:476` | FunctionsPage.tsx、ToolsPage.tsx |
| `function-error` | `theme.css:652` | FunctionsPage.tsx、ToolsPage.tsx |
| `function-object-library` | `theme.css:758` | 未直接命中；需核对动态类/旧规则 |
| `function-object-value` | `theme.css:715` | ReadOnlyFunctionValue.tsx |
| `function-readonly-value` | `theme.css:692` | App.tsx |
| `function-result` | `theme.css:472` | App.tsx |
| `function-results` | `theme.css:471` | App.tsx |
| `function-settings` | `theme.css:478` | FunctionsPage.tsx、SidebarActions.tsx |
| `function-test` | `theme.css:482` | FunctionsPage.tsx、ToolsPage.tsx |
| `function-world-label` | `theme.css:500` | FunctionsPage.tsx |
| `functions-content` | `theme.css:651` | FunctionsPage.tsx、ToolsPage.tsx |
| `functions-heading` | `theme.css:648` | FunctionsPage.tsx、ToolsPage.tsx |
| `functions-page` | `theme.css:568` | FunctionsPage.tsx、ToolsPage.tsx |
| `generated-code-toggle` | `theme.css:564` | FunctionsPage.tsx |
| `generated-flow-code` | `theme.css:565` | FunctionsPage.tsx |
| `ghost` | `style.css:2`、`theme.css:23` | App.tsx、AppRoot.tsx、ChatPage.tsx、DocumentWorkspace.tsx、FlowEditor.tsx、FunctionCodeEditor.tsx、FunctionsPage.tsx、InterfaceConfigPage.tsx、ModelsPage.tsx、ModelWorkflowPage.tsx、SettingsPage.tsx、SortHandle.tsx、ToolsPage.tsx、useTreeDrag.ts、VariablePool.tsx、WorkflowEditor.tsx、WorkflowPorts.tsx |
| `googleapis` | `style.css:1` | 未直接命中；需核对动态类/旧规则 |
| `graph-add-mapping` | `theme.css:141` | GraphConfigPage.tsx |
| `graph-canvas` | `style.css:2`、`theme.css:219` | App.tsx |
| `graph-config-content` | `theme.css:590` | GraphConfigPage.tsx、PageSession.tsx |
| `graph-config-heading` | `theme.css:587` | GraphConfigPage.tsx |
| `graph-config-inner` | `theme.css:591` | GraphConfigPage.tsx |
| `graph-config-page` | `theme.css:586` | GraphConfigPage.tsx、InterfaceConfigPage.tsx |
| `graph-config-section` | `theme.css:140` | GraphConfigPage.tsx |
| `graph-edge` | `style.css:3`、`theme.css:427` | App.tsx、GraphEdge.tsx |
| `graph-inspector` | `style.css:2`、`theme.css:218` | App.tsx |
| `graph-layout` | `style.css:2`、`theme.css:259` | App.tsx |
| `graph-main` | `style.css:2`、`theme.css:320` | App.tsx |
| `graph-style-card` | `theme.css:144` | GraphConfigPage.tsx |
| `graph-style-controls` | `theme.css:142` | GraphConfigPage.tsx |
| `graph-style-head` | `theme.css:142` | GraphConfigPage.tsx |
| `graph-tools` | `style.css:2`、`theme.css:225` | App.tsx、SidebarActions.tsx |
| `graph-top` | `style.css:2`、`theme.css:21` | App.tsx |
| `graph-transform` | `style.css:2`、`theme.css:329` | App.tsx |
| `has-value` | `theme.css:856` | WorkflowEditor.tsx |
| `heading-actions` | `style.css:2`、`theme.css:283` | App.tsx、AppRoot.tsx、FunctionsPage.tsx、InterfaceConfigPage.tsx、ModelsPage.tsx、ModelWorkflowPage.tsx、SidebarActions.tsx、ToolsPage.tsx、TopbarActions.tsx |
| `hidden-file-input` | `theme.css:284` | DocumentWorkspace.tsx、ModelWorkflowPage.tsx |
| `hint-card` | `style.css:2`、`theme.css:27` | SchemaEditor.tsx |
| `icon-button` | `style.css:2`、`theme.css:8` | App.tsx、AppRoot.tsx、CreateInterfaceDialog.tsx、DocumentWorkspace.tsx、FlowEditor.tsx、GraphConfigPage.tsx、GraphEditActions.tsx、ModelsPage.tsx、PluginTree.tsx、SchemaEditor.tsx、TopbarActions.tsx、VariablePool.tsx、WorkflowEditor.tsx、WorkflowPorts.tsx |
| `input` | `theme.css:959` | App.tsx、AppRoot.tsx、ColorPicker.tsx、CreateInterfaceDialog.tsx、DocumentWorkspace.tsx、FlowEditor.tsx、FunctionCodeEditor.tsx、FunctionsPage.tsx、GraphConfigPage.tsx、InterfaceConfigPage.tsx、ModelsPage.tsx、ModelWorkflowPage.tsx、PickerMenu.tsx、ReadOnlyFunctionValue.tsx、SchemaEditor.tsx、SettingsPage.tsx、SortHandle.tsx、ToolsPage.tsx、useCanvasEditing.ts、VariablePool.tsx、WorkflowEditor.tsx、WorkflowIcon.tsx、WorkflowPorts.tsx |
| `inspector-empty` | `style.css:2`、`theme.css:224` | App.tsx |
| `inspector-fields` | `style.css:2` | App.tsx |
| `inspector-name` | `style.css:2`、`theme.css:34` | App.tsx |
| `inspector-open` | `theme.css:325` | App.tsx |
| `inspector-person` | `style.css:2`、`theme.css:223` | App.tsx |
| `inspector-title` | `style.css:2`、`theme.css:218` | App.tsx |
| `instance-proposal` | `theme.css:998` | ChatPage.tsx |
| `interface-config-body` | `theme.css:888` | InterfaceConfigPage.tsx、PageSession.tsx |
| `interface-config-page` | `theme.css:887` | InterfaceConfigPage.tsx |
| `interface-file-actions` | `theme.css:908` | AppRoot.tsx |
| `interface-workspace` | `theme.css:906` | AppRoot.tsx |
| `is-attached` | `theme.css:1026` | DragCardPreview.tsx |
| `is-card` | `theme.css:1021` | DragCardPreview.tsx |
| `is-compact` | `theme.css:1019` | DragCardPreview.tsx |
| `is-drag-origin` | `theme.css:961` | WorkflowPorts.tsx |
| `is-dragging` | `theme.css:951` | SortHandle.tsx、VariablePool.tsx |
| `is-drop-preview` | `theme.css:961` | WorkflowPorts.tsx |
| `is-maximized` | `theme.css:607` | FlowEditor.tsx |
| `is-morphing` | `theme.css:1026` | DragCardPreview.tsx |
| `is-open` | `theme.css:310` | App.tsx、DocumentWorkspace.tsx、FlowEditor.tsx、VariablePool.tsx、WorkflowEditor.tsx |
| `is-original-visible` | `theme.css:1031` | DragCardPreview.tsx |
| `is-placeholder` | `theme.css:1036` | DragCardPreview.tsx |
| `library-expand-all` | `theme.css:1012` | FlowEditor.tsx、WorkflowEditor.tsx |
| `library-open` | `theme.css:784` | FlowEditor.tsx、WorkflowEditor.tsx |
| `loading` | `style.css:2` | AppRoot.tsx、ModelsPage.tsx、ModelWorkflowPage.tsx |
| `main-area` | `style.css:2`、`theme.css:16` | AppRoot.tsx、DocumentWorkspace.tsx、FlowEditor.tsx、SidebarActions.tsx |
| `map-canvas` | `theme.css:777` | 未直接命中；需核对动态类/旧规则 |
| `map-compass` | `theme.css:212` | MapPage.tsx |
| `map-grid` | `style.css:2`、`theme.css:777` | 未直接命中；需核对动态类/旧规则 |
| `map-location` | `theme.css:207` | 未直接命中；需核对动态类/旧规则 |
| `map-notice` | `theme.css:215` | MapPage.tsx |
| `map-pin` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `map-region` | `theme.css:202` | 未直接命中；需核对动态类/旧规则 |
| `map-route` | `theme.css:206` | 未直接命中；需核对动态类/旧规则 |
| `map-terrain` | `theme.css:201` | 未直接命中；需核对动态类/旧规则 |
| `map-title` | `theme.css:210` | MapPage.tsx |
| `map-zoom` | `theme.css:213` | MapPage.tsx、SidebarActions.tsx |
| `markdown-code-editor` | `theme.css:409` | DocumentWorkspace.tsx、PageSession.tsx |
| `markdown-edit-error` | `theme.css:415` | DocumentWorkspace.tsx |
| `markdown-import-modal` | `theme.css:291` | DocumentWorkspace.tsx |
| `markdown-line-overlay` | `theme.css:410` | 未直接命中；需核对动态类/旧规则 |
| `markdown-preview` | `theme.css:286` | DocumentWorkspace.tsx |
| `markdown-source-editor` | `theme.css:446` | MarkdownSourceEditor.tsx |
| `markdown-source-line` | `theme.css:447` | MarkdownSourceEditor.tsx |
| `markdown-sync-banner` | `theme.css:294` | AppRoot.tsx |
| `markdown-toggle` | `theme.css:285` | DocumentWorkspace.tsx、SidebarActions.tsx |
| `markdown-top-header` | `theme.css:677` | DocumentWorkspace.tsx |
| `markdown-top-title` | `theme.css:677` | DocumentWorkspace.tsx |
| `marquee` | `style.css:2` | App.tsx |
| `md-heading` | `theme.css:449` | MarkdownSourceEditor.tsx |
| `md-heading-1` | `theme.css:450` | 未直接命中；需核对动态类/旧规则 |
| `md-heading-2` | `theme.css:450` | 未直接命中；需核对动态类/旧规则 |
| `md-heading-3` | `theme.css:450` | 未直接命中；需核对动态类/旧规则 |
| `md-heading-4` | `theme.css:450` | 未直接命中；需核对动态类/旧规则 |
| `md-heading-5` | `theme.css:450` | 未直接命中；需核对动态类/旧规则 |
| `md-heading-6` | `theme.css:450` | 未直接命中；需核对动态类/旧规则 |
| `message` | `theme.css:191` | AppRoot.tsx、ChatPage.tsx、DocumentWorkspace.tsx、FunctionsPage.tsx、ModelWorkflowPage.tsx、ToolsPage.tsx、useVariableDrag.ts、VariablePool.tsx |
| `message-column` | `theme.css:190` | ChatPage.tsx |
| `message-content` | `theme.css:193` | ChatPage.tsx |
| `message-scroll` | `theme.css:189` | ChatPage.tsx、PageSession.tsx |
| `mini-add` | `style.css:2`、`theme.css:58` | GraphConfigPage.tsx |
| `mixed-value` | `theme.css:582` | App.tsx |
| `modal` | `style.css:4`、`theme.css:62` | AppRoot.tsx、CreateInterfaceDialog.tsx、DocumentWorkspace.tsx、FlowEditor.tsx |
| `modal-actions` | `style.css:4` | AppRoot.tsx、CreateInterfaceDialog.tsx、DocumentWorkspace.tsx |
| `modal-backdrop` | `style.css:4` | AppRoot.tsx、CreateInterfaceDialog.tsx、DocumentWorkspace.tsx、FlowEditor.tsx |
| `model-card` | `theme.css:363` | ModelsPage.tsx |
| `model-card-heading` | `theme.css:366` | ModelsPage.tsx |
| `model-cards` | `theme.css:362` | ModelsPage.tsx |
| `model-delete` | `theme.css:370` | 未直接命中；需核对动态类/旧规则 |
| `model-enabled` | `theme.css:380` | ModelsPage.tsx、ToolsPage.tsx |
| `model-field-wide` | `theme.css:376` | ModelsPage.tsx、ToolsPage.tsx |
| `model-form` | `theme.css:371` | ModelsPage.tsx、ModelWorkflowPage.tsx、ToolsPage.tsx |
| `model-key-input` | `theme.css:377` | ModelsPage.tsx |
| `model-management-page` | `theme.css:718` | ModelsPage.tsx、ModelWorkflowPage.tsx |
| `model-management-scroll` | `theme.css:721` | ModelsPage.tsx、ModelWorkflowPage.tsx、PageSession.tsx |
| `model-nav-row` | `theme.css:355` | AppRoot.tsx、ModelsSidebar.tsx |
| `model-service-actions` | `theme.css:723` | ModelsPage.tsx、ModelWorkflowPage.tsx |
| `model-status` | `theme.css:369` | ModelsPage.tsx |
| `models-sidebar-tree` | `theme.css:717` | ModelsSidebar.tsx |
| `modern-composer` | `theme.css:177` | ChatPage.tsx |
| `muted` | `style.css:2`、`theme.css:644` | App.tsx、FlowEditor.tsx、FunctionsPage.tsx、InterfaceConfigPage.tsx、ObjectPicker.tsx、ReadOnlyFunctionValue.tsx、SidebarActions.tsx、ToolsPage.tsx |
| `node-avatar` | `style.css:2`、`theme.css:223` | App.tsx |
| `north` | `theme.css:209` | 未直接命中；需核对动态类/旧规则 |
| `null-value` | `style.css:2`、`theme.css:38` | App.tsx、ReadOnlyFunctionValue.tsx |
| `object-body` | `style.css:2`、`theme.css:37` | App.tsx、ReadOnlyFunctionValue.tsx |
| `object-call-actions` | `theme.css:510` | FunctionCodeEditor.tsx |
| `object-call-assistant` | `theme.css:504` | FunctionCodeEditor.tsx |
| `object-page` | `theme.css:774` | AppRoot.tsx |
| `object-picker` | `theme.css:507` | ObjectPicker.tsx |
| `one` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `output` | `theme.css:537` | AppRoot.tsx、FlowEditor.tsx、FunctionsPage.tsx、ModelWorkflowPage.tsx、ToolsPage.tsx、WorkflowEditor.tsx、WorkflowPorts.tsx |
| `page-heading` | `style.css:2`、`theme.css:18` | App.tsx、AppRoot.tsx、FunctionsPage.tsx、GraphConfigPage.tsx、InterfaceConfigPage.tsx、ModelsPage.tsx、ModelWorkflowPage.tsx、SchemaEditor.tsx、SettingsPage.tsx、SidebarActions.tsx、ToolsPage.tsx |
| `page-scroll` | `style.css:2`、`theme.css:280` | App.tsx、AppRoot.tsx、FunctionsPage.tsx、InterfaceConfigPage.tsx、PageSession.tsx、SchemaEditor.tsx、SettingsPage.tsx、SortHandle.tsx、ToolsPage.tsx |
| `page-session` | `theme.css:631` | PageSession.tsx、SidebarActions.tsx、TopbarActions.tsx |
| `palette-port-signature` | `theme.css:971` | FlowEditor.tsx、WorkflowEditor.tsx |
| `panel-title` | `style.css:2`、`theme.css:28` | CreateInterfaceDialog.tsx、GraphConfigPage.tsx、InterfaceConfigPage.tsx、SchemaEditor.tsx |
| `person-node` | `style.css:2`、`theme.css:221` | App.tsx |
| `picker-empty` | `style.css:2` | App.tsx |
| `picker-menu` | `style.css:2`、`theme.css:43` | PickerMenu.tsx |
| `placeholder-page` | `style.css:2`、`theme.css:21` | 未直接命中；需核对动态类/旧规则 |
| `plugin-folder-add` | `theme.css:493` | PluginTree.tsx |
| `plugin-nav` | `theme.css:89` | 未直接命中；需核对动态类/旧规则 |
| `plugin-root-row` | `theme.css:490` | PluginTree.tsx |
| `plugin-sidebar` | `theme.css:67` | AppRoot.tsx |
| `plugin-tree` | `theme.css:487` | PluginTree.tsx |
| `plugin-tree-branch` | `style.css:18`、`theme.css:491` | PluginTree.tsx |
| `port` | `theme.css:209` | FlowEditor.tsx、useCanvasEditing.ts、useDragCardSize.ts、useVariableDrag.ts、WorkflowEditor.tsx、WorkflowPorts.tsx |
| `port-type-icon` | `theme.css:960` | WorkflowIcon.tsx |
| `preview-overlay` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `preview-shell` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `primary` | `style.css:2`、`theme.css:25` | App.tsx、AppRoot.tsx、ChatPage.tsx、CreateInterfaceDialog.tsx、DocumentWorkspace.tsx、FunctionsPage.tsx、ModelsPage.tsx、ModelWorkflowPage.tsx、ToolsPage.tsx |
| `project-delete` | `theme.css:272` | App.tsx |
| `project-nav` | `theme.css:68` | AppRoot.tsx |
| `project-tree` | `theme.css:82` | AppRoot.tsx |
| `projects-children` | `theme.css:237` | AppRoot.tsx |
| `projects-heading` | `theme.css:80` | AppRoot.tsx |
| `projects-scroll` | `theme.css:338` | AppRoot.tsx、useTreeDrag.ts |
| `proposal-actions` | `theme.css:1004` | ChatPage.tsx |
| `proposal-comparison` | `theme.css:1000` | ChatPage.tsx |
| `rail` | `style.css:2`、`theme.css:2` | AppRoot.tsx |
| `rail-bottom` | `style.css:2` | AppRoot.tsx |
| `rail-items` | `style.css:2`、`theme.css:247` | AppRoot.tsx |
| `rail-selection` | `theme.css:248` | AppRoot.tsx |
| `reference-class` | `style.css:2`、`theme.css:49` | App.tsx、ReadOnlyFunctionValue.tsx |
| `reference-picker` | `style.css:2`、`theme.css:475` | App.tsx、ReadOnlyFunctionValue.tsx |
| `reference-trigger` | `style.css:2`、`theme.css:34` | App.tsx、ReadOnlyFunctionValue.tsx |
| `region-a` | `theme.css:203` | 未直接命中；需核对动态类/旧规则 |
| `region-b` | `theme.css:204` | 未直接命中；需核对动态类/旧规则 |
| `region-c` | `theme.css:205` | 未直接命中；需核对动态类/旧规则 |
| `relation-style-controls` | `theme.css:462` | GraphConfigPage.tsx |
| `repeat-toggle` | `style.css:2`、`theme.css:33` | SchemaEditor.tsx |
| `round-add` | `style.css:2`、`theme.css:54` | App.tsx |
| `save-dot` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `schema-arrow` | `style.css:2` | SchemaEditor.tsx |
| `schema-children` | `style.css:2`、`theme.css:37` | SchemaEditor.tsx |
| `schema-editor-content` | `theme.css:626` | FieldCard.tsx、SchemaEditor.tsx |
| `schema-editor-heading` | `theme.css:623` | SchemaEditor.tsx |
| `schema-editor-page` | `theme.css:613` | SchemaEditor.tsx |
| `schema-grip` | `style.css:2`、`theme.css:52` | SortHandle.tsx |
| `schema-line` | `style.css:2`、`theme.css:50` | SchemaEditor.tsx |
| `schema-panel` | `style.css:2`、`theme.css:27` | App.tsx、FunctionsPage.tsx、GraphConfigPage.tsx、InterfaceConfigPage.tsx、SchemaEditor.tsx、ToolsPage.tsx |
| `schema-row` | `style.css:2`、`theme.css:34` | SchemaEditor.tsx |
| `section-label` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `selected` | `style.css:2`、`theme.css:105` | App.tsx、AppRoot.tsx、DerivedReferenceSelect.tsx、DragCardPreview.tsx、FlowEditor.tsx、FunctionsPage.tsx、MapPage.tsx、ModelSelector.tsx、ModelsSidebar.tsx、ModelWorkflowPage.tsx、ReadOnlyFunctionValue.tsx、SettingsPage.tsx、ToolsPage.tsx、useCanvasEditing.ts、useGraphEditing.ts、WorkflowEditor.tsx |
| `send-button` | `theme.css:183` | ChatPage.tsx |
| `setting-line` | `style.css:2`、`theme.css:33` | 未直接命中；需核对动态类/旧规则 |
| `setting-toggle` | `style.css:2`、`theme.css:33` | GraphConfigPage.tsx |
| `settings-page` | `theme.css:102` | SettingsPage.tsx |
| `settings-sidebar` | `theme.css:67` | AppRoot.tsx |
| `settings-sidebar-content` | `theme.css:93` | SettingsSidebar.tsx |
| `settings-tree-branch` | `theme.css:354` | SettingsSidebar.tsx |
| `settings-tree-empty` | `theme.css:361` | 未直接命中；需核对动态类/旧规则 |
| `settings-tree-heading` | `theme.css:350` | AppRoot.tsx、SettingsSidebar.tsx |
| `settings-tree-parent` | `theme.css:689` | SettingsSidebar.tsx |
| `sidebar` | `style.css:2`、`theme.css:10` | AppRoot.tsx、SettingsPage.tsx、SidebarActions.tsx、useTreeDrag.ts |
| `sidebar-action-icon` | `theme.css:672` | SidebarActions.tsx |
| `sidebar-action-label` | `theme.css:673` | SidebarActions.tsx |
| `sidebar-actions` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `sidebar-add` | `theme.css:94` | SettingsSidebar.tsx |
| `sidebar-back` | `theme.css:153` | 未直接命中；需核对动态类/旧规则 |
| `sidebar-brand` | `style.css:2`、`theme.css:13` | AppRoot.tsx |
| `sidebar-chevron` | `theme.css:160` | 未直接命中；需核对动态类/旧规则 |
| `sidebar-collapsed` | `theme.css:664` | AppRoot.tsx |
| `sidebar-divider` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `sidebar-empty` | `theme.css:170` | 未直接命中；需核对动态类/旧规则 |
| `sidebar-folder` | `theme.css:157` | 未直接命中；需核对动态类/旧规则 |
| `sidebar-footer` | `style.css:2`、`theme.css:15` | 未直接命中；需核对动态类/旧规则 |
| `sidebar-group-title` | `theme.css:88` | 未直接命中；需核对动态类/旧规则 |
| `sidebar-header` | `style.css:2`、`theme.css:11` | AppRoot.tsx |
| `sidebar-object-menu` | `theme.css:637` | SidebarActions.tsx |
| `sidebar-primary` | `theme.css:155` | 未直接命中；需核对动态类/旧规则 |
| `sidebar-region` | `theme.css:661` | AppRoot.tsx |
| `sidebar-search` | `style.css:2`、`theme.css:85` | 未直接命中；需核对动态类/旧规则 |
| `sidebar-toggle` | `theme.css:666` | AppRoot.tsx |
| `simple-page` | `style.css:2`、`theme.css:18` | 未直接命中；需核对动态类/旧规则 |
| `sort-after` | `theme.css:406` | 未直接命中；需核对动态类/旧规则 |
| `sort-before` | `theme.css:406` | 未直接命中；需核对动态类/旧规则 |
| `sort-dragging` | `theme.css:404` | 未直接命中；需核对动态类/旧规则 |
| `sort-ghost` | `theme.css:421` | SortHandle.tsx |
| `sort-handle` | `theme.css:401` | SortHandle.tsx |
| `sort-lifted` | `theme.css:420` | SortHandle.tsx |
| `sort-placeholder` | `theme.css:423` | SortHandle.tsx |
| `sorting-active` | `theme.css:403` | SortHandle.tsx |
| `style-row` | `style.css:2`、`theme.css:32` | 未直接命中；需核对动态类/旧规则 |
| `subtle` | `style.css:2` | App.tsx、AppRoot.tsx、GraphConfigPage.tsx、SchemaEditor.tsx |
| `text-reference` | `style.css:2` | App.tsx、ReadOnlyFunctionValue.tsx |
| `text-reference-content` | `theme.css:703` | App.tsx、ReadOnlyFunctionValue.tsx |
| `text-reference-short` | `theme.css:700` | App.tsx、ReadOnlyFunctionValue.tsx |
| `theme-color-grid` | `theme.css:119` | SettingsPage.tsx |
| `theme-editor` | `theme.css:112` | SettingsPage.tsx |
| `theme-editor-title` | `theme.css:113` | SettingsPage.tsx |
| `theme-mini` | `theme.css:99` | SettingsSidebar.tsx |
| `theme-name` | `theme.css:117` | SettingsPage.tsx |
| `theme-nav-row` | `theme.css:94` | AppRoot.tsx、SettingsSidebar.tsx |
| `theme-preview` | `theme.css:104` | SettingsPage.tsx |
| `theme-preview-art` | `theme.css:106` | SettingsPage.tsx |
| `theme-preview-grid` | `theme.css:103` | SettingsPage.tsx |
| `three` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `tool-active` | `style.css:2`、`theme.css:226` | App.tsx |
| `tool-annotations` | `theme.css:934` | ToolsPage.tsx |
| `tool-builtin-summary` | `theme.css:993` | ToolsPage.tsx |
| `tool-code-editor` | `theme.css:932` | 未直接命中；需核对动态类/旧规则 |
| `tool-http-summary` | `theme.css:988` | ToolsPage.tsx |
| `tool-locked-settings` | `theme.css:991` | ToolsPage.tsx |
| `tool-model-selection` | `theme.css:1006` | ModelsPage.tsx |
| `tool-settings-form` | `theme.css:983` | ToolsPage.tsx |
| `tool-world-label` | `theme.css:984` | ToolsPage.tsx |
| `tools-page` | `theme.css:936` | ToolsPage.tsx |
| `top-avatar` | `style.css:2`、`theme.css:7` | 未直接命中；需核对动态类/旧规则 |
| `topbar` | `style.css:2`、`theme.css:16` | AppRoot.tsx、DocumentWorkspace.tsx、FlowEditor.tsx、SidebarActions.tsx |
| `topbar-markdown-toggle` | `theme.css:676` | DocumentWorkspace.tsx |
| `topbar-page-actions` | `theme.css:767` | TopbarActions.tsx |
| `topbar-right` | `style.css:2`、`theme.css:18` | 未直接命中；需核对动态类/旧规则 |
| `tree` | `style.css:2` | AppRoot.tsx、ModelsSidebar.tsx、PluginTree.tsx |
| `tree-branch` | `theme.css:238` | AppRoot.tsx、ModelsSidebar.tsx |
| `tree-config` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `tree-disclosure` | `theme.css:682` | TreeDisclosure.tsx |
| `tree-drag-card` | `style.css:11` | useTreeDrag.ts |
| `tree-drag-source` | `style.css:12` | 未直接命中；需核对动态类/旧规则 |
| `tree-dragging` | `style.css:10` | useTreeDrag.ts |
| `tree-drop-inside` | `style.css:13` | useTreeDrag.ts |
| `tree-drop-placeholder` | `style.css:14` | useTreeDrag.ts |
| `tree-main` | `style.css:2`、`theme.css:72` | AppRoot.tsx、ModelsSidebar.tsx、PluginTree.tsx、useTreeDrag.ts |
| `tree-node` | `theme.css:239` | AppRoot.tsx、ModelsSidebar.tsx、useTreeDrag.ts |
| `tree-row` | `style.css:2`、`theme.css:69` | AppRoot.tsx、ModelsSidebar.tsx、PluginTree.tsx |
| `tree-spacer` | `style.css:2`、`theme.css:268` | 未直接命中；需核对动态类/旧规则 |
| `two` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `user` | `style.css:2`、`theme.css:192` | AppRoot.tsx、ModelsPage.tsx、TopbarActions.tsx |
| `user-avatar` | `style.css:2`、`theme.css:7` | AppRoot.tsx |
| `variable-card-ghost` | `theme.css:969` | 未直接命中；需核对动态类/旧规则 |
| `variable-drag-handle` | `theme.css:952` | VariablePool.tsx |
| `variable-drag-origin` | `theme.css:1037` | DragCardPreview.tsx、useVariableDrag.ts |
| `variable-drop-target` | `theme.css:968` | useVariableDrag.ts |
| `variable-name-editor` | `theme.css:871` | VariablePool.tsx |
| `variable-pool` | `theme.css:858` | useVariableDrag.ts、VariablePool.tsx、WorkflowEditor.tsx |
| `variable-pool-add` | `theme.css:864` | VariablePool.tsx |
| `variable-pool-empty` | `theme.css:885` | VariablePool.tsx |
| `variable-pool-name` | `theme.css:867` | VariablePool.tsx |
| `variable-pool-row` | `theme.css:865` | useVariableDrag.ts、VariablePool.tsx |
| `variable-pool-row-bottom` | `theme.css:951` | VariablePool.tsx |
| `variable-pool-row-heading` | `theme.css:866` | VariablePool.tsx |
| `variable-pool-scroll` | `theme.css:862` | useVariableDrag.ts、VariablePool.tsx |
| `variable-pool-title` | `theme.css:860` | VariablePool.tsx |
| `variable-pool-title-actions` | `theme.css:945` | VariablePool.tsx |
| `variable-pool-toggle` | `theme.css:863` | VariablePool.tsx |
| `variable-pool-value` | `theme.css:880` | VariablePool.tsx |
| `variable-pool-value-detail` | `theme.css:882` | VariablePool.tsx |
| `variable-type-menu` | `theme.css:876` | VariableTypePicker.tsx |
| `variable-type-picker` | `theme.css:874` | VariableTypePicker.tsx |
| `view` | `style.css:2`、`theme.css:30` | App.tsx、AppRoot.tsx、CreateInterfaceDialog.tsx、InterfaceConfigPage.tsx、MapPage.tsx、ViewBindingPicker.tsx |
| `view-binding-controls` | `theme.css:891` | ViewBindingPicker.tsx |
| `view-binding-row` | `theme.css:889` | ViewBindingPicker.tsx |
| `welcome` | `style.css:2` | AppRoot.tsx |
| `welcome-steps` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `welcome-symbol` | `style.css:2`、`theme.css:29` | AppRoot.tsx |
| `with-markdown` | `theme.css:281` | DocumentWorkspace.tsx |
| `workflow-context-menu` | `theme.css:974` | WorkflowContextMenu.tsx |
| `workflow-drag-body` | `theme.css:1023` | DragCardPreview.tsx |
| `workflow-drag-card-content` | `theme.css:1034` | WorkflowEditor.tsx |
| `workflow-drag-preview` | `theme.css:1017` | DragCardPreview.tsx |
| `workflow-drag-title` | `theme.css:1020` | DragCardPreview.tsx |
| `workflow-drag-visual` | `theme.css:1018` | DragCardPreview.tsx |
| `workflow-edge-value` | `theme.css:854` | WorkflowEditor.tsx |
| `workflow-image-preview` | `theme.css:840` | ModelWorkflowPage.tsx |
| `workflow-images` | `theme.css:730` | ModelWorkflowPage.tsx |
| `workflow-library-branch` | `theme.css:727` | LibraryFolder.tsx |
| `workflow-library-panel` | `theme.css:939` | WorkflowEditor.tsx |
| `workflow-library-search` | `theme.css:726` | WorkflowEditor.tsx |
| `workflow-live-status` | `theme.css:857` | ModelWorkflowPage.tsx |
| `workflow-management-page` | `theme.css:977` | ModelWorkflowPage.tsx |
| `workflow-node-controls` | `theme.css:845` | WorkflowEditor.tsx |
| `workflow-parameters` | `theme.css:728` | WorkflowEditor.tsx |
| `workflow-prototype-measure` | `theme.css:1015` | FlowEditor.tsx、WorkflowEditor.tsx |
| `workflow-result` | `theme.css:730` | ModelsPage.tsx、ModelWorkflowPage.tsx |
| `workflow-run-panel` | `theme.css:726` | ModelWorkflowPage.tsx |
| `workflow-settings` | `theme.css:724` | ModelWorkflowPage.tsx |
| `workflow-settings-actions` | `theme.css:724` | ModelWorkflowPage.tsx |
| `workflow-toolbar-controls` | `theme.css:846` | WorkflowEditor.tsx |
| `workflow-type-icon` | `theme.css:832` | WorkflowIcon.tsx |
| `workflow-variable-editor` | `theme.css:726` | ModelWorkflowPage.tsx |
| `workflow-workbench` | `theme.css:725` | WorkflowEditor.tsx |
| `workspace-label` | `style.css:2`、`theme.css:20` | 未直接命中；需核对动态类/旧规则 |
| `world-icon` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
| `world-row` | `theme.css:83` | AppRoot.tsx |
| `world-switch` | `style.css:2` | 未直接命中；需核对动态类/旧规则 |
