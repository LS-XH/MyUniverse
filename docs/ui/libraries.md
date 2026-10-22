# 插件、模型与配置界面

本文件负责管理入口和编辑载体；全局树、路径和动作见 [页面与导航](pages.md)。字段格式见 [配置数据](../data/integrations.md)，执行见 [功能目录](../features/README.md)。

## 分类与目录

插件包含技能、函数、工具，模型包含 LLM、SD、Agent。各分类以可嵌套虚拟文件夹组织，使用同一紧凑树行、展开、拖动、混合 DOM 顺序和卡片浏览。普通目录使用 Folder，文件按语言与类型区分；完整图标映射和许可证见 [样式](styles.md#插件与模型的三级图标)。

新建条目归当前目录；删除目录将内容提升一级。目录归属通过树拖动管理，Function、Tool、Skill 和模型配置不另设父文件夹下拉；Skill 专属 Tool 固定在其 scripts。移动不改变身份或物理路径。

## Function 与 Tool 编辑

两者共用紧凑工具栏、全高代码载体和对象调用助手。配置与测试浮层互斥、默认关闭、独立滚动，源码保留完整工作区。Function 以 JS/Python 源码或 Flow 画布编辑，JS 新建菜单包含空模板、关系推理、反推及姐妹关系模板；选择只创建独立副本，不绑定、不执行。

ScriptEditor 使用原生 textarea、同步高亮层与行号，支持标识符高亮和已有符号补全；它不是完整语言服务器。Function、Tool 和代码块复用 FunctionCodeEditor/ScriptEditor；语法色从主题 accent/text/muted/success/warning/danger 派生，script-occurrence 标记同名标识符。补全通过 textareaCaret 测量光标、在编辑区边缘避让，复用菜单家族。FunctionCodeEditor 另提供世界门面、values 和 add 的补全及速查。Function 配置无返回类型选择，测试须选具体实例/绑定成员；测试可能提交 add，执行边界见 [Function](../features/functions.md#执行环境flow-和编辑)。

Tool 配置承载调用名、说明、JSON Schema、annotations 及 JS/HTTP 参数。自带项仅说明可在配置中编辑，树位置可拖动；名称、实现、Schema、annotations 和启停只读，无删除入口。对象调用世界与测试参数可选。Skill 专属工具复用同一编辑测试界面，数据回写所属技能包。

## Skill 包编辑

可展开包节点提供管理页、SKILL.md、scripts、references、assets。管理页显示说明和启用状态；正文编辑保留草稿，点击保存校验 YAML/name 后更新对象，后续由统一保存队列落盘。修改 name 同时请求目录改名，ID 保持。参考文档可创建、保存和删除；scripts 使用 Tool 编辑器；assets 仅在桌面资源管理器维护。

重新读取技能目录会先尝试保存当前编辑，再扫描独立包；冲突和格式错误就地显示。删除用户自建包提示移入 .trash，移除受管参考文件提示保留 .history。新建、迁移、冲突与恢复规则见 [Skill 格式](../data/skills.md)，运行时文件接口见 [Skill 功能](../features/skills.md)。

## LLM 连接

连接页编辑 URL、密钥、模型目录、请求参数及输入未命中/缓存命中/输出价格。目录获取可取消旧请求，失败时允许手填模型 ID；测试会发送真实 HTTP 请求并显示结果。连接不提供系统词、Tool 或子 Agent 许可，见 [模型](../features/models.md)。

系统自带技能以 builtin-skill 稳定身份保护，不显示删除菜单/按钮；移动到其他目录后仍不可删除。正文和说明仍按原编辑规则维护。放进系统文件夹的用户自建技能仍可删除，不能仅按当前文件夹判定所有权。技能分类根项使用 Hammer，每个技能包使用 Sparkles。

## Agent 与 SD

Agent 集合按 Workflow、ReAct、高级三种类型创建独立实例。Workflow 显示图、配置、运行和变量池；ReAct/高级显示应用核心的配置页，隐藏内部图。普通实例可改系统词、Tool/Agent/Skill 许可和轮次，默认 ReAct/高级实例也可改名删除，不在重启后补建。

多角色扮演是受保护的特化实例，配置只读，仅展示已接入能力；工作策略在可编辑 Skill 中。能力许可使用纵向主题列表，普通实例可清理失效引用，特化页不显示可编辑清理操作。Workflow 在调用契约配置内使用同一套许可列表；三种 Agent 默认整组选中系统 Manager / Runtime 文件夹，Runtime Skills 中的有效技能默认可用；Tool 不逐项展开。普通实例可取消组许可，用户自建工具仍单独列出，特化实例只读展示。

Workflow、SD 与 Function Flow 的画布、端口和拖动见 [工作流 UI](workflow-editor.md)。配置、运行、节点库共用右侧停靠区，互斥显示；SD 从外部 ComfyUI 加载节点目录并导入 API 图，执行方法见 [ComfyUI](../features/comfyui.md)。

## 设置与主题

预设为星雾蓝紫、经典暗黑、晨光浅色，只读；可复制、新建、命名、删除自建主题。颜色覆盖 rail/sidebar/surface/canvas/panel/input/border/text/muted/accent/hover/active 及图、聊天、标记、源码高亮等专用对象。使用 ARGB 选择器及 8×8 方形色板，选择预设保留当前透明度。

导航、滚动条、下拉、右键、弹层等必须应用语义主题颜色。减少动态效果下保留反馈但停用位移/旋转。部分底层样式仍有早期色值，新增/维护样式应使用主题覆盖，不将残留实现描述为设计许可。

源码入口：[FunctionsPage](../../src/ui/FunctionsPage.tsx)、[ToolsPage](../../src/ui/ToolsPage.tsx)、[SkillsPage](../../src/ui/SkillsPage.tsx)、[ModelsPage](../../src/ui/ModelsPage.tsx)、[PresetAgentPage](../../src/ui/PresetAgentPage.tsx)、[ModelWorkflowPage](../../src/ui/ModelWorkflowPage.tsx)、[SettingsPage](../../src/ui/SettingsPage.tsx)。

系统应用文件夹以 builtin-folder 稳定身份识别，使用 FolderCog；不可改名、删除或作为拖动源。仍可展开、进入及管理其内容。普通用户文件夹保持 Folder 和原有编辑/拖动行为。
