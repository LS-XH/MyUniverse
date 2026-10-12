# UI 样式分类与复用

当前入口为 src/ui/styles/index.css，由 src/main.tsx 单次导入。style.css 仅保留兼容入口，theme.css 不再提供另一套覆盖。迁移前的选择器及交互审计保留在 [历史盘点](ui-style-inventory.md)。

## 组织与使用

入口依次加载基础、Token、公共表面、按钮、输入、树行、菜单、卡片、浮层、内容、画布、页面布局。基础与控件家族拥有共同视觉声明；变体设置局部参数；layouts.css 保留布局、内容排版、父级结构相关的细节及特殊渲染。伪元素、代码高亮、地图与关系线不强行套用普通控件表面。

ui-surface 统一背景、文字、圆角、阴影和各侧边框。其参数在每个表面上重置，防止嵌套控件继承父控件皮肤；ui-surface--bordered 提供共享的主题边框。家族的 --themed / --text 标记选择主题背景和文字默认值，具体变体仅覆盖必要参数。原生控件的未指定值回退到浏览器样式。

例如普通按钮使用：

```tsx
<button className="ghost ui-surface ui-button ui-button--standard ui-button--ghost ui-surface--bordered">操作</button>
```

标题按钮额外增加 ui-button--elevated；图标使用 ui-button--icon，顶栏再加 ui-button--topbar-icon。保留旧业务类用于结构、查询和状态控制。新增同类元素应组合已有基础和变体，不在页面里重新写完整皮肤。局部尺寸、背景、阴影、边框可覆盖 --ui-radius、--ui-bg、--ui-fg、--ui-shadow 和 --ui-border-*；共享档位使用 tokens.css 中的圆角、时长和阴影色。

## 家族与交互

| 家族 | 共同基础 | 变体与行为边界 |
|---|---|---|
| 按钮 | ui-button / ui-button--standard | ghost、primary 保留普通无缩放；elevated 上浮 1px、按下 .96；icon 默认透明，topbar-icon 按下 .94；add 保留上浮与 .94；inline、send、文字动作分别保留尺寸与反馈 |
| 树与列表 | ui-tree-row | navigation、heading、model、theme、folder、palette、conversation；展开、拖动与辅助动作保留业务实现 |
| 输入与选择 | ui-field / ui-search | reference、color-trigger、数字、紧凑与多行；保留透明名称输入、只读、原生 select 和各自焦点表现 |
| 菜单 | ui-menu / ui-menu-item | object 有按下反馈，workflow 无缩放；picker、type、model、completion、color 保留位置、搜索及动画 |
| 卡片与面板 | ui-card / ui-panel | collection 悬停上浮与按下 .975；field 只保留二维放大、阴影和高亮，最内层响应由 FieldCard 控制；input/output 行保留边框高亮；entity、model、theme、variable 与静态面板保留区别 |
| 标签与底座 | ui-badge / ui-avatar / ui-icon-surface | 类型、引用、状态、函数、用户与节点头像；形状与内容色通过变体保留 |
| 弹窗与侧栏 | ui-dialog / ui-drawer | standard、editor 与各配置侧栏；工作流配置/运行/节点库共享 ui-drawer--dock 平面皮肤及停靠位置，其他浮动、滑入、真实布局展开分别保留 |
| 提示与展示 | ui-alert / ui-value | error、sync、结果与只读值；空态、加载、代码排版由对应结构规则提供 |
| 编辑器与聊天 | ui-field / ui-composer / ui-message | Function、Tool、Markdown 共用输入皮肤与字体继承，补全、高亮、行号及消息布局保留 |
| 画布与拖动 | ui-node / ui-port / ui-drop-slot / ui-drag-preview | flow、person、地图标记、树/排序克隆和占位；端口不是普通按钮，坐标与变形算法保留 |

.heading-actions 和 .editor-actions 的按钮反馈已迁为元素上的显式修饰类；容器仍负责布局。动态克隆保持源元素家族标记，额外添加拖动预览变体。

画布变量节点在普通移动中直接使用正式 ui-node--flow 元素及其选中状态，不生成另一张可见卡片或替换控件。只有进入其他节点、节点库或变量池等边界才启用变形预览；预览隐藏需覆盖整个子树，克隆需保留原生控件的当前值。详细交互规则见 [工作流编辑器](workflow-editor.md#拖动形态与吸附)。

## 主题与颜色例外

ThemeColors 增加 danger=#ef7777、success=#59c48d、warning=#dfa158，三个预设及主题编辑器均包含它们。旧主题通过 normalizeWorkspace 补默认值并保留原字段、ID 与存储形状。删除、错误、保存、成功和警告读取语义颜色；透明背景与发光从对应颜色派生。

主题缩略图、颜色选择内容、关系网用户样式、地图图片、代码语法色和原有非语义装饰色保留，避免额外视觉变化。中性阴影色、遮罩、圆角、时长集中为 Token，档位保持原值。Portal 使用 portalTheme.ts 传递触发区主题及共享 Token；不复制控件自身表面参数，以免按钮圆角、边框或悬停状态污染菜单。

## 验收入口

运行开发服务后访问 /tests/ui-styles.html：三套预设、自定义主题及常态、悬停、按下、焦点、禁用、只读展示。状态预览从实际 CSS 规则生成，不维护第二套皮肤；减少动态效果选项复用实际媒体规则。真实 Tab、菜单关闭和点击仍可独立检查。/tests/tree-ui.html 用于树导航、编辑器、工作流菜单、节点库及画布拖放；这些页面仅操作内存。详细验证结果见 [修改日志](changelog/2026-10-10.md)。

## 旧类映射

下表为元素的主要视觉变体；实际 JSX 同时携带基础类和必要组合标记。结构类、选中与拖动状态保留，不因缺少 JSX 字面引用而删除。机器可读表见 src/ui/styles/mapping.json。

| 旧类 | 视觉变体 |
|---|---|
| ghost | ui-button--ghost |
| primary | ui-button--primary |
| icon-button | ui-button--icon |
| round-add | ui-button--add |
| mini-add | ui-button--mini-add |
| add-inline | ui-button--inline |
| add-schema | ui-button--schema-add |
| tree-disclosure | ui-button--disclosure |
| sidebar-toggle | ui-button--sidebar-toggle |
| topbar-markdown-toggle | ui-button--markdown-toggle |
| send-button | ui-button--send |
| chat-model-trigger | ui-button--model-picker |
| variable-type-picker | ui-button--type-picker |
| color-trigger | ui-field--color-trigger |
| color-done | ui-button--color-done |
| reference-trigger | ui-field--reference |
| sidebar-back | ui-button--back |
| sidebar-primary | ui-button--new-conversation |
| tree-row | ui-tree-row--navigation |
| settings-tree-heading | ui-tree-row--heading |
| model-nav-row | ui-tree-row--model |
| theme-nav-row | ui-tree-row--theme |
| sidebar-add | ui-tree-row--add |
| plugin-nav | ui-tree-row--plugin |
| flow-library-folder | ui-tree-row--folder |
| flow-palette-item | ui-tree-row--palette |
| conversation-row | ui-tree-row--conversation |
| sidebar-folder | ui-tree-row--conversation-folder |
| entity-search | ui-search--entity |
| sidebar-search | ui-search--sidebar |
| inspector-name | ui-field--inspector |
| function-code | ui-field--code |
| workflow-library-search | ui-field--library-search |
| channel-number | ui-field--channel |
| chat-agent-select | ui-field--agent |
| derived-reference-select | ui-field--derived |
| collection-card | ui-card--collection |
| entity-card | ui-card--entity |
| field-card | ui-card--tilt |
| model-card | ui-card--model |
| theme-preview | ui-card--theme |
| variable-pool-row | ui-card--variable |
| flow-input-row | ui-card--input |
| flow-output-row | ui-card--output |
| flow-input-output-row | ui-card--input-output |
| flow-inline-variable | ui-card--inline-variable |
| schema-panel | ui-panel--schema |
| hint-card | ui-panel--hint |
| empty-card | ui-panel--empty |
| theme-editor | ui-panel--theme |
| object-call-assistant | ui-panel--object-assistant |
| workflow-settings | ui-panel--workflow-settings |
| workflow-run-panel | ui-panel--workflow-run |
| workflow-variable-editor | ui-panel--workflow-variables |
| instance-proposal | ui-panel--proposal |
| function-contract-guide | ui-panel--contract |
| tool-model-selection | ui-panel--tool-models |
| picker-menu | ui-menu--picker |
| floating-picker-menu | ui-menu--floating |
| sidebar-object-menu | ui-menu--object |
| workflow-context-menu | ui-menu--workflow |
| variable-type-menu | ui-menu--type |
| chat-model-menu | ui-menu--model |
| code-completions | ui-menu--completion |
| color-popover | ui-menu--color |
| entity-tag | ui-badge--entity |
| reference-class | ui-badge--reference |
| function-chip | ui-badge--function |
| model-status | ui-badge--status |
| workspace-label | ui-badge--workspace |
| flow-connected-value | ui-badge--connected-value |
| collection-icon | ui-icon-surface--collection |
| empty-icon | ui-icon-surface--empty |
| welcome-symbol | ui-icon-surface--welcome |
| chat-welcome-icon | ui-icon-surface--chat |
| assistant-avatar | ui-icon-surface--assistant |
| brand-mark | ui-icon-surface--brand |
| user-avatar | ui-avatar--user |
| top-avatar | ui-avatar--top |
| node-avatar | ui-avatar--node |
| modal | ui-dialog--standard |
| editor-drawer | ui-drawer--editor |
| graph-inspector | ui-drawer--inspector |
| flow-library | ui-drawer--library |
| workflow-library-panel | ui-drawer--workflow-library |
| variable-pool | ui-drawer--variable-pool |
| markdown-preview | ui-drawer--markdown |
| document-error | ui-alert--document |
| markdown-sync-banner | ui-alert--sync |
| markdown-edit-error | ui-alert--markdown |
| function-error | ui-alert--function |
| flow-error | ui-alert--flow |
| editor-error | ui-alert--editor |
| generated-flow-code | ui-value--generated-code |
| workflow-result | ui-value--workflow |
| modern-composer | ui-composer--chat |
| message-content | ui-message--content |
| chat-bubble | ui-message--bubble |
| graph-canvas | ui-canvas--graph |
| flow-canvas | ui-canvas--flow |
| full-map | ui-canvas--map |
| map-grid | ui-canvas--grid |
| flow-node | ui-node--flow |
| person-node | ui-node--person |
| bound-map-pin | ui-node--bound-map |
| map-location | ui-node--location |
| map-pin | ui-node--map-pin |
| flow-port | ui-port--flow |
| flow-variable-placeholder | ui-drop-slot--variable |
| tree-drag-card | ui-drag-preview--tree |
| tree-drop-placeholder | ui-drag-preview--tree-placeholder |
| sort-ghost | ui-drag-preview--sort |
| sort-placeholder | ui-drag-preview--sort-placeholder |
| flow-template-ghost | ui-drag-preview--template |
| variable-card-ghost | ui-drag-preview--variable |
| workflow-drag-preview | ui-drag-preview--workflow |
| workflow-drag-visual | ui-drag-preview--visual |
| sort-handle | ui-drag-handle--sort |
| schema-grip | ui-drag-handle--schema |
| variable-drag-handle | ui-drag-handle--variable |

field-card 的 ui-card--tilt 标记为兼容旧映射保留；文件操作与属性配置中的实际反馈已取消 perspective 和 rotateX/rotateY，仅使用二维 scale(1.008)、原阴影和主题高亮。

## 聊天过程与 Markdown

过程卡片沿用 ui-panel--chat-process，并显式声明 ui-panel--themed / ui-panel--text / ui-surface--bordered；圆角使用 ui-radius-10。折叠标题包含同族 ui-icon-surface--process、主题状态徽标及展开箭头，提供 hover、focus-visible 和 reduced-motion 反馈，不依赖原生 details 标记作最终视觉。

Markdown 正文继承聊天字体与主题，标题、列表、引用、链接和表格只补充内容排版；代码及工具参数复用 ui-value--chat-code，以 input/text/border 和圆角 token 定义皮肤。react-markdown + remark-gfm 使用 React 元素渲染，关闭原始 HTML，保留默认 URL 校验。界面渲染与模型协议存储独立。

消息容器 white-space:normal，用户文本单独 pre-wrap；不能用 JSX 空格或统一正文顶边距制造用户气泡空行。用户气泡下方的编辑/复制使用现有 icon 按钮与主题反馈，不增加独立皮肤。差异只用一列行号（删除取旧行号，新增/上下文取新行号），固定行号列与 minmax(0,1fr) 正文列，正文 pre-wrap / overflow-wrap:anywhere；消息和过程 flex 项必须 min-width:0，避免长文本撑宽父容器。发送/停止复用同一个 ui-button--send，固定输入区右下角。回到底部按钮复用 ghost 按钮，使用主题 panel/text/border 和圆形局部变量；定位输入区上方居中。修改建议以原生 details/summary 实现默认折叠，使用同一主题面板与展开箭头，增删统计继承 success/danger；连续工具组复用过程面板，不增加独立皮肤。交互契约见 [页面交互](ui-interactions.md)。
实例选择统一使用 `src/ui/ReferencePicker.tsx`：文件操作中的 ReferenceInput、关系网新增映射及映射实例切换复用 `reference-picker` / `ui-field--reference`，保留只读、搜索和可选实例限制。选中实例及菜单项的背景取所属文档 `entityLabels` 对应 `labels[].color`，支持 ARGB；没有标签时回退主题背景，悬停由标签色和主题悬停色混合派生。实例标签色属于用户配置的内容颜色例外。验证页：`tests/reference-picker-ui.html`（仅内存）。

界面配置复用文件操作的实例卡片：`ConfigCard` 组合 `entity-card/ui-card--entity`、`entity-header` 和 `entity-fields`，标题常驻，不提供折叠。关系连线、背景块映射复用 `FieldCard`，所有格式值直接展示于同一行，数字框随剩余宽度在 62–100px 间伸缩，颜色选择器保持 140px，窄窗口横向滚动。地图的界面设置、显示元素绑定、地图展示也使用 ConfigCard；页面 CSS 只调整排列及间距，共享边框、背景、高亮与动效由 cards.css 提供。

配置卡片标题与映射条目复用 SortHandle 的指针排序、克隆预览、占位动画和方向键操作。ConfigCardList 的分组顺序仅为当前页面布局；映射顺序重排 graph.lineStyles/domainStyles 条目的插入顺序，随现有配置保存，不修改实例内容。

单行映射布局的左侧选择器按内容占位，右侧控件区使用剩余宽度；两区间距 16px，颜色列固定宽度，数字列和类型下拉为弹性列。

单行映射当前采用左弹性、右对齐：实例选择框占用剩余空间，右侧颜色/数字/类型控件保持固定紧凑列宽并整体靠右，删除按钮固定于最右侧；箭头沿选择框右边缘对齐。

当前映射布局：左侧引用按文件操作的共享内容宽度自适应，不拉满；剩余留白由左侧布局列承担。右侧整体靠右且各列固定：颜色 140px、数字 90px、类型 104px，删除按钮在最右侧。
