import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {createWorld} from '../src/model/templates'
import DocumentWorkspace from '../src/ui/DocumentWorkspace'
import '../src/ui/style.css'
import '../src/ui/theme.css'
const initial=createWorld('性能验收（不保存）')
initial.documents=[{...initial.documents[0],id:'long',name:'长文档',fileName:'长文档.md',schema:[{id:'text',key:'正文',keyType:'Const',valueType:'Content'},{id:'ref',key:'引用',keyType:'Const',valueType:'Class',classId:'targets'}],entities:[{id:'long-entity',name:'20万字实例',fields:[{id:'text-value',schemaId:'text',key:'正文',value:'长文档内容'.repeat(40000),children:[]},{id:'ref-value',schemaId:'ref',key:'引用',value:'',children:[]}]}]},{...initial.documents[0],id:'targets',name:'引用目标',fileName:'目标.md',schema:[],entities:Array.from({length:2000},(_,i)=>({id:`target-${i}`,name:`目标${i}`,fields:[]}))}]
function Fixture(){const [world,setWorld]=useState(initial);return <div className="main-area" style={{height:'100vh'}}><div className="topbar"><span>20 万字 / 2,000 引用目标 · 仅内存测试</span></div><DocumentWorkspace world={world} doc={world.documents[0]} onChange={doc=>setWorld(w=>({...w,documents:w.documents.map(d=>d.id===doc.id?doc:d)}))} onDelete={()=>{}}/></div>}
createRoot(document.getElementById('root')!).render(<Fixture/> )
