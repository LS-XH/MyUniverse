# 开发、交付与验证

本文件维护可重复的开发方法与验证入口，某次构建、测试数量、截图、耗时和交付结果只记入 [日志](changelog/README.md)。源码分层见 [架构](architecture.md)，逐文件导航见 [源码索引](source-map.md)。

## 环境与命令

前端需要可运行 Vite 7/TypeScript 5 的 Node.js 与 npm；桌面还需 Rust、Tauri 2 的系统构建依赖和 Windows WebView 环境。Python Function 需要另装 Python 3，ComfyUI 需要外部服务；它们不是前端构建自带能力。

| 命令 | 用途 |
| --- | --- |
| npm install | 按 package.json/lock 安装依赖 |
| npm run dev | 默认 127.0.0.1:1420，strictPort；用户数据和 Rust 构建目录不监听 |
| npm run dev -- --port 1425 | 使用独立开发端口打开测试夹具 |
| npm test | scripts/test-markdown.mjs 内存打包并运行全部导入的测试 |
| npm run build | tsc -b 与 Vite 前端构建 |
| npm run tauri dev | 桌面开发运行 |
| npm run desktop:build | Windows 独立 target-next 构建及可执行文件替换 |
| cargo test --manifest-path src-tauri/Cargo.toml --lib | Rust 桥及文件测试；需对应系统工具链 |
| node tests/sse-server.mjs | loopback:1431 本地模拟模型 SSE 服务 |

浏览器是功能预览：工作区与技能包使用不同 localStorage key，JSON 写入仍同步；不拥有桌面 user 目录、Python 或资源管理器能力。

## 桌面交付

scripts/build-desktop.ps1 先从三个关系示例刷新 bundledRelationshipScripts.json，再以 src-tauri/target-next 编译，复制到 src-tauri/target/release/my-universe.exe，并更新项目根快捷方式。运行中的 exe 被锁定时启动隐藏 install-desktop.ps1，最多等待两小时，每 5 秒重试替换，状态记录于 .desktop-update-status.json。实际替换状态与源码构建成功分开记录。

release 的 user 位于 exe 同目录，debug 使用工作目录。更新不得删除、移动或覆盖用户工作区作为测试夹具。普通前端构建不会代替用户正在运行的桌面 exe；本次是否重建必须在日志明确记录。

## 验证层次

| 层次 | 能证明的内容 | 实施要求 |
| --- | --- | --- |
| 类型/构建 | TypeScript 接口与打包 | npm run build；不证明交互、Python 或服务可用 |
| 模型/服务回归 | 转换、Schema、事务、迁移、模拟 Graph/SSE | npm test 使用内存与本地夹具，不写真实世界 |
| UI 内存夹具 | 实际组件、主题、DOM、手势、状态 | 使用 tests/*.html，记录具体操作与观察 |
| Rust 测试 | 文件路径、独立包、原子写入、网络桥、Python 桥 | 临时目录/本地服务；Python 结果取决于实际解释器 |
| 桌面端到端 | WebView、文件对话框、进程取消、重启恢复和实际替换 | 在隔离数据位置验收，区分构建与运行版本 |
| 真实服务 | 供应商协议、ToolUse、Skill 自主选择、GPU 输出 | 单独记录服务、输入和真实返回；模拟不能替代 |

## 按功能选择回归

测试执行列表以 [test-markdown.mjs](../scripts/test-markdown.mjs) 为准；新增文件若未导入不会由 npm test 自动发现。

| 主题 | 代表测试 | 必查契约 |
| --- | --- | --- |
| 世界/Markdown/JSON | markdown、plainMarkdown、jsonRuntime、manualSave | 固定 Schema、引用、纯文本导出、来源保留/清除、启动零正文读取、限定导出不覆盖存档 |
| 编辑/排序/过滤 | instanceEditing、bulkEdit、sorting、attributeFilter、treeMoves、treeDragHit、libraryTreeOrder、visitHistory | 递归副本身份、标签、组排序、源树完整性、混排 DOM 与预览落点、导航分支 |
| Function/脚本 | functions、flow、scriptHost、relationshipFunction、scriptEditor | void/add 范围、生成所有权、失败回滚、逐实例提交、模板、语法编辑契约 |
| Tool/提议 | builtinTools、workflowTools | 官方实现保护、Schema、原调用 ID、待确认、冲突合并、批量/回退、问题取消 |
| 工作流 | workflows、workflowStructure、workflowEditing、workflowExecution、agentGraph | 全叶子/返回顺序、惰性、共享缓存、内部循环/Method、绑定及根预算 |
| 视图 | interfaceViews、graph、relationGraph | current/fixed 路径、逐值关系、源写回、只读生成值、布局与聚焦隔离 |
| Agent/Skill | models、agentSettings、agentSessions、roleplayConversation、skillPackages、runtimeSkills | 稳定迁移、删除不复活、成员私有隔离、输出校验、显式/自主许可、文件版本和失败 |
| 聊天/网络 | sse、chatPresentation、chatDirectives、chatUsage | UTF-8 拆包、工具参数累积、插话、编辑快照、引用和实际请求用量 |
| 主题/诊断/性能 | themes、runtimeLog、performance | ARGB、Portal、日志限量与有界格式化、网络状态不记录密钥、视角不重算和局部更新 |

## UI 夹具索引

每个 HTML 与同名 TSX 配对，使用内存世界；完整文件列表见 [源码索引](source-map.md#tests)。在运行开发服务器后访问 /tests/<名称>.html。

| 对象 | 夹具名称 |
| --- | --- |
| 主题与共享组件 | ui-styles、modern-ui、native-interaction-ui、library-icons-ui |
| 树与排序 | tree-ui、tree-drop-ui、tree-hit-ui |
| 实例与保存 | instance-edit-ui、instance-actions-ui、instance-name-ui、manual-save-ui、attribute-filter-ui、markdown-diff-ui、json-runtime-ui、refresh-function-ui |
| 视图与引用 | view-tree-ui、person-relations-ui、relation-graph-ui、graph-selection-ui、graph-layout-ui、graph-history-ui、reference-picker-ui |
| 编辑器 | script-ui、script-editor-ui、function-templates-ui |
| Agent 与聊天 | agent-ui、agent-settings-ui、agent-runtime-ui、multiagent-chat-ui、chat-controls-ui |
| 诊断与压力 | runtime-log-ui、performance-ui |

## 交互验收方法

树拖放比对松开前占位/目录高亮与提交后的 DOM 顺序、parentId；检查混排、移入移出、禁用目标、取消及自动滚动。画布拖放观察真实尺寸、多帧位置和不同缩放，验证普通移动不断线、仅兼容槽变形、库内释放不创建、取消恢复；只检查类名不足以证明手势正确。

实例编辑检查筛选后隐藏旁支保留、多选组排序、标签、剪切与跨页撤销；巨大 Content 保留完整值，预览关闭后不生成全文。关系网检查逐值选择与删除、类型多选、生成只读、1～5 级聚焦、中心新增、布局历史及源类文件操作。页面必须沿真实父容器链填满剩余高度。

聊天检查主/子过程、已校验公开输出、等待问题、插话后取消重算、完成顺序、引用标签/IME、费用浮窗、返回焦点与左右主题。生成过程不得访问真实模型或磁盘作为模拟夹具；真实供应商行为另记。重新加载检查 running 转 interrupted，问题不重放，目标失效不切换，成员私有上下文不进入其他成员。

性能测量分别记录扫描、解析、合并、导出、DOM 更新与实际输入延迟；单项 Node 耗时不是桌面整次输入耗时。历史截图及性能数字不作为当前设备保证。

## 当前能力边界

| 能力 | 状态 |
| --- | --- |
| 世界编辑、JSON 自动存档、明确 MD 交换 | 已实现；不自动发现未知文件或推断 Schema |
| 人物关系网、关系类型网、地图 | 已实现；双实线渲染仍待完善，地图不是 GIS |
| JS/Flow、Python、用户 Tool | 已实现接口；脚本不是权限沙箱，Python/桌面联调独立验收 |
| Agent Graph、Skill 包、会话管理、流式聊天 | 已实现；自主选工具/技能与长会话需真实供应商验收 |
| 新 void Function 从通用图节点写世界 | 缺少 bindingPath 适配 |
| ComfyUI API 图与取图 | 已实现桥；需要外部服务/GPU，不支持完整前端布局 |
| 外部 Skill 下载安装、插件发现安装 | 待实现 |
| 自动章节写作、插图归档、远程/对外 MCP、像素加工 | 待实现 |

维护文档前核对源码及示例，将当前规则更新到所属对象章节；实际命令和结果写 [日志](changelog/README.md)，不要在专题末尾追加日期补丁。

toolCategories 测试覆盖三种 Agent 的默认目录许可与隔离、用户取消选择保留、旧目录移除时内容提升、只读目录删除/移动保护、职能图标持久化、自建 write/ask 的执行前确认、文件提议恢复/冲突/无关变更保留、批量保存倒序回退。tests/tool-categories-ui.html 使用内存夹具检查目录图标、分组配置、文件保存/回退和提问回答，不读写用户实际文件或访问模型。

技能所有权验收：toolCategories 检查分类 Hammer、包项 Sparkles、系统项隐藏删除与领域拒绝、自建项保留删除；skillPackages 检查保存预检禁止任何部分写入。Rust 检查受保护包删除拒绝但编辑/改目录仍有效。tests/skill-ownership-ui.html 提供系统/自建技能同目录的隔离 UI 夹具。
