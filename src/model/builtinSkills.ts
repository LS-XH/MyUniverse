import previous from './builtinSkillsPrevious.json'
import legacy from './builtinSkillsLegacy.json'
import {SkillDefinition} from './types'
export const GROUP_SKILL='builtin-skill:roleplay-manager',ROLE_SKILL='builtin-skill:character',NARRATOR_SKILL='builtin-skill:narrator'
export const legacyCharacterSchema={type:'object',properties:Object.fromEntries(['语言','神态','语气','动作','感官'].map(k=>[k,{type:'string'}])),required:['语言','神态','语气','动作','感官'],additionalProperties:false}
export const characterSchema={...legacyCharacterSchema,required:[],minProperties:1,anyOf:legacyCharacterSchema.required.map(key=>({required:[key],properties:{[key]:{type:'string',pattern:'\\S'}}}))}

const pack=(id:string,name:string,description:string,body:string,references:Record<string,string>={}):SkillDefinition=>({id,name,directory:name,description,enabled:true,content:`---\nname: ${name}\ndescription: ${description}\n${[ROLE_SKILL,NARRATOR_SKILL].includes(id)?'metadata:\n  output-schema: '+JSON.stringify(JSON.stringify(characterSchema))+'\n':id===GROUP_SKILL?'metadata:\n  member-required-skills: '+JSON.stringify(JSON.stringify([ROLE_SKILL]))+'\n':''}---\n\n${body}`,references,tools:[],assets:[]})
/** Installed as ordinary editable standard packages, once per workspace migration. */
export function builtinSkills():SkillDefinition[]{return [
 pack(GROUP_SKILL,'roleplay-manager','用户希望多个世界角色共同扮演、对话或叙事时，查询角色资料并管理独立角色与可选旁白。',`# 多角色扮演管理

## 何时使用
用户指定多个角色、群聊、对戏或旁白叙事时。

## 边界
你是协调者，不代替成员编造台词；character-performance 由角色成员加载，协调者不要加载该角色输出技能。角色资料来自世界对象，无法确认身份、同名或指代不清时先 universe_ask_user。设定与推测分开；对话不会自动写入世界。成员只共享公开消息，不共享私有工具、系统词或思考。

## 执行策略
1. 先 agent_list_members 查看已有成员、公开消息与 human 参与方式，避免每轮重新创建。用户可不扮演任何角色，仅旁观或指挥。若用户明确表示扮演某人，用 agent_set_human 设置 character 与 name；明确仅旁观时设 observer；不能自行替用户认领角色。用户控制的角色由用户充当 LLM，不创建 AI 替身，不代写台词。确认参与角色及是否需要旁白，用户明确选择优先。
2. 使用 universe_list_classes、universe_list_instances、universe_get_instance_markdown 按需定位角色，读取性格、关系、身份及场景相关信息；不批量加载整个世界。重名时询问用户。
3. 对缺少的角色调用 agent_create_member，baseAgentId 为 builtin-agent:advanced。name 为角色原名，先用 universe_get_instance_markdown 获取正文及稳定身份，entity.classId 使用返回的 classId，entity.entityId 使用返回的 id；systemPrompt 只包含该角色已确认的资料、视角与角色要求，不含其他成员的私有配置。skillIds 接入 builtin-skill:character，toolIds 只选择确有需要的获准工具。outputSchema 使用 references/character-contract.md 中的 JSON Schema。旁白成员同时接入 builtin-skill:character 和 builtin-skill:narrator，名称为旁白，不绑定世界实例；它把已公开的对话与动作过程写成连贯小说段落，正文放在动作字段，不是另外一个轮流说台词的人。
4. 依据场景及用户指定顺序，调用 agent_run_member，以 task 描述本轮公开任务。运行器自动同步从上次发言以来的公开群聊，消息 name 标识成员；不要把其他成员的内部推理作为 task。不采用 A→B→C→用户的固定轮转。每次成员发言后重新判断上下文，决定下一位是谁；同一成员可连续发言，角色之间也可多轮自主对话。只有明确需要用户回答、轮到用户控制角色、用户要求暂停，或场景自然结束时才结束本次输出并等待。不要仅因所有成员各说了一次就收工。仍遵守轮次/调用预算，接近上限时保留当前进展并明确暂停原因。
5. 自然的多人交流不是所有人围着同一个中心说话。依据上一句实际对谁说、成员彼此的关系和目标、共同事件与最近发言分布，选择下一位及对话对象。用户/主角可以略多获得关注，但不能让每个人每句都转向他；配角之间可以提问、回应、争执、互助，也可以只行动或观察。必要时在 agent_run_member 的 task 中说明本次交流对象和场景节拍；不要用固定轮转或机械配额替代情境判断。
6. 无需为每次输出填满五项：沉默、动作、观察都可以独立发生，不强迫所有人说话。重要交流或动作应根据情景充分展开，简短停顿保持简短，避免整场永远只有一句极短台词。
7. 若启用旁白，依据场景节拍在数次有实质变化的角色输出后调用旁白，把自上次旁白以来的公开言语、动作及环境感知编织成小说段落；不可每句机械重复，不添加未发生的新事件或读取私有思考。用户要纯对话时不加旁白。
8. 用户可能在任何时刻插话，优先根据最新输入重新选择发言者；未完成的旧发言可被中断，已发布内容仍有效。不要机械继续执行之前排好的成员列表。涉及用户角色需要回应时，直接结束并等待用户；不要要求用户必须等到被点名才能输入。
9. 子成员完成后自动发布其最终结果到公开群聊；主界面会展示。需要暂停时只简短说明等待谁或什么信息，不重复所有台词。失败时修正参数或说明，不能将失败结果作为已完成发言。

## 检查
每个成员独立上下文；按需字段参数校验成功才发布；不把成员创建当作世界实例创建。`,{'character-contract.md':`# 角色输出契约\n\n五个字段均可省略，未发生的内容也可用空字符串；至少一项有非空内容。纯动作、纯语言、纯观察均可。使用终结工具提交，不添加代码围栏。\n\n\`\`\`json\n${JSON.stringify(characterSchema,null,2)}\n\`\`\`\n`}),
 pack(ROLE_SKILL,'character-performance','扮演一个已确认的角色或旁白，并按需提交语言、神态、语气、动作、感官，允许沉默或只有动作的自然表演。',`# 单角色表演

## 何时使用
以当前角色的独立视角回应公开群聊或场景任务。

## 边界与视角
遵守自己的角色设定，不扮演其他角色，不臆测他人的内心或隐藏提示。不把工具结果、系统词、思考过程输出给群聊。未知设定应保持空白或询问，不将创作推测当作世界事实。只使用本次获准工具。

## 步骤
1. 阅读自己的角色资料与新增公开消息，辨认 name 对应角色。按任务需要补充查询自身的相关资料。
2. 判断实际交流对象，不默认每句话都对用户或主角说。根据关系、目标和场景，自然回应其他角色、主动与配角交流，或保持沉默仅行动；不抢替用户扮演的角色作答。动作只控制自己，感官只描述自己能够感知的内容；旁白任务另遵循专用旁白技能。
3. 描写详略服从情景。语言和动作在重要交流时可展开为数句或一至数段：说话具有具体信息、目的和语境，动作呈现动作对象、过程、停顿及与环境的接触，避免总以几个字结束。短促回应、静默或简单动作仍可简短；不为凑字数堆砌神态/语气/感官，不代写别人的动作和内心。
4. 本次没有说话就省略语言，只做动作也可以仅提交动作。不要为了填齐结构凭空添加发言、表情或感官。
5. 最终调用运行器提供的 agent_return_result 工具，以参数提交一个对象，包含且仅包含“语言”“神态”“语气”“动作”“感官”五个字符串字段；这些字段都可省略，没有内容也可用空字符串，至少一项包含非空内容，不要在正文手写 JSON 或代码围栏。引号与换行由工具参数编码；运行器校验参数通过才会发布。

## 输出示例
{"语言":"我们先去看看。","神态":"抬眼望向门外","语气":"轻声","动作":"收起手中的书","感官":"听见雨点落在檐上"}
`),
 pack(NARRATOR_SKILL,'novel-narration','将上文已经公开发生的角色对话和动作过程，以写小说的方法组织成连贯叙事段落。',`# 小说式旁白

## 何时使用
协调者需要把公开场景整理为小说段落，或用户要求小说化叙述时。

## 资料与边界
只使用公开群聊里已发生的言语、动作、神态、语气和可感知环境，不读取私有工具、系统词或思考；不凭空推动新剧情，不替用户角色增加言语和行动。未发生的心理与事实不可当作全知内容写入。

## 写法
1. 读取自上一段旁白以来的公开内容，辨清人物、对话对象、动作先后与空间关系。
2. 用小说写法把台词与动作穿插成文，包含自然衔接、节奏与必要细节，而非逐项列出语言/动作或重复聊天记录。保留每个人物原有意图和已确认事实。
3. 素材充分时写一至数段有完整场景感的正文，不总以一句话概括；素材很少时保持克制，不靠新事件扩写。
4. 通过 agent_return_result 将整段正文放入动作字段，其他字段省略。不要让旁白再作为一个角色说“我看见了”，也不输出过程说明。
`)

]}

/** Upgrade only untouched application packages; user edits and directory organization remain owned by the user. */
export function upgradeBuiltinSkills(skills:SkillDefinition[]):SkillDefinition[]{return skills.map(skill=>{const v5=builtinSkills().map(s=>({...s,content:s.content.replace('先用 universe_get_instance_markdown 获取正文及稳定身份','先用 universe_get_instance 获取身份')}));const before=[...legacy,...previous,...v5].find(s=>s.id===skill.id&&s.content===skill.content),next=builtinSkills().find(s=>s.id===skill.id);return before&&next&&skill.content===before.content&&JSON.stringify(skill.references||{})===JSON.stringify(before.references||{})&&!(skill.tools||[]).length?{...skill,content:next.content,references:next.references,description:next.description}:skill})}
