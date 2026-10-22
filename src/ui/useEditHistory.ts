import {useRef,useState} from 'react'
import {mergeThreeWay,sameData} from '../model/merge'
import {usePageRef} from './PageSession'

/** Page-scoped inverse patches preserve unrelated changes made on other pages. */
export default function useEditHistory<T>(value:T,save:(value:T)=>void,key:string,limit=50){
 const history=usePageRef<{past:{before:T;after:T}[];future:{before:T;after:T}[]}>('history:'+key,()=>({past:[],future:[]}))
 const live=useRef({value,save});live.current={value,save}
 const [,render]=useState(0)
 const commit=(next:T)=>{
  const {value:before,save}=live.current;if(sameData(before,next))return
  history.current.past.push({before,after:next});if(history.current.past.length>limit)history.current.past.shift()
  history.current.future=[];live.current.value=next;save(next);render(n=>n+1)
 }
 const restore=(undo:boolean)=>{
  const h=history.current,entry=(undo?h.past:h.future).pop();if(!entry)return
  const {value,save}=live.current
  const next=mergeThreeWay(undo?entry.after:entry.before,value,undo?entry.before:entry.after).value
  ;(undo?h.future:h.past).push(entry);live.current.value=next;save(next);render(n=>n+1)
 }
 return {commit,undo:()=>restore(true),redo:()=>restore(false),canUndo:!!history.current.past.length,canRedo:!!history.current.future.length}
}
