import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import '../src/ui/styles/index.css'
import {personRepeatedFixture} from './relationGraphFixture'
import {GraphPage} from '../src/ui/App'
import PageSession from '../src/ui/PageSession'
import {activeTheme,themeStyle} from '../src/model/themes'
function Preview(){
 const [world,setWorld]=useState(()=>personRepeatedFixture().world),[memory]=useState(()=>new Map<string,unknown>())
 const view=Object.values(world.views!).find(v=>v.kind==='graph')!
 return <div className="app-shell" style={{...themeStyle(activeTheme({worlds:[world],activeWorldId:world.id}).colors),gridTemplateColumns:'1fr'}}><main className="main-area object-page"><PageSession memory={memory}><GraphPage world={world} view={view} onChange={setWorld} onOpenPerson={()=>{}}/></PageSession></main></div>
}
createRoot(document.getElementById('root')!).render(<Preview/> )
