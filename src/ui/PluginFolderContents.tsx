import { Folder } from 'lucide-react'
import { PluginSection, Workspace } from '../model/types'

export default function PluginFolderContents({workspace,section,folderId,onOpen}:{workspace:Workspace;section:PluginSection;folderId:string|null;onOpen:(id:string)=>void}) {
  const folders=(workspace.pluginFolders||[]).filter(f=>f.section===section&&f.parentId===folderId)
  return <>{folders.map(folder=><button key={folder.id} className="collection-card ui-card--collection ui-surface ui-card ui-card--themed ui-card--text" onClick={()=>onOpen(folder.id)}><div className="collection-icon ui-icon-surface--collection collection ui-surface ui-icon-surface ui-icon-surface--themed ui-icon-surface--text"><Folder size={22}/></div><div><strong>{folder.name}</strong><span>文件夹</span></div></button>)}</>
}
