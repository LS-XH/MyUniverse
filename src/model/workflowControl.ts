import {WorkflowGraph,WorkflowNode} from './types'
import {defaultVariable,variablePort,variableTypes,VariableType} from './workflowValues'
import {newScopeGraph} from './workflowScopes'
export type ControlType=Exclude<VariableType,'Method'>|'ANY'
export function controlType(node:WorkflowNode):ControlType {
 const type=node.settings.variableType as ControlType
 if(type!=='ANY'&&(!variableTypes.includes(type)||type as string==='Method'))throw new Error('条件必须指定值类型或 ANY')
 return type
}
export function configureControl(node:WorkflowNode,type:ControlType='ANY'):WorkflowNode {
 if(node.kind==='loop')return {...node,settings:{repeat:'1'},body:node.body||newScopeGraph('loop'),inputs:[{name:'value',type:'ANY'}],outputs:[{name:'value',type:'ANY'}]}
 const port=type==='ANY'?'ANY':variablePort(type),value=type==='ANY'?undefined:defaultVariable(type)
 return {...node,settings:{...node.settings,variableType:type},inputs:[{name:'condition',type:'BOOLEAN',default:false},{name:'trueValue',type:port,default:value},{name:'falseValue',type:port,default:value}],outputs:[{name:'value',type:port}]}
}
export function configureSequence(node:WorkflowNode,count:number):WorkflowNode {
 if(!Number.isSafeInteger(count)||count<1||count>64)throw new Error('顺序执行分支数量必须为 1–64')
 const inputs=Array.from({length:count},(_,i)=>({name:`branch${i+1}`,type:'ANY'}))
 const settings={...node.settings};for(const key of Object.keys(settings))if(key.startsWith('port:')&&!inputs.some(p=>key===`port:${p.name}`))delete settings[key]
 return {...node,settings,inputs,outputs:inputs.map(p=>({...p})),bindings:Object.fromEntries(Object.entries(node.bindings||{}).filter(([key])=>inputs.some(p=>key.slice(key.indexOf(':')+1)===p.name)))}
}
export function validateControl(graph:WorkflowGraph,_complete=true):void {
 for(const node of graph.nodes){
  if(node.kind==='loop'){
   if(!node.body||node.inputs.length!==1||node.inputs[0].name!=='value'||node.inputs[0].type!=='ANY'||node.outputs.length!==1||node.outputs[0].name!=='value'||node.outputs[0].type!=='ANY')throw new Error('旧循环回边已不支持：请改用内部画布循环（value 输入输出及 repeat）')
   const repeat=Number(node.settings.repeat??1);if(!Number.isSafeInteger(repeat)||repeat<1||repeat>10000)throw new Error('repeat 必须为 1–10000 的整数')
   if(node.body.scope!=='loop')throw new Error('循环体必须是 loop 作用域')
  }
  if(node.kind==='condition'){
   const expected=configureControl(node,controlType(node))
   for(const direction of ['inputs','outputs'] as const)if(JSON.stringify(node[direction].map(p=>[p.name,p.type]))!==JSON.stringify(expected[direction].map(p=>[p.name,p.type])))throw new Error('条件端口与声明类型不一致')
  }
  if(node.kind==='sequence'){
   const expected=configureSequence(node,node.inputs.length)
   for(const direction of ['inputs','outputs'] as const)if(JSON.stringify(node[direction].map(p=>[p.name,p.type]))!==JSON.stringify(expected[direction].map(p=>[p.name,p.type])))throw new Error('顺序执行输入输出必须按分支一一对应')
  }
 }
 if(graph.scope==='loop'){
  for(const kind of ['break','continue'])if(graph.nodes.filter(n=>n.kind===kind).length!==1)throw new Error('循环体必须各有一个 break 和 continue 卡片')
  if(graph.nodes.some(n=>n.kind==='return'))throw new Error('循环体不使用返回卡片')
 }else if(graph.nodes.some(n=>n.kind==='break'||n.kind==='continue'))throw new Error('break/continue 只能出现在循环内部')
 if(graph.scope==='method'&&graph.nodes.filter(n=>n.kind==='return').length!==1)throw new Error('方法体必须有且只有一个返回卡片')
 if(graph.scope&&graph.nodes.some(n=>n.kind==='input'))throw new Error('内部作用域没有输入参数，使用变量池共享值')
 for(const n of graph.nodes.filter(n=>n.kind==='break'||n.kind==='continue'))if(n.inputs.length!==1||n.inputs[0].name!=='condition'||n.inputs[0].type!=='BOOLEAN'||n.outputs.length)throw new Error('break/continue 仅有 Boolean condition 输入')
 if(graph.scope==='method'){const n=graph.nodes.find(n=>n.kind==='return')!;if(n.outputs.length||n.inputs.some(p=>p.name!=='after'||p.type!=='ANY'))throw new Error('方法返回只表示完成，不接受返回值')}
 const visited=new Set<string>(),active=new Set<string>()
 const visit=(id:string)=>{if(active.has(id))throw new Error('工作流必须无环；循环请使用内部画布，不支持回边');if(visited.has(id))return;active.add(id);for(const edge of graph.links.filter(e=>e.to===id))visit(edge.from);active.delete(id);visited.add(id)}
 graph.nodes.forEach(n=>visit(n.id))
}
