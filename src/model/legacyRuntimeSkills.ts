import {SkillDefinition} from './types'
import {skillTemplate} from './skillPackages'
export const RUNTIME_SKILL_FOLDER='builtin-folder:runtime-skills',SKILL_CREATOR_ID='builtin-skill:creator'
export function legacyRuntimeSkills():SkillDefinition[]{const name='skill-creator',description='用户要求创建、修改、整理或检查技能包时使用；先明确用途及触发条件，维护标准 SKILL.md、参考文档与专属工具。';return [{id:SKILL_CREATOR_ID,name,directory:name,description,enabled:true,folderId:RUNTIME_SKILL_FOLDER,content:skillTemplate(name,description).replace(/## 操作内容[\s\S]*?## 参考与资源/,`## 操作内容

1. 明确技能要解决的任务、何时使用、输入与期望结果；仅在关键信息不足时提问。
2. 用 agent_runtime_list_skills 查找是否已有合适技能。修改已有技能先用 agent_runtime_read_skill 读取完整包与 version，保持用户原用途及未知元数据，不重建覆盖。
3. SKILL.md 写精确的 name/description 和简洁决策规则；不写泛泛常识，不将一次案例扩展成所有任务的限制。细节、例子和验收场景放 references，正文说明何时读取。
4. 只在重复或确定性处理确有必要时创建 scripts 工具，使用 JS execute(params) 或 HTTP Tool 契约；定义明确参数 Schema。没有执行验证的脚本不得声称测试通过。
5. 用 agent_runtime_write_skill 提交标准完整 Markdown。更新传 skillId、expectedVersion；未改的 references/tools 省略，不传空集合误删原内容。工具错误或版本冲突时重新读取，不能自动覆盖并发修改。
6. 用 agent_runtime_validate_skill 检查，至少给出一个应触发、一个不应触发及一个实际任务验收例；用户反馈问题时修正最相关的规则，避免无限堆叠禁令。
7. 说明真实创建/修改内容与尚未验证部分。新技能不自动加入任何 Agent 的自主许可；用户可显式 @ 指定或在配置中勾选，下次运行加载。

## 参考与资源`),references:{},tools:[],assets:[]}]}
