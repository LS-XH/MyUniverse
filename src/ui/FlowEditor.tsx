import LibraryFolder from './LibraryFolder'
import WorkflowIcon from './WorkflowIcon'
import useCanvasEditing from './useCanvasEditing'
import GraphEditActions from './GraphEditActions'
import { usePageState } from './PageSession'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Code2, Maximize2, Minimize2, Plus, Trash2, X, PanelRightOpen, PanelRightClose } from 'lucide-react'
import { connectFlow, flowNames, flowPorts, newFlowNode } from '../model/flow'
import { zoomAt } from '../model/graphGeometry'
import { FlowGraph, FlowNode, FlowNodeType, World } from '../model/types'
import ObjectPicker from './ObjectPicker'
import FunctionCodeEditor from './FunctionCodeEditor'

type Point={x:number;y:number}
const nodeWidth=260
export default function FlowEditor({value,onChange:externalOnChange,world,typed=false,toolbar}:{value:FlowGraph;onChange:(flow:FlowGraph)=>void;world?:World;typed?:boolean;toolbar?:ReactNode}) {
  const canvas=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null)
  const [libraryOpen,setLibraryOpen]=usePageState('flow:libraryOpen',true)
  const [pan,setPan]=usePageState('flow:pan',{x:20,y:20}),[scale,setScale]=usePageState('flow:scale',.8)
  const [error,setError]=useState(''),[editing,setEditing]=useState<string|null>(null)
  const editor=useCanvasEditing(value,externalOnChange,'flow',canvas,pan,scale,setPan,()=>setLibraryOpen(!libraryOpen),edge=>editor.commit(connectFlow(value,edge.from,edge.to,edge.input)),setError)
  const {selected,selectedEdges,from,cursor}=editor,onChange=editor.commit,live=useRef({value,onChange});live.current={value,onChange}
  const [maximized,setMaximized]=useState(false),[frame,setFrame]=useState({left:349,top:80})
  const [ports,setPorts]=useState<Record<string,Point>>({})
  const viewport=useRef({pan,scale});viewport.current={pan,scale}
  const templateDrag=useRef<{type:FlowNodeType;start:Point;moved:boolean}|null>(null),suppressClick=useRef(false)
  const [ghost,setGhost]=useState<{type:FlowNodeType;point:Point}|null>(null)
  const worldPoint=(client:Point)=>{const rect=canvas.current!.getBoundingClientRect(),v=viewport.current;return {x:(client.x-rect.left-v.pan.x)/v.scale,y:(client.y-rect.top-v.pan.y)/v.scale}}
  const fit=()=>{
    const rect=canvas.current?.getBoundingClientRect();if(!rect)return
    const nodes=live.current.value.nodes,minX=Math.min(...nodes.map(n=>n.x)),minY=Math.min(...nodes.map(n=>n.y))
    const heights=new Map<string,number>();stage.current?.querySelectorAll<HTMLElement>('.flow-node').forEach(el=>heights.set(el.dataset.nodeId!,el.offsetHeight))
    const maxX=Math.max(...nodes.map(n=>n.x+nodeWidth)),maxY=Math.max(...nodes.map(n=>n.y+(heights.get(n.id)||180)))
    const nextScale=Math.max(.08,Math.min(1.2,(rect.width-60)/(maxX-minX),(rect.height-60)/(maxY-minY)))
    setScale(nextScale);setPan({x:30-minX*nextScale,y:30-minY*nextScale})
  }
  useEffect(()=>{if(maximized){const frame=requestAnimationFrame(fit);return()=>cancelAnimationFrame(frame)}},[maximized])
  const add=(type:FlowNodeType,point?:Point)=>{
    const rect=canvas.current?.getBoundingClientRect(),v=viewport.current
    const location=point||{x:((rect?.width||700)/2-v.pan.x)/v.scale-nodeWidth/2+Math.random()*30,y:((rect?.height||600)/2-v.pan.y)/v.scale-70+Math.random()*30}
    const node=newFlowNode(type,location.x,location.y);live.current.onChange({...live.current.value,nodes:[...live.current.value.nodes,node]});editor.setSelected([node.id]);setError('')
  }
  useEffect(()=>{
    const move=(e:PointerEvent)=>{const d=templateDrag.current;if(!d)return;if(Math.hypot(e.clientX-d.start.x,e.clientY-d.start.y)>5)d.moved=true;if(d.moved){e.preventDefault();setGhost({type:d.type,point:{x:e.clientX,y:e.clientY}})}}
    const end=(e:PointerEvent)=>{const d=templateDrag.current;if(!d)return;const rect=canvas.current?.getBoundingClientRect();suppressClick.current=d.moved;if(d.moved&&rect&&e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom){const point=worldPoint({x:e.clientX,y:e.clientY});add(d.type,{x:point.x-30,y:point.y-20})}templateDrag.current=null;setGhost(null)}
    const cancel=()=>{templateDrag.current=null;setGhost(null);editor.setFrom(null)}
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){cancel();setEditing(null)}}
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',key)
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key)}
  },[])
  useEffect(()=>{
    const el=canvas.current;if(!el)return
    const wheel=(e:WheelEvent)=>{if((e.target as HTMLElement).closest('input,select,textarea'))return;e.preventDefault();const rect=el.getBoundingClientRect(),v=viewport.current,next=zoomAt(v.pan,v.scale,e.deltaY<0?1.1:1/1.1,{x:e.clientX-rect.left,y:e.clientY-rect.top});setPan(next.pan);setScale(next.scale)}
    el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel)
  },[])
  useLayoutEffect(()=>{
    const el=stage.current;if(!el)return
    const measure=()=>{
      const rect=canvas.current!.getBoundingClientRect(),points:Record<string,Point>={}
      el.querySelectorAll<HTMLButtonElement>('[data-flow-port]').forEach(port=>{const box=port.getBoundingClientRect();points[port.dataset.flowPort!]={x:(box.left+box.width/2-rect.left-pan.x)/scale,y:(box.top+box.height/2-rect.top-pan.y)/scale}})
      setPorts(points)
    }
    measure();const observer=new ResizeObserver(measure);el.querySelectorAll('.flow-node').forEach(node=>observer.observe(node));return()=>observer.disconnect()
  },[value,pan,scale,maximized])
  const update=(id:string,patch:Partial<FlowNode>)=>onChange({...value,nodes:value.nodes.map(n=>n.id===id?{...n,...patch}:n)})
  const path=(a:Point,b:Point)=>{const bend=Math.max(55,Math.abs(b.x-a.x)*.5);return `M ${a.x} ${a.y} C ${a.x+bend} ${a.y}, ${b.x-bend} ${b.y}, ${b.x} ${b.y}`}
  const palette=(type:FlowNodeType)=><button className="flow-palette-item" key={type} onPointerDown={e=>{if(e.button!==0)return;templateDrag.current={type,start:{x:e.clientX,y:e.clientY},moved:false};suppressClick.current=false}} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return}add(type)}}>{type==='code'?<Code2 size={16}/>:type==='entityMarkdown'||type==='memberMarkdown'?<WorkflowIcon kind="world"/>:<WorkflowIcon kind="add"/>}<span>{flowNames[type]}</span><Plus size={14}/></button>
  const codeNode=value.nodes.find(n=>n.id===editing)
  return <div className={`flow-workbench ${maximized?'is-maximized':''} ${libraryOpen?'library-open':''}`} style={maximized?{left:frame.left,top:frame.top}:undefined}><div className="flow-toolbar"><strong>Flow</strong><span>{from?'选择目标输入端口 · Esc 取消':'拖动卡片 · 输出端口 → 输入端口 · 滚轮缩放'}</span>{toolbar}<button className="ghost" onClick={()=>{const main=canvas.current?.closest('.main-area'),rect=main?.getBoundingClientRect(),top=main?.querySelector('.topbar')?.getBoundingClientRect().bottom;setFrame({left:(rect?.left||329)+20,top:(top||64)+16});setMaximized(!maximized)}}>{maximized?<Minimize2 size={14}/>:<Maximize2 size={14}/>} {maximized?'收起画布':'展开画布'}</button><button className="ghost" onClick={fit}>适应画布</button><button className="ghost" onClick={()=>{setPan({x:20,y:20});setScale(.8)}}>复位</button><GraphEditActions {...editor} hasSelection={!!selected.length}/><button className="ghost danger" disabled={!selected.length&&!selectedEdges.length} onClick={editor.remove}><Trash2 size={14}/> 删除所选</button><button className="icon-button" title={libraryOpen?'收起节点库':'打开节点库'} aria-label={libraryOpen?'收起节点库':'打开节点库'} aria-expanded={libraryOpen} onClick={()=>setLibraryOpen(!libraryOpen)}>{libraryOpen?<PanelRightClose size={18}/>:<PanelRightOpen size={18}/>}</button></div><div className="flow-editor-layout"><div ref={canvas} className="flow-canvas" onPointerDown={editor.startCanvas}><div ref={stage} className="flow-stage" style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${scale})`}}><svg className="flow-edges" width="1" height="1" style={{overflow:'visible'}}>{value.edges.map(edge=>{
    const a=ports[`${edge.from}:out`],b=ports[`${edge.to}:${edge.port}`];if(!a||!b)return null
    return <g key={edge.id} className={selectedEdges.includes(edge.id)?'selected':''} onPointerDown={e=>e.stopPropagation()} onClick={e=>{editor.setSelectedEdges(e.ctrlKey?selectedEdges.includes(edge.id)?selectedEdges.filter(id=>id!==edge.id):[...selectedEdges,edge.id]:[edge.id]);editor.setSelected([])}}><path className="flow-edge-hit" d={path(a,b)}/><path className="flow-edge-line" d={path(a,b)}/></g>
  })}{from&&ports[editor.portKey(from)]&&cursor&&<path className="flow-edge-preview" d={path(ports[editor.portKey(from)],cursor)}/>}</svg>{value.nodes.map(node=><section key={node.id} data-node-id={node.id} className={`flow-node ${selected.includes(node.id)?'selected':''} ${from?.id===node.id?'connecting':''}`} style={{left:node.x,top:node.y,width:nodeWidth}} onClick={e=>editor.selectNode(e,node.id)}><header onPointerDown={e=>editor.startNode(e,node.id)}><strong>{flowNames[node.type]}</strong><span>⋮⋮</span></header>{node.type!=='return'&&<div className="flow-output-row"><span>输出</span><button className="flow-port output" data-flow-port={`${node.id}:out`} aria-label={`${flowNames[node.type]} 输出端口`} {...editor.portEvents({id:node.id,port:'value',direction:'out'})}/></div>}{node.type==='input'&&<p className="flow-node-hint">{typed?'绑定属性的类型 input；代码可访问 self / values':'函数的字符串 input'}</p>}{node.type==='constant'&&<label className="flow-value">值<input aria-label="常量值" value={node.values.value||''} onChange={e=>update(node.id,{values:{...node.values,value:e.target.value}})}/></label>}{flowPorts(node).map(port=>{
    const edge=value.edges.find(e=>e.to===node.id&&e.port===port)
    return <div className="flow-input-row" key={port}><button className={`flow-port input ${edge?'connected':''}`} data-flow-port={`${node.id}:${port}`} aria-label={`${flowNames[node.type]} ${port} 输入端口`} title={edge?'点击重新连接，双击断开':'点击连接'} {...editor.portEvents({id:node.id,port,direction:'in'})} onDoubleClick={e=>{e.stopPropagation();onChange({...value,edges:value.edges.filter(e=>e.id!==edge?.id)})}}/><label>{node.type==='code'?<input className="flow-port-name" defaultValue={port} aria-label={`输入名称 ${port}`} onBlur={e=>{const name=e.target.value.trim();if(name===port)return;if(!/^[A-Za-z_$][\w$]*$/.test(name)||flowPorts(node).includes(name)){e.target.value=port;setError('输入名称需为不重复的英文标识符');return}const values={...node.values,[name]:node.values[port]||''};delete values[port];onChange({...value,nodes:value.nodes.map(n=>n.id===node.id?{...n,values,ports:flowPorts(n).map(p=>p===port?name:p)}:n),edges:value.edges.map(edge=>edge.to===node.id&&edge.port===port?{...edge,port:name}:edge)})}}/>:port}{edge?<span className="flow-connected-value">← {flowNames[value.nodes.find(n=>n.id===edge.from)!.type]}</span>:<input aria-label={`${flowNames[node.type]} ${port} 默认值`} value={node.values[port]||''} placeholder={node.type==='return'?'请连接来源':'未连线时使用此值'} onChange={e=>update(node.id,{values:{...node.values,[port]:e.target.value}})}/>}</label>{node.type==='code'&&<button className="icon-button" title={`删除输入 ${port}`} onClick={()=>onChange({...value,nodes:value.nodes.map(n=>n.id===node.id?{...n,ports:flowPorts(n).filter(p=>p!==port)}:n),edges:value.edges.filter(e=>e.to!==node.id||e.port!==port)})}><X size={12}/></button>}</div>
  })}{node.type==='code'&&<div className="flow-code-body"><button className="add-inline" onClick={()=>{let count=flowPorts(node).length+1;while(flowPorts(node).includes(`arg${count}`))count++;update(node.id,{ports:[...flowPorts(node),`arg${count}`]})}}><Plus size={13}/> 添加输入</button><textarea aria-label="代码块内容" spellCheck={false} value={node.code||''} onChange={e=>update(node.id,{code:e.target.value})}/><button className="ghost" onClick={()=>setEditing(node.id)}><Code2 size={14}/> 展开代码与对象助手</button></div>}{(node.type==='entityMarkdown'||node.type==='memberMarkdown')&&<ObjectPicker world={world} value={node.object||{classId:'',entityId:'',path:[]}} onChange={object=>update(node.id,{object})} mode={node.type==='entityMarkdown'?'entity':'member'}/>} {node.type==='memberMarkdown'&&<label className="flow-value">输出格式<select aria-label="成员输出格式" value={node.values.format||'markdown'} onChange={e=>update(node.id,{values:{...node.values,format:e.target.value}})}><option value="markdown">完整 Markdown</option><option value="value">原始值（适合运算）</option></select></label>}</section>)}</div>{editor.box&&<div className="flow-selection-box" style={{left:pan.x+Math.min(editor.box.a.x,editor.box.b.x)*scale,top:pan.y+Math.min(editor.box.a.y,editor.box.b.y)*scale,width:Math.abs(editor.box.a.x-editor.box.b.x)*scale,height:Math.abs(editor.box.a.y-editor.box.b.y)*scale}}/>}<div className="flow-zoom">{Math.round(scale*100)}%</div>{error&&<div className="flow-error" role="alert">{error}</div>}</div><aside className={`flow-library ${libraryOpen?'is-open':''}`} inert={!libraryOpen} aria-hidden={!libraryOpen}><header className="flow-library-title"><h3>节点库</h3><button className="icon-button" title="收起节点库" aria-label="收起节点库" onClick={()=>setLibraryOpen(false)}><PanelRightClose size={18}/></button></header><div className="flow-library-scroll"><LibraryFolder title="操作">{(['add','subtract','multiply','divide','constant','code'] as const).map(palette)}</LibraryFolder><LibraryFolder title="文件操作">{(['entityMarkdown','memberMarkdown'] as const).map(palette)}</LibraryFolder><p>点击添加，或拖入画布。复杂逻辑可写在代码块中。</p></div></aside></div>{ghost&&<div className="flow-template-ghost" style={{left:ghost.point.x+10,top:ghost.point.y+10}}>{flowNames[ghost.type]}</div>}{codeNode&&<div className="modal-backdrop"><div className="modal flow-code-modal"><div className="flow-code-modal-title"><h2>代码块</h2><button className="icon-button" aria-label="关闭代码块编辑" onClick={()=>setEditing(null)}><X size={18}/></button></div><FunctionCodeEditor typed={typed} value={codeNode.code||''} onChange={code=>update(codeNode.id,{code})} world={world} block/><p className="muted">输入：{flowPorts(codeNode).map(p=>`inputs.${p}`).join('、')||'无'}；使用 return 返回值。</p></div></div>}</div>
}
