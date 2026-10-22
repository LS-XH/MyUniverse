# 主题颜色、共享样式与控件复用

入口为 [styles/index.css](../../src/ui/styles/index.css)，主题键定义于 [themes.ts](../../src/model/themes.ts)。此文件维护当前样式规范，具体页面行为见 [页面](pages.md)、[管理界面](libraries.md)、[聊天](chat.md) 和 [工作流](workflow-editor.md)。

## 组织与使用

入口依次加载基础、Token、公共表面、按钮、输入、树行、菜单、卡片、浮层、内容、画布、页面布局及现代组合层 modern.css。基础与控件家族拥有共同视觉声明；变体设置局部参数；layouts.css 保留布局、内容排版、父级结构相关的细节及特殊渲染。伪元素、代码高亮、地图与关系线不强行套用普通控件表面。

ui-surface 统一背景、文字、圆角、阴影和各侧边框。其参数在每个表面上重置，防止嵌套控件继承父控件皮肤；ui-surface--bordered 提供共享的主题边框。家族的 --themed / --text 标记选择主题背景和文字默认值，具体变体仅覆盖必要参数。原生 select 只作为隐藏的表单与 change 事件适配器，所有可见选择器由共享 Select 按钮与 Portal 菜单渲染。

例如普通按钮使用：

```tsx
<button className="ghost ui-surface ui-button ui-button--standard ui-button--ghost ui-surface--bordered">操作</button>
```

标题按钮额外增加 ui-button--elevated；图标使用 ui-button--icon，顶栏再加 ui-button--topbar-icon。保留旧业务类用于结构、查询和状态控制。新增同类元素应组合已有基础和变体，不在页面里重新写完整皮肤。局部尺寸、背景、阴影、边框可覆盖 --ui-radius、--ui-bg、--ui-fg、--ui-shadow 和 --ui-border-*；共享档位使用 tokens.css 中的圆角、时长和阴影色。

顶栏图标按钮的标准组合如下，主顶栏与 graph-top 共用同一变体：

```tsx
<button className="icon-button ui-surface ui-button ui-button--icon ui-button--topbar-icon" title="操作说明" aria-label="操作说明">
  <Icon size={20}/>
</button>
```

图标按钮的基础尺寸由 buttons.css 统一维护，topbar-icon 为 32×32、零内边距，常态透明无边框、文字为 muted；悬停使用 hover/text，按下缩放 .94。aria-pressed、aria-expanded 或已有 tool-active 状态由共享变体提供 active/accent 高亮。页面容器只安排位置与间距，旧 graph-tools 普通按钮规则不得覆盖图标变体的背景、边框和尺寸。

## 家族与交互

| 家族 | 共同基础 | 变体与行为边界 |
|---|---|---|
| 按钮 | ui-button / ui-button--standard | ghost、primary 保留普通无缩放；elevated 上浮 1px、按下 .96；icon 默认透明，topbar-icon 按下 .94；add 保留上浮与 .94；inline、send、文字动作分别保留尺寸与反馈 |
| 树与列表 | ui-tree-row | navigation、heading、model、theme、folder、palette、conversation；展开、拖动与辅助动作保留业务实现 |
| 输入与选择 | ui-field / ui-search | reference、color-trigger、数字、紧凑与多行；保留透明名称输入与只读；原生 select 统一迁移为 Select 按钮菜单 |
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

主题缩略图、颜色选择内容、人物关系网用户样式、地图图片、代码语法色和原有非语义装饰色保留，避免额外视觉变化。中性阴影色、遮罩、圆角、时长集中为 Token，档位保持原值。Portal 使用 portalTheme.ts 传递触发区主题及共享 Token；不复制控件自身表面参数，以免按钮圆角、边框或悬停状态污染菜单。

## 引用选择与配置卡片

实例选择统一使用 `ReferencePicker.tsx`；文件 ReferenceInput、关系映射新增和切换共用 reference-picker/ui-field--reference，保留只读、搜索和候选限制。背景来自实例所属标签的 ARGB 颜色，无标签回退主题，悬停由标签色与主题 hover 混合。标签色属于用户内容颜色。

下拉实例条目统一使用 `ReferenceOption.tsx`：显示所属类徽标和实例名称，从 referenceIndex 读取所属标签颜色，复用 ui-reference-option 的背景与悬停规则。ReferencePicker 使用单选按钮条目，关系类型筛选使用带复选框的同一条目；复选框不改变实例的标签背景。标签透明度按 ARGB 保留，不使用关系连线格式的颜色代替标签色。

`ConfigCard` 复用 entity-card、entity-header、entity-fields；标题常驻，无折叠。关系/背景映射复用 FieldCard，地图设置与绑定同样复用 ConfigCard。布局由 layouts.css 定义，皮肤和反馈由 cards.css 提供。

配置标题与映射条目复用 SortHandle；ConfigCardList 分组顺序仅为页面布局，映射重排改变 lineStyles/domainStyles 条目顺序并自动存档 JSON，保存键再导出配置，不修改实例正文。拖动克隆通过 preserveDragAppearance 保留计算样式及内部布局。

单行映射左侧引用遵循文件操作的共享内容宽度，剩余空白由左布局列承担；右侧整体靠右。颜色列 140px，数字列 90px，类型列 104px，删除按钮固定最右，两区域间隔 16px；窄窗口横向滚动。这里仅保留当前布局，早期弹性列和拉满选择框方案见日志。

## 聊天过程与 Markdown

过程卡片沿用 ui-panel--chat-process，并显式声明 ui-panel--themed / ui-panel--text / ui-surface--bordered；圆角使用 ui-radius-10。折叠标题包含同族 ui-icon-surface--process、主题状态徽标及展开箭头，提供 hover、focus-visible 和 reduced-motion 反馈，不依赖原生 details 标记作最终视觉。

Markdown 正文继承聊天字体与主题，标题、列表、引用、链接和表格只补充内容排版；代码及工具参数复用 ui-value--chat-code，以 input/text/border 和圆角 token 定义皮肤。react-markdown + remark-gfm 使用 React 元素渲染，关闭原始 HTML，保留默认 URL 校验。界面渲染与模型协议存储独立。

消息容器 white-space:normal，用户文本单独 pre-wrap；不能用 JSX 空格或统一正文顶边距制造用户气泡空行。用户气泡下方的编辑/复制使用现有 icon 按钮与主题反馈，不增加独立皮肤。差异只用一列行号（删除取旧行号，新增/上下文取新行号），固定行号列与 minmax(0,1fr) 正文列，正文 pre-wrap / overflow-wrap:anywhere；消息和过程 flex 项必须 min-width:0，避免长文本撑宽父容器。发送/停止复用同一个 ui-button--send，固定输入区右下角。回到底部按钮复用 ghost 按钮，使用主题 panel/text/border 和圆形局部变量；定位输入区上方居中。修改建议以原生 details/summary 实现默认折叠，使用同一主题面板与展开箭头，增删统计继承 success/danger；连续工具组复用过程面板，不增加独立皮肤。交互契约见 [页面交互](pages.md)。

## 颜色格式

六位颜色为 #RRGGBB；项目八位颜色为 #AARRGGBB，由 themeStyle/toCssColor 转为 CSS rgba，不能直接当 CSS 的 #RRGGBBAA 使用。ColorPicker 和标签、关系图用户颜色沿用此规则。主题中包括 button/buttonText 等兼容字段；当前通用按钮文字由现代组合层统一使用 text，强调按钮和纯图标遵守下述例外。

## 现代组合层与次级工具栏

`modern.css` 在布局层后加载，只提供跨页面组合规则。所有选择型原生下拉改为 `Select.tsx`：触发器组合 ui-button/ui-field--select；选项复用 PickerMenu、ui-menu-item，支持主题、禁用、分组、长列表搜索及键盘选择。隐藏原生 select 保留原 value/onChange/form 契约。画布、实例批量操作的快捷键与滚轮保护同步识别 combobox/listbox，避免操作菜单时误删节点。

次级工具栏共用 `ui-page-toolbar`，透明背景、无底部分隔线与背景模糊；页面只通过修饰类安排功能布局：

| 修饰类 | 使用位置 |
| --- | --- |
| ui-page-toolbar--canvas | graph-top、flow-toolbar |
| ui-page-toolbar--editor | functions-heading、Tool 编辑页 |
| ui-page-toolbar--page | 集合、实例、设置、模型与 Skill 标题 |
| ui-page-toolbar--document | 属性编辑标题 |
| ui-page-toolbar--chat | 会话标题 |
| ui-page-toolbar--config | 界面配置标题 |

原有业务类保留供定位与命令查询；修饰类不能重新定义完整背景皮肤。主 topbar 保留应用级导航，路径节点使用已有 ghost/standard 基础，加 breadcrumb-button 的无边框、透明、圆角覆盖。

### 工具栏与文字状态

工作流工具栏与画布共享网格区域，工具栏透明且空白区域不接收指针事件；节点库展开时仅保留库头部右侧的收起按钮。所有按钮与树行文字统一使用 text，只有 icon-button / ui-button--icon 使用 muted；选中仍通过背景和边框表达。

ReferencePicker 与聊天输入模块共同使用 ui-reference-trigger 基础样式；聊天只覆盖行内定位与点击反馈，类型徽标沿用 reference-class，内容颜色仍读取 reference-color。

按钮文字例外：primary、send、color-done 使用 accentText；mini-add、schema-add 使用 accent；round-add / ui-button--add 与图标按钮使用 muted。普通按钮与树行仍使用 text。

### 原生文字选择和 Tab 焦点

全局界面文字默认不可拖动选择；input、textarea、contenteditable 和 role=textbox 的文本区域保留原生选择，聊天引用模块仍为原子控件。useNativeInteractionPolicy 在原生 Tab 默认动作前排除只读展示框、非交互 tabindex 容器和 Chromium 隐式可聚焦的滚动容器；不接管 Tab 跳转，也不移除正常交互控件的焦点提示。只读框仍可用鼠标复制，画布的 tabindex=-1 仍供快捷键的程序化聚焦使用。

## 插件与模型的三级图标

LibraryIcon 只表示系统分类根项：函数/工具/SD/Agent 保留原图标，LLM 为 BrainCircuit，Skill 为 Sparkles。普通虚拟文件夹及其子文件夹、集合页文件夹卡片使用 Folder，不继承文件类型图标。

LibraryFileIcon 统一树文件与集合卡片：JS 为 fluent:document-javascript-16-regular，Python 为 fluent:document-py-16-regular，Function Flow 为 Lucide Workflow，SD 工作流为 thesvg:comfyui，普通 Agent 工作流为 simple-icons:langgraph，LLM 连接为 Bot。系统 ReAct/高级/多角色 Agent 保留专有图标。AgentIcon 的普通 Agent 分支复用同一 LangGraph 图标，聊天等身份呈现保持一致。

SkillTree 的包项为 FolderPen，SKILL.md/参考 Markdown 文件为 FileText；scripts 为 Wrench、assets 为 Image，references 入口为 Files，scripts 中的 Tool 仍为 Wrench。SkillsPage 对应管理卡片使用同一映射。

ToolIcon 按职能统一树项、集合卡片、编辑页与聊天过程：write 使用 FilePen，read 使用 FileSearchCorner，ask 使用 UserCheck，其他操作使用 Wrench；不根据显示名称猜测。WorkflowEvent 持久化 toolRole，旧事件通过内置调用名回查。系统文件夹使用 FolderCog，普通文件夹仍使用 Folder。当前 Lucide 依赖未含 FileSearchCorner，因此内联官方 SVG 路径（ISC 许可），不依赖运行时网络。

四个 Iconify 图标随应用离线打包，源 SVG、元数据和许可证保存在 src/assets/library-icons，静态路径在 libraryIconPaths.ts，通过内联 SVG currentColor 继承主题；树 16px、卡片按现有尺寸，不引入运行时网络图标库。节点画布使用独立的 WorkflowIcon 映射。

## 兼容类与交互尺寸

旧业务类继续承担布局、查询、状态和拖动定位。完整旧类 → 家族变体映射只维护在 [mapping.json](../../src/ui/styles/mapping.json)，不在 Markdown 复制一份长表。新增同类控件组合基础类与显式变体，动态克隆保留这些标记。

cardMotion 按实际宽高换算 FieldCard 悬停总宽高各 +4px；实例悬停上浮 1px，按下为固定 1px 位移和阴影变化，不使用整卡缩放。共享卡片 CSS 管理背景、边框、阴影和 transform 过渡，页面不能覆盖整份 transition 列表。减少动态效果时关闭卡片变形。

field-card 的 ui-card--tilt 标记为兼容旧映射保留；文件操作与属性配置中的实际反馈已取消 perspective 和 rotateX/rotateY，二维缩放由 prepareCardMotion 按布局尺寸计算固定 4px 增量，配合阴影和主题高亮。高度超过 1,200px 或包含 `.is-long-content` 文本框时不缩放；FieldCard 同时跳过这类区域的悬停动画，避免为巨型正文创建/重绘变换表面。长文本编辑框规则见 [页面](pages.md)。

## 验证入口

/tests/ui-styles.html 展示控件家族、主题与常态/悬停/按下/焦点/禁用/只读；/tests/modern-ui.html、/tests/native-interaction-ui.html、/tests/library-icons-ui.html 分别检查选择器、焦点和图标。夹具只作内存验证，真实操作及服务验收方法见 [开发指南](../development.md)，历史结果见 [日志](../changelog/README.md)。
