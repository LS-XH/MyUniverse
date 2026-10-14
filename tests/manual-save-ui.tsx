import {createRoot} from 'react-dom/client'
import AppRoot from '../src/ui/AppRoot'
import {createWorld} from '../src/model/templates'
import {Workspace} from '../src/model/types'
import '../src/ui/style.css'
const world=createWorld('手动保存验收')
for(const id of ['people','relations']){
 const doc=world.documents.find(d=>d.id===id)!
 doc.entities=[{id:id+'-a',name:id==='people'?'测试人物':'测试关系',fields:doc.schema.filter(s=>!s.repeatable).map(s=>({id:s.id+'-v',schemaId:s.id,key:s.keyType==='Const'?s.key:'',value:'',children:[]}))}]
}
let persisted:Workspace={worlds:[world],activeWorldId:world.id,themeId:new URLSearchParams(location.search).get('theme')||'violet'},writes=0
Object.defineProperty(window,'localStorage',{value:{getItem:()=>JSON.stringify(persisted),setItem:(_key:string,value:string)=>{persisted=JSON.parse(value);writes++},removeItem:()=>{}},configurable:true})
const status=document.createElement('output');status.id='test-save-status';status.style.cssText='position:fixed;bottom:0;left:70px;z-index:1000;background:#101010;color:white;padding:3px;font-size:12px';document.body.append(status)
setInterval(()=>{status.textContent=`内存持久化 ${writes} 次；人物：${persisted.worlds[0]?.documents.find(d=>d.id==='people')?.entities[0]?.name}；关系：${persisted.worlds[0]?.documents.find(d=>d.id==='relations')?.entities[0]?.name}`},100)
createRoot(document.getElementById('root')!).render(<AppRoot/> )
