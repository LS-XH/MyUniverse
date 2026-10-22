# 应用自带 Tool 目录

定义来自 [builtinTools.ts](../../src/model/builtinTools.ts)，总计 17 项。此文件维护稳定调用名和参数；建议采纳见 [修改提议](proposals.md)，JS/HTTP 执行器见 [Tool](tools.md)。

## 注册与配置

| 分组 | 数量 | 职责 |
| --- | --- | --- |
| Object Manager | 5 | 发现类、实例、读取全文、提议新增/修改 |
| Interaction Manager | 1 | 聊天中等待用户回答 |
| Skill Manager | 3 | 调用级发现、激活和参考读取 |
| Agent Manager | 4 | 会话成员及人类身份 |
| Runtime Tool | 4 | 受管技能文本文件读写 |

自带项名称、调用名、实现、Schema 和 annotations 只读且不可删除；可编辑 description，通过侧栏树拖动调整 folderId。registeredTools/canonicalTool 只合并这两个用户配置，其余字段以应用为准。未修改的旧出厂说明可精确升级，定制说明保留；目录版本迁移后不覆盖用户拖动。

## 世界与交互调用契约

Schema 均为 object，表内参数全部 required，additionalProperties=false。名称在调用世界中精确匹配，缺失或重名明确报错。

| 稳定 ID 后缀 / 名称 | 调用名 | 参数 | 返回 |
| --- | --- | --- | --- |
| list_classes / 所有类名 | universe_list_classes | 无 | 类名称数组 |
| list_instances / 实例名列表 | universe_list_instances | className | 该类全部实例名称 |
| get_instance_markdown / 实例 Markdown | universe_get_instance_markdown | className、instanceName | {id,classId,name,className,markdown}；markdown 为完整实例正文，身份供角色绑定使用 |
| propose_instance_change / 修改建议 | universe_propose_instance_change | className、instanceName、markdown | proposalId、pending、等待用户说明；世界未修改 |
| propose_instance_add / 新实例添加提议 | universe_propose_instance_add | className、instanceName、markdown | proposalId、pending；确认前世界未修改 |
| ask_user / 向用户提问 | universe_ask_user | question、options | 等待用户回答并返回字符串 |

完整 ID 为 builtin: 加后缀。旧五项对象工具与旧四项整包 CRUD 已移除注册、执行分支和默认目录。系统角色 Skill 改用 Markdown 接口的稳定身份；旧用户图的失效引用明确报错，需要接入现有工具，不猜测结构转换。移除旧目录时将用户自建内容提升至根目录，保留其身份。

## Skill Manager

高级 Agent 自动注册以下三项，自主目录来自 config.skillIds；本次启动或用户强制加载可按相应规则加入有效技能，ReAct/Workflow 也可为强制加载临时建立加载器。离开调用级 Skill Manager 上下文时报错。名称与实现只读，工具说明与分类仍可编辑。

| 稳定 ID 后缀 | 中文名称 / 调用名 | 参数 | 返回 |
| --- | --- | --- | --- |
| list_skills | 发现可用技能 / agent_list_skills | 无 | 获准技能 ID、名称、说明、激活状态 |
| read_skill | 加载技能 / agent_read_skill | skillId | SKILL.md 全文、参考/资源清单和已注册专属 Tool 描述 |
| read_skill_reference | 读取技能参考文档 / agent_read_skill_reference | skillId、path | 已激活技能 references 内的 Markdown |

首次只发现目录，激活后动态注册专属 Tool。Tool Schema、调用身份、预算、取消与聊天事件复用既有流程，详见 [Skill](skills.md)。

## Agent Manager

仅在 config.manageAgents 调用上下文执行，不从手动 Tool 测试借用聊天。

| 调用名 | 必需参数 | 可选参数 |
| --- | --- | --- |
| agent_list_members | 无 | 无 |
| agent_create_member | name、baseAgentId、systemPrompt、toolIds、skillIds | outputSchema、entity:{classId,entityId} |
| agent_run_member | memberId、task | 无 |
| agent_set_human | mode:observer/character | name；character 模式要求非空 |

创建和调用受管理者许可、成员数量、实体身份及根预算约束；list_members 只公开身份和发言。私有协议、发布时机及成员隔离见 [Agent Manager](agents.md#通用会话-agent-manager)。

## Runtime Tool

四项调用为 agent_runtime_list_files/read_file/write_file/edit_file。完整参数、路径、版本、写入和失败规则见 [运行时文件接口](skills.md#runtime-tool-文件接口)。它们在用户确认后保存技能包文件，不能说所有官方工具均无文件副作用；它们不直接修改世界实例。


## 用户提问

universe_ask_user 的 question 为非空字符串，options 最多 12 个不同非空选项，可为空数组。调用等待选项或自填回答，返回字符串并保持原 tool_call_id；没有聊天交互上下文时报错。取消终止等待，重启保留记录并禁用未完成问题，不自动重放；子调用共享根取消。实现见 [chatQuestions.ts](../../src/services/chatQuestions.ts)。

## 调用身份与边界

稳定 ID 为 builtin: 加定义后缀，调用名保持表中前缀。世界/交互工具由 [services/builtinTools.ts](../../src/services/builtinTools.ts) 分派；Skill、Agent、Runtime 各有自己的上下文处理器。Tool annotations 的只读提示不等于配置只读范围，也不是任意脚本权限沙箱；当前没有对外 MCP 服务或远程 MCP 连接。
