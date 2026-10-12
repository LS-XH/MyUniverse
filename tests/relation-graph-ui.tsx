import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import '../src/ui/styles/index.css'
import {relationGraphFixture} from './relationGraphFixture'
import {GraphPage} from '../src/ui/App'
import InterfaceConfigPage from '../src/ui/InterfaceConfigPage'
import PageSession from '../src/ui/PageSession'
import {activeTheme,themeStyle} from '../src/model/themes'
import {Workspace} from '../src/model/types'

function Preview(){
 const [world,setWorld]=useState(()=>relationGraphFixture().world),[config,setConfig]=useState(false),[theme,setTheme]=useState('violet')
 const [memory]=useState(()=>new Map<string,unknown>()),[opened,setOpened]=useState('')
 const view=Object.values(world.views!).find(v=>v.kind==='relationGraph')!,workspace:Workspace={worlds:[world],activeWorldId:world.id,themeId:theme}
 return <div className="app-shell" style={{...themeStyle(activeTheme(workspace).colors),gridTemplateColumns:'1fr'}}><main className="main-area object-page"><div className="topbar"><button className="ghost ui-surface ui-button" onClick={()=>setConfig(!config)}>{config?'返回关系类型网':'关系类型网配置'}</button><select aria-label="验收主题" value={theme} onChange={e=>setTheme(e.target.value)}><option value="violet">星雾蓝紫</option><option value="light">晨光浅色</option><option value="dark">经典暗黑</option></select><span role="status">{opened}</span></div><PageSession key={config?'config':'graph'} memory={memory}>{config?<InterfaceConfigPage world={world} view={view} onChange={setWorld} onDelete={()=>{}}/>:<GraphPage world={world} view={view} onChange={setWorld} onOpenPerson={id=>setOpened(`打开关系类型实例：${id}`)}/>}</PageSession></main></div>
}
createRoot(document.getElementById('root')!).render(<Preview/> )
