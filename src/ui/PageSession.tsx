import { createContext, useContext, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react'

export type PageMemory=Map<string,unknown>
const Context=createContext<PageMemory|null>(null)
export function usePageState<T>(key:string,initial:T|(()=>T)):[T,Dispatch<SetStateAction<T>>] {
  const memory=useContext(Context)
  const [value,setValue]=useState<T>(()=>memory?.has(key)?memory.get(key) as T:typeof initial==='function'?(initial as ()=>T)():initial)
  if(memory)memory.set(key,value)
  return [value,setValue]
}
const scrollSelector='.model-management-scroll,.page-scroll,.entity-list,.graph-config-content,.interface-config-body,.message-scroll,.markdown-code-editor,.flow-library'
export default function PageSession({memory,children}:{memory:PageMemory;children:ReactNode}) {
  const root=useRef<HTMLDivElement>(null)
  useLayoutEffect(()=>{
    root.current?.querySelectorAll<HTMLElement>(scrollSelector).forEach((el,index)=>{const saved=memory.get(`scroll:${index}`) as {top:number;left:number}|undefined;if(saved){el.scrollTop=saved.top;el.scrollLeft=saved.left}})
  },[memory])
  return <Context.Provider value={memory}><div className="page-session" ref={root} onScrollCapture={e=>{
    const el=e.target as HTMLElement,index=Array.from(root.current?.querySelectorAll(scrollSelector)||[]).indexOf(el)
    if(index>=0)memory.set(`scroll:${index}`,{top:el.scrollTop,left:el.scrollLeft})
  }}>{children}</div></Context.Provider>
}
