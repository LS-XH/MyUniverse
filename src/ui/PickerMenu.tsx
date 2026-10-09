import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Render above card and scroll containers while following the input's position. */
export default function PickerMenu({children,onClose,className=''}:{children:ReactNode;onClose:()=>void;className?:string}) {
  const anchor=useRef<HTMLSpanElement>(null),menu=useRef<HTMLDivElement>(null)
  const [position,setPosition]=useState({left:0,top:0,width:230,maxHeight:240,ready:false})
  useLayoutEffect(()=>{
    const host=anchor.current?.parentElement
    if(!host)return
    const update=()=>{
      if(menu.current){
        const theme=getComputedStyle(host)
        for(let i=0;i<theme.length;i++){const key=theme[i];if(key.startsWith('--'))menu.current.style.setProperty(key,theme.getPropertyValue(key))}
        menu.current.style.fontFamily=theme.fontFamily
      }
      const rect=host.getBoundingClientRect(),gap=6,margin=8
      const below=window.innerHeight-rect.bottom-gap-margin,above=rect.top-gap-margin
      const height=Math.min(240,Math.max(0,below>=180||below>=above?below:above))
      const width=Math.min(Math.max(230,rect.width),window.innerWidth-margin*2)
      setPosition({left:Math.max(margin,Math.min(rect.left,window.innerWidth-width-margin)),top:below>=180||below>=above?rect.bottom+gap:Math.max(margin,rect.top-gap-Math.min(menu.current?.scrollHeight||240,height)),width,maxHeight:height,ready:true})
    }
    const outside=(event:PointerEvent)=>{if(!host.contains(event.target as Node)&&!menu.current?.contains(event.target as Node))onClose()}
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();onClose()}}
    update()
    const observer=new ResizeObserver(update);observer.observe(host);if(menu.current)observer.observe(menu.current)
    window.addEventListener('scroll',update,true);window.addEventListener('resize',update)
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key)
    return()=>{observer.disconnect();window.removeEventListener('scroll',update,true);window.removeEventListener('resize',update);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)}
  },[onClose])
  return <><span ref={anchor} hidden/>{createPortal(<div ref={menu} className={`picker-menu floating-picker-menu ${className}`} style={{position:'fixed',zIndex:10020,left:position.left,top:position.top,width:position.width,maxHeight:position.maxHeight,minWidth:0,visibility:position.ready?'visible':'hidden'}}>{children}</div>,document.body)}</>
}
