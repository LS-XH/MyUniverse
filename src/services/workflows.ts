import {graphLeaves,walkWorkflowNodes} from '../model/workflowScopes'
import {MethodValue} from '../model/workflowValues'
import {askChatQuestion} from './chatQuestions'
import {agentCapabilities,resolveWorkflowAgents,workflowAgentValue} from './workflowAgents'
import {agentParameters} from '../model/agents'
import {AgentLimitError,isAgentLimit,agentDefinitionSignature,AgentInvocation,AgentMemoryChange,commitAgentMemory,emitAgentEvent,newAgentRuntime,spend} from './agentRuntime'
import {controlType} from '../model/workflowControl'
import {workflowNodeTitle} from '../model/workflows'
import {resolveWorkflowTools,workflowToolMember} from './workflowTools'
import {registeredTools} from '../model/builtinTools'
import {ToolCallContext} from './instanceProposals'
import {readScriptWorld} from './scriptHost'
import {runTool,toolResultText,toolName} from './tools'
import {migrateWorkflowTypes} from '../model/workflowMigration'
import {poolEntries} from '../model/variablePool'
import {createHostWorldApi} from '../model/hostWorldApi'
import {watchComfyEvents} from './comfyEvents'
import {ensureGraphVariables} from '../model/variablePool'
import {WorkflowEvent,emitWorkflowEvent,executionType,comfyExecutionEvent} from './workflowExecution'
import {variablePort,defaultVariable,strictValue,validateMessages,VariableType,invokeValueMember} from '../model/workflowValues'
import {workflowImageAction} from './workflowImages'
import { AgentDefinition, SDWorkflow, WorkflowGraph, WorkflowNode, ToolDefinition, Workspace, World } from '../model/types'
import { validateWorkflow } from '../model/workflows'
import { apiEndpoint, modelRequest } from './modelHttp'
import { callLLM, callLLMMessage, callLLMStream, callLLMWithTools, LLMMessage } from './llm'
import { runFunctionValue } from './functions'

export interface ImageResult {filename:string;subfolder:string;type:string;url:string}
export interface WorkflowRun {value:unknown;variables:Record<string,unknown>;trace:{id:string;title:string;value:unknown;frame?:string;scopeLabel?:string;invocationId?:string}[];memoryChanges?:AgentMemoryChange[]}
export interface WorkflowDependencies {runId?:string;invocation?:AgentInvocation;stream?:boolean;llmStream?:typeof callLLMStream;toolContext?:ToolCallContext;onEvent?:(event:WorkflowEvent)=>void|Promise<void>;llm?:typeof callLLM;llmMessage?:typeof callLLMMessage;imageAction?:typeof workflowImageAction;http?:typeof modelRequest;sd?:(workflow:SDWorkflow,input:string,workspace:Workspace,world?:World,signal?:AbortSignal)=>Promise<ImageResult[]>;function?:typeof runFunctionValue}
export const workflowText=(value:unknown):string=>typeof value==='string'?value:value==null?'':JSON.stringify(value,null,2)
function messages(value:unknown):LLMMessage[] {
  if(value==null||value==='')return []
  if(typeof value==='object'&&'type'in value&&value.type==='Messages')return validateMessages(value).items
  const data=typeof value==='string'?JSON.parse(value):value
  if(!Array.isArray(data)||data.some(item=>!item||!['user','assistant','system','tool'].includes(item.role)||(item.content!==null&&typeof item.content!=='string')))throw new Error('上下文应为 {role, content} 消息数组')
  return validateMessages({type:"Messages",version:1,items:data}).items
}
function evaluator(graph:WorkflowGraph,input:unknown,workspace:Workspace,world:World|undefined,variables:Record<string,unknown>,signal:AbortSignal|undefined,trace:WorkflowRun['trace'],deps:WorkflowDependencies,onProgress?:(message:string)=>void,scope?:{frame:string;label:string;methods:string[]}) {
  const cache=new Map<string,Promise<unknown>>(),outputs=new Map<string,Record<string,unknown>>(),resolved=new Map<string,unknown>(),seenEdges=new Set<string>()
  const emit=(event:WorkflowEvent)=>{
    const node='id'in event&&['node','loop','branch'].includes(event.kind)?graph.nodes.find(n=>n.id===event.id):undefined
    return emitAgentEvent(deps.invocation,deps.onEvent,{...event,...(node?{title:workflowNodeTitle(node)}:{}),...(scope?{scopeLabel:scope.label}:{})},scope?.frame)
  }
  const request=async(model:import('../model/types').ModelConnection,conversation:LLMMessage[],requestSignal?:AbortSignal,tools?:ToolDefinition[]):Promise<LLMMessage>=>{
    if(deps.invocation)spend(deps.invocation.runtime,'calls')
    const id:string=crypto.randomUUID();await emit({kind:'model',id,state:'running'})
    const response=deps.stream?await (deps.llmStream||callLLMStream)(model,conversation,requestSignal,tools,delta=>emit({kind:'model',id,state:'running',...delta})):await (deps.llmMessage||callLLMMessage)(model,conversation,requestSignal,tools)
    if(!deps.stream&&response.content)await emit({kind:'model',id,state:'running',text:response.content})
    await emit({kind:'model',id,state:'complete'});return response
  }
  const execute=async(tool:ToolDefinition,parameters:unknown,id:string=crypto.randomUUID()):Promise<unknown>=>{
    if('agentId'in tool){const agent=workspace.agents?.find(a=>a.id===tool.agentId);if(!agent)throw new Error('Agent 已不存在');return (await runAgent(agent,parameters as Record<string,unknown>,workspace,world,signal,onProgress,deps)).value}
    if(deps.invocation)spend(deps.invocation.runtime,'calls')
    await emit({kind:'tool',id,name:toolName(tool),state:'running',parameters})
    try{const result=await runTool(tool,parameters,world,signal,deps.http||modelRequest,{...deps.toolContext,...(deps.stream&&deps.onEvent?{askUser:(question:string,options:string[])=>askChatQuestion(question,options,signal,value=>emit({kind:'question',...value}))}:{}),onProposal:proposalId=>emit({kind:'proposal',id:proposalId})});await emit({kind:'tool',id,name:toolName(tool),state:'complete',result});return result}
    catch(error){await emit({kind:'tool',id,name:toolName(tool),state:signal?.aborted?'error':'error',error:String(error)});throw error}
  }
  const capabilities=async(node:WorkflowNode,defaultIds?:string[],defaultAgentIds:string[]=[])=>{
    const supplied=await read(node,'tools'),agents=await read(node,'agents')
    const tools=supplied===undefined?(defaultIds||[]).map(id=>{const t=registeredTools(workspace).find(t=>t.id===id);if(!t||!t.enabled)throw new Error('Tool 不存在或已停用: '+id);return t}):resolveWorkflowTools(supplied,workspace)
    const all=[...tools,...agentCapabilities(agents===undefined&&defaultAgentIds.length?{type:'Agents',version:1,agentIds:defaultAgentIds}:agents,workspace)]
    if(new Set(all.map(toolName)).size!==all.length)throw new Error('Tool / Agent 调用名称重复')
    return all
  }
  const check=()=>{if(signal?.aborted)throw new DOMException('运行已取消','AbortError')}
  const read=async(node:WorkflowNode,name:string):Promise<unknown>=>{
    const key=`${node.id}:${name}`;if(resolved.has(key))return resolved.get(key)
    const link=graph.links.find(link=>link.to===node.id&&link.input===name)
    let value:unknown
    if(link){value=await output(link.from,link.output)
      if(!seenEdges.has(link.id)){seenEdges.add(link.id);await emit({kind:'edge',id:link.id,value,valueType:executionType(value)})}
      const type=node.inputs.find(p=>p.name===name)?.type;if(['TOOLS','AGENTS'].includes(type||'')||['variable','valueMethod','valueProperty'].includes(node.kind)&&['STRING','NUMBER','BOOLEAN','MESSAGES','IMAGE_OBJECT'].includes(type||''))value=strictValue(({STRING:'String',NUMBER:'Number',BOOLEAN:'Boolean',MESSAGES:'Messages',IMAGE_OBJECT:'Image',TOOLS:'Tools',AGENTS:'Agents'} as Record<string,VariableType>)[type!],value)
    }else if(node.bindings?.[`in:${name}`]){
      const binding=node.bindings[`in:${name}`],entry=poolEntries(variables).find(v=>v.id===binding.variableId)
      if(!entry?.type)throw new Error('绑定变量不存在：'+binding.name)
      const port=node.inputs.find(p=>p.name===name)
      if(port?.type!==({String:'STRING',Number:'NUMBER',Boolean:'BOOLEAN',Messages:'MESSAGES',Image:'IMAGE_OBJECT',Tools:'TOOLS',Agents:'AGENTS',Method:'METHOD'}[entry.type]))throw new Error('绑定变量类型不匹配')
      value=strictValue(entry.type,entry.value)
    }else{const stored=node.settings[`port:${name}`];value=stored!==undefined?JSON.parse(stored):node.inputs.find(port=>port.name===name)?.default}
    if(link&&node.bindings?.[`in:${name}`]){const binding=node.bindings[`in:${name}`],entry=poolEntries(variables).find(v=>v.id===binding.variableId);if(!entry?.type||variablePort(entry.type)!==node.inputs.find(p=>p.name===name)?.type)throw new Error('输入绑定类型不匹配');value=strictValue(entry.type,value);variables[entry.name]={id:entry.id,type:entry.type,value};await emit({kind:'variables',values:variables})}
    resolved.set(key,value);return value
  }
  const evaluate=(id:string):Promise<unknown>=>{
    if(cache.has(id))return cache.get(id)!
    const node=graph.nodes.find(node=>node.id===id);if(!node)throw new Error('来源节点已不存在')
    const promise=(async()=>{
      check();if(deps.invocation)spend(deps.invocation.runtime,'nodes');await emit({kind:'node',id:node.id,state:'waiting'});
      if(!['loop','condition','sequence'].includes(node.kind))for(const port of [...node.inputs].sort((a,b)=>Number(b.name.startsWith('condition'))-Number(a.name.startsWith('condition'))||Number(b.name==='after')-Number(a.name==='after')))await read(node,port.name)
      check();await emit({kind:'node',id:node.id,state:'running'});check();onProgress?.(`执行：${workflowNodeTitle(node)}`)
      const setting=node.settings
      let value:unknown
      switch(node.kind){
        case 'loop':{
          value=await read(node,'value')
          const repeat=Number(setting.repeat??1)
          for(let iteration=1;iteration<=repeat;iteration++){
            check();await emit({kind:'loop',id:node.id,iteration,state:'running'})
            const frame=(scope?.frame||'')+'/'+node.id+':'+iteration,label=[scope?.label,`循环 · 第 ${iteration} 轮`].filter(Boolean).join(' / ')
            const engine=evaluator(node.body!,input,workspace,world,variables,signal,trace,deps,onProgress,{frame,label,methods:scope?.methods||[]})
            const result=await engine.finish()
            await emit({kind:'loop',id:node.id,iteration,state:'complete'})
            if(result.stop||!result.again)break
          }
          break
        }
        case 'sequence':{const values:Record<string,unknown>={};for(const port of node.inputs)values[port.name]=await read(node,port.name);outputs.set(node.id,values);break}
        case 'break':case 'continue':value=strictValue('Boolean',await read(node,'condition'));break
        case 'method':{
          value=await read(node,'value')
          const entry=poolEntries(variables).find(v=>setting.variableId?v.id===setting.variableId:v.name===setting.name)
          if(!entry||entry.type!=='Method')throw new Error('方法变量不存在或类型已变化')
          const definition=strictValue('Method',entry.value) as MethodValue
          validateWorkflow(definition.graph)
          const methods=[...(scope?.methods||[]),entry.id]
          if(methods.length>(deps.invocation?.runtime.limits.depth||8))throw new AgentLimitError('方法调用深度超过上限')
          const frame=(scope?.frame||'')+'/method:'+node.id+':'+methods.length,label=[scope?.label,`方法 · ${entry.name}`].filter(Boolean).join(' / ')
          await evaluator(definition.graph,input,workspace,world,variables,signal,trace,deps,onProgress,{frame,label,methods}).finish()
          break
        }
        case 'condition':{const selected=strictValue('Boolean',await read(node,'condition')) as boolean;await emit({kind:'branch',id:node.id,selected});const chosen=await read(node,selected?'trueValue':'falseValue');value=controlType(node)==='ANY'?chosen:strictValue(controlType(node) as VariableType,chosen);break}
        case 'agent':{const supplied=await read(node,'agents'),agents=supplied===undefined?workspace.agents?.filter(a=>a.id===setting.agentId)||[]:resolveWorkflowAgents(supplied,workspace);if(agents.length!==1)throw new Error('调用 Agent 需要且只能接入一个 Agent');const result=await runAgent(agents[0],JSON.parse(strictValue('String',await read(node,'input')) as string),workspace,world,signal,onProgress,deps);value=workflowText(result.value);break}

        case 'llmBasic':{
          const model=workspace.models?.find(m=>m.id===setting.modelId);if(!model)throw new Error('请选择 LLM 模型')
          const source=validateMessages(await read(node,'messages'));if(source.fragment)throw new Error('工具结果片段必须先合并进完整上下文')
          const answered=new Set(source.items.filter(m=>m.role==='tool').map(m=>m.tool_call_id))
          if(source.items.flatMap(m=>m.tool_calls||[]).some(c=>!answered.has(c.id)))throw new Error('请先执行 ToolCalls 并合并工具返回')
          if(!source.items.length)throw new Error('Messages 不能为空')
          const tools=await capabilities(node)
          const response=await request(model,source.items,signal,tools)
          value=validateMessages({type:'Messages',version:1,items:[response]});break
        }
        case 'toolCalls':{
          const source=validateMessages(await read(node,'messages')),tools=await capabilities(node)
          if(new Set(tools.map(toolName)).size!==tools.length)throw new Error('Tool 调用名称重复')
          const answered=new Set(source.items.filter(m=>m.role==='tool').map(m=>m.tool_call_id)),results:LLMMessage[]=[]
          for(const call of source.items.flatMap(m=>m.tool_calls||[]).filter(c=>!answered.has(c.id))){
            check();let content:string
            try{const tool=tools.find(t=>toolName(t)===call.function.name);if(!tool)throw new Error('Tool 未接入：'+call.function.name);content=toolResultText(await execute(tool,JSON.parse(call.function.arguments),call.id))}
            catch(error){check();if(isAgentLimit(error))throw error;content=JSON.stringify({isError:true,error:error instanceof Error?error.message:String(error)})}
            results.push({role:'tool',content,tool_call_id:call.id})
          }
          value=validateMessages({type:'Messages',version:1,fragment:'toolResults',items:results});break
        }
        case 'input':{const parameters=typeof input==='object'&&input?input as Record<string,unknown>:{input};value=parameters[setting.parameter||'input'];const type=node.outputs[0]?.type;const map:Record<string,VariableType>={STRING:'String',NUMBER:'Number',BOOLEAN:'Boolean',MESSAGES:'Messages',IMAGE_OBJECT:'Image',TOOLS:'Tools',AGENTS:'Agents'};if(map[type])value=strictValue(map[type],value);break}
        case 'return':await read(node,'after');value=graph.scope==='method'?undefined:await read(node,'value');break
        case 'constant':value=setting.valueType==='json'?JSON.parse(setting.value||'null'):setting.value||'';break
        case 'world':{
          if(!world||!node.object?.classId)throw new Error('请选择世界和类')
          let object:any=createHostWorldApi(()=>readScriptWorld(world),()=>{throw new Error('世界节点只读')}).get_class(node.object.classId)
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
          const writes=graph.links.some(e=>e.to===node.id&&e.input==='value')||Object.hasOwn(setting,'port:value')||Object.hasOwn(node.bindings||{},'in:value');value=strictValue(type,writes?await read(node,'value'):stored&&typeof stored==='object'&&'type'in stored&&'value'in stored?stored.value:stored??defaultVariable(type));Object.defineProperty(variables,name,{value:{...(stored?.id?{id:stored.id}:{}),type,value},writable:true,enumerable:true,configurable:true});break
        }
        case 'valueMethod':case 'valueProperty':value=await invokeValueMember(setting.variableType as VariableType,setting.member,await read(node,'self'),await read(node,'arg'),{...setting,...(setting.member==='toolResult'?{toolCallId:workflowText(await read(node,'callId'))||setting.toolCallId||'',toolName:workflowText(await read(node,'toolName'))||setting.toolName||''}:{})},deps.imageAction||workflowImageAction,async(key,value,arg,settings)=>{if(value.type==='Agents'){if(key==='execute'){const agents=resolveWorkflowAgents(value,workspace);if(agents.length!==1)throw new Error('调用 Agent 需要一个对象');return workflowText((await runAgent(agents[0],JSON.parse(strictValue('String',arg) as string),workspace,world,signal,onProgress,deps)).value)}return workflowAgentValue(key,value,settings,workspace)}return workflowToolMember(key,value,arg,settings,workspace,world,signal,deps.http||modelRequest,deps.toolContext,execute)});break
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
          const tools=await capabilities(node,setting.toolIds?JSON.parse(setting.toolIds):model.toolIds||[],model.agentIds||[])
          const response=deps.llm?{message:{role:'assistant' as const,content:await deps.llm(model,conversation,signal)},messages:[] as LLMMessage[]}:await callLLMWithTools(model,conversation,workspace,world,signal,request,[],deps.toolContext,tools,execute);value=response.message.content||'';outputs.set(node.id,{messages:validateMessages({type:'Messages',version:1,items:response.messages.length?response.messages:[response.message]})});break
        }
        case 'sd':{const sd=workspace.sdWorkflows?.find(item=>item.id===setting.workflowId);if(!sd)throw new Error('请选择 SD 工作流');value=await (deps.sd||runSDWorkflow)(sd,workflowText(await read(node,'prompt')),workspace,world,signal);break}
        case 'function':{
          const fn=workspace.functions?.find(fn=>fn.id===setting.functionId);if(!fn)throw new Error('请选择 Function')
          const raw=await read(node,'input')
          const context=fn.apiVersion===2?{self:{classId:node.object?.classId||'',entityId:node.object?.entityId||''},input:raw&&typeof raw==='object'&&'type'in raw?raw as any:{type:'Text' as const,value:workflowText(raw)}}:undefined
          const result=await (deps.function||runFunctionValue)(fn,workflowText(raw),world,context,signal);check();value=result.typedValue||result.value;break
        }
        case 'tool':{
          const supplied=await read(node,'tool'),references=supplied!==undefined?resolveWorkflowTools(supplied,workspace):undefined
          if(references&&references.length!==1)throw new Error('调用 Tool 需要且只能接入一个工具')
          const tool=references?references[0]:setting.toolId?registeredTools(workspace).find(item=>item.id===setting.toolId):undefined
          if(setting.toolId&&!tool)throw new Error('所选 Tool 已不存在')
          if(tool&&!tool.enabled)throw new Error('Tool 已停用')
          if(tool){const raw=await read(node,'input'),parameters=node.inputs.find(p=>p.name==='input')?.type==='STRING'?JSON.parse(strictValue('String',raw) as string):raw;const result=await execute(tool,parameters);value=node.outputs.find(p=>p.name==='value')?.type==='STRING'?workflowText(result):result;break}
          if(node.inputs.some(p=>p.type==='TOOLS'))throw new Error('请接入 Tool 对象或选择注册 Tool')
          const config=setting
          if(!config.url)throw new Error('请选择 Tool 或输入 URL')
          const source=await read(node,'input'),raw=node.inputs.find(p=>p.name==='input')?.type==='STRING'?JSON.parse(strictValue('String',source) as string):source,id=crypto.randomUUID()
          if(deps.invocation)spend(deps.invocation.runtime,'calls');await emit({kind:'tool',id,name:'HTTP Tool',state:'running',parameters:raw})
          try{value=await (deps.http||modelRequest)({url:config.url,method:config.method==='GET'?'GET':'POST',apiKey:config.apiKey,body:config.method==='GET'?undefined:config.bodyMode==='raw'?raw:{input:raw},signal});await emit({kind:'tool',id,name:'HTTP Tool',state:'complete',result:value})}catch(error){await emit({kind:'tool',id,name:'HTTP Tool',state:'error',error:String(error)});throw error}
          if(node.outputs.find(p=>p.name==='value')?.type==='STRING')value=workflowText(value);break
        }
        case 'comfy':throw new Error('ComfyUI 输出只能连接到 ComfyUI 输入，由服务器执行')
        default:throw new Error('未知节点类型')
      }
      check();for(const [key,binding] of Object.entries(node.bindings||{})){
        const output=key.startsWith('out:')?key.slice(4):binding.output;if(!output)continue
        const entry=poolEntries(variables).find(v=>v.id===binding.variableId);if(!entry?.type)throw new Error('绑定变量不存在：'+binding.name)
        const port=node.outputs.find(p=>p.name===output);if(port?.type!==({String:'STRING',Number:'NUMBER',Boolean:'BOOLEAN',Messages:'MESSAGES',Image:'IMAGE_OBJECT',Tools:'TOOLS',Agents:'AGENTS',Method:'METHOD'}[entry.type]))throw new Error('输出绑定类型不匹配')
        const next=strictValue(entry.type,output==='value'?value:outputs.get(node.id)?.[output]);variables[entry.name]={id:entry.id,type:entry.type,value:next}
      }
      if(['variable','setVariable'].includes(node.kind)||Object.keys(node.bindings||{}).length)await emit({kind:'variables',values:variables});trace.push({id:node.id,title:workflowNodeTitle(node),value,frame:scope?.frame,scopeLabel:scope?.label,invocationId:deps.invocation?.id});await emit({kind:'node',id:node.id,state:'complete'});return value
    })().catch(async error=>{await emit({kind:'node',id:node.id,state:signal?.aborted?'cancelled':'error',error:error instanceof Error?error.message:String(error)});throw new Error(`[${workflowNodeTitle(node)}] ${error instanceof Error?error.message:String(error)}`,{cause:error})})
    cache.set(id,promise);return promise
  }
  const output=async(id:string,name:string):Promise<unknown>=>{const value=await evaluate(id);if(name==='value')return value;const extra=outputs.get(id);if(!extra||!Object.hasOwn(extra,name))throw new Error('本地节点不支持此输出端口');return extra[name]}
  const finish=async():Promise<{value?:unknown;stop?:boolean;again?:boolean}>=>{
    for(const leaf of graphLeaves(graph).filter(n=>!['return','break','continue'].includes(n.kind)))await evaluate(leaf.id)
    if(graph.scope==='loop'){
      const stop=await evaluate(graph.nodes.find(n=>n.kind==='break')!.id) as boolean
      if(stop)return {stop:true}
      return {stop:false,again:await evaluate(graph.nodes.find(n=>n.kind==='continue')!.id) as boolean}
    }
    const terminal=graph.nodes.find(n=>n.kind==='return')
    return {value:terminal?await evaluate(terminal.id):undefined}
  }
  return {evaluate,read,output,finish}
}
export async function runAgent(agent:AgentDefinition,input:string|Record<string,unknown>,workspace:Workspace,world?:World,signal?:AbortSignal,onProgress?:(message:string)=>void,deps:WorkflowDependencies={}):Promise<WorkflowRun> {
  if(signal?.aborted)throw new DOMException('运行已取消','AbortError')
  if(agent.enabled===false)throw new Error('Agent 已停用')
  const parameters=agentParameters(agent,input),parent=deps.invocation,runtime=parent?.runtime||newAgentRuntime(agent)
  if(!parent&&deps.runId)runtime.runId=deps.runId
  if(parent)spend(runtime,'calls')
  const invocation:AgentInvocation={runtime,id:crypto.randomUUID(),parentId:parent?.id,agentId:agent.id,depth:(parent?.depth||0)+1}
  if(invocation.depth>runtime.limits.depth)throw new AgentLimitError('Agent 调用深度超过上限')
  const checkpoint=new Map(runtime.staged),scope=world?.id||'global',key=agent.id+':'+scope
  const emit=(event:WorkflowEvent)=>emitAgentEvent(invocation,deps.onEvent,event)
  await emit({kind:'agent',id:invocation.id,name:agent.name,state:'running',parameters})
  try{
    const original=agent;agent=migrateWorkflowTypes(agent);validateWorkflow(agent.graph)
    const returns=agent.graph.nodes.filter(node=>node.kind==='return');if(returns.length!==1)throw new Error('Agent 必须有且只有一个返回卡片')
    const declarations=new Map<string,string>();for(const n of [...walkWorkflowNodes(agent.graph),...poolEntries(agent.variables).filter(e=>e.type==='Method').flatMap(e=>walkWorkflowNodes((e.value as MethodValue).graph))].filter(node=>node.kind==='variable')){const previous=declarations.get(n.settings.name);if(previous&&previous!==n.settings.variableType)throw new Error('变量 '+n.settings.name+' 存在不同类型的声明');declarations.set(n.settings.name,n.settings.variableType)}
    const previous=runtime.staged.get(key),variables=structuredClone(ensureGraphVariables(agent.graph,{...agent.variables,...(previous?.variables||agent.memory?.[scope])})),trace:WorkflowRun['trace']=[]
    for(const entry of poolEntries(agent.variables).filter(e=>e.type==='Method'))variables[entry.name]=structuredClone(agent.variables[entry.name])
    for(const entry of poolEntries(variables).filter(e=>e.type==='Method'))validateWorkflow((strictValue('Method',entry.value) as MethodValue).graph)
    await emit({kind:'variables',values:variables})
    const engine=evaluator(agent.graph,parameters,workspace,world,variables,signal,trace,{...deps,invocation},onProgress),value=(await engine.finish()).value
    toolResultText(value)
    if(signal?.aborted)throw new DOMException('运行已取消','AbortError')
    if(workspace.agents?.some(a=>a.id===original.id))runtime.staged.set(key,{agentId:agent.id,scope,base:previous?.base??structuredClone(original.memory?.[scope]),definition:previous?.definition||agentDefinitionSignature(original),variables:structuredClone(variables)})
    await emit({kind:'agent',id:invocation.id,name:agent.name,state:'complete',result:value})
    return {value,variables,trace,memoryChanges:parent?undefined:[...runtime.staged.values()]}
  }catch(error){runtime.staged=checkpoint;await emit({kind:'agent',id:invocation.id,name:agent.name,state:signal?.aborted?'cancelled':'error',error:String(error)});throw error}
}
export {commitAgentMemory}
export async function compileComfyPrompt(workflow:SDWorkflow,input:string,workspace:Workspace,world?:World,signal?:AbortSignal,deps:WorkflowDependencies={}):Promise<Record<string,unknown>> {
  workflow=migrateWorkflowTypes(workflow)
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
        else if(port.required)throw new Error(`${workflowNodeTitle(node)} 的 ${port.name} 尚未连接或配置`)
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
