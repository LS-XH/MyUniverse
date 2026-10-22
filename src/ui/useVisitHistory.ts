import {useEffect,useLayoutEffect,useRef} from 'react'
import {VisitHistory} from '../model/visitHistory'
/** Only route snapshots enter this history; world edits/drafts remain in their own stores. */
export default function useVisitHistory<T>(route:T,restore:(route:T)=>void,enabled:boolean){
 const history=useRef(new VisitHistory<T>()),apply=useRef(restore);apply.current=restore
 useLayoutEffect(()=>{if(enabled)history.current.record(route)},[JSON.stringify(route),enabled])
 useEffect(()=>{if(!enabled)return
  const go=(delta:number)=>{const next=history.current.step(delta);if(next)apply.current(next)}
  const pointer=(event:PointerEvent)=>{if(event.button===3||event.button===4){event.preventDefault();event.stopPropagation();go(event.button===3?-1:1)}}
  const suppress=(event:MouseEvent)=>{if(event.button===3||event.button===4){event.preventDefault();event.stopPropagation()}}
  const key=(event:KeyboardEvent)=>{if(event.altKey&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();go(event.key==='ArrowLeft'?-1:1)}}
  window.addEventListener('pointerdown',pointer,true);window.addEventListener('mousedown',suppress,true);window.addEventListener('mouseup',suppress,true);window.addEventListener('auxclick',suppress,true);window.addEventListener('keydown',key)
  return()=>{window.removeEventListener('pointerdown',pointer,true);window.removeEventListener('mousedown',suppress,true);window.removeEventListener('mouseup',suppress,true);window.removeEventListener('auxclick',suppress,true);window.removeEventListener('keydown',key)}
 },[enabled])
}
