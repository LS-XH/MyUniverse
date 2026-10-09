import { FlowGraph, FlowNode, FlowNodeType, uid } from './types'
import { objectCode } from './worldApi'

export const flowNames:Record<FlowNodeType,string>={input:'input · 输入',return:'return · 输出',add:'+ 相加',subtract:'− 相减',multiply:'× 相乘',divide:'÷ 相除',constant:'常量',code:'代码块',entityMarkdown:'获取实例内容',memberMarkdown:'获取实例对象'}
export function flowPorts(node:FlowNode):string[] {return node.type==='input'||node.type==='constant'||node.type==='entityMarkdown'||node.type==='memberMarkdown'?[]:node.type==='return'?['value']:node.type==='code'?(node.ports||['a','b']):['a','b']}
export function newFlowNode(type:FlowNodeType,x=320,y=180):FlowNode {return {id:uid(),type,x,y,values:{},...(type==='code'?{ports:['a','b'],code:'return inputs.a;'}:{}),...(['entityMarkdown','memberMarkdown'].includes(type)?{object:{classId:'',entityId:'',path:[]}}:{})}}
export function createFlow():FlowGraph {const input=newFlowNode('input',70,120),output=newFlowNode('return',620,120);return {version:1,nodes:[input,output],edges:[{id:uid(),from:input.id,to:output.id,port:'value'}]}}
export function isFlowGraph(value:unknown):value is FlowGraph {
  const g=value as FlowGraph
  return !!g&&g.version===1&&Array.isArray(g.nodes)&&Array.isArray(g.edges)&&g.nodes.length<=300&&g.edges.length<=1500&&g.nodes.every(n=>n&&typeof n.id==='string'&&Object.hasOwn(flowNames,n.type)&&Number.isFinite(n.x)&&Number.isFinite(n.y)&&!!n.values&&typeof n.values==='object'&&!Array.isArray(n.values)&&Object.values(n.values).every(v=>typeof v==='string')&&(!n.code||typeof n.code==='string')&&(!n.ports||Array.isArray(n.ports)&&n.ports.every(p=>typeof p==='string'))&&(!n.object||typeof n.object.classId==='string'&&typeof n.object.entityId==='string'&&Array.isArray(n.object.path)&&n.object.path.every(p=>typeof p==='string')))&&g.edges.every(e=>e&&typeof e.id==='string'&&typeof e.from==='string'&&typeof e.to==='string'&&typeof e.port==='string')
}
export function validateFlow(graph:FlowGraph,complete=true):void {
  if(!isFlowGraph(graph))throw new Error('Flow 文件结构无效')
  if(graph.nodes.filter(n=>n.type==='input').length!==1||graph.nodes.filter(n=>n.type==='return').length!==1)throw new Error('Flow 必须各有一个 input 和 return')
  if(new Set(graph.nodes.map(n=>n.id)).size!==graph.nodes.length)throw new Error('卡片 ID 重复')
  const destinations=new Set<string>(),visiting=new Set<string>(),visited=new Set<string>()
  for(const e of graph.edges){const from=graph.nodes.find(n=>n.id===e.from),to=graph.nodes.find(n=>n.id===e.to);if(!from||!to||from.type==='return'||!flowPorts(to).includes(e.port))throw new Error('存在失效的连线端口');const key=`${e.to}/${e.port}`;if(destinations.has(key))throw new Error('一个输入端口只能连接一个来源');destinations.add(key)}
  const visit=(id:string)=>{if(visiting.has(id))throw new Error('流程图不能循环连线；循环逻辑请写在代码块中');if(visited.has(id))return;visiting.add(id);for(const edge of graph.edges.filter(e=>e.to===id))visit(edge.from);visiting.delete(id);visited.add(id)}
  graph.nodes.forEach(n=>{const ports=flowPorts(n);if(new Set(ports).size!==ports.length)throw new Error('代码块输入名称重复');visit(n.id)})
  const output=graph.nodes.find(n=>n.type==='return')!
  if(complete&&!graph.edges.some(e=>e.to===output.id))throw new Error('请将输出连接到 return')
}
/** Generates ordinary JS: nodes remain editable while loops/branches live inside code blocks. */
export function compileFlow(graph:FlowGraph,typed=false):string {
  validateFlow(graph)
  const output=graph.nodes.find(n=>n.type==='return')!,lines:string[]=[]
  for(const node of graph.nodes){
    const ports=flowPorts(node),inputs=ports.map(p=>{const edge=graph.edges.find(e=>e.to===node.id&&e.port===p);return `[${JSON.stringify(p)}, ${edge?`await evaluate(${JSON.stringify(edge.from)})`:JSON.stringify(node.values[p]||'')}]`}).join(', ')
    let body=''
    if(node.type==='input')body='return input;'
    else if(node.type==='constant')body=`return ${JSON.stringify(node.values.value||'')};`
    else if(node.type==='return')body='return inputs.value;'
    else if(node.type==='code')body=`return await (async function(inputs, world) {\n${node.code||'return inputs.a;'}\n})(inputs, world);`
    else if(node.type==='entityMarkdown'||node.type==='memberMarkdown'){
      if(!node.object?.classId||!node.object.entityId)body=`throw new Error(${JSON.stringify(`${flowNames[node.type]}：请选择类和实例`)});`
      else if(node.type==='memberMarkdown'&&!node.object.path.length)body='throw new Error("获取实例对象：请选择属性成员");'
      else body=`return ${objectCode({...node.object,path:node.type==='entityMarkdown'?[]:node.object.path}).replace(/;$/,'').replace(/\.markdown\(\)$/,node.type==='memberMarkdown'&&node.values.format==='value'?'.value()':'.markdown()')};`
    }else {
      const op={add:'+',subtract:'-',multiply:'*',divide:'/'}[node.type]
      body=`const a=number(inputs.a), b=number(inputs.b); ${node.type==='divide'?'if(b===0)throw new Error("除数不能为 0"); ':''}const result=a ${op} b;if(!Number.isFinite(result))throw new Error("运算结果超出范围");return result;`
    }
    lines.push(`case ${JSON.stringify(node.id)}: { const inputs = Object.fromEntries([${inputs}]); ${body} }`)
  }
  return `async function transform(${typed?'self, input':'input, world'}) {\n  const cache = new Map();\n  const number = value => {if(value && typeof value.value === 'function')value=value.value();else if(value && typeof value === 'object' && value.type)value=value.value;if(String(value).trim()==='' || !Number.isFinite(Number(value)))throw new Error('算术输入必须是有效数字');return Number(value);};\n  async function evaluate(id) {\n    if(cache.has(id))return cache.get(id);\n    const task=(async()=>{switch(id) {\n${lines.map(line=>'      '+line).join('\n')}\n      default: throw new Error('卡片不存在');\n    }})();\n    cache.set(id,task);\n    return task;\n  }\n  const result = await evaluate(${JSON.stringify(output.id)});\n  if(result === undefined)throw new Error('代码块没有返回值');\n  return ${typed?'values.from(result && typeof result.to_value === "function" ? result.to_value() : result)':"typeof result === 'string' ? result : JSON.stringify(result)"};\n}\n`
}
export function connectFlow(graph:FlowGraph,from:string,to:string,port:string):FlowGraph {
  const candidate={...graph,edges:[...graph.edges.filter(e=>e.to!==to||e.port!==port),{id:uid(),from,to,port}]}
  validateFlow(candidate,false)
  return candidate
}
