import {useState,type ReactNode} from 'react'
import {Folder,ChevronDown,ChevronRight} from 'lucide-react'
export default function LibraryFolder({title,icon,children}:{title:string;icon?:ReactNode;children:ReactNode}){const [open,setOpen]=useState(true);return <div className="library-tree-folder"><button className="flow-library-folder" aria-expanded={open} onClick={()=>setOpen(!open)}>{icon||<Folder size={16}/>}<span>{title}</span>{open?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</button>{open&&<div className="workflow-library-branch">{children}</div>}</div>}
