# 文档维护规则

## 三个主模块

UI 维护设计理念、主题样式复用、页面布局、控件与手势；数据结构维护世界对象、JSON/Markdown 格式、视图绑定、聊天和工作流信封；功能维护保存刷新、Function/Tool、视图写回、Graph 执行、模型与聊天以及 API。

目录见 [README](README.md)。Planning 只描述产品全貌与模块摘要；architecture 说明源码调用链；development 维护命令、验收方法和能力缺口，不承载某轮测试结果。

## 主题归属

| 修改对象 | 主维护位置 |
| --- | --- |
| 跨页面布局、复用与拖动约束 | ui/design-principles.md |
| 主题、CSS 家族、共享配置和引用控件 | ui/styles.md |
| 树、实例、Schema、双栏与页面操作 | ui/pages.md |
| 工作流侧栏、端口和画布编辑 | ui/workflow-editor.md |
| 聊天消息、工具组和提议呈现 | ui/chat.md |
| 世界类型、稳定身份、来源与默认模板 | data/world.md |
| 文件布局、JSON 对象与加载角色 | data/json-storage.md |
| 标题、纯文本引用、重复成员、JSON 填入、解析 | data/markdown.md |
| 视图/聊天/工作流持久结构 | data/views.md、chat.md、workflow.md |
| 草稿、保存刷新、提交隔离、基线 | features/persistence.md |
| 添加契约、调度与所有权 | features/functions.md |
| Tool Schema、事务、执行环境 | features/tools.md |
| 官方参数与提议确认/回退 | features/official-tools.md |
| 关系网/地图投影与源写回 | features/interface-views.md |
| Graph 求值、循环与根记忆事务 | features/workflow-execution.md |
| LLM/ToolCalls/Agent/ComfyUI | features/models-and-agents.md |
| 会话执行、SSE、重发 | features/chat.md |
| 公共接口与调用示例 | features/api.md |
| 需求原因、实施过程、截图和实际测试结果 | changelog/日期.md |

## 更新方式

先读对应专题与实际源码，把新规则放到对象所属章节，直接修改被替代规则；不要把“最新说明”“本轮修改”或日期小节追加到设计末尾。跨类型内容拆分后用链接引用，一项规则只有一个完整主维护位置。新增专题必须有独立职责，不能按聊天轮次命名。

先更新结构、行为、兼容边界与示例，再更新 Planning/README 摘要及代码入口。同日日志可按轮次追加；记录触发问题、最终修改、必要取舍、规范归属和实际验证。未执行测试应明确写出，不复用历史测试数。

## 状态与验证

- 已实现：有对应代码入口，并说明实际参数、范围和行为。
- 兼容：解释旧数据如何读取，新建数据采用什么规则。
- 待实现：明确预留入口与缺失实现。
- 待验收：代码或模拟验证存在，真实环境尚未确认。

用户设计要求与代码有差距时分别写要求和实现边界。构建、单测、浏览器、桌面与真实服务验收分别记录。保存前检查相对链接/锚点、类型名、示例、源码入口和各模块是否矛盾。

## 历史与交接

历史原文位于 changelog/archive，manifest 记录来源、字节数和 SHA256；原文不修改。旧方案、过程顺序与测试截图留在日志，不能当作现行规范。日期/轮次无法确定时按来源归档，不补造日期。

交接先链接当前模块与能力边界，仅在追查原因时链接日志。不要再次把整段聊天抄进专题末尾。模板与映射见 [整理记录](changelog/documentation-reorganization.md)。
