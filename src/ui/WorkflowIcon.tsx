import {ArrowDownUp,Database,FileBox,Folder,Sigma,Bot,Wrench,Binary} from 'lucide-react'
import {Letters,ScanBox,FileCodeCorner,SquareSparkles} from './LucideWorkflowIcons'
const icons={letters:Letters,scan:ScanBox,method:FileCodeCorner,sd:SquareSparkles}
export function LocalWorkflowIcon({name,size=16}:{name:keyof typeof icons;size?:number}){const Icon=icons[name];return <Icon className="workflow-type-icon" size={size} aria-hidden="true"/>}
export default function WorkflowIcon({kind,type}:{kind:string;type?:string}){
 if(kind==='valueMethod')return <LocalWorkflowIcon name="method"/>
 if(kind==='valueProperty')return <FileBox size={16}/>
 if(type==='String')return <LocalWorkflowIcon name="letters"/>
 if(type==='Boolean')return <Binary size={16}/>
 if(type)return <LocalWorkflowIcon name="scan"/>
 if(kind==='llm')return <Bot size={16}/>
 if(kind==='sd')return <LocalWorkflowIcon name="sd"/>
 if(kind==='tool')return <Wrench size={16}/>
 if(kind==='input'||kind==='return')return <ArrowDownUp size={16}/>
 if(kind==='world'||kind==='function')return <Database size={16}/>
 if(['add','subtract','multiply','divide','concat','constant'].includes(kind))return <Sigma size={16}/>
 return <Folder size={16}/>
}
