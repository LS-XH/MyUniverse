import {useCardMotion} from './EntityCard'
import {prepareCardMotion} from './cardMotion'
import {Children,cloneElement,isValidElement,useState,type ReactNode,type ReactElement} from 'react'
import SortHandle,{reorder} from './SortHandle'

type CardProps={title:string;actions?:ReactNode;children:ReactNode;className?:string;sortId?:string;onMove?:(from:string,to:string,after:boolean)=>void}
/** Always-open configuration card sharing the file workspace's instance skin. */
export default function ConfigCard({title,actions,children,className='',sortId,onMove}:CardProps){
 const motionRef=useCardMotion<HTMLElement>()
 return <section ref={motionRef} onPointerEnter={e=>prepareCardMotion(e.currentTarget)} data-sort-id={sortId} className={`entity-card ui-card--entity ui-surface ui-card ui-card--themed ui-card--text config-instance-card ${className}`}><div className="entity-header">{sortId&&onMove&&<SortHandle id={sortId} onMove={onMove}/>}<strong>{title}</strong>{actions}</div><div className="entity-fields">{children}</div></section>
}
/** Section ordering is a local display preference; it never alters view bindings. */
export function ConfigCardList({children,className=''}:{children:ReactNode;className?:string}){
 const [order,setOrder]=useState<string[]>([])
 const cards=Children.toArray(children).filter(isValidElement).map((card,index)=>({id:String(card.key??index),card:card as ReactElement<CardProps>}))
 const sorted=[...cards].sort((a,b)=>{const ai=order.indexOf(a.id),bi=order.indexOf(b.id);return (ai<0?order.length+cards.indexOf(a):ai)-(bi<0?order.length+cards.indexOf(b):bi)})
 return <div className={className}>{sorted.map(({id,card})=>cloneElement(card,{sortId:id,onMove:(from,to,after)=>setOrder(reorder(sorted,from,to,after).map(x=>x.id))}))}</div>
}
