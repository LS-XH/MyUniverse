import {useEffect,useRef,type PointerEvent as ReactPointerEvent} from 'react'
import {nearestTreeTarget} from '../model/treeDragHit'
import {portalTheme} from './portalTheme'
import {preserveDragAppearance} from './dragAppearance'
/** Stable hit geometry and one insertion preview; horizontal indent expresses nesting. */
export default function useTreeDrag(onMove:(source:string,target:string,inside:boolean,after:boolean)=>void){
 const callback=useRef(onMove),cleanup=useRef<(()=>void)|null>(null);callback.current=onMove
 useEffect(()=>()=>cleanup.current?.(),[])
 return(event:ReactPointerEvent<HTMLElement>)=>{
  if(event.button!==0||!(event.target as HTMLElement).closest('.tree-main'))return
  const row=(event.target as HTMLElement).closest<HTMLElement>('[data-tree-id]');if(!row||row.dataset.treeReadonly==='true')return
  const source=row.dataset.treeId!,parts=source.split(':');if((parts[0]==='plugin'||parts[0]==='model')&&parts.at(-1)==='root')return
  cleanup.current?.()
  const region=event.currentTarget,unitFor=(item:HTMLElement)=>item.parentElement?.matches('.tree-node,.plugin-tree-node')?item.parentElement:item
  const unit=unitFor(row),display=unit.style.display,bounds=row.getBoundingClientRect(),start={x:event.clientX,y:event.clientY},scroller=row.closest<HTMLElement>('.projects-scroll,.organized-tree,.sidebar'),initialScroll=scroller?.scrollTop||0
  const placeholder=document.createElement('div');placeholder.className='tree-drop-placeholder ui-drag-preview--tree-placeholder ui-surface ui-drag-preview';placeholder.style.height=`${bounds.height}px`;placeholder.setAttribute('aria-hidden','true')
  const animations=new Map<HTMLElement,Animation>()
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let ghost:HTMLElement|null=null,active=false,target:HTMLElement|null=null,inside=false,after=false,x=start.x,y=start.y,frame=0
  let rows:{element:HTMLElement;top:number;bottom:number;left:number}[]=[],originTop=0,originBottom=0
  const compatible=(item:HTMLElement)=>{const to=item.dataset.treeId!.split(':'),root=parts[0]==='world'&&parts[2]==='root';return !unit.contains(item)&&parts[0]===to[0]&&(root?to[2]==='root':parts[1]===to[1])}
  const animate=(change:()=>void)=>{
   const elements=Array.from(region.querySelectorAll<HTMLElement>('[data-tree-id]')).filter(el=>el.getClientRects().length),before=elements.map(el=>el.getBoundingClientRect().top)
   animations.forEach(animation=>animation.cancel());animations.clear()
   change()
   if(!reduced)elements.forEach((el,i)=>{const delta=before[i]-el.getBoundingClientRect().top;if(delta)animations.set(el,el.animate([{transform:`translateY(${delta}px)`},{transform:'none'}],{duration:180,easing:'ease-out'}))})
  }
  const mark=()=>{
   const rect=region.getBoundingClientRect(),inRegion=x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom,scroll=(scroller?.scrollTop||0)-initialScroll
   // Keep the last slot outside the tree, and restore the original slot when revisited.
   if(!inRegion){target=null;return}
   if(y+scroll>=originTop&&y+scroll<=originBottom){if(placeholder.nextSibling!==unit)animate(()=>{unit.before(placeholder);placeholder.style.marginLeft='0';placeholder.dataset.dropMode='origin'});target=null;inside=false;after=false;return}
   const hit=nearestTreeTarget(rows,y+scroll)
   const next=hit?.element||null,worldRoot=parts[0]==='world'&&parts[2]==='root',root=next?.dataset.treeId?.endsWith(':root')||next?.dataset.treeId===`world:${parts[1]}:root`
   const nested=!!next&&!worldRoot&&next.dataset.treeFolder==='true'&&(root||x>=hit!.left+32),below=!!hit&&y+scroll>=(hit.top+hit.bottom)/2
   const nextAfter=nested?false:below
   if(next===target&&nested===inside&&nextAfter===after)return
   if(!next)return
   animate(()=>{target=next;inside=nested;after=nextAfter
    const targetUnit=unitFor(next);placeholder.style.marginLeft=nested?'20px':'0';placeholder.dataset.dropMode=nested?'inside':below?'after':'before'
    if(nested&&targetUnit!==next){const branch=Array.from(targetUnit.children).find(el=>el.matches('.tree-branch,.plugin-tree-branch,.plugin-tree-children,.ui-tree-branch'));if(branch)branch.prepend(placeholder);else targetUnit.append(placeholder)}else targetUnit.insertAdjacentElement(nested||below?'afterend':'beforebegin',placeholder)
   })
  }
  const scroll=()=>{if(active&&scroller){const rect=scroller.getBoundingClientRect(),before=scroller.scrollTop;scroller.scrollTop+=y<rect.top+35?-7:y>rect.bottom-35?7:0;if(scroller.scrollTop!==before)mark()}if(active)frame=requestAnimationFrame(scroll)}
  const move=(e:PointerEvent)=>{
   if(e.pointerId!==event.pointerId)return
   x=e.clientX;y=e.clientY;if(!active&&Math.hypot(x-start.x,y-start.y)<6)return;e.preventDefault()
   if(!active){active=true;ghost=row.cloneNode(true) as HTMLElement;preserveDragAppearance(row,ghost);ghost.classList.add('tree-drag-card','ui-drag-preview--tree','ui-surface','ui-drag-preview');ghost.removeAttribute('data-tree-id');ghost.inert=true;ghost.setAttribute('aria-hidden','true');for(const [key,value] of Object.entries(portalTheme(row)))ghost.style.setProperty(key,String(value));Object.assign(ghost.style,{width:`${bounds.width}px`,height:`${bounds.height}px`,margin:'0',pointerEvents:'none'});document.body.append(ghost)
    // Capture logical positions before lifting; previews must never feed back into hit testing.
    rows=Array.from(region.querySelectorAll<HTMLElement>('[data-tree-id]')).filter(item=>compatible(item)&&item.getClientRects().length).map(element=>{const rect=element.getBoundingClientRect();return {element,top:rect.top,bottom:rect.bottom,left:rect.left}})
    const unitBounds=unit.getBoundingClientRect(),unitStyle=getComputedStyle(unit);originTop=unitBounds.top;originBottom=unitBounds.bottom
    placeholder.style.height=`${unitBounds.height}px`;placeholder.style.margin=unitStyle.margin;placeholder.dataset.dropMode='origin'
    // Replace the source's footprint in one layout pass; never close and reopen the gap.
    unit.before(placeholder);unit.style.display='none'
    document.body.classList.add('tree-dragging');frame=requestAnimationFrame(scroll)
   }
   ghost!.style.left=`${x-(start.x-bounds.left)}px`;ghost!.style.top=`${y-(start.y-bounds.top)}px`;mark()
  }
  const stop=()=>{cancelAnimationFrame(frame);animations.forEach(animation=>animation.cancel());animations.clear();placeholder.remove();ghost?.remove();unit.style.display=display;document.body.classList.remove('tree-dragging');window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key);cleanup.current=null}
  const cancel=()=>stop(),key=(e:KeyboardEvent)=>{if(e.key==='Escape')stop()},up=(e:PointerEvent)=>{if(e.pointerId!==event.pointerId)return;const destination=target?.dataset.treeId;stop();if(active){const suppress=(click:MouseEvent)=>{click.preventDefault();click.stopImmediatePropagation()};window.addEventListener('click',suppress,{capture:true,once:true});setTimeout(()=>window.removeEventListener('click',suppress,true),0);if(destination)callback.current(source,destination,inside,after)}}
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',key);cleanup.current=stop
 }
}
