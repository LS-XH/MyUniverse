# 官方 Tool 与修改建议

## 程序维护的只读模板

官方 Tool 是主程序适配入口，未来可实现世界对象之外的能力。定义不能编辑、删除或移动，不作为用户脚本写入 workspace.json；模型仅保存稳定 ID。只读模板不意味着以后每个工具只能查询，但当前九项均不直接写世界，第九项只发建议事件。

model/builtinTools.ts 冻结配置，registeredTools 合并官方与用户工具。builtin: ID 为保留命名空间，外部伪造定义也被官方版本覆盖；services/builtinTools.ts 执行专门处理器，复用世界门面、类型转换和 Markdown，不执行用户源码替代模板。

侧栏、工具页、模型选择、工作流使用同一注册表。官方编辑页展示用途与 Schema，配置禁用且无删除动作；世界与测试参数属于调用上下文，可修改。当前 annotations 为只读、非破坏、非开放世界；建议项不标幂等。

## 九项调用契约

Schema 均为 object，表内参数全部 required，additionalProperties=false。名称在调用世界中精确匹配，缺失或重名明确报错。

| 稳定 ID 后缀 / 名称 | 调用名 | 参数 | 返回 |
| --- | --- | --- | --- |
| list_classes / 所有类名 | universe_list_classes | 无 | 类名称数组 |
| class_structure / 类成员结构对象 | universe_class_structure | className | className、members 模板：键/值类型、重复项、引用类、递归子结构，不含实例内容 |
| class_structure_markdown / 类成员结构 Markdown | universe_class_structure_markdown | className | 类标题、示例实例标题和属性标题，无值、正文和派生结果 |
| list_instances / 实例名列表 | universe_list_instances | className | 该类全部实例名称 |
| get_instance / 指定实例对象 | universe_get_instance | className、instanceName | 实例 id/name/className，递归成员 id/key/type/TypedValue/children |
| get_instance_markdown / 实例 Markdown | universe_get_instance_markdown | className、instanceName | 现有格式的完整实例 Markdown |
| find_instance_key / 递归 key | universe_find_instance_key | className、instanceName、key | found、全部 matches，每项含稳定 ID/键路径及类型值 |
| propose_instance_change / 修改建议 | universe_propose_instance_change | className、instanceName、markdown | proposalId、pending、等待用户说明；世界未修改 |
| propose_instance_add / 新实例添加提议 | universe_propose_instance_add | className、instanceName、markdown | proposalId、pending；确认前世界未修改 |

完整 ID 为 builtin: 加后缀。第 2/3 项根据 Schema 生成结构模板，不枚举已有实例内容。第 7 项深度优先精确匹配键名，返回全部匹配，不静默取首个；found 区分“键为空值”和“不存在键”。

## 修改建议与用户采纳

### 输入与生成

第九项固定三个参数：类名字、实例名字、修改后的 Markdown。没有“修改说明”参数；内部展示说明不改变公开 Schema。

markdown 应采用第六项实例格式，以 `## 实例名字` 开始，保留实例名与属性结构。复用原解析器，禁止类一级标题、同时改变其他实例、改名或改 Schema。验证后记录修改前后内容与 Schema 签名，发 onInstanceProposal 事件，不改变实例。

### 原会话定位

聊天处理器在调用 worldId/conversationId 追加建议卡片。切换世界或会话不改变建议归属；明确调用会话已删除时失败，不插入新会话冒充原会话。工具页测试进入调用世界当前聊天，没有会话则创建“实例修改建议”。处理器未就绪时明确失败。

建议作为 ChatMessage.proposal 持久化，重启后可查看，状态为 pending/saved/rejected。工具产生建议即发过程事件，工作流继续执行，用户随后决定。界面按 proposal 稳定 ID 统一查找新旧存储，每份只展示一次，确认卡片默认折叠，摘要显示对象名称、状态和总增删行数，展开后查看差异与保存/拒绝操作。Git 风格行差异保留上下文及单列行号（删除用旧行号，新增和上下文用新行号），正文自动换行（包括连续编码及无空格长文本），固定行号列、弹性正文列不得撑宽聊天页面，使用主题 success/danger 色，右下角“保存修改 / 拒绝”。pending 表示等待用户，不得向模型或用户宣称世界已经修改。

### 新增实例、批量确认与回退

官方只读模板 propose_instance_add（提议添加新实例及其内容）调用名 universe_propose_instance_add，参数 className、instanceName、markdown。提交只校验现有类结构与名称并生成 kind=add 提议，不创建实例；用户采纳后创建稳定 ID 实例。同名实例或类结构变化拒绝保存。新实例差异全部显示为增加行。

上下相邻、同一世界/类身份且 className 相同的新增/修改提议合并为默认折叠组，显示数量与总增删行数，全部保存/全部拒绝只处理 pending 项。正文、思考、其他工具和子调用分隔组，提议工具的成功结果与提议卡片合并避免重复占位。批量处理在不可变临时状态中计算，任一失败不提交整批。

保存记录 savedBefore/savedAfter/savedAt，已保存项提供回退保存，组可回退已保存项（按保存顺序倒序）。修改回退反向合并本次改变的成员内容，保留无冲突后续编辑；新增回退仅在实例内容仍等于保存快照时移除实例。冲突拒绝且保留 saved 状态。成功回退转 pending，可再次采纳。旧 saved 记录没有快照时不提供回退。

### 采纳与过期检查

保存时复查世界、类、实例存在及 Schema 签名。将 before/after 解析为实例，按稳定成员身份比较，只合并建议实际改变的成员内容；未改变的成员保留当前值。成员文本变化通过去掉共同前后缀得到替换内容，在该成员当前文本内唯一匹配后替换；插入需匹配原有上下文。不同成员及可唯一定位的独立文本修改可依次采纳，不因整实例基线不同而全部过期。目标内容找不到、出现多处匹配、目标成员被删或发生重叠冲突时明确指出成员位置并拒绝整份建议，不部分写入。类 Schema 改变仍要求重新生成；合并后再次解析校验，并保留稳定 ID。

拒绝只改建议状态。已保存/拒绝不可重复处理。采纳更新主程序草稿，不自动写盘；“已保存”是已采纳到内存，仍需创作区保存当前文件或保存全部，磁盘失败由同步提示显示。后续模型请求包含建议处理状态，建议事件不是完成写入的工具结果。

## 程序边界与扩展

建议需要用户明确采纳，而普通用户 JS Tool 的门面写入遵循该 Tool 自己的会话规则；不能将建议模板规则误套到所有 Tool。模板只读配置和运行 readOnlyHint 都不能替代完整权限沙箱。

新增官方能力应扩展冻结注册表、Schema、专门处理器和对应程序事件，保持稳定 ID 与参数契约。当前没有对外 MCP 服务器或远程连接。

## 实现与验证

model/builtinTools.ts：配置与注册；services/builtinTools.ts：查询；instanceProposals.ts：解析、事件、归属和采纳；AppRoot/ChatPage：订阅与显示；tests/builtinTools.test.ts：注册保护、查询、配对、建议和过期测试。

验收重点为模板不可编辑/删除、建议提出前后实例值不变、用户采纳才改值、过期拒绝、拒绝/重复处理、重启和切会话身份。历史测试数量及交付记录见 [修改日志](changelog/README.md)。
