import type {PointerEvent,ReactNode} from 'react'
import {X,GripVertical} from 'lucide-react'
import {WorkflowGraph,WorkflowNode,WorkflowPort} from '../model/types'
import {pairedOutput,unbindVariable} from '../model/workflowBindings'
import {poolEntries} from '../model/variablePool'
import {workflowNodeTitle,ComfyCatalog} from '../model/workflows'
import {PortTypeIcon} from './WorkflowIcon'
import type useCanvasEditing from './useCanvasEditing'
import type {PoolEntry} from './VariablePool'
export interface BindingSource {nodeId:string;key:string}
export default function WorkflowPorts({node,graph,variables,catalog,editor,onChange,onLiteral,renderValue,onDrag,preview}:{node:WorkflowNode;graph:WorkflowGraph;variables:Record<string,unknown>;catalog:ComfyCatalog;editor:Pick<ReturnType<typeof useCanvasEditing>,'portEvents'>;onChange:(graph:WorkflowGraph)=>void;onLiteral:(port:WorkflowPort,value:unknown)=>void;renderValue:(port:WorkflowPort)=>ReactNode;onDrag:(entry:PoolEntry,event:PointerEvent,source?:BindingSource)=>void;preview?:{entry:PoolEntry;origin?:BindingSource;pending?:boolean;target?:string}|null}){
 const title=workflowNodeTitle(node,catalog),paired=new Set(node.inputs.map(p=>pairedOutput(node,p)).filter(Boolean))
 const portButton=(port:WorkflowPort,direction:'in'|'out')=><button className={`flow-port ui-port--flow ${direction==='in'?'input':'output'} ui-surface ui-port`} aria-label={`${title} ${port.name} ${direction==='in'?'输入':'输出'}`} data-workflow-port={`${node.id}:${direction}:${port.name}`} {...editor.portEvents({id:node.id,port:port.name,direction})} onDoubleClick={direction==='in'?e=>{e.stopPropagation();onChange({...graph,links:graph.links.filter(l=>l.to!==node.id||l.input!==port.name)})}:undefined}/>
 const binding=(key:string)=>{const [direction,...parts]=key.split(':'),temporary=!preview?.pending&&preview?.target===`${node.id}|${direction}|${parts.join(':')}`,departing=!preview?.pending&&preview?.origin?.nodeId===node.id&&preview.origin.key===key,b=temporary?{variableId:preview!.entry.id,name:preview!.entry.name}:node.bindings?.[key];if(!b)return null;const entry=temporary?preview!.entry:poolEntries(variables).find(v=>v.id===b.variableId);return <div className={`flow-palette-item ui-tree-row--palette flow-inline-variable ui-card--inline-variable ${temporary?'is-drop-preview':departing?'is-drag-origin':''} ui-surface ui-tree-row ui-card`} onPointerDown={e=>{if(entry)onDrag(entry,e,{nodeId:node.id,key})}} onClick={e=>{e.preventDefault();e.stopPropagation()}}><GripVertical size={12}/><PortTypeIcon type={entry?.type==='Image'?'IMAGE_OBJECT':entry?.type?.toUpperCase()||'ANY'}/><span>{entry?.name||b.name}</span><button className="icon-button ui-button--icon ui-surface ui-button" aria-label={`解除变量引用 ${b.name}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onChange(unbindVariable(graph,node.id,key))}}><X size={12}/></button></div>}
 return <>{node.outputs.filter(p=>!paired.has(p.name)).map(port=><div className="flow-output-row ui-card--output ui-surface ui-card" key={`out:${port.name}`} data-variable-type={port.type} data-variable-target={`${node.id}|out|${port.name}`}><PortTypeIcon type={port.type}/><span>{String(port.default||port.name)} · {port.type}</span>{binding(`out:${port.name}`)}{portButton(port,'out')}</div>)}{node.inputs.map(port=>{
  const output=pairedOutput(node,port),edge=graph.links.find(l=>l.to===node.id&&l.input===port.name),key=`in:${port.name}`
  return <div className={`${output?'flow-input-output-row ui-card--input-output':'flow-input-row ui-card--input'} ui-surface ui-card`} key={key} data-variable-type={port.type} data-variable-target={`${node.id}|in|${port.name}`}>
   {portButton(port,'in')}<label><span className="flow-port-caption"><PortTypeIcon type={port.type}/>{output?`${port.name} ↔ ${output}`:port.name} · {port.type}</span>
    {binding(key)|| (edge?<span className="flow-connected-value ui-badge--connected-value ui-surface ui-badge">← {workflowNodeTitle(graph.nodes.find(n=>n.id===edge.from),catalog)}</span>:renderValue(port))}
    {node.kind==='variable'&&port.name==='value'&&Object.hasOwn(node.settings,'port:value')&&!edge&&!node.bindings?.[key]&&<button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" onClick={()=>onLiteral(port,undefined)}>切换为读取</button>}
   </label>{output&&<>{binding(`out:${output}`)}{portButton(node.outputs.find(p=>p.name===output)!,'out')}</>}
  </div>
 })}</>
}
