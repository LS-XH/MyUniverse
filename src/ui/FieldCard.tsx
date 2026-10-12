import {prepareCardMotion} from './cardMotion'
import { type HTMLAttributes, type PointerEvent } from 'react'

/** Keep pointer animation local to the DOM so editing never rerenders on movement. */
export default function FieldCard(props:HTMLAttributes<HTMLDivElement>) {
  const reset=(element:HTMLElement)=>{
    element.classList.remove('field-card-hovered')
  }
  const move=(event:PointerEvent<HTMLDivElement>)=>{
    const element=event.currentTarget
    if(event.pointerType==='touch'||!element.closest('.entity-fields,.schema-editor-content'))return
    // Only the innermost member is highlighted and enlarged.
    if((event.target as HTMLElement).closest('.field-card')!==element){reset(element);return}
    if(!element.classList.contains('field-card-hovered'))prepareCardMotion(element)
    element.classList.add('field-card-hovered')
  }
  return <div {...props} className={`${props.className||''} field-card ui-card--tilt ui-surface ui-card`} onPointerMove={move} onPointerLeave={event=>reset(event.currentTarget)}/>
}
