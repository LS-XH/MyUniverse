import {SkillDefinition} from './types'
import {skillTemplate} from './skillPackages'
const SKILL_CREATOR_ID='builtin-skill:creator',RUNTIME_SKILL_FOLDER='builtin-folder:runtime-skills'
export function runtimeSkillsV5():SkillDefinition[]{const name='skill-creator',description='创建或改进技能时使用：明确触发条件，编写标准 SKILL.md，按需组织脚本和参考文档，并验证实际任务。';return [{id:SKILL_CREATOR_ID,name,directory:name,description,enabled:true,folderId:RUNTIME_SKILL_FOLDER,content:skillTemplate(name,description).replace(/## 操作内容[\s\S]*?## 参考与资源/,`## 操作内容

1. 明确用途、触发条件、输入与期望结果。保留用户意图，不把个别案例泛化成全部任务限制。
2. 用 agent_runtime_list_files 查看 skills 目录；修改前用 agent_runtime_read_file 读取相关文件及 version。维护文件不等于激活技能；本次使用技能仍通过 Skill Manager 加载获准技能。
3. 用 agent_runtime_write_file 创建 skills/<name>/SKILL.md：以 YAML name、description 开头，目录名与 name 一致。正文只写影响决策的指导；大段细节放 references，并说明何时读取。简单技能无需空文件或额外脚本。
4. 使用 agent_runtime_edit_file 精确修改已有文件，传 expectedVersion、oldText、newText；完整替换也可用 write_file + expectedVersion。版本冲突重新读取，不覆盖并发修改。新建文件不传 expectedVersion。每次写入会校验元数据、路径和 Tool Schema，返回 saved 才代表保存成功。
5. 必要时创建 scripts/tool-N.js，入口 execute(params)；scripts/tools.json 可定义明确的参数 Schema 或 HTTP Tool。先写 JS 再更新 manifest；沿用读取的规范路径，写入返回实际文件目录。当前运行时只支持应用管理的文本文件，不提供系统 Shell，也不直接写 assets 或包外文件。
6. 至少验证一个应触发、一个不应触发和一个实际任务。格式检查不等于脚本执行测试；没有执行过的脚本不声称测试通过。根据反馈改善最相关规则，避免不断堆叠禁令。
7. 报告实际改动与未验证内容。新技能不会自动加入 Agent 自主许可，可由用户 @ 强制指定，或配置允许后在后续运行加载。

## 参考与资源`),references:{},tools:[],assets:[]}]}