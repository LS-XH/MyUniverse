import {Workspace} from './types'

/** Render siblings in their stored order, rather than using CSS to reorder the DOM. */
export function orderedTreeEntries<T extends {key:string}>(workspace:Workspace,entries:T[]):T[]{
 const ranks=new Map((workspace.sidebarTreeOrder||[]).map((key,index)=>[key,index]))
 return entries.map((entry,index)=>({entry,index})).sort((a,b)=>(ranks.get(a.entry.key)??Number.MAX_SAFE_INTEGER)-(ranks.get(b.entry.key)??Number.MAX_SAFE_INTEGER)||a.index-b.index).map(({entry})=>entry)
}
