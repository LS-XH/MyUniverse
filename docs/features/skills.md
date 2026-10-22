# Skill 加载、能力与运行时文件维护

Skill 把任务规则、专属 Tool 与参考文档组成独立包。字段和目录格式见 [Skill 数据](../data/skills.md)，创建/编辑页面见 [管理界面](../ui/libraries.md#skill-包编辑)。

## 调用级加载

每次调用创建独立 AgentSkillManager。高级 Agent 根据 config.skillIds 建立自主目录，首先只提供名称、说明和身份；模型调用 agent_read_skill 后才读取全文、注册启用的专属 Tool，参考文档通过 agent_read_skill_reference 按需读取。读取参考之前须先加载该技能，路径必须属于它的 references。

启动技能在模型首次请求前加载，必须同时位于 config.skillIds 中。专属 Tool 复用现有 JS/HTTP 执行器、Schema、事件、取消和预算；加载时拒绝系统 Tool 替换、ID/调用名冲突。allowed-tools 仅过滤本包工具。全局 Tool 与子 Agent 仍受各自许可控制。

Skill Manager 的三项调用契约见 [官方工具目录](official-tools.md#skill-manager)。动态工具只在本次调用生效，运行中的目录和激活副本不热替换；新建和修改包在后续根运行使用。Workflow 强制加载时注入调用级规则与专属能力，仍需图自己编排 ToolCalls。

## 用户强制技能与实例引用

用户在聊天选择技能标签或精确写 @skill-name / @[skill-name] 会强制预加载有效技能，即使它未在自主目录勾选。旧 / 补全保留；稳定引用优先于名称，停用或格式错误明确失败。disable-model-invocation:true 的包不出现在自主目录，但允许显式或显式启动加载。

根 Agent 配置系统词中的显式 @ 同样解析；世界资料、工具结果及模型生成的成员 system 不视为用户授权。子调用不继承根强制列表。强制加载不改永久许可，也不额外授予全局 Tool、子 Agent 或文件写权限。实例 @ 则读取当前世界资料供事实参考，不加载技能。引用结构见 [聊天数据](../data/chat.md)。

## 自带技能与策略

roleplay-manager 管理多角色策略，character-performance 约定角色表现，旁白技能整理已发生的公开内容；角色输出为语言、神态、语气、动作、感官的非空子集，Schema 来自 metadata.output-schema。输出校验与一次纠正见 [Agent 结构化输出](agents.md#工具参数式结构化输出)，角色呈现见 [聊天 UI](../ui/chat.md)。

Runtime Skills 是虚拟分类，skill-creator 是普通标准包，提供创建和迭代指导；由获准 Runtime Tool 维护文件。它不是独立的 create_skill 原生接口。Agent 默认接入 Runtime Skills 目录中的有效技能，以 [Agent 类型](agents.md#三种类型与实例) 为准。

## Runtime Tool 文件接口

| 调用名 | 参数 | 结果与规则 |
| --- | --- | --- |
| agent_runtime_list_files | path?，默认 skills，或 skills/<name> | 受管文本路径及包级 version；不含内部 .myuniverse.json |
| agent_runtime_read_file | path | content、version |
| agent_runtime_write_file | path、content、expectedVersion? | 新文件省略版本；已有文件必须提供读取版本；返回 proposalId、pending，等待用户确认 |
| agent_runtime_edit_file | path、oldText、newText、expectedVersion | oldText 非空且恰好一次；其余内容不变，返回同上 |

路径限定为 skills/<name>/SKILL.md、references/*.md、scripts/tool-N.js、scripts/tools.json。新技能先写 SKILL.md，再逐文件补资源；先写 JS，再更新 manifest。每次写入校验名称、元数据、路径、Tool Schema 和身份，提交差异提议；用户保存时重新校验并由保存队列落盘，冲突重新读取，不能覆盖。脚本沿用 list/read 返回的规范路径。

文件维护不触发技能激活，不授予自主许可。接入读取文件工具意味着可读取安装包的受管文件，范围不等于 config.skillIds；接入写入工具才允许维护文件。当前没有任意系统 Shell、包外路径、assets 写入、文件删除或任意重命名 API。旧四个整包工具已从目录和执行器移除。

## 保存与外部修改

UI 修改和 Runtime Tool 共用 skillStorage 与存储串行队列。只写发生变化的包，保存前比较磁盘 revision；冲突拒绝覆盖。重新读取目录先尝试保存当前编辑，再读取包；有未解决的外部冲突时应先处理冲突，不能把重新读取按钮理解为强制丢弃本地编辑。外部文件变化不会自动热重载。

Runtime 写入只产生待确认提议，采纳后更新编辑态并等待 checkpointWorkspace；磁盘失败在卡片显示，不能声称保存成功。确认、内容冲突及回退见 [修改提议](proposals.md#runtime-文件提议)。包恢复、trash/history、浏览器差异见 [Skill 数据](../data/skills.md#保存迁移与恢复)。格式校验不表示脚本运行通过；创建器要求正触发、反触发和实际任务验收。

## 实现入口

[agentSkills.ts](../../src/services/agentSkills.ts) 管理激活；[runtimeSkills.ts](../../src/services/runtimeSkills.ts) 管理文件版本和修改；[skillStorage.ts](../../src/services/skillStorage.ts) 管理独立包读写；[builtinSkills.ts](../../src/model/builtinSkills.ts) 与 [runtimeSkills.ts](../../src/model/runtimeSkills.ts) 定义默认包及精确升级规则。外部下载、自动安装及其他宿主专属策略文件尚未实现。
