import {validateWorkflow} from '../model/workflows'
import {isFlowGraph} from '../model/flow'
import { useEffect, useRef, useState } from 'react'
import { EditGraph, graphFragment, pasteGraphFragment, removeGraphSelection } from '../model/graphEditing'
let clipboard:{kind:string;graph:EditGraph}|null=null
export default function useGraphEditing<G extends EditGraph>(value:G,onChange:(next:G)=>void,kind:string) {
  const [selected,setSelected]=useState<string[]>([]),[selectedEdges,setSelectedEdges]=useState<string[]>([]),[revision,setRevision]=useState(0)
  const past=useRef<G[]>([]),future=useRef<G[]>([]),transaction=useRef<G|null>(null),live=useRef({value,onChange,selected,selectedEdges});live.current={value,onChange,selected,selectedEdges}
  const changed=()=>setRevision(n=>n+1)
  const commit=(next:G)=>{const current=live.current;if(JSON.stringify(next)===JSON.stringify(current.value))return;if(!transaction.current){past.current.push(structuredClone(current.value));if(past.current.length>100)past.current.shift()}future.current=[];live.current={...current,value:next};current.onChange(next);changed()}
  const begin=()=>{transaction.current=structuredClone(live.current.value)}
  const end=()=>{if(transaction.current&&JSON.stringify(transaction.current)!==JSON.stringify(live.current.value)){past.current.push(transaction.current);if(past.current.length>100)past.current.shift();future.current=[]}transaction.current=null;changed()}
  const undo=()=>{end();const previous=past.current.pop();if(!previous)return;future.current.push(structuredClone(live.current.value));live.current.onChange(previous);live.current.value=previous;setSelected([]);setSelectedEdges([]);changed()}
  const redo=()=>{const next=future.current.pop();if(!next)return;past.current.push(structuredClone(live.current.value));live.current.onChange(next);live.current.value=next;setSelected([]);setSelectedEdges([]);changed()}
  const copy=()=>{if(!live.current.selected.length)return;const graph=graphFragment(live.current.value,live.current.selected);clipboard={kind,graph};void navigator.clipboard?.writeText(JSON.stringify({myUniverseGraphClipboard:kind,graph})).catch(()=>{});changed()}
  const remove=()=>{commit(removeGraphSelection(live.current.value,live.current.selected,live.current.selectedEdges));setSelected([]);setSelectedEdges([])}
  const cut=()=>{copy();remove()}
  const paste=async()=>{
    let source=clipboard?.kind===kind?clipboard.graph:null
    if(!source){try{const data=JSON.parse(await navigator.clipboard.readText());if(data.myUniverseGraphClipboard===kind&&data.graph?.version===1&&Array.isArray(data.graph.nodes)&&data.graph.nodes.every((n:any)=>typeof n.id==='string'&&Number.isFinite(n.x)&&Number.isFinite(n.y)&&typeof(kind==='flow'?n.type:n.kind)==='string'&&(kind==='flow'?n.values&&typeof n.values==='object':Array.isArray(n.inputs)&&Array.isArray(n.outputs)&&n.settings&&typeof n.settings==='object'))&&Array.isArray(kind==='flow'?data.graph.edges:data.graph.links))source=data.graph}catch{}}
    if(!source)return
    try{if(kind==='flow'){if(!isFlowGraph(source))return}else validateWorkflow(source as any)}catch{return}
    const result=pasteGraphFragment(live.current.value,source as G);commit(result.graph);setSelected(result.ids);setSelectedEdges([]);clipboard={kind,graph:graphFragment(result.graph,result.ids)}
  }
  const select=(id:string,additive=false)=>{setSelected(current=>additive?current.includes(id)?current.filter(item=>item!==id):[...current,id]:current.includes(id)?current:[id]);setSelectedEdges([])}
  const clear=()=>{setSelected([]);setSelectedEdges([])}
  const commands=useRef({copy,paste,cut,undo,redo,remove});commands.current={copy,paste,cut,undo,redo,remove}
  useEffect(()=>{past.current=[];future.current=[];transaction.current=null;clear();changed()},[kind])
  return {selected,setSelected,selectedEdges,setSelectedEdges,commit,begin,end,undo,redo,copy,paste,cut,remove,select,clear,canUndo:past.current.length>0,canRedo:future.current.length>0,commands,revision}
}
