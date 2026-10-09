import {WorkflowNode,uid} from './types'
export const variableTypes=['String','Number','Boolean','Messages','Image'] as const
export type VariableType=typeof variableTypes[number]
export interface ToolCall {id:string;type:'function';function:{name:string;arguments:string};mcp?:{server:string;tool:string}}
export interface ContextMessage {role:'system'|'user'|'assistant'|'tool';content:string|null;tool_calls?:ToolCall[];tool_call_id?:string;name?:string}
export interface MessageValue {type:'Messages';version:1;items:ContextMessage[]}
export interface ImageValue {type:'Image';version:1;url:string;filename?:string;width?:number;height?:number;mimeType?:string}
export interface StoredVariable {id?:string;type:VariableType;value:unknown}
export const variablePort=(type:VariableType)=>type==='String'?'STRING':type==='Image'?'IMAGE_OBJECT':type.toUpperCase()
export const defaultVariable=(type:VariableType):unknown=>({String:'',Number:0,Boolean:false,Messages:{type:'Messages',version:1,items:[]},Image:{type:'Image',version:1,url:''}}[type])
export function validateMessages(value:unknown):MessageValue {
 const v=value as MessageValue;if(!v||v.type!=='Messages'||v.version!==1||!Array.isArray(v.items))throw new Error('需要 Messages 对象 {type, version:1, items}')
 const calls=new Map<string,boolean>()
 for(const item of v.items){if(!item||!['system','user','assistant','tool'].includes(item.role)||(item.content!==null&&typeof item.content!=='string'))throw new Error('无效消息 role/content');if(item.tool_calls){if(item.role!=='assistant'||!Array.isArray(item.tool_calls))throw new Error('tool_calls 仅属于 assistant');for(const call of item.tool_calls){if(!call.id||calls.has(call.id)||call.type!=='function'||!call.function?.name||typeof call.function.arguments!=='string')throw new Error('工具调用需要唯一 id、名称与 JSON arguments 字符串');try{JSON.parse(call.function.arguments)}catch{throw new Error('工具 arguments 必须是 JSON 字符串')}calls.set(call.id,false)}}if(item.role==='tool'){if(!item.tool_call_id||!calls.has(item.tool_call_id)||calls.get(item.tool_call_id))throw new Error('工具返回必须匹配一个尚未返回的 tool_call_id');calls.set(item.tool_call_id,true)}}return structuredClone(v)
}
export function strictValue(type:VariableType,value:unknown):unknown {
 if(type==='String'&&typeof value==='string'||type==='Number'&&typeof value==='number'&&Number.isFinite(value)||type==='Boolean'&&typeof value==='boolean')return value
 if(type==='Messages')return validateMessages(value)
 if(type==='Image'){const v=value as ImageValue;if(v?.type==='Image'&&v.version===1&&typeof v.url==='string'&&(!v.url||/^(https?:|data:image\/|blob:)/.test(v.url))&&[v.width,v.height].every(n=>n===undefined||Number.isFinite(n)&&n>=0))return structuredClone(v)}
 throw new Error(`值必须为 ${type}，不进行隐式转换`)
}
export interface MemberDefinition {key:string;name:string;input?:string;output:string;property?:boolean}
export const variableMembers:Record<VariableType,MemberDefinition[]>={
 String:[{key:'length',name:'长度',output:'NUMBER',property:true},{key:'trim',name:'去除首尾空白',output:'STRING'},{key:'upper',name:'转为大写',output:'STRING'},{key:'lower',name:'转为小写',output:'STRING'},{key:'append',name:'追加文本',input:'STRING',output:'STRING'},{key:'contains',name:'包含文本',input:'STRING',output:'BOOLEAN'}],
 Number:[{key:'abs',name:'绝对值',output:'NUMBER'},{key:'round',name:'四舍五入',output:'NUMBER'},{key:'floor',name:'向下取整',output:'NUMBER'},{key:'add',name:'增加',input:'NUMBER',output:'NUMBER'}],
 Boolean:[{key:'not',name:'取反',output:'BOOLEAN'},{key:'and',name:'逻辑与',input:'BOOLEAN',output:'BOOLEAN'},{key:'or',name:'逻辑或',input:'BOOLEAN',output:'BOOLEAN'}],
 Messages:[{key:'count',name:'消息数量',output:'NUMBER',property:true},{key:'lastText',name:'最后一条文本',output:'STRING',property:true},{key:'pendingTools',name:'待执行工具 JSON',output:'STRING',property:true},{key:'nextToolId',name:'下一个工具调用 ID',output:'STRING',property:true},{key:'nextToolName',name:'下一个工具名称',output:'STRING',property:true},{key:'nextToolArguments',name:'下一个工具参数 JSON',output:'STRING',property:true},{key:'system',name:'添加系统提示词',input:'STRING',output:'MESSAGES'},{key:'user',name:'添加用户消息',input:'STRING',output:'MESSAGES'},{key:'assistant',name:'添加助手消息',input:'STRING',output:'MESSAGES'},{key:'toolCall',name:'添加 ToolUse（JSON）',input:'STRING',output:'MESSAGES'},{key:'toolResult',name:'添加工具返回',input:'STRING',output:'MESSAGES'},{key:'merge',name:'合并消息上下文',input:'MESSAGES',output:'MESSAGES'},{key:'clear',name:'清空上下文',output:'MESSAGES'},{key:'trim',name:'保留最近轮次',input:'NUMBER',output:'MESSAGES'}],
 Image:[{key:'url',name:'图片地址',output:'STRING',property:true},{key:'filename',name:'文件名',output:'STRING',property:true},{key:'width',name:'宽度',output:'NUMBER',property:true},{key:'height',name:'高度',output:'NUMBER',property:true},{key:'fromUrl',name:'从地址建立图片',input:'STRING',output:'IMAGE_OBJECT'},{key:'fromSD',name:'从 SD 结果取图片',input:'ANY',output:'IMAGE_OBJECT'},{key:'display',name:'显示图片',output:'IMAGE_OBJECT'},{key:'save',name:'保存图片',input:'STRING',output:'IMAGE_OBJECT'}]
}
export function typedVariableNode(type:VariableType,member?:string,x=40,y=40):WorkflowNode {
 const def=member?variableMembers[type].find(item=>item.key===member):undefined;if(member&&!def)throw new Error('未知类型成员')
 const id=uid();return{id,kind:def?(def.property?'valueProperty':'valueMethod'):'variable',title:def?`${type} · ${def.name}`:`${type} 变量`,x,y,settings:{variableType:type,...(def?{member:def.key}:{name:`${type.toLowerCase()}_${id.slice(0,6)}`})},inputs:def?[{name:'self',type:variablePort(type),default:defaultVariable(type)},...(def.input?[{name:'arg',type:def.input}]:[]),...(member==='toolResult'?[{name:'callId',type:'STRING',default:''},{name:'toolName',type:'STRING',default:''}]:[])]:[{name:'value',type:variablePort(type)},{name:'after',type:'ANY'}],outputs:[{name:'value',type:def?.output||variablePort(type)}]}
}
export async function invokeValueMember(type:VariableType,key:string,self:unknown,arg:unknown,settings:Record<string,string>,imageAction?:(action:'save'|'display',image:ImageValue,filename?:string)=>Promise<void>):Promise<unknown>{
 const v:any=strictValue(type,self),def=variableMembers[type].find(d=>d.key===key);if(!def)throw new Error('未知类型成员')
 if(def.input&&def.input!=='ANY')arg=strictValue(def.input==='STRING'?'String':def.input==='NUMBER'?'Number':def.input==='BOOLEAN'?'Boolean':def.input==='MESSAGES'?'Messages':'Image',arg)
 if(type==='String'){if(key==='length')return v.length;if(key==='trim')return v.trim();if(key==='upper')return v.toUpperCase();if(key==='lower')return v.toLowerCase();if(key==='append')return v+arg;if(key==='contains')return v.includes(arg)}
 if(type==='Number'){if(key==='abs')return Math.abs(v);if(key==='round')return Math.round(v);if(key==='floor')return Math.floor(v);if(key==='add')return strictValue('Number',v+(arg as number))}
 if(type==='Boolean'){if(key==='not')return !v;if(key==='and')return v&&arg;if(key==='or')return v||arg}
 if(type==='Messages'){
  const items:ContextMessage[]=v.items;if(key==='count')return items.length;if(key==='lastText')return items.at(-1)?.content||'';if(['pendingTools','nextToolId','nextToolName','nextToolArguments'].includes(key)){const done=new Set(items.filter(i=>i.role==='tool').map(i=>i.tool_call_id));const pending=items.flatMap(i=>i.tool_calls||[]).filter(c=>!done.has(c.id));return key==='pendingTools'?JSON.stringify(pending):key==='nextToolId'?pending[0]?.id||'':key==='nextToolName'?pending[0]?.function.name||'':pending[0]?.function.arguments||''}
  let next=items;if(['system','user','assistant'].includes(key))next=[...items,{role:key as ContextMessage['role'],content:arg as string}];if(key==='toolCall')next=[...items,{role:'assistant',content:null,tool_calls:[JSON.parse(arg as string)]}];if(key==='toolResult')next=[...items,{role:'tool',content:arg as string,tool_call_id:settings.toolCallId||'',...(settings.toolName?{name:settings.toolName}:{})}];if(key==='merge')next=[...items,...(arg as MessageValue).items];if(key==='clear')next=[];
  if(key==='trim'){if(!Number.isInteger(arg)||Number(arg)<1)throw new Error('保留轮次必须为正整数');const starts=items.map((m,i)=>m.role==='user'?i:-1).filter(i=>i>=0),start=starts[Math.max(0,starts.length-Number(arg))]??0;next=[...items.slice(0,start).filter(m=>m.role==='system'),...items.slice(start)]}
  return validateMessages({type:'Messages',version:1,items:next})
 }
 if(type==='Image'){if(['url','filename'].includes(key))return v[key]||'';if(['width','height'].includes(key))return v[key]||0;if(key==='fromUrl')return strictValue('Image',{type:'Image',version:1,url:arg});if(key==='fromSD'){const images=arg as any[],index=Number(settings.index||0);if(!Array.isArray(images)||!images[index]?.url)throw new Error('SD 图片索引不存在');return strictValue('Image',{type:'Image',version:1,...images[index]})}if(key==='save'||key==='display'){if(!v.url)throw new Error('图片地址为空');if(!imageAction)throw new Error('图片操作运行环境不可用');await imageAction(key,v,key==='save'?arg as string:undefined);return v}}
 throw new Error('未实现的类型成员')
}
