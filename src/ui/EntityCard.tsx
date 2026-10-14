import {useLayoutEffect,useRef,type HTMLAttributes} from 'react'
import {prepareCardMotion} from './cardMotion'

/** Recalculate fixed-pixel motion when expansion or wrapped content changes the size. */
export function useCardMotion<T extends HTMLElement>(){
 const ref=useRef<T|null>(null)
 useLayoutEffect(()=>{if(ref.current)prepareCardMotion(ref.current)})
 useLayoutEffect(()=>{const el=ref.current;if(!el)return;const observer=new ResizeObserver(()=>prepareCardMotion(el));observer.observe(el);return()=>observer.disconnect()},[])
 return ref
}
export default function EntityCard(props:HTMLAttributes<HTMLDivElement>){
 const ref=useCardMotion<HTMLDivElement>()
 return <div {...props} ref={ref}/>
}
