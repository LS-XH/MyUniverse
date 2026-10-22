import type {CSSProperties} from 'react'
import type {ReferenceChoice} from '../model/referenceIndex'
import {toCssColor} from './ColorPicker'

export const referenceColorStyle=(color?:string):CSSProperties|undefined=>color?{'--reference-color':toCssColor(color)} as CSSProperties:undefined

export function ReferenceBadge({name}:{name:string}){
 return <span className="reference-class ui-badge--reference ui-surface ui-badge ui-badge--themed ui-badge--text">{name}</span>
}

/** One instance-row presentation for single selection and checkbox selection. */
export default function ReferenceOption({choice,onSelect,checkbox}:{choice:Pick<ReferenceChoice,'doc'|'entity'|'color'>;onSelect?:()=>void;checkbox?:{checked:boolean;onChange:(checked:boolean)=>void}}){
 const props={className:'ui-reference-option ui-surface ui-button ui-menu-item','data-reference-color':choice.color||undefined,style:referenceColorStyle(choice.color)}
 const content=<>{checkbox&&<input type="checkbox" aria-label={choice.entity.name} checked={checkbox.checked} onChange={event=>checkbox.onChange(event.target.checked)}/>}<ReferenceBadge name={choice.doc.name}/><span className="reference-option-name">{choice.entity.name}</span></>
 return checkbox?<label {...props}>{content}</label>:<button type="button" {...props} onClick={onSelect}>{content}</button>
}
