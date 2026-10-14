import {createRoot} from 'react-dom/client'
import AppRoot from '../src/ui/AppRoot'
import {runtimeFixture} from './jsonRuntimeFixture'
import {documentMarkdown} from '../src/model/markdown'
import '../src/ui/style.css'

const fixture=runtimeFixture(2)
fixture.fn.code='function transform(self,input){input.add("item",values.text("刷新结果"));}'
let archive=structuredClone(fixture.workspace),reads=0
const files=Object.fromEntries(fixture.world.documents.map(doc=>[doc.fileName,documentMarkdown(doc).replaceAll('用户前','磁盘输入')]))
Object.defineProperty(window,'localStorage',{value:{getItem:()=>JSON.stringify(archive),setItem:(_key:string,text:string)=>{archive=JSON.parse(text)},removeItem:()=>{}},configurable:true})
Object.assign(window,{isTauri:true,__TAURI_INTERNALS__:{invoke:async(command:string,args:any)=>{
 if(command==='load_workspace')return structuredClone(archive)
 if(command==='checkpoint_workspace'){archive=JSON.parse(args.text);return}
 if(command==='read_document_files'){reads++;return Object.fromEntries(Object.entries(args.requests as Record<string,string[]>).map(([id,names])=>[id,Object.fromEntries(names.map(name=>[name,files[name]??null]))]))}
 if(command==='export_workspace')return
 throw new Error(`Unexpected command: ${command}`)
}}})
const status=document.createElement('output');status.style.cssText='position:fixed;bottom:0;left:70px;z-index:1000;background:#101010;color:white;padding:4px;font-size:12px';status.setAttribute('aria-label','刷新验收结果');document.body.append(status)
setInterval(()=>{const doc=archive.worlds[0].documents.find(d=>d.id===fixture.doc.id);status.textContent=`读取 MD ${reads} 次 · 输入 ${doc?.entities[0].fields[0].children[0].value} · 生成 ${doc?.entities.map(e=>e.fields[0].children[1].value).join(' / ')}`},100)
createRoot(document.getElementById('root')!).render(<AppRoot/> )
