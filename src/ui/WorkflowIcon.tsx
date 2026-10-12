import {ArrowDownUp,Database,FileBox,Folder,Sigma,Bot,Wrench,Binary,Hash,Image,CircleHelp,Network,Repeat,GitBranch} from 'lucide-react'
import {Letters,ScanBox,FileCodeCorner,SquareSparkles} from './LucideWorkflowIcons'
function MessagesCircle(){return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 16a7 7 0 1 0-4-3l-1 4 5-1Z"/><path d="M10 18a7 7 0 0 0 9-2l3 1-1-4a7 7 0 0 0-3-7"/></svg>}
const icons={letters:Letters,scan:ScanBox,method:FileCodeCorner,sd:SquareSparkles}
export function LocalWorkflowIcon({name,size=16}:{name:keyof typeof icons;size?:number}){const Icon=icons[name];return <Icon className="workflow-type-icon" size={size} aria-hidden="true"/>}
export default function WorkflowIcon({kind,type}:{kind:string;type?:string}){
 if(kind==='valueMethod')return <LocalWorkflowIcon name="method"/>
 if(kind==='valueProperty')return <FileBox size={16}/>
 if(type==='Agents')return <Network size={16}/>
 if(kind==='agent')return <Network size={16}/>
 if(kind==='loop')return <Repeat size={16}/>
 if(kind==='condition')return <GitBranch size={16}/>
 if(type==='Tools')return <Wrench size={16}/>
 if(type==='Number')return <Hash size={16}/>
 if(type==='Messages')return <MessagesCircle/>
 if(type==='Image')return <Image size={16}/>
 if(type==='String')return <LocalWorkflowIcon name="letters"/>
 if(type==='Boolean')return <Binary size={16}/>
 if(type)return <LocalWorkflowIcon name="scan"/>
 if(kind==='llm'||kind==='llmBasic')return <Bot size={16}/>
 if(kind==='toolCalls')return <Wrench size={16}/>
 if(kind==='sd')return <LocalWorkflowIcon name="sd"/>
 if(kind==='tool')return <Wrench size={16}/>
 if(kind==='input'||kind==='return')return <ArrowDownUp size={16}/>
 if(kind==='world'||kind==='function')return <Database size={16}/>
 if(['add','subtract','multiply','divide','concat','constant'].includes(kind))return <Sigma size={16}/>
 return <Folder size={16}/>
}
export function PortTypeIcon({type}:{type:string}){const names:Record<string,string>={STRING:'String',NUMBER:'Number',INT:'Number',FLOAT:'Number',BOOLEAN:'Boolean',MESSAGES:'Messages',IMAGE_OBJECT:'Image',AGENTS:'Agents',TOOLS:'Tools',TOOL:'Tools'};return <span className="port-type-icon" title={names[type]||type}>{names[type]?<WorkflowIcon kind="variable" type={names[type]}/>:type==='ANY'?<CircleHelp size={14}/>:<FileBox size={14}/>}</span>}
