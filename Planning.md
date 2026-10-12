# MyUniverse 总体设计

MyUniverse 是基于世界对象的小说创作工作台，使用 React、TypeScript、Vite 和 Tauri 2。人物、关系、势力、地点、事件、章节与插图按世界隔离；长期目标是让 Agent 在用户掌控的数据、模型和工具上完成设计、写作与绘图。当前 Agent 使用项目自己的 Graph 执行器。完整入口见 [文档目录](docs/README.md)，过程与历史验收见 [日志](docs/changelog/README.md)。

## UI

### 总体设计与复用

四个主入口为创作、插件、模型、设置；侧栏导航对象，顶栏显示路径并复用页面动作，主区编辑当前对象。树以缩进和箭头表示层级，单击打开、箭头或双击展开、右键只开菜单。世界项目直接作为创作树根。页面会话保留滚动、搜索、选择与视角。

主题提供语义颜色，共享 CSS 家族提供表面、按钮、输入、树行、卡片、菜单和浮层；Portal 继承主题。FieldCard、ReferencePicker、ConfigCard、SortHandle 和画布手势按对象复用。成员只做二维轻微突出；拖动平时保留形态，进入兼容边界才连续变形，松开提交。详见 [设计原则](docs/ui/design-principles.md) 与 [样式复用](docs/ui/styles.md)。

### 页面与编辑载体

文件页面提供实例、递归成员、搜索、多选、复制/剪切/粘贴、历史与标签；Markdown 双栏直接编辑同一对象，展示保存基线的行差异及选中范围。实例、文件与父集合用圆点提示未保存状态；类名旁的函数开关控制生成值显示，顶部强调色进度条展示刷新与函数计算进度。属性配置定义 Schema，不从正文猜结构。

人物关系网固定人物结构，展示重复关系、势力、个人关系聚焦及格式可见性；地图配置父类与对象绑定。聊天展示 Markdown 回复、实际思考、工具与子 Agent 过程、待采纳差异。工作流以画布为主体，Agent/SD 的配置、运行、节点库共用右侧停靠区，变量池位于节点库下方。详见 [页面](docs/ui/pages.md)、[聊天 UI](docs/ui/chat.md)、[工作流 UI](docs/ui/workflow-editor.md)。

## 数据结构

### 世界对象与身份

Workspace 管理 World 和全局插件、模型、Agent、主题；World 包含导航、类文档、视图与聊天。ClassDocument 由 FieldSchema 定义 Entity 的 FieldValue 结构。Key 为 Text/Const/Class，Value 为 Object/Class/Data/Text/Content/Integer/Decimal/Null。重复成员共享声明而保持独立 ID；引用、绑定和组织依赖稳定身份。默认世界包含人物、关系、势力、地点、事件类。详见 [世界数据](docs/data/world.md)。

### JSON 与 Markdown

JSON 保存完整工作区快照、组织、身份、结构、标签、配置和函数执行元数据；Markdown 是读取阶段的实例内容来源。类正文、Schema 和视图 JSON 平铺于 worlds/世界ID，集合与插件文件夹仅为虚拟组织。正文以一级类、二级实例、递归成员标题表达结构；函数生成成员仅附可读函数名注释。详见 [JSON 存储](docs/data/json-storage.md) 与 [Markdown 格式](docs/data/markdown.md)。

### 视图、聊天与工作流

地图 current 绑定用 Schema 路径，fixed 绑定用具体成员路径；视图布局独立于实例内容。聊天可见消息与完整模型协议分开，提议保留原世界/会话身份。WorkflowGraph 与 Function Flow 是不同结构；工作流有 String/Number/Boolean/Messages/Image/Tools/Agents 七型变量，Tools/Agents 只存注册身份。详见 [视图](docs/data/views.md)、[聊天](docs/data/chat.md)、[工作流数据](docs/data/workflow.md)。

## 功能

### 编辑、保存与刷新

正文及其他界面编辑先修改内存，不在改名、切页、失焦或脚本提交时自动保存；属性配置是独立例外，Schema 和标签定义自动写入 JSON，不读写 Markdown。Ctrl+S 保存当前文件或配置，保存全部提交所有草稿；Ctrl+R 明确重读目标并放弃对应草稿，创作刷新后重算绑定函数，计算结果仍待保存。保存只写提交快照，不读取或合并旧 Markdown。详见 [持久化功能](docs/features/persistence.md)。

### Function、Tool 与 API

绑定 Function 为 transform(self,input) 的 void/add 程序，只能向绑定范围的既有可重复结构添加，不能改写用户原值；生成内容只读，所有权由函数 ID 与绑定成员 ID 决定。JS/Flow 在主程序运行，Python 以快照和日志桥接。Tool 使用自由 JSON Schema 参数与可传输返回值，共用世界门面和运行草稿事务。官方九项工具负责查询、修改/新增提议，提议需用户采纳，采纳仍是内存更改。详见 [Function](docs/features/functions.md)、[Tool](docs/features/tools.md)、[官方工具](docs/features/official-tools.md)、[API 方法](docs/features/api.md)。

### 视图、Graph、模型与聊天

人物关系网操作写回人物源对象，布局独立；地图标记拖动只更新该视图覆盖。Graph 按返回依赖求值，循环反馈与惰性条件显式编排，基础 LLM 请求一次，ToolCalls 执行能力并返回工具结果片段。子 Agent 共享预算、世界和取消信号，独立变量，根成功统一提交记忆。聊天通过 SSE 流式请求，固定发起会话，支持消息编辑重发。SD 接入外部 ComfyUI API 图与取图。详见 [视图功能](docs/features/interface-views.md)、[工作流执行](docs/features/workflow-execution.md)、[模型与 Agent](docs/features/models-and-agents.md)、[聊天功能](docs/features/chat.md)。

## 能力边界与维护

Skill 执行、插件安装/发现、自动章节写作、插图归档、远程/对外 MCP、像素加工和完整 ComfyUI 前端布局导入仍待实现；人物关系网双实线渲染待完善。接口存在不等于真实供应商或 GPU 联调通过。通用工作流 Function 节点尚无 bindingPath，不能直接运行新 void 函数写世界。桌面保存为单文件原子替换，整批文件没有磁盘事务回滚。

[架构](docs/architecture.md) 说明调用链，[开发与验证](docs/development.md) 说明验收与交付，[文档维护](docs/documentation-guide.md) 规定主题归属。历史原始需求及本次整理前原文均收进日志，后续追加必须更新所属对象章节。

聊天工具支持只读子成员定向修改提议（精确标题路径及重复项 ID 消歧），并支持向用户提问等待选项或自填回答；提议复用确认与回退，提问随调用过程持久化、取消时终止且重启不重放。细节见 docs/features/official-tools.md 与 docs/ui/chat.md。

