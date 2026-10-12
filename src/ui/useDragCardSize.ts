import {useLayoutEffect,useState,type RefObject} from 'react'

/** Measure the real renderer at world scale, never estimate from port counts. */
export default function useDragCardSize(container:RefObject<HTMLDivElement|null>,identity?:string){
 const [height,setHeight]=useState(0)
 useLayoutEffect(()=>{
  const node=container.current?.querySelector<HTMLElement>('.flow-node')
  if(!node){setHeight(0);return}
  const measure=()=>setHeight(node.getBoundingClientRect().height)
  measure();const observer=new ResizeObserver(measure);observer.observe(node)
  return()=>observer.disconnect()
 },[container,identity])
 return height
}
