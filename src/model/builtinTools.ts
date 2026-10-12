import {ToolDefinition,Workspace} from './types'

const text=(description:string)=>({type:'string',minLength:1,description})
const className=text('世界中的类名称，重名时请先让用户消除歧义。')
const instanceName=text('该类中的实例名称。')
const definitions=[
  ['list_classes','获取所有类名列表',{},'返回当前世界的所有类名称。'],
  ['class_structure','获取类的成员实例结构对象',{className},'返回指定类的实例属性结构模板，不包含实例内容。'],
  ['class_structure_markdown','获取类的成员实例结构 Markdown',{className},'返回指定类的实例 Markdown 结构模板，只有标题，没有内容和派生结果。'],
  ['list_instances','获取类的成员实例名称列表',{className},'返回指定类的所有实例名称。'],
  ['get_instance','获取指定实例对象',{className,instanceName},'返回指定实例的结构化对象，包含嵌套属性及类型值。'],
  ['get_instance_markdown','获取指定实例 Markdown',{className,instanceName},'返回指定实例的完整 Markdown。'],
  ['find_instance_key','查找实例子对象中的 key',{className,instanceName,key:text('要递归查找的属性键名。')},'递归查找实例子对象中精确匹配的 key，返回全部匹配路径和值；不存在时 found=false。'],
  ['propose_instance_change','提交实例修改建议',{className,instanceName,markdown:text('修改后的完整实例 Markdown，以 ## 实例名 开始，保留实例名称和属性结构。')},'仅提交修改建议并在聊天中请求用户确认，不直接修改世界。用户点击保存修改后才写入；pending 不代表已保存。'],
  ['propose_instance_add','提议添加新实例及其内容',{className,instanceName,markdown:text('新实例的完整 Markdown，以 ## 实例名 开始，符合现有类的属性结构。')},'仅提交新实例及内容的添加提议，等待用户在聊天中保存；不直接写入世界。'],
  ['ask_user','向用户提问',{question:text('需要用户明确的问题。'),options:{type:'array',items:text('可点击的回答内容。'),uniqueItems:true,maxItems:12}},'在聊天中向用户提问并等待回答，返回用户选择的选项内容或自填文字；不修改世界。只能在支持交互的聊天调用中使用。'],
  ['propose_member_change','提交实例子成员变量修改建议',{className,instanceName,path:{type:'array',minItems:1,items:{type:'object',properties:{key:text('从三级标题开始的精确标题键，包括 Class 引用链接。'),id:text('可选成员 ID，用于区分同名重复项。')},required:['key'],additionalProperties:false}},markdown:text('仅目标成员的正文；Object 须包含下一层标题和全部子成员，不包含目标标题或祖先标题。')},'按标题路径定位一个成员，仅提议替换该成员正文，保留其他成员；内容按原类型与结构校验，等待用户保存。路径重复且未提供 ID 时拒绝猜测。'],
] as const
function freeze<T>(value:T):T {if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
export const builtinTools:readonly ToolDefinition[]=freeze(definitions.map(([key,name,properties,description])=>({id:`builtin:${key}`,builtin:true,kind:'builtin' as const,name,callName:`universe_${key}`,description,inputSchema:{type:'object',properties,required:Object.keys(properties),additionalProperties:false},annotations:{title:name,readOnlyHint:true,destructiveHint:false,idempotentHint:!key.startsWith('propose_')&&key!=='ask_user',openWorldHint:false},url:'',method:'POST' as const,apiKey:'',bodyMode:'raw' as const,enabled:true})))
export const isBuiltinTool=(tool:Pick<ToolDefinition,'id'>)=>tool.id.startsWith('builtin:')
/** Canonical built-ins always override any serialized or forged copy. */
export const registeredTools=(workspace:Workspace):ToolDefinition[]=>[...builtinTools,...(workspace.tools||[]).filter(tool=>!isBuiltinTool(tool))]
export const canonicalTool=(tool:ToolDefinition)=>isBuiltinTool(tool)?builtinTools.find(item=>item.id===tool.id):tool
