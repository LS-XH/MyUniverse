import {runtimeSkillsV5} from './runtimeSkillsV5'
import {SkillDefinition,ToolDefinition} from './types'
import {skillTemplate} from './skillPackages'
import {legacyRuntimeSkills} from './legacyRuntimeSkills'
export {legacyRuntimeSkills} from './legacyRuntimeSkills'
export const RUNTIME_TOOL_FOLDER='builtin-folder:runtime',RUNTIME_SKILL_FOLDER='builtin-folder:runtime-skills',SKILL_CREATOR_ID='builtin-skill:creator'
const str=(description:string)=>({type:'string',description})
const definitions=[
 ['runtime_list_files','列出运行时文件',{path:str('相对目录，默认 skills；例如 skills/my-skill。')},[],'列出应用管理的 skills 目录中的文本文件路径与版本。不加载技能，不执行脚本。'],
 ['runtime_read_file','读取运行时文件',{path:str('skills/<技能名>/SKILL.md、references/*.md、scripts/tool-N.js 或 scripts/tools.json。')},['path'],'读取一个运行时文本文件，返回 content 和 version。用于文件维护，不等于激活技能；自主加载仍由 Skill Manager 的许可管理。'],
 ['runtime_write_file','写入运行时文件',{path:str('skills/<技能名>/SKILL.md、references/*.md、scripts/tool-N.js 或 scripts/tools.json。'),content:str('完整文件内容。'),expectedVersion:str('修改已有文件必须提供读取返回的 version；新文件省略。')},['path','content'],'创建或替换单个文本文件，保留同包其他文件。新技能先创建标准 SKILL.md，再写资源。每次写入校验包结构、元数据及 Tool Schema，只提交差异提议，用户保存后才落盘；拒绝并发覆盖、路径越界及内部配置写入。'],
 ['runtime_edit_file','精确编辑运行时文件',{path:str('已有运行时文件路径。'),oldText:str('在文件中恰好出现一次的原文。'),newText:str('替换内容。'),expectedVersion:str('读取返回的 version。')},['path','oldText','newText','expectedVersion'],'精确替换文件中唯一匹配的原文，其他内容保持不变。缺失或多处匹配、版本变化及格式错误均拒绝，不猜测位置；提交差异提议，用户保存后才写文件。'],
] as const
export const runtimeTools:ToolDefinition[]=definitions.map(([id,name,properties,required,description])=>({id:'builtin:'+id,kind:'builtin',builtin:true,name,callName:'agent_'+id,description,inputSchema:{type:'object',properties,required,additionalProperties:false},folderId:RUNTIME_TOOL_FOLDER,enabled:true,url:'',method:'POST',apiKey:'',bodyMode:'raw',annotations:{readOnlyHint:id==='runtime_list_files'||id==='runtime_read_file',destructiveHint:false,openWorldHint:false}}))
export function runtimeSkills():SkillDefinition[]{const name='skill-creator',description='创建或改进技能时使用：明确触发条件，编写标准 SKILL.md，按需组织脚本和参考文档，并验证实际任务。';return [{id:SKILL_CREATOR_ID,name,directory:name,description,enabled:true,folderId:RUNTIME_SKILL_FOLDER,content:skillTemplate(name,description).replace(/## 操作内容[\s\S]*?## 参考与资源/,`## 操作内容

1. 明确用途、触发条件、输入与期望结果。保留用户意图，不把个别案例泛化成全部任务限制。
2. 用 agent_runtime_list_files 查看 skills 目录；修改前用 agent_runtime_read_file 读取相关文件及 version。维护文件不等于激活技能；本次使用技能仍通过 Skill Manager 加载获准技能。
3. 用 agent_runtime_write_file 创建 skills/<name>/SKILL.md：以 YAML name、description 开头，目录名与 name 一致。正文只写影响决策的指导；大段细节放 references，并说明何时读取。简单技能无需空文件或额外脚本。
4. 使用 agent_runtime_edit_file 精确修改已有文件，传 expectedVersion、oldText、newText；完整替换也可用 write_file + expectedVersion。版本冲突重新读取，不覆盖并发修改。新建文件不传 expectedVersion。每次提交会校验元数据、路径和 Tool Schema；返回 pending/proposalId 只表示待用户确认，不能声称已保存。用户保存后才能继续依赖新文件，未保存时不要反复提交同一修改。
5. 必要时创建 scripts/tool-N.js，入口 execute(params)；scripts/tools.json 可定义明确的参数 Schema 或 HTTP Tool。先写 JS 再更新 manifest；沿用读取的规范路径，写入返回实际文件目录。当前运行时只支持应用管理的文本文件，不提供系统 Shell，也不直接写 assets 或包外文件。
6. 至少验证一个应触发、一个不应触发和一个实际任务。格式检查不等于脚本执行测试；没有执行过的脚本不声称测试通过。根据反馈改善最相关规则，避免不断堆叠禁令。
7. 报告实际改动与未验证内容。新技能不会自动加入 Agent 自主许可，可由用户 @ 强制指定，或配置允许后在后续运行加载。

## 参考与资源`),references:{},tools:[],assets:[]}]}

/** Only upgrade the exact factory body; customized or deleted packages remain user-owned. */
export function upgradeRuntimeSkills(skills:SkillDefinition[],version:number){const previous=[legacyRuntimeSkills()[0],runtimeSkillsV5()[0]],current=runtimeSkills()[0];return version<6?skills.map(s=>s.id===current.id&&previous.some(p=>s.content===p.content)?{...s,content:current.content,description:current.description}:s):skills}

