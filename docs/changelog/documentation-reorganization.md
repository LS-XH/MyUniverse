# 文档结构重整：2026-10-11

## 问题与处理

在已有分类基础上，后续追加再次把个人关系网、未保存提示、项目根、Markdown 差异和函数内部状态堆到文档末尾；共享配置布局还同时保留多轮互相替代的描述。保存前外部合并、独立浮层、可配置关系网等旧规则与当前代码不一致。

现行专题按 UI、数据结构、功能分目录；追加要求归回对象章节。JSON 文件职责与 Markdown 格式拆开，持久化行为独立；视图和聊天的数据结构从行为文档分离；工作流控制执行从类型文档分离；接口表与调用示例统一收集。既有日期日志保留实施顺序，本次未重演历史测试。

## 原文件迁移

| 整理前 | 现行主入口 |
| --- | --- |
| `docs/design-principles.md` | [docs/ui/design-principles.md](../ui/design-principles.md) |
| `docs/ui-interactions.md` | [docs/ui/pages.md](../ui/pages.md) |
| `docs/ui-styles.md` | [docs/ui/styles.md](../ui/styles.md) |
| `docs/workflow-editor.md` | [docs/ui/workflow-editor.md](../ui/workflow-editor.md) |
| `docs/data-model.md` | [docs/data/world.md](../data/world.md) |
| `docs/markdown-sync.md` | [docs/data/markdown.md](../data/markdown.md) |
| `docs/workflow-types.md` | [docs/data/workflow.md](../data/workflow.md) |
| `docs/functions.md` | [docs/features/functions.md](../features/functions.md) |
| `docs/script-runtime-and-tools.md` | [docs/features/tools.md](../features/tools.md) |
| `docs/official-tools.md` | [docs/features/official-tools.md](../features/official-tools.md) |
| `docs/models-and-agents.md` | [docs/features/models-and-agents.md](../features/models-and-agents.md) |
| `docs/interface-views.md` | [docs/features/interface-views.md](../features/interface-views.md) |

新增拆分：data/json-storage.md、data/views.md、data/chat.md、ui/chat.md、features/persistence.md、features/workflow-execution.md、features/chat.md、features/api.md。ui-style-inventory 为迁移前审计，收进本次原文归档；Planning - 副本和 workflow-structure-update 仅保留旧入口。架构、开发与维护规则继续位于 docs 根。

## 代码核对

- types.ts/templates.ts：世界结构、函数来源、聊天提议、默认人物的递归小故事 Object。
- storage.ts/manualSave.ts/AppRoot.tsx/lib.rs：保存不读正文、范围隔离、显式刷新、草稿/基线、单文件原子替换；world-index 与聊天导出文件没有独立热读入口。
- hostWorldApi.ts/scriptHost.ts/functionAppend.ts/functions.ts：稳定门面、void/add、绑定所有权、内存事务与 autoSave:false。
- builtinTools.ts/instanceProposals：九项工具及内存采纳；saved 提议状态不等于磁盘成功。
- interfaceViews.ts/App.tsx/CreateInterfaceDialog：人物关系网固定 people、地图配置父类、个人布局与可见性。
- WorkflowEditor/workflowValues/agents/agentRuntime：七型变量、Graph、独立变量、根记忆、右侧停靠和拖动预览。
- main.tsx/styles/index.css/layouts.css/ConfigCard：单入口 CSS、共享卡片及最终 140/90/104px 映射列。

## 原文完整性

整理前 Planning、副本和 docs 根全部 Markdown 原字节保存在 [本次归档](archive/2026-10-11-documentation/README.md)。[manifest.json](archive/2026-10-11-documentation/manifest.json) 记录来源、归档路径、字节数和 SHA256。以前 archive 原文和 manifest 不改动。当前日志只修复现行专题链接，原始上下文与验证记录保留。

## 验证

已检查 34 份现行文档、日志及导航索引中的 390 处本地链接/标题锚点，缺失文件和锚点均为 0。20 份本轮原文（269734 字节）与此前 14 份原文的字节数及 SHA256 全部匹配，共 34 份归档完整。ui/data/features 共 20 份主题文档；迁移前全部根目录专题都有去向或历史入口。

代码契约与最终结构已交叉核对，同日记录见 [修改日志](2026-10-11.md#文档按-ui数据结构功能重整)。本次仅修改文档，未运行应用测试、构建或真实服务联调。
