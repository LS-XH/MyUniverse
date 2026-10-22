import {isSystemFolder} from '../model/toolRoles'
import {Folder,FolderCog} from 'lucide-react'
import {ModelSection,Workspace} from '../model/types'
export default function ModelFolderContents({workspace,section,folderId,onOpen}:{workspace:Workspace;section:ModelSection;folderId:string|null;onOpen?:(id:string)=>void}){
 return <div className="collection-grid">{workspace.modelFolders?.filter(f=>f.section===section&&f.parentId===folderId).map(f=><button className="collection-card ui-surface ui-card ui-card--themed ui-card--text" key={f.id} onClick={()=>onOpen?.(f.id)}>{isSystemFolder(f.id)?<FolderCog size={24}/>:<Folder size={24}/>}<div><strong>{f.name}</strong><span>文件夹</span></div></button>)}</div>
}
