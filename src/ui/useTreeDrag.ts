import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { portalTheme } from './portalTheme'

/** Preview stays in the DOM; only the final valid drop changes workspace data. */
export default function useTreeDrag(onMove:(source:string,target:string,inside:boolean,after:boolean)=>void){
  const callback=useRef(onMove),cleanup=useRef<(()=>void)|null>(null);callback.current=onMove
  useEffect(()=>()=>cleanup.current?.(),[])
  return (event:ReactPointerEvent<HTMLElement>)=>{
    if(event.button!==0||!(event.target as HTMLElement).closest('.tree-main'))return
    const row=(event.target as HTMLElement).closest<HTMLElement>('[data-tree-id]');if(!row)return
    const source=row.dataset.treeId!;if(source.startsWith('plugin:')&&source.endsWith(':root'))return
    cleanup.current?.()
    const unitFor=(row:HTMLElement)=>row.parentElement?.matches('.tree-node,.plugin-tree-node')?row.parentElement:row
    const unit=unitFor(row),display=unit.style.display,bounds=row.getBoundingClientRect(),origin={x:event.clientX,y:event.clientY},offset={x:event.clientX-bounds.left,y:event.clientY-bounds.top}
    let ghost:HTMLElement|null=null,target:HTMLElement|null=null,inside=false,after=false,active=false,frame=0,lastX=origin.x,lastY=origin.y
    const placeholder=document.createElement('div');placeholder.className='tree-drop-placeholder ui-drag-preview--tree-placeholder ui-surface ui-drag-preview';placeholder.style.height=`${bounds.height}px`;placeholder.setAttribute('aria-hidden','true')
    const region=event.currentTarget,reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const clearTarget=()=>{target?.classList.remove('tree-drop-inside');placeholder.remove()}
    const animateLayout=(change:()=>void)=>{
      const rows=Array.from(region.querySelectorAll<HTMLElement>('[data-tree-id]')),positions=rows.map(r=>r.getBoundingClientRect().top)
      change()
      if(!reduced)rows.forEach((r,i)=>{const delta=positions[i]-r.getBoundingClientRect().top;if(delta&&r.getClientRects().length){r.getAnimations().forEach(a=>a.cancel());r.animate([{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],{duration:180,easing:'ease-out'})}})
    }
    const mark=()=>{
      if(placeholder.isConnected){const rect=placeholder.getBoundingClientRect();if(lastX>=rect.left&&lastX<=rect.right&&lastY>=rect.top&&lastY<=rect.bottom)return}
      const candidate=document.elementFromPoint(lastX,lastY)?.closest<HTMLElement>('[data-tree-id]')||null
      const from=source.split(':'),to=candidate?.dataset.treeId?.split(':')||[]
      const worlds=from[0]==='world'&&from[2]==='root'&&to[0]==='world'&&to[2]==='root'
      let next=candidate
      if(!next||unit.contains(next)||from[0]!==to[0]||(!worlds&&from[1]!==to[1])||(from[0]==='world'&&from[2]==='root'&&!worlds))next=null
      const rect=next?.getBoundingClientRect(),fraction=rect?(lastY-rect.top)/rect.height:0
      const nextInside=!worlds&&next?.dataset.treeFolder==='true'&&fraction>.25&&fraction<.75,nextAfter=fraction>=.5
      if(next&&!nextInside&&to.at(-1)==='root'&&!worlds)next=null
      if(next===target&&nextInside===inside&&nextAfter===after)return
      animateLayout(()=>{clearTarget();target=next;inside=!!nextInside;after=nextAfter
        if(!target)return
        if(inside)target.classList.add('tree-drop-inside')
        else{const targetUnit=unitFor(target);placeholder.style.order=String(Number(targetUnit.style.order||0)+(after?.5:-.5));targetUnit.insertAdjacentElement(after?'afterend':'beforebegin',placeholder)}
      })
    }
    const scroll=()=>{const container=row.closest<HTMLElement>('.projects-scroll,.sidebar');if(container&&active){const rect=container.getBoundingClientRect(),before=container.scrollTop;container.scrollTop+=lastY<rect.top+35?-7:lastY>rect.bottom-35?7:0;if(before!==container.scrollTop)mark();frame=requestAnimationFrame(scroll)}}
    const move=(e:PointerEvent)=>{
      if(e.pointerId!==event.pointerId)return
      if(!active&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)<6)return
      e.preventDefault();lastX=e.clientX;lastY=e.clientY
      if(!active){active=true;ghost=row.cloneNode(true) as HTMLElement;ghost.classList.add('tree-drag-card','ui-drag-preview--tree','ui-surface','ui-drag-preview');ghost.removeAttribute('data-tree-id');ghost.setAttribute('aria-hidden','true');ghost.inert=true
        // The clone leaves the sidebar, so preserve styles supplied by its ancestors.
        const originals=[row,...Array.from(row.querySelectorAll<HTMLElement | SVGElement>('*'))]
        const copies=[ghost,...Array.from(ghost.querySelectorAll<HTMLElement | SVGElement>('*'))]
        const presentation=['display','align-items','justify-content','gap','padding','box-sizing','font-family','font-size','font-weight','line-height','letter-spacing','color','flex','flex-shrink','min-width','max-width','width','height','overflow','text-overflow','white-space','opacity']
        originals.forEach((original,index)=>{const computed=getComputedStyle(original),copy=copies[index]
          presentation.forEach(key=>copy.style.setProperty(key,computed.getPropertyValue(key)))
          copy.style.pointerEvents='none'
        })
        for(const [key,value] of Object.entries(portalTheme(row)))ghost.style.setProperty(key,String(value))
        Object.assign(ghost.style,{width:`${bounds.width}px`,minWidth:`${bounds.width}px`,maxWidth:`${bounds.width}px`,height:`${bounds.height}px`,margin:'0',border:'none',outline:'none',transform:'none'});document.body.append(ghost)
        animateLayout(()=>{unit.style.display='none'});document.body.classList.add('tree-dragging');frame=requestAnimationFrame(scroll)
      }
      ghost!.style.left=`${lastX-offset.x}px`;ghost!.style.top=`${lastY-offset.y}px`;mark()
    }
    const stop=()=>{cancelAnimationFrame(frame);clearTarget();ghost?.remove();unit.style.display=display;document.body.classList.remove('tree-dragging');window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',key);window.removeEventListener('blur',cancel);cleanup.current=null}
    const cancel=()=>stop(),key=(e:KeyboardEvent)=>{if(e.key==='Escape')stop()}
    const up=(e:PointerEvent)=>{if(e.pointerId!==event.pointerId)return;const destination=target?.dataset.treeId;stop();if(active){const suppress=(click:MouseEvent)=>{click.preventDefault();click.stopImmediatePropagation()};window.addEventListener('click',suppress,{capture:true,once:true});setTimeout(()=>window.removeEventListener('click',suppress,true),0);if(destination)callback.current(source,destination,inside,after)}}
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',key);window.addEventListener('blur',cancel);cleanup.current=stop
  }
}
