import {runtimeTools,RUNTIME_TOOL_FOLDER,RUNTIME_SKILL_FOLDER} from './runtimeSkills'
import {removedToolIds} from './toolRoles'
import {agentManagerTools,AGENT_MANAGER_FOLDER} from './agentManagement'
import {ToolDefinition,Workspace} from './types'

const text=(description:string)=>({type:'string',minLength:1,description})
const className=text('世界中的类名称，重名时请先让用户消除歧义。')
const instanceName=text('该类中的实例名称。')
export const LEGACY_OBJECT_FOLDER='builtin-folder:legacy-objects'
export const INTERACTION_MANAGER_FOLDER='builtin-folder:interaction'
export const OBJECT_MANAGER_FOLDER='builtin-folder:objects',SKILL_MANAGER_FOLDER='builtin-folder:skills'
export const skillManagerIds=['builtin:list_skills','builtin:read_skill','builtin:read_skill_reference']
const definitions=[
  ['list_skills','发现可用技能',{},'列出本次高级 Agent 获准使用的技能名称、说明及身份；不提前加载全文。'],
  ['read_skill','加载技能',{skillId:text('获准技能的稳定 ID。')},'按需加载技能 SKILL.md，注册该技能启用的专属工具，并返回参考文件目录。'],
  ['read_skill_reference','读取技能参考文档',{skillId:text('已经加载的技能 ID。'),path:text('references 内的 Markdown 相对路径，如 guide.md。')},'按需读取已加载技能的参考 Markdown；拒绝其他目录或未加载的技能。'],
  ['list_classes','获取所有类名列表',{},'发现当前世界有哪些类，返回类名列表。仅用于选择 className；不返回实例、属性结构或内容，不修改世界。'],
  ['list_instances','获取类的成员实例名称列表',{className},'列出 className 对应类的全部实例名称。仅用于查找或确认 instanceName；不返回实例内容。先用类名列表确认类，重名需询问用户，不猜测，不修改世界。'],
  ['get_instance_markdown','获取指定实例 Markdown',{className,instanceName},'读取 className、instanceName 精确定位的一个实例的 {id,classId,name,className,markdown}，markdown 包含已有属性标题、重复成员及内容。用于了解事实、结构并准备新增/修改提议；不搜索其他实例，不修改世界。'],
  ['propose_instance_change','提交实例修改建议',{className,instanceName,markdown:text('修改后的完整实例 Markdown，以 ## 实例名 开始，保留实例名称和属性结构。')},'向用户提交一个已有实例的完整 Markdown 修改提议。先读取该实例 Markdown，保留实例名及现有类属性结构，可增加合法重复值；禁止改类结构或直接写世界。仅返回待确认提议，用户保存后才生效，拒绝不会修改。'],
  ['propose_instance_add','提议添加新实例及其内容',{className,instanceName,markdown:text('新实例的完整 Markdown，以 ## 实例名 开始，符合现有类的属性结构。')},'向现有 className 提议创建一个名称尚未占用的新实例。markdown 必须为以 ## 实例名 开始且符合该类属性结构的完整实例；先读取同类实例了解结构，不创建类、不修改类结构、不覆盖已有实例。仅生成待确认提议，用户保存后才创建。'],
  ['ask_user','向用户提问',{question:text('需要用户明确的问题。'),options:{type:'array',items:text('可点击的回答内容。'),uniqueItems:true,maxItems:12}},'在聊天中向用户提问并等待回答，返回用户选择的选项内容或自填文字；不修改世界。只能在支持交互的聊天调用中使用。'],
] as const
function freeze<T>(value:T):T {if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
export const builtinTools:readonly ToolDefinition[]=freeze([...runtimeTools,...agentManagerTools,...definitions.filter(([key])=>!removedToolIds.includes(`builtin:${key}`)).map(([key,name,properties,description])=>({id:`builtin:${key}`,builtin:true,kind:'builtin' as const,name,callName:skillManagerIds.includes(`builtin:${key}`)?`agent_${key}`:`universe_${key}`,folderId:skillManagerIds.includes(`builtin:${key}`)?SKILL_MANAGER_FOLDER:key==='ask_user'?INTERACTION_MANAGER_FOLDER:OBJECT_MANAGER_FOLDER,description,inputSchema:{type:'object',properties,required:Object.keys(properties),additionalProperties:false},annotations:{title:name,readOnlyHint:true,destructiveHint:false,idempotentHint:!key.startsWith('propose_')&&key!=='ask_user',openWorldHint:false},url:'',method:'POST' as const,apiKey:'',bodyMode:'raw' as const,enabled:true}))])
export const isBuiltinTool=(tool:Pick<ToolDefinition,'id'>)=>tool.id.startsWith('builtin:')
/** Only the LLM description and organization are user-owned for application tools. */
function configuredBuiltin(base:ToolDefinition,saved?:ToolDefinition):ToolDefinition {
 const descriptions:Record<string,string>={"返回当前世界的所有类名称。": "发现当前世界有哪些类，返回类名列表。仅用于选择 className；不返回实例、属性结构或内容，不修改世界。", "返回指定类的所有实例名称。": "列出 className 对应类的全部实例名称。仅用于查找或确认 instanceName；不返回实例内容。先用类名列表确认类，重名需询问用户，不猜测，不修改世界。", "返回指定实例的完整 Markdown。": "读取 className、instanceName 精确定位的一个实例的 {id,classId,name,className,markdown}，markdown 包含已有属性标题、重复成员及内容。用于了解事实、结构并准备新增/修改提议；不搜索其他实例，不修改世界。", "仅提交修改建议并在聊天中请求用户确认，不直接修改世界。用户点击保存修改后才写入；pending 不代表已保存。": "向用户提交一个已有实例的完整 Markdown 修改提议。先读取该实例 Markdown，保留实例名及现有类属性结构，可增加合法重复值；禁止改类结构或直接写世界。仅返回待确认提议，用户保存后才生效，拒绝不会修改。", "仅提交新实例及内容的添加提议，等待用户在聊天中保存；不直接写入世界。": "向现有 className 提议创建一个名称尚未占用的新实例。markdown 必须为以 ## 实例名 开始且符合该类属性结构的完整实例；先读取同类实例了解结构，不创建类、不修改类结构、不覆盖已有实例。仅生成待确认提议，用户保存后才创建。"}
 if(base.id==='builtin:ask_user'&&(saved?.folderId===null||saved?.folderId===undefined))saved={...base,...saved,folderId:INTERACTION_MANAGER_FOLDER}
 const description=saved?.description&&descriptions[saved.description]||saved?.description
 return {...base,...(typeof description==='string'?{description}:{}),...(saved&&Object.hasOwn(saved,'folderId')&&(typeof saved.folderId==='string'||saved.folderId===null)?{folderId:saved.folderId}:{})}
}
export const registeredTools=(workspace:Workspace):ToolDefinition[]=>[
 ...builtinTools.map(base=>configuredBuiltin(base,workspace.tools?.find(tool=>tool.id===base.id))),
 ...(workspace.tools||[]).filter(tool=>!isBuiltinTool(tool))
]
/** Materialize the registered entries so ordinary tree moves also support application tools. */
export function installBuiltinTools(workspace:Workspace):Workspace {
 const tools=registeredTools(workspace).map(tool=>['builtin-folder:legacy-runtime',LEGACY_OBJECT_FOLDER].includes(tool.folderId||'')?{...tool,folderId:null}:tool)
 const defaults=[{id:INTERACTION_MANAGER_FOLDER,name:'Interaction Manager',section:'tools' as const,parentId:null},{id:RUNTIME_SKILL_FOLDER,name:'Runtime Skills',section:'skills' as const,parentId:null},{id:RUNTIME_TOOL_FOLDER,name:'Runtime Tool',section:'tools' as const,parentId:null},{id:AGENT_MANAGER_FOLDER,name:'Agent Manager',section:'tools' as const,parentId:null},{id:OBJECT_MANAGER_FOLDER,name:'Object Manager',section:'tools' as const,parentId:null},{id:SKILL_MANAGER_FOLDER,name:'Skill Manager',section:'tools' as const,parentId:null}],pluginFolders=[...(workspace.pluginFolders||[]).filter(f=>!['builtin-folder:legacy-runtime',LEGACY_OBJECT_FOLDER].includes(f.id)).map(f=>['builtin-folder:legacy-runtime',LEGACY_OBJECT_FOLDER].includes(f.parentId||'')?{...f,parentId:null}:f),...defaults.filter(f=>!workspace.pluginFolders?.some(saved=>saved.id===f.id))]
 return JSON.stringify(tools)===JSON.stringify(workspace.tools||[])&&pluginFolders.length===(workspace.pluginFolders||[]).length&&workspace.toolCatalogVersion===2?workspace:{...workspace,tools,pluginFolders,toolCatalogVersion:2}
}
export function canonicalTool(tool:ToolDefinition){
 if(!isBuiltinTool(tool))return tool.kind==='builtin'?undefined:tool
 const base=builtinTools.find(item=>item.id===tool.id)
 return base?configuredBuiltin(base,tool):undefined
}
