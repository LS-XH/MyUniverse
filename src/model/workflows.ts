import {walkWorkflowNodes,scopeTerminal} from './workflowScopes'
import {conversationAgent} from './workflowTemplates'
import {variableTypes, variablePort, variableMembers,typedVariableNode, VariableType} from './workflowValues'
import {configureControl,configureSequence,validateControl} from './workflowControl'
import {migrateWorkflowTypes} from './workflowMigration'
import { AgentDefinition, SDWorkflow, WorkflowGraph, WorkflowKind, WorkflowLink, WorkflowNode, WorkflowPort, uid } from './types'

export const workflowNames:Record<WorkflowKind,string>={sequence:'顺序执行',break:'break',continue:'continue',method:'方法',loop:'循环',condition:'条件',agent:'调用 Agent',input:'输入',return:'返回',constant:'常量',world:'世界对象',add:'相加',subtract:'相减',multiply:'相乘',divide:'相除',concat:'文本拼接',function:'调用 Function',llm:'LLM 模型（自动 ToolCalls）',llmBasic:'LLM 模型',toolCalls:'ToolCalls',sd:'SD 工作流',tool:'调用 Tool',getVariable:'读取变量',setVariable:'设置变量',context:'管理上下文',appendContext:'追加上下文',comfy:'ComfyUI 节点',variable:'类型变量',valueMethod:'类型方法',valueProperty:'类型属性'}
/** Titles belong to node types. Serialized instance titles are legacy metadata. */
export function workflowNodeTitle(node:WorkflowNode|undefined,catalog:ComfyCatalog={}):string {
 if(!node)return ''
 if(node.kind==='comfy')return catalog[node.classType||'']?.display_name||node.classType||workflowNames.comfy
 const type=node.settings.variableType as VariableType
 if(node.kind==='method')return '方法'
 if(node.kind==='variable')return `${type} 变量`
 if(node.kind==='valueMethod'||node.kind==='valueProperty')return `${type} · ${variableMembers[type]?.find(member=>member.key===node.settings.member)?.name||workflowNames[node.kind]}`
 return workflowNames[node.kind]
}
const port=(name:string,type='ANY',value?:unknown):WorkflowPort=>({name,type,...(value!==undefined?{default:value}:{})})
export function workflowNode(kind:WorkflowKind,x=40,y=40):WorkflowNode {
  if(kind==='method')return typedVariableNode('Method',undefined,x,y)
  if(kind==='break'||kind==='continue')return scopeTerminal(kind,x,y)
  if(kind==='loop'||kind==='condition')return configureControl({id:uid(),kind,title:workflowNames[kind],x,y,settings:{},inputs:[],outputs:[]},'ANY')
  if(kind==='sequence')return configureSequence({id:uid(),kind,title:workflowNames[kind],x,y,settings:{},inputs:[],outputs:[]},2)
  const inputs:Partial<Record<WorkflowKind,WorkflowPort[]>>={agent:[port('agents','AGENTS'),port('input','STRING','{"input":""}')],return:[port('value'),port('after')],add:[port('a','NUMBER',0),port('b','NUMBER',0)],subtract:[port('a','NUMBER',0),port('b','NUMBER',0)],multiply:[port('a','NUMBER',1),port('b','NUMBER',1)],divide:[port('a','NUMBER',1),port('b','NUMBER',1)],concat:[port('a','STRING',''),port('b','STRING','')],function:[port('input','ANY','')],llmBasic:[port('messages','MESSAGES'),port('tools','TOOLS'),port('agents','AGENTS')],toolCalls:[port('messages','MESSAGES'),port('tools','TOOLS'),port('agents','AGENTS')],llm:[port('prompt','STRING',''),port('context','MESSAGES'),port('tools','TOOLS'),port('agents','AGENTS')],sd:[port('prompt','STRING','')],tool:[port('tool','TOOLS'),port('input','STRING','{}')],getVariable:[port('after')],setVariable:[port('value'),port('after')],context:[port('history','MESSAGES',[]),port('prompt','STRING','')],appendContext:[port('history','MESSAGES',[]),port('prompt','STRING',''),port('reply','STRING','')]}
  return {id:uid(),kind,title:workflowNames[kind],x,y,settings:kind==='constant'?{value:'',valueType:'text'}:kind==='world'?{format:'markdown'}:kind==='context'?{limit:'20'}:kind==='getVariable'||kind==='setVariable'?{name:'context'}:{},inputs:inputs[kind]||[],outputs:kind==='return'?[]:[...(kind==='llm'?[port('messages','MESSAGES')]:[]),port('value',kind==='llmBasic'||kind==='toolCalls'?'MESSAGES':kind==='llm'||kind==='concat'||kind==='input'||kind==='tool'||kind==='agent'?'STRING':kind==='context'||kind==='appendContext'?'MESSAGES':['add','subtract','multiply','divide'].includes(kind)?'NUMBER':'ANY')]}
}
export function agentGraph():WorkflowGraph {
  const input=workflowNode('input',40,100),llm=workflowNode('llm',380,100),output=workflowNode('return',720,100)
  return {version:1,nodes:[input,llm,output],links:[{id:uid(),from:input.id,output:'value',to:llm.id,input:'prompt'},{id:uid(),from:llm.id,output:'value',to:output.id,input:'value'}]}
}
export function createAgent():AgentDefinition{return conversationAgent()}
export function createSDWorkflow():SDWorkflow{return {id:uid(),name:'新绘画工作流',baseUrl:'http://127.0.0.1:8188',graph:{version:1,nodes:[workflowNode('input')],links:[]},timeoutSeconds:300}}
export function validateWorkflow(graph:WorkflowGraph,complete=true):void {
  graph=migrateWorkflowTypes(graph)
  if(graph.version!==1||!Array.isArray(graph.nodes)||!Array.isArray(graph.links))throw new Error('无效工作流格式')
  const ids=new Set<string>()
  for(const node of graph.nodes){for(const [key,binding] of Object.entries(node.bindings||{})){
    const [direction,name]=key.split(':'),port=(direction==='in'?node.inputs:direction==='out'?node.outputs:[])?.find(p=>p.name===name)
    if(!port||!binding.variableId||!binding.name)throw new Error('无效变量引用')
    if(binding.output&&!node.outputs.some(p=>p.name===binding.output&&p.type===port.type))throw new Error('输入输出变量引用类型不一致')
  }}
  for(const node of graph.nodes){if(ids.has(node.id))throw new Error('重复节点 ID');ids.add(node.id);if(['variable','valueMethod','valueProperty'].includes(node.kind)){const type=node.settings?.variableType;if(!variableTypes.includes(type as any))throw new Error('变量必须指定严格类型');if(node.kind==='variable'&&(node.outputs[0]?.type!==variablePort(type as any)||node.inputs[0]?.type!==variablePort(type as any)))throw new Error('变量端口类型与声明不一致')}if(!workflowNames[node.kind]||!Array.isArray(node.inputs)||!Array.isArray(node.outputs)||!Number.isFinite(node.x)||!Number.isFinite(node.y)||!node.settings||typeof node.settings!=='object')throw new Error('无效节点定义')}
  const incoming=new Set<string>()
  for(const link of graph.links){const from=graph.nodes.find(n=>n.id===link.from),to=graph.nodes.find(n=>n.id===link.to);if(!from?.outputs.some(p=>p.name===link.output)||!to?.inputs.some(p=>p.name===link.input))throw new Error('连线引用了不存在的节点或端口');const output=from.outputs.find(p=>p.name===link.output)!,input=to.inputs.find(p=>p.name===link.input)!;if(input.type!=='ANY'&&(['TOOLS','AGENTS'].includes(input.type)||['TOOLS','AGENTS'].includes(output.type))&&input.type!==output.type)throw new Error(`端口类型不匹配：${output.type} → ${input.type}`);if((['variable','valueMethod','valueProperty','loop','condition'].includes(from.kind)||['variable','valueMethod','valueProperty','loop','condition'].includes(to.kind))&&input.type!=='ANY'&&output.type!=='ANY'&&input.type!==output.type&&!(['INT','FLOAT','NUMBER'].includes(input.type)&&['INT','FLOAT','NUMBER'].includes(output.type)))throw new Error(`端口类型不匹配：${output.type} → ${input.type}`);const key=`${link.to}:${link.input}`;if(incoming.has(key))throw new Error('一个输入端口只能连接一个来源');incoming.add(key)}
  validateControl(graph,complete)
  for(const node of graph.nodes){if(node.body&&node.kind!=='loop')throw new Error('只有循环卡片持有内部图；方法体属于变量池');if(node.body)validateWorkflow(node.body,complete);if(node.kind==='method'&&(node.settings.variableType!=='Method'||node.inputs.length!==1||node.inputs[0].type!=='ANY'||node.inputs[0].name!=='value'||node.outputs.length!==1||node.outputs[0].type!=='ANY'||node.outputs[0].name!=='value'))throw new Error('方法只允许 ANY value 输入输出')}
  if(new Set(walkWorkflowNodes(graph).map(n=>n.id)).size!==walkWorkflowNodes(graph).length)throw new Error('内部图节点 ID 必须全局唯一')
}
export function connectWorkflow(graph:WorkflowGraph,edge:Omit<WorkflowLink,'id'>):WorkflowGraph {
  const next={...graph,links:[...graph.links.filter(e=>e.to!==edge.to||e.input!==edge.input),{id:uid(),...edge}]};validateWorkflow(next,false);return next
}
export interface ComfyNodeInfo {display_name?:string;category?:string;input:{required?:Record<string,[unknown,Record<string,unknown>?]>;optional?:Record<string,[unknown,Record<string,unknown>?]>};output:string[];output_name?:string[];output_node?:boolean}
export type ComfyCatalog=Record<string,ComfyNodeInfo>
export function comfyNode(classType:string,info:ComfyNodeInfo,x=40,y=40):WorkflowNode {
  const inputs=Object.entries({...info.input.required,...info.input.optional}).map(([name,[type,options]])=>({name,type:Array.isArray(type)?'CHOICE':String(type),...(Array.isArray(type)?{options:type,default:type[0]}:{}),...(options&&'default'in options?{default:options.default}:{}),required:name in (info.input.required||{})}))
  return {id:uid(),kind:'comfy',title:info.display_name||classType,classType,category:info.category||'ComfyUI',x,y,settings:{},inputs,outputs:(info.output||[]).map((type,index)=>({name:`out${index}`,type,...(info.output_name?.[index]?{default:info.output_name[index]}:{})}))}
}
export function importComfyPrompt(value:unknown,catalog:ComfyCatalog):WorkflowGraph {
  const raw=value as any,api=raw.prompt||raw
  if(raw.nodes||!api||typeof api!=='object'||Array.isArray(api))throw new Error('请选择 ComfyUI 导出的 API 格式 JSON（不是界面布局 JSON）')
  const nodes:WorkflowNode[]=[],links:WorkflowLink[]=[]
  for(const [id,item] of Object.entries<any>(api)){
    if(!item.class_type||!item.inputs||!catalog[item.class_type])throw new Error(`节点 ${id} 未安装或尚未加载节点目录：${item.class_type||'缺少 class_type'}`)
    const node=comfyNode(item.class_type,catalog[item.class_type],40+(nodes.length%3)*340,40+Math.floor(nodes.length/3)*340);node.id=id
    for(const [name,input] of Object.entries(item.inputs)){
      if(!node.inputs.some(p=>p.name===name))node.inputs.push({name,type:'ANY'})
      if(Array.isArray(input)&&input.length===2&&typeof input[1]==='number'&&api[String(input[0])])links.push({id:uid(),from:String(input[0]),output:`out${input[1]}`,to:id,input:name})
      else node.settings[`port:${name}`]=JSON.stringify(input)
    }
    nodes.push(node)
  }
  const graph:WorkflowGraph={version:1,nodes,links};validateWorkflow(graph);return graph
}
export function textToImageGraph(catalog:ComfyCatalog):WorkflowGraph {
  const types=['CheckpointLoaderSimple','CLIPTextEncode','EmptyLatentImage','KSampler','VAEDecode','SaveImage']
  for(const type of types)if(!catalog[type])throw new Error(`ComfyUI 节点目录缺少 ${type}`)
  const input=workflowNode('input',20,20),loader=comfyNode(types[0],catalog[types[0]],20,200),positive=comfyNode(types[1],catalog[types[1]],360,20),negative=comfyNode(types[1],catalog[types[1]],360,350),latent=comfyNode(types[2],catalog[types[2]],360,650),sampler=comfyNode(types[3],catalog[types[3]],700,100),decode=comfyNode(types[4],catalog[types[4]],1040,100),save=comfyNode(types[5],catalog[types[5]],1380,100)
  negative.settings['port:text']=JSON.stringify('')
  const connect=(from:WorkflowNode,output:string,to:WorkflowNode,input:string):WorkflowLink=>({id:uid(),from:from.id,output,to:to.id,input})
  return {version:1,nodes:[input,loader,positive,negative,latent,sampler,decode,save],links:[connect(input,'value',positive,'text'),connect(loader,'out1',positive,'clip'),connect(loader,'out1',negative,'clip'),connect(loader,'out0',sampler,'model'),connect(positive,'out0',sampler,'positive'),connect(negative,'out0',sampler,'negative'),connect(latent,'out0',sampler,'latent_image'),connect(sampler,'out0',decode,'samples'),connect(loader,'out2',decode,'vae'),connect(decode,'out0',save,'images')]}
}
