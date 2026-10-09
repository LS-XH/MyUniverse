import {watchComfyEvents} from './comfyEvents'
import {ensureGraphVariables} from '../model/variablePool'
import {WorkflowEvent,emitWorkflowEvent,executionType,comfyExecutionEvent} from './workflowExecution'
import {defaultVariable,strictValue,validateMessages,VariableType,invokeValueMember} from '../model/workflowValues'
import {workflowImageAction} from './workflowImages'
import { AgentDefinition, SDWorkflow, WorkflowGraph, WorkflowNode, Workspace, World } from '../model/types'
import { validateWorkflow } from '../model/workflows'
import { createWorldApi, worldCatalog } from '../model/worldApi'
import { apiEndpoint, modelRequest } from './modelHttp'
import { callLLM, callLLMMessage, LLMMessage } from './llm'
import { runFunctionValue } from './functions'

export interface ImageResult {filename:string;subfolder:string;type:string;url:string}
export interface WorkflowRun {value:unknown;variables:Record<string,unknown>;trace:{id:string;title:string;value:unknown}[]}
export interface WorkflowDependencies {onEvent?:(event:WorkflowEvent)=>void|Promise<void>;llm?:typeof callLLM;llmMessage?:typeof callLLMMessage;imageAction?:typeof workflowImageAction;http?:typeof modelRequest;sd?:(workflow:SDWorkflow,input:string,workspace:Workspace,world?:World,signal?:AbortSignal)=>Promise<ImageResult[]>;function?:typeof runFunctionValue}
export const workflowText=(value:unknown):string=>typeof value==='string'?value:value==null?'':JSON.stringify(value,null,2)
function messages(value:unknown):LLMMessage[] {
  if(value==null||value==='')return []
  if(typeof value==='object'&&'type'in value&&value.type==='Messages')return validateMessages(value).items
  const data=typeof value==='string'?JSON.parse(value):value
  if(!Array.isArray(data)||data.some(item=>!item||!['user','assistant','system','tool'].includes(item.role)||(item.content!==null&&typeof item.content!=='string')))throw new Error('上下文应为 {role, content} 消息数组')
  return validateMessages({type:"Messages",version:1,items:data}).items
}
function evaluator(graph:WorkflowGraph,input:unknown,workspace:Workspace,world:World|undefined,variables:Record<string,unknown>,signal:AbortSignal|undefined,trace:WorkflowRun['trace'],deps:WorkflowDependencies,onProgress?:(message:string)=>void) {
  const cache=new Map<string,Promise<unknown>>(),outputs=new Map<string,Record<string,unknown>>(),resolved=new Map<string,unknown>(),seenEdges=new Set<string>()
  const emit=(event:WorkflowEvent)=>emitWorkflowEvent(deps.onEvent,event)
  const check=()=>{if(signal?.aborted)throw new DOMException('运行已取消','AbortError')}
  const read=async(node:WorkflowNode,name:string):Promise<unknown>=>{
    const key=`${node.id}:${name}`;if(resolved.has(key))return resolved.get(key)
    const link=graph.links.find(link=>link.to===node.id&&link.input===name)
    let value:unknown
    if(link){value=await evaluate(link.from);if(link.output!=='value'){const extra=outputs.get(link.from);if(!extra||!Object.hasOwn(extra,link.output))throw new Error('本地节点不支持此输出端口');value=extra[link.output]}
      if(!seenEdges.has(link.id)){seenEdges.add(link.id);await emit({kind:'edge',id:link.id,value,valueType:executionType(value)})}
      const type=node.inputs.find(p=>p.name===name)?.type;if(['variable','valueMethod','valueProperty'].includes(node.kind)&&['STRING','NUMBER','BOOLEAN','MESSAGES','IMAGE_OBJECT'].includes(type||''))value=strictValue(({STRING:'String',NUMBER:'Number',BOOLEAN:'Boolean',MESSAGES:'Messages',IMAGE_OBJECT:'Image'} as Record<string,VariableType>)[type!],value)
    }else{const stored=node.settings[`port:${name}`];value=stored!==undefined?JSON.parse(stored):node.inputs.find(port=>port.name===name)?.default}
    resolved.set(key,value);return value
  }
  const evaluate=(id:string):Promise<unknown>=>{
    if(cache.has(id))return cache.get(id)!
    const node=graph.nodes.find(node=>node.id===id);if(!node)throw new Error('来源节点已不存在')
    const promise=(async()=>{
      check();await emit({kind:'node',id:node.id,state:'waiting'});
      for(const port of [...node.inputs].sort((a,b)=>Number(b.name==='after')-Number(a.name==='after')))await read(node,port.name)
      check();await emit({kind:'node',id:node.id,state:'running'});check();onProgress?.(`执行：${node.title}`)
      const setting=node.settings
      let value:unknown
      switch(node.kind){
        case 'input':value=input;break
        case 'return':await read(node,'after');value=await read(node,'value');break
        case 'constant':value=setting.valueType==='json'?JSON.parse(setting.value||'null'):setting.value||'';break
        case 'world':{
          if(!world||!node.object?.classId)throw new Error('请选择世界和类')
          let object:any=createWorldApi(worldCatalog(world)).get_class(node.object.classId)
          if(node.object.entityId)object=object.get_instance(node.object.entityId)
          for(const member of node.object.path)object=object.get_member(member)
          if(setting.format==='typed')value=object.to_value?object.to_value():{type:'Class',classId:node.object.classId,entityId:node.object.entityId}
          else if(setting.format==='value')value=object.value?object.to_value?.().value??object.value():object.instances?object.instances().map((item:any)=>({id:item.id,name:item.name,markdown:item.markdown()})):object.markdown()
          else value=object.markdown();break
        }
        case 'concat':value=workflowText(await read(node,'a'))+(setting.separator||'')+workflowText(await read(node,'b'));break
        case 'add':case 'subtract':case 'multiply':case 'divide':{
          const rawA=await read(node,'a'),rawB=await read(node,'b'),a=Number(rawA),b=Number(rawB)
          if(rawA==null||rawB==null||!Number.isFinite(a)||!Number.isFinite(b))throw new Error('运算输入必须为有限数字')
          if(node.kind==='divide'&&b===0)throw new Error('除数不能为 0')
          value=node.kind==='add'?a+b:node.kind==='subtract'?a-b:node.kind==='multiply'?a*b:a/b;break
        }
        case 'variable':{
          await read(node,'after');const type=setting.variableType as VariableType,name=setting.name;if(!name)throw new Error('请输入变量名称');const stored=Object.hasOwn(variables,name)?variables[name] as any:undefined;
          if(stored&&typeof stored==='object'&&'type'in stored&&'value'in stored&&stored.type!==type)throw new Error(`变量 ${name} 已声明为 ${stored.type}，不能改为 ${type}`)
          const writes=graph.links.some(e=>e.to===node.id&&e.input==='value')||Object.hasOwn(setting,'port:value');value=strictValue(type,writes?await read(node,'value'):stored&&typeof stored==='object'&&'type'in stored&&'value'in stored?stored.value:stored??defaultVariable(type));Object.defineProperty(variables,name,{value:{...(stored?.id?{id:stored.id}:{}),type,value},writable:true,enumerable:true,configurable:true});break
        }
        case 'valueMethod':case 'valueProperty':value=await invokeValueMember(setting.variableType as VariableType,setting.member,await read(node,'self'),await read(node,'arg'),{...setting,...(setting.member==='toolResult'?{toolCallId:workflowText(await read(node,'callId'))||setting.toolCallId||'',toolName:workflowText(await read(node,'toolName'))||setting.toolName||''}:{})},deps.imageAction||workflowImageAction);break
        case 'getVariable':await read(node,'after');if(!setting.name)throw new Error('请输入变量名称');value=Object.hasOwn(variables,setting.name)?variables[setting.name]:undefined;if(value&&typeof value==='object'&&'type'in value&&'value'in value)value=value.value;break
        case 'setVariable':await read(node,'after');if(!setting.name)throw new Error('请输入变量名称');value=await read(node,'value');const old=variables[setting.name] as any;if(old&&typeof old==='object'&&'type'in old&&'value'in old)value=strictValue(old.type,value);Object.defineProperty(variables,setting.name,{value:old&&typeof old==='object'&&'type'in old&&'value'in old?{type:old.type,value}:value,writable:true,enumerable:true,configurable:true});break
        case 'context':{
          const history=messages(await read(node,'history')),prompt=workflowText(await read(node,'prompt')),limit=Number(setting.limit||20)
          if(!Number.isInteger(limit)||limit<1||limit>1000)throw new Error('上下文保留条数应为 1–1000')
          value=[...history.slice(-limit),...(prompt?[{role:'user',content:prompt}]:[])];break
        }
        case 'appendContext':{
          const limit=Number(setting.limit||20);if(!Number.isInteger(limit)||limit<1||limit>1000)throw new Error('上下文保留条数应为 1–1000')
          value=[...messages(await read(node,'history')),...(workflowText(await read(node,'prompt'))?[{role:'user',content:workflowText(await read(node,'prompt'))}]:[]),{role:'assistant',content:workflowText(await read(node,'reply'))}].slice(-limit);break
        }
        case 'llm':{
          const model=workspace.models?.find(model=>model.id===setting.modelId);if(!model)throw new Error('请选择 LLM 模型')
          const context=messages(await read(node,'context')),prompt=workflowText(await read(node,'prompt'))
          const conversation:LLMMessage[]=[...(setting.systemPrompt?[{role:'system' as const,content:setting.systemPrompt}]:[]),...context,...(prompt?[{role:'user' as const,content:prompt}]:[])]
          if(!conversation.length)throw new Error('LLM 输入为空')
          const message=deps.llm?{role:'assistant' as const,content:await deps.llm(model,conversation,signal)}:await (deps.llmMessage||callLLMMessage)(model,conversation,signal);value=message.content||'';outputs.set(node.id,{messages:validateMessages({type:'Messages',version:1,items:[message]})});break
        }
        case 'sd':{const sd=workspace.sdWorkflows?.find(item=>item.id===setting.workflowId);if(!sd)throw new Error('请选择 SD 工作流');value=await (deps.sd||runSDWorkflow)(sd,workflowText(await read(node,'prompt')),workspace,world,signal);break}
        case 'function':{
          const fn=workspace.functions?.find(fn=>fn.id===setting.functionId);if(!fn)throw new Error('请选择 Function')
          const raw=await read(node,'input')
          const context=fn.apiVersion===2?{self:{classId:node.object?.classId||'',entityId:node.object?.entityId||''},input:raw&&typeof raw==='object'&&'type'in raw?raw as any:{type:'Text' as const,value:workflowText(raw)}}:undefined
          const result=await (deps.function||runFunctionValue)(fn,workflowText(raw),world,context);check();value=result.typedValue||result.value;break
        }
        case 'tool':{
          const tool=setting.toolId?workspace.tools?.find(item=>item.id===setting.toolId):undefined
          if(setting.toolId&&!tool)throw new Error('所选 Tool 已不存在')
          if(tool&&!tool.enabled)throw new Error('Tool 已停用')
          const config=tool||setting
          if(!config.url)throw new Error('请选择 Tool 或输入 URL')
          const raw=await read(node,'input');value=await (deps.http||modelRequest)({url:config.url,method:config.method==='GET'?'GET':'POST',apiKey:config.apiKey,body:config.method==='GET'?undefined:config.bodyMode==='raw'?raw:{input:raw},signal});break
        }
        case 'comfy':throw new Error('ComfyUI 输出只能连接到 ComfyUI 输入，由服务器执行')
        default:throw new Error('未知节点类型')
      }
      check();if(['variable','setVariable'].includes(node.kind))await emit({kind:'variables',values:variables});trace.push({id:node.id,title:node.title,value});await emit({kind:'node',id:node.id,state:'complete'});return value
    })().catch(async error=>{await emit({kind:'node',id:node.id,state:signal?.aborted?'cancelled':'error',error:error instanceof Error?error.message:String(error)});throw new Error(`[${node.title}] ${error instanceof Error?error.message:String(error)}`)})
    cache.set(id,promise);return promise
  }
  return {evaluate,read}
}
export async function runAgent(agent:AgentDefinition,input:string,workspace:Workspace,world?:World,signal?:AbortSignal,onProgress?:(message:string)=>void,deps:WorkflowDependencies={}):Promise<WorkflowRun> {
  validateWorkflow(agent.graph)
  const returns=agent.graph.nodes.filter(node=>node.kind==='return');if(returns.length!==1)throw new Error('Agent 必须有且只有一个返回卡片')
  const declarations=new Map<string,string>();for(const n of agent.graph.nodes.filter(n=>n.kind==='variable')){const previous=declarations.get(n.settings.name);if(previous&&previous!==n.settings.variableType)throw new Error(`变量 ${n.settings.name} 存在不同类型的声明`);declarations.set(n.settings.name,n.settings.variableType)}
  const variables=structuredClone(ensureGraphVariables(agent.graph,{...agent.variables,...agent.memory?.[world?.id||'global']})),trace:WorkflowRun['trace']=[]
  await emitWorkflowEvent(deps.onEvent,{kind:'variables',values:variables})
  const engine=evaluator(agent.graph,input,workspace,world,variables,signal,trace,deps,onProgress)
  return {value:await engine.evaluate(returns[0].id),variables,trace}
}
export async function compileComfyPrompt(workflow:SDWorkflow,input:string,workspace:Workspace,world?:World,signal?:AbortSignal,deps:WorkflowDependencies={}):Promise<Record<string,unknown>> {
  validateWorkflow(workflow.graph)
  if(workflow.graph.nodes.some(node=>!['comfy','input','constant','world','add','subtract','multiply','divide','concat','function','variable','valueMethod','valueProperty'].includes(node.kind)))throw new Error('SD 工作流仅允许 ComfyUI 节点及本地数据 / Function 节点；模型与工具编排请使用 Agent')
  const graph=workflow.graph,engine=evaluator(graph,input,workspace,world,ensureGraphVariables(graph,workflow.variables||{}),signal,[],deps)
  const prompt:Record<string,unknown>={}
  for(const node of graph.nodes.filter(node=>node.kind==='comfy')){
    if(!node.classType)throw new Error('ComfyUI 节点缺少 class_type')
    const inputs:Record<string,unknown>={}
    for(const port of node.inputs){
      const edge=graph.links.find(link=>link.to===node.id&&link.input===port.name)
      if(edge){
        const source=graph.nodes.find(item=>item.id===edge.from)!
        if(source.kind==='comfy')inputs[port.name]=[source.id,source.outputs.findIndex(output=>output.name===edge.output)]
        else inputs[port.name]=await engine.read(node,port.name)
      }else{
        const value=await engine.read(node,port.name)
        if(value!==undefined)inputs[port.name]=value
        else if(port.required)throw new Error(`${node.title} 的 ${port.name} 尚未连接或配置`)
      }
    }
    prompt[node.id]={class_type:node.classType,inputs}
  }
  if(!Object.keys(prompt).length)throw new Error('请加载 ComfyUI 节点并添加绘画工作流，或导入 API 格式 JSON')
  return prompt
}
export async function runSDWorkflow(workflow:SDWorkflow,input:string,workspace:Workspace,world?:World,signal?:AbortSignal,onProgress?:(message:string)=>void,deps:WorkflowDependencies={}):Promise<ImageResult[]> {
  // Host-side nodes only produce literals; they never get sent as fake ComfyUI classes.
  const http=deps.http||modelRequest,prompt=await compileComfyPrompt(workflow,input,workspace,world,signal,deps)
  const clientId=crypto.randomUUID();let promptId='',active:string|null=null,completed=false;const pending:any[]=[]
  const stopEvents=deps.onEvent?await watchComfyEvents(workflow.baseUrl,clientId,workflow.apiKey||'',message=>{if(!promptId){pending.push(message);return}const next=comfyExecutionEvent(workflow.graph,message,promptId,active);active=next.active;for(const event of next.events)void emitWorkflowEvent(deps.onEvent,event)},()=>void emitWorkflowEvent(deps.onEvent,{kind:'notice',message:'ComfyUI 实时连接不可用，继续等待服务器结果'}),signal):()=>{}
  try{
  const submitted=await http({url:apiEndpoint(workflow.baseUrl,'prompt'),method:'POST',apiKey:workflow.apiKey,body:{prompt,client_id:clientId},signal})
  promptId=submitted.prompt_id||'';for(const message of pending){const next=comfyExecutionEvent(workflow.graph,message,promptId,active);active=next.active;for(const event of next.events)await emitWorkflowEvent(deps.onEvent,event)}
  if(!submitted.prompt_id)throw new Error(JSON.stringify(submitted.node_errors||submitted.error||submitted))
  const deadline=Date.now()+(workflow.timeoutSeconds||300)*1000
  onProgress?.(`已提交 ${submitted.prompt_id}，等待 ComfyUI`)
  while(Date.now()<deadline){
    if(signal?.aborted)throw new DOMException('已取消等待；ComfyUI 任务可能仍在运行','AbortError')
    const history=await http({url:apiEndpoint(workflow.baseUrl,`history/${encodeURIComponent(submitted.prompt_id)}`),apiKey:workflow.apiKey,signal,timeoutSeconds:20})
    const item=history[submitted.prompt_id]
    if(item){
      if(item.status?.status_str==='error')throw new Error(JSON.stringify(item.status.messages||item.status))
      const images:ImageResult[]=Object.values<any>(item.outputs||{}).flatMap(output=>(output.images||[]).map((image:any)=>({...image,url:apiEndpoint(workflow.baseUrl,'view')+'?'+new URLSearchParams({filename:image.filename,subfolder:image.subfolder||'',type:image.type||'output'})})))
      if(item.status?.completed||images.length){completed=true;if(!images.length)throw new Error('工作流完成但没有图片输出，请添加 SaveImage 节点');return images}
    }
    await new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('已取消','AbortError'))},timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve()},1000);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()})
  }
  throw new Error('等待 ComfyUI 超时；任务可能仍在服务器运行，可在 ComfyUI 队列查看')
  }finally{stopEvents();if(active)await emitWorkflowEvent(deps.onEvent,{kind:'node',id:active,state:signal?.aborted?'cancelled':completed?'complete':'error'})}
}
