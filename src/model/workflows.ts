import {variableTypes, variablePort} from './workflowValues'
import { AgentDefinition, SDWorkflow, WorkflowGraph, WorkflowKind, WorkflowLink, WorkflowNode, WorkflowPort, uid } from './types'

export const workflowNames:Record<WorkflowKind,string>={input:'输入',return:'返回',constant:'常量',world:'世界对象',add:'相加',subtract:'相减',multiply:'相乘',divide:'相除',concat:'文本拼接',function:'调用 Function',llm:'LLM 模型',sd:'SD 工作流',tool:'HTTP Tool',getVariable:'读取变量',setVariable:'设置变量',context:'管理上下文',appendContext:'追加上下文',comfy:'ComfyUI 节点',variable:'类型变量',valueMethod:'类型方法',valueProperty:'类型属性'}
const port=(name:string,type='ANY',value?:unknown):WorkflowPort=>({name,type,...(value!==undefined?{default:value}:{})})
export function workflowNode(kind:WorkflowKind,x=40,y=40):WorkflowNode {
  const inputs:Partial<Record<WorkflowKind,WorkflowPort[]>>={return:[port('value'),port('after')],add:[port('a','NUMBER',0),port('b','NUMBER',0)],subtract:[port('a','NUMBER',0),port('b','NUMBER',0)],multiply:[port('a','NUMBER',1),port('b','NUMBER',1)],divide:[port('a','NUMBER',1),port('b','NUMBER',1)],concat:[port('a','STRING',''),port('b','STRING','')],function:[port('input','ANY','')],llm:[port('prompt','STRING',''),port('context','MESSAGES')],sd:[port('prompt','STRING','')],tool:[port('input','ANY','')],getVariable:[port('after')],setVariable:[port('value'),port('after')],context:[port('history','MESSAGES',[]),port('prompt','STRING','')],appendContext:[port('history','MESSAGES',[]),port('prompt','STRING',''),port('reply','STRING','')]}
  return {id:uid(),kind,title:workflowNames[kind],x,y,settings:kind==='constant'?{value:'',valueType:'text'}:kind==='world'?{format:'markdown'}:kind==='context'?{limit:'20'}:kind==='getVariable'||kind==='setVariable'?{name:'context'}:{},inputs:inputs[kind]||[],outputs:kind==='return'?[]:[...(kind==='llm'?[port('messages','MESSAGES')]:[]),port('value',kind==='llm'||kind==='concat'||kind==='input'?'STRING':kind==='context'||kind==='appendContext'?'MESSAGES':['add','subtract','multiply','divide'].includes(kind)?'NUMBER':'ANY')]}
}
export function agentGraph():WorkflowGraph {
  const input=workflowNode('input',40,100),llm=workflowNode('llm',380,100),output=workflowNode('return',720,100)
  return {version:1,nodes:[input,llm,output],links:[{id:uid(),from:input.id,output:'value',to:llm.id,input:'prompt'},{id:uid(),from:llm.id,output:'value',to:output.id,input:'value'}]}
}
export function createAgent():AgentDefinition{return {id:uid(),name:'新智能体',graph:agentGraph(),variables:{}}}
export function createSDWorkflow():SDWorkflow{return {id:uid(),name:'新绘画工作流',baseUrl:'http://127.0.0.1:8188',graph:{version:1,nodes:[workflowNode('input')],links:[]},timeoutSeconds:300}}
export function validateWorkflow(graph:WorkflowGraph):void {
  if(graph.version!==1||!Array.isArray(graph.nodes)||!Array.isArray(graph.links))throw new Error('无效工作流格式')
  const ids=new Set<string>()
  for(const node of graph.nodes){if(ids.has(node.id))throw new Error('重复节点 ID');ids.add(node.id);if(['variable','valueMethod','valueProperty'].includes(node.kind)){const type=node.settings?.variableType;if(!variableTypes.includes(type as any))throw new Error('变量必须指定严格类型');if(node.kind==='variable'&&(node.outputs[0]?.type!==variablePort(type as any)||node.inputs[0]?.type!==variablePort(type as any)))throw new Error('变量端口类型与声明不一致')}if(!workflowNames[node.kind]||!Array.isArray(node.inputs)||!Array.isArray(node.outputs)||!Number.isFinite(node.x)||!Number.isFinite(node.y)||!node.settings||typeof node.settings!=='object')throw new Error('无效节点定义')}
  const incoming=new Set<string>()
  for(const link of graph.links){const from=graph.nodes.find(n=>n.id===link.from),to=graph.nodes.find(n=>n.id===link.to);if(!from?.outputs.some(p=>p.name===link.output)||!to?.inputs.some(p=>p.name===link.input))throw new Error('连线引用了不存在的节点或端口');const output=from.outputs.find(p=>p.name===link.output)!,input=to.inputs.find(p=>p.name===link.input)!;if((['variable','valueMethod','valueProperty'].includes(from.kind)||['variable','valueMethod','valueProperty'].includes(to.kind))&&input.type!=='ANY'&&output.type!=='ANY'&&input.type!==output.type&&!(['INT','FLOAT','NUMBER'].includes(input.type)&&['INT','FLOAT','NUMBER'].includes(output.type)))throw new Error(`端口类型不匹配：${output.type} → ${input.type}`);const key=`${link.to}:${link.input}`;if(incoming.has(key))throw new Error('一个输入端口只能连接一个来源');incoming.add(key)}
  const visited=new Set<string>(),active=new Set<string>()
  const visit=(id:string)=>{if(active.has(id))throw new Error('工作流存在循环，请使用变量在运行之间保存状态');if(visited.has(id))return;active.add(id);for(const edge of graph.links.filter(e=>e.to===id))visit(edge.from);active.delete(id);visited.add(id)}
  graph.nodes.forEach(n=>visit(n.id))
}
export function connectWorkflow(graph:WorkflowGraph,edge:Omit<WorkflowLink,'id'>):WorkflowGraph {
  const next={...graph,links:[...graph.links.filter(e=>e.to!==edge.to||e.input!==edge.input),{id:uid(),...edge}]};validateWorkflow(next);return next
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
  negative.settings['port:text']=JSON.stringify('');positive.title='正向提示词';negative.title='负向提示词'
  const connect=(from:WorkflowNode,output:string,to:WorkflowNode,input:string):WorkflowLink=>({id:uid(),from:from.id,output,to:to.id,input})
  return {version:1,nodes:[input,loader,positive,negative,latent,sampler,decode,save],links:[connect(input,'value',positive,'text'),connect(loader,'out1',positive,'clip'),connect(loader,'out1',negative,'clip'),connect(loader,'out0',sampler,'model'),connect(positive,'out0',sampler,'positive'),connect(negative,'out0',sampler,'negative'),connect(latent,'out0',sampler,'latent_image'),connect(sampler,'out0',decode,'samples'),connect(loader,'out2',decode,'vae'),connect(decode,'out0',save,'images')]}
}
