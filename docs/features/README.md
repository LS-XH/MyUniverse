# 功能模块

维护用户操作、运行规则、提交范围与 API。结构见 [数据模块](../data/README.md)，布局和手势见 [UI 模块](../ui/README.md)。

| 子对象 | 内容 |
| --- | --- |
| [世界与实例编辑](editing.md) | 结构同步、筛选、批量、副本身份、标签与历史 |
| [保存与刷新](persistence.md) | 自动 JSON、限定导出、MD 导入/填入、来源、渐进提交与取消 |
| [Function](functions.md) | void/add、绑定范围、所有权、重算、JS/Python/Flow 与模板 |
| [Tool 执行器](tools.md) | JSON Schema、JS/HTTP、草稿事务、取消和模型适配 |
| [官方工具目录](official-tools.md) | 17 项分组、调用名、参数、上下文与职能 |
| [修改提议](proposals.md) | 定向提议、冲突合并、批量采纳与回退 |
| [关系网与地图](interface-views.md) | 源写回、逐值关系、聚焦/筛选、布局与配置 |
| [工作流执行](workflow-execution.md) | 依赖、惰性、顺序、内部循环、Method、预算及记忆 |
| [LLM 模型](models.md) | 连接、参数、用量、基础 LLM/ToolCalls 与兼容自动交流 |
| [Agent](agents.md) | 类型/实例、能力、迁移、子调用、成员管理和结构化输出 |
| [Skill 加载与文件维护](skills.md) | 发现/激活、强制技能、专属 Tool、Runtime 文件版本与保存 |
| [聊天生命周期](chat.md) | SSE、发起会话归属、成员交流、插话、编辑重发和持久化 |
| [ComfyUI](comfyui.md) | SD API 图、节点目录、执行观察、轮询和图片保存 |
| [API 参考](api.md) | 世界门面、脚本入口、存储服务、HTTP/SSE 和 Tauri 桥 |
| [运行日志](runtime-log.md) | 来源、限量、过滤、覆盖层与诊断边界 |

源码入口见 [架构](../architecture.md)，验证方法见 [开发指南](../development.md)，实际测试和修改经过见 [日志](../changelog/README.md)。返回 [总目录](../README.md)。
