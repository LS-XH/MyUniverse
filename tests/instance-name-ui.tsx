import React,{useEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import '../src/ui/styles/index.css'
import DocumentWorkspace from '../src/ui/DocumentWorkspace'
import {createWorld} from '../src/model/templates'
import {themeStyle,activeTheme} from '../src/model/themes'
import type {ClassDocument,Workspace} from '../src/model/types'
import {functionJobs} from '../src/services/functions'
const initial=createWorld('性能验收世界')
const doc:ClassDocument={id:'places-test',name:'地点',fileName:'地点.md',schema:[{id:'description',key:'描述',keyType:'Const',valueType:'Content',functionIds:['reader']}],entities:Array.from({length:400},(_,i)=>({id:`place-${i}`,name:i?`地点 ${i}`:'新地点',fields:[{id:`description-${i}`,schemaId:'description',key:'描述',value:'示例描述\n'.repeat(6),children:[]}]}))}
initial.documents=[doc]
function Preview(){
 const [world,setWorld]=useState(initial),[stats,setStats]=useState({scans:0,scanMs:0,maxGap:0}),latest=useRef(world);latest.current=world
 const workspace:Workspace={worlds:[world],activeWorldId:world.id,functions:[{id:'reader',name:'读取描述',language:'js',apiVersion:2,returnType:{type:'Text'},code:'function transform(self,input){return input.to_value()}'}]}
 useEffect(()=>{let last=performance.now();const timer=setInterval(()=>{const now=performance.now(),gap=now-last;last=now;const start=performance.now();functionJobs({...workspace,worlds:[latest.current]});const ms=performance.now()-start;setStats(value=>({scans:value.scans+1,scanMs:ms,maxGap:Math.max(value.maxGap,gap)}))},500);return()=>clearInterval(timer)},[])
 return <div className="app-shell" style={themeStyle(activeTheme(workspace).colors)}><main className="main-area"><header className="topbar"><strong>实例名称性能验收 · 400 个实例（仅内存）</strong><output aria-label="性能记录">扫描 {stats.scans} 次 · 最近 {stats.scanMs.toFixed(1)} ms · 最大间隔 {stats.maxGap.toFixed(1)} ms</output></header><DocumentWorkspace world={world} doc={world.documents[0]} onChange={next=>setWorld({...latest.current,documents:[next]})} onDelete={()=>{}}/></main></div>
}
createRoot(document.getElementById('root')!).render(<Preview/> )
