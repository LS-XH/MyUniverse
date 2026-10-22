import {Hammer,FileCode2,Wrench,BrainCircuit,Network} from 'lucide-react'
import {LocalWorkflowIcon} from './WorkflowIcon'
export default function LibraryIcon({kind}:{kind:'skills'|'functions'|'tools'|'llm'|'sd'|'agents'}){
 const Icon=kind==='skills'?Hammer:kind==='functions'?FileCode2:kind==='tools'?Wrench:kind==='llm'?BrainCircuit:Network
 return kind==='sd'?<LocalWorkflowIcon name="sd"/>:<Icon size={16}/>
}
