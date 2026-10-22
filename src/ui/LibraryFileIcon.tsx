import {Bot,Workflow} from 'lucide-react'
import {libraryIconPaths} from './libraryIconPaths'
/** Static inline SVGs inherit the theme and need no network or external SVG mask. */
export function LibraryAssetIcon({name,size=16}:{name:keyof typeof libraryIconPaths;size?:number}){
 const icon=libraryIconPaths[name]
 return <svg width={size} height={size} viewBox={icon.viewBox} fill="none" aria-hidden="true" data-library-icon={name} style={{flexShrink:0}}>{icon.paths.map((path,index)=><path key={index} {...path}/>)}</svg>
}
export default function LibraryFileIcon({kind,size=16}:{kind:'js'|'py'|'flow'|'sd'|'agent'|'llm';size?:number}){
 if(kind==='flow')return <Workflow size={size}/>
 if(kind==='llm')return <Bot size={size}/>
 return <LibraryAssetIcon size={size} name={kind==='js'?'fluent-javascript':kind==='py'?'fluent-python':kind==='sd'?'comfyui':'langgraph'}/>
}
