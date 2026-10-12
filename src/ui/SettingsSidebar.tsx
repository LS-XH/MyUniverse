import TreeDisclosure from './TreeDisclosure'
import { useState } from 'react'
import { Check, Palette, Plus } from 'lucide-react'
import { Theme, Workspace, uid } from '../model/types'
import { activeTheme, builtinThemes } from '../model/themes'
export function SettingsSidebar({workspace,onChange,}:{workspace:Workspace;onChange:(workspace:Workspace)=>void}) {
  const [themesOpen,setThemesOpen]=useState(true)
  const themes=[...builtinThemes,...(workspace.themes||[])]
  const create=()=>{const base=activeTheme(workspace),next:Theme={id:uid(),name:`我的主题 ${(workspace.themes||[]).length+1}`,colors:{...base.colors}};onChange({...workspace,themes:[...(workspace.themes||[]),next],themeId:next.id})}
  return <div className="settings-sidebar-content"><div className="settings-tree-parent"><button className="settings-tree-heading ui-tree-row--heading active ui-surface ui-tree-row" onDoubleClick={()=>setThemesOpen(!themesOpen)}><Palette size={17}/><span>主题</span></button><TreeDisclosure open={themesOpen} name="主题" onToggle={()=>setThemesOpen(!themesOpen)}/></div>{themesOpen&&<div className="settings-tree-branch ui-tree-branch">{themes.map(theme=><button className={`theme-nav-row ui-tree-row--theme ${workspace.themeId===theme.id?'active':''} ui-surface ui-tree-row`} key={theme.id} onClick={()=>{onChange({...workspace,themeId:theme.id})}}><span className="theme-mini" style={{background:theme.colors.surface,borderColor:theme.colors.border}}><i style={{background:theme.colors.accent}}/></span><span>{theme.name}</span>{workspace.themeId===theme.id&&<Check size={15}/>}</button>)}<button className="sidebar-add ui-tree-row--add ui-surface ui-tree-row" onClick={()=>{create()}}><Plus size={15}/> 新建主题</button></div>}</div>
}

