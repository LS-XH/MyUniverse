import React,{useEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {runtimeFixture} from './jsonRuntimeFixture'
import {recomputeFunctions} from '../src/services/recompute'
import {background} from '../src/services/background'
import {publishImportedDocument} from '../src/services/storage'
import {DocumentEditor} from '../src/ui/App'
import DocumentWorkspace from '../src/ui/DocumentWorkspace'
import {FunctionContext} from '../src/ui/FunctionContext'
import {FileActionsContext} from '../src/ui/FileActionsContext'
import PageSession from '../src/ui/PageSession'
import {themeStyle,builtinThemes} from '../src/model/themes'
import {documentMarkdown} from '../src/model/markdown'
import '../src/ui/style.css'

function Demo(){
 const initial=useRef(runtimeFixture(8)),[workspace,setWorkspace]=useState(initial.current.workspace),latest=useRef(workspace);latest.current=workspace
 const [ticks,setTicks]=useState(0),[done,setDone]=useState(0),[busy,setBusy]=useState(false),[status,setStatus]=useState('待执行'),controller=useRef<AbortController|null>(null)
 const memory=useRef(new Map()),world=workspace.worlds[0],doc=world.documents[0]
 useEffect(()=>{const timer=setInterval(()=>setTicks(n=>n+1),50);return()=>clearInterval(timer)},[])
 const update=(change:(v:typeof workspace)=>typeof workspace)=>{const next=change(latest.current);latest.current=next;setWorkspace(next)}
 const run=async(hang=false)=>{
  if(busy)return
  const copy={...latest.current,functions:latest.current.functions!.map(fn=>({...fn,code:hang?'function transform(self,input){while(true){}}':'function transform(self,input){const end=Date.now()+250;while(Date.now()<end){};input.add("item",values.text("新版"));}'}))};latest.current=copy;setWorkspace(copy)
  const active=new AbortController();controller.current=active;setBusy(true);setDone(0);setStatus('计算中')
  try{await recomputeFunctions(()=>latest.current,update,{worldId:world.id,docId:doc.id},n=>setDone(n),active.signal);setStatus('完成')}catch(error){setStatus(active.signal.aborted?'已取消':String(error))}finally{setBusy(false);controller.current=null}
 }
 const importAll=async()=>{
  const active=new AbortController();controller.current=active;setBusy(true);setDone(0);setStatus('导入中')
  try{const before=latest.current.worlds[0].documents[0],text=documentMarkdown(before).replaceAll('用户前','导入前'),parsed=await background('parse',{text,doc:before,world:latest.current.worlds[0],options:{enforceGeneratedReadOnly:false}},active.signal)
   await publishImportedDocument(before,parsed,world.id,{signal:active.signal,onProgress:p=>{update(v=>({...v,worlds:v.worlds.map(w=>w.id===world.id?{...w,documents:w.documents.map(d=>d.id===doc.id?p.document:d)}:w)}));setDone(p.completed)}});setStatus('导入完成')
  }catch(error){setStatus(String(error))}finally{setBusy(false);controller.current=null}
 }
 return <div className="app-shell" style={{...themeStyle(builtinThemes[0].colors),display:'flex'}}><main className="main-area"><div className="topbar"><button disabled={busy} onClick={()=>{void run()}}>执行八个耗时函数</button><button disabled={busy} onClick={()=>{void run(true)}}>执行死循环函数</button><button disabled={!busy} onClick={()=>controller.current?.abort()}>停止后台执行</button><button disabled={busy} onClick={()=>{void importAll()}}>导入内存 MD</button><output aria-label="运行验收">心跳 {ticks} · 完成 {done}/8 · {status} · 新版 {doc.entities.filter(e=>e.fields[0].children.some(f=>f.value==='新版')).length}</output></div><PageSession memory={memory.current}><FunctionContext.Provider value={workspace.functions||[]}><FileActionsContext.Provider value={{save:()=>{},refresh:()=>{},busy,recompute:()=>{void run()},savedDocument:initial.current.doc}}><DocumentWorkspace world={world} doc={doc} onChange={next=>update(v=>({...v,worlds:v.worlds.map(w=>({...w,documents:w.documents.map(d=>d.id===doc.id?next:d)}))}))} onDelete={()=>{}}/></FileActionsContext.Provider></FunctionContext.Provider></PageSession></main></div>
}
void DocumentEditor
createRoot(document.getElementById('root')!).render(<Demo/> )
