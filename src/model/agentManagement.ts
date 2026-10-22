import {ToolDefinition} from './types'
export const AGENT_MANAGER_FOLDER='builtin-folder:agent-manager'
const str={type:'string',minLength:1},ids={type:'array',items:str,uniqueItems:true,maxItems:64}
const defs=[
 ['set_human','设置用户参与角色',{mode:{type:'string',enum:['observer','character']},name:{type:'string',maxLength:80}},['mode'],'根据用户明确意愿设置旁观或用户扮演角色；不能替用户角色生成台词。'],
 ['list_members','查看会话成员',{},[],'查看公开成员身份、可用基底和获准能力；不返回成员的私有上下文。'],
 ['create_member','创建会话子智能体',{name:{...str,maxLength:80},baseAgentId:str,systemPrompt:{...str,maxLength:32000},toolIds:ids,skillIds:ids,outputSchema:{type:'object'},entity:{type:'object',properties:{classId:str,entityId:str},required:['classId','entityId'],additionalProperties:false}},['name','baseAgentId','systemPrompt','toolIds','skillIds'],'创建当前会话的独立成员；只可使用管理者已获准的能力，成员说明和执行策略由 Skill 提供。'],
 ['run_member','调用会话子智能体',{memberId:str,task:{...str,maxLength:32000}},['memberId','task'],'运行指定成员，向其同步新增公开群聊；仅最终结果公开，私有协议与工具上下文隔离。'],
] as const
export const agentManagerTools:ToolDefinition[]=defs.map(([key,name,properties,required,description])=>({id:`builtin:${key}`,name,callName:`agent_${key}`,description,builtin:true,kind:'builtin',folderId:AGENT_MANAGER_FOLDER,inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},url:'',method:'POST',apiKey:'',bodyMode:'raw',enabled:true}))
export const agentManagerIds=agentManagerTools.map(t=>t.id)
