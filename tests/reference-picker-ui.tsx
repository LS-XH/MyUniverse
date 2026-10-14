import EntityCard from '../src/ui/EntityCard'
import AutoGrowTextarea from '../src/ui/AutoGrowTextarea'
import DocumentAttributeFilter from '../src/ui/DocumentAttributeFilter'
import type {AttributeFilter} from '../src/model/attributeFilter'
import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import '../src/ui/styles/index.css'
import {createWorld} from '../src/model/templates'
import {builtinThemes,themeStyle} from '../src/model/themes'
import ReferencePicker from '../src/ui/ReferencePicker'
import GraphConfigPage from '../src/ui/GraphConfigPage'
import {preserveDragAppearance} from '../src/ui/dragAppearance'
import InterfaceConfigPage from '../src/ui/InterfaceConfigPage'
import {createInterfaceView} from '../src/model/interfaceViews'
const initial=createWorld('选择器验收')
const relations=initial.documents.find(d=>d.id==='relations')!
relations.entities=[{id:'red',name:'红色关系',fields:[]},{id:'green',name:'绿色关系',fields:[]}]
relations.labels=[{id:'red-label',name:'红色标签',color:'#FFEF7777'},{id:'green-label',name:'绿色标签',color:'#FF59C48D'}]
relations.entityLabels={red:'red-label',green:'green-label'}
initial.graph.lineStyles={red:{fill:'#FFEF7777',stroke:'#FFEF7777',glow:8,lineType:'实线',pattern:'纯色'}}
function Preview(){const [world,setWorld]=useState(initial),[selected,setSelected]=useState('red'),[theme,setTheme]=useState(builtinThemes[0].id),[filter,setFilter]=useState<AttributeFilter>({key:''}),[expandDemo,setExpandDemo]=useState(false),[map,setMap]=useState(false),[mapView,setMapView]=useState(()=>createInterfaceView(initial,'places','map','地图'));return <div style={{...themeStyle(builtinThemes.find(t=>t.id===theme)!.colors),minHeight:'100vh',padding:24,background:'var(--bg)',color:'var(--text)'}}><select aria-label="主题" value={theme} onChange={e=>setTheme(e.target.value)}>{builtinThemes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><button onClick={()=>setMap(!map)}>切换地图配置</button><button onClick={()=>{const source=document.querySelector<HTMLElement>(".graph-section-body > .graph-mapping-field"),host=document.getElementById("sort-preview-check");if(!source||!host)return;const clone=source.cloneNode(true) as HTMLElement;preserveDragAppearance(source,clone);clone.classList.add("sort-ghost","ui-drag-preview--sort","ui-surface","ui-drag-preview");clone.removeAttribute("data-sort-id");clone.inert=true;const rect=source.getBoundingClientRect();Object.assign(clone.style,{position:"relative",left:"0",top:"0",width:`${rect.width}px`,height:`${rect.height}px`,transform:"none"});host.replaceChildren(clone)}}>检查拖动预览</button><div id="sort-preview-check"/><DocumentAttributeFilter world={world} doc={world.documents.find(d=>d.id==="relations")!} filter={filter} onChange={setFilter}/><EntityCard className="entity-card ui-card--entity ui-surface ui-card ui-card--themed ui-card--text" data-testid="expand-motion-card" style={{width:280}}><div className="entity-header"><button onClick={()=>setExpandDemo(!expandDemo)}>展开动效验收</button></div>{expandDemo&&<div className="entity-fields" style={{height:600}}>展开后保持固定变化</div>}</EntityCard><h2>内容自动换行</h2><div className="text-reference text-reference-content" style={{width:280}}><AutoGrowTextarea aria-label="内容换行验收" defaultValue={"连续中文内容自动换行".repeat(30)+"\n"+"https://example.test/"+"long-reference".repeat(40)} className="ui-surface ui-field"/></div><h2>文件引用选择器</h2><ReferencePicker world={world} classId="relations" entityId={selected} ariaLabel="文件引用" onChange={(_,id)=>setSelected(id)}/>{map?<InterfaceConfigPage world={world} view={mapView} onChange={next=>{setWorld(next);setMapView(next.views![mapView.id])}} onDelete={()=>{}}/>:<GraphConfigPage world={world} onChange={setWorld}/>}</div>}
createRoot(document.getElementById('root')!).render(<Preview/> )
