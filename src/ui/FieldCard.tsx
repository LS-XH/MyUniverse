import { useRef, type HTMLAttributes, type PointerEvent } from 'react'

/** Keep pointer animation local to the DOM so editing never rerenders on movement. */
export default function FieldCard(props:HTMLAttributes<HTMLDivElement>) {
  const bounds=useRef<DOMRect|null>(null)
  const reset=(element:HTMLElement)=>{
    element.style.setProperty('--field-rotate-x','0deg')
    element.style.setProperty('--field-rotate-y','0deg')
    element.classList.remove('field-card-hovered')
    bounds.current=null
  }
  const move=(event:PointerEvent<HTMLDivElement>)=>{
    const element=event.currentTarget
    if(event.pointerType==='touch'||!element.closest('.entity-fields,.schema-editor-content'))return
    // Nested members receive their own effect without tilting all their ancestors.
    if((event.target as HTMLElement).closest('.field-card')!==element){reset(element);return}
    const rect=bounds.current||(bounds.current=element.getBoundingClientRect())
    const x=Math.max(-1,Math.min(1,(event.clientX-rect.left)/rect.width*2-1))
    const y=Math.max(-1,Math.min(1,(event.clientY-rect.top)/rect.height*2-1))
    element.style.setProperty('--field-rotate-x',`${-y*1.6}deg`)
    element.style.setProperty('--field-rotate-y',`${x*1.6}deg`)
    element.classList.add('field-card-hovered')
  }
  return <div {...props} className={`${props.className||''} field-card`} onPointerMove={move} onPointerLeave={event=>reset(event.currentTarget)}/>
}
