import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import '../src/ui/styles/index.css'
import DocumentWorkspace from '../src/ui/DocumentWorkspace'
import PageSession from '../src/ui/PageSession'
import {attributeFilterFixture} from './attributeFilterFixture'
import {activeTheme,themeStyle} from '../src/model/themes'
function Preview(){
 const [world,setWorld]=useState(()=>attributeFilterFixture().world),[memory]=useState(()=>new Map<string,unknown>()),[changes,setChanges]=useState(0)
 const doc=world.documents.find(d=>d.id==='things')!
 return <div className="app-shell" style={{...themeStyle(activeTheme({worlds:[world],activeWorldId:world.id}).colors),gridTemplateColumns:'1fr'}}><main className="main-area object-page"><header className="topbar"><output aria-label="源数据验收">修改 {changes} 次 · 旁支 {doc.entities[0].fields[0].children[2].value} · 红色 {doc.entities[0].fields[0].children[1].value}</output></header><PageSession memory={memory}><DocumentWorkspace world={world} doc={doc} onChange={next=>{setChanges(value=>value+1);setWorld({...world,documents:world.documents.map(d=>d.id===next.id?next:d)})}} onDelete={()=>{}}/></PageSession></main></div>
}
createRoot(document.getElementById('root')!).render(<Preview/> )
