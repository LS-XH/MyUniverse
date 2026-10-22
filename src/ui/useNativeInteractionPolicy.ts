import {useEffect} from 'react'

const interactiveRoles=new Set(['button','link','textbox','combobox','listbox','option','checkbox','radio','switch','slider','spinbutton','tab','treeitem','menuitem','menuitemcheckbox','menuitemradio'])
function interactive(element:HTMLElement){
 if(element.matches('input,textarea'))return !element.matches(':disabled,[readonly],[aria-readonly="true"]')
 if(element.matches('[aria-readonly="true"]'))return false
 return element.isContentEditable||element.matches('button,a[href],select,summary,audio[controls],video[controls]')||interactiveRoles.has(element.getAttribute('role')||'')
}

/** Keep native Tab traversal, while excluding readonly fields and implicit scroll-container stops. */
export default function useNativeInteractionPolicy(){
 useEffect(()=>{
  const suppressed=new Map<HTMLElement,string|null>()
  const prepare=(event:KeyboardEvent)=>{
   if(event.key!=='Tab'||event.ctrlKey||event.metaKey||event.altKey)return
   for(const [element,previous] of suppressed){
    if(!element.isConnected){suppressed.delete(element);continue}
    if(interactive(element)){if(previous===null)element.removeAttribute('tabindex');else element.setAttribute('tabindex',previous);suppressed.delete(element)}
   }
   const stops:HTMLElement[]=[]
   document.querySelectorAll<HTMLElement>('input[readonly],textarea[readonly],[aria-readonly="true"],[tabindex],div,main,aside,section,article,nav,pre,ul,ol').forEach(element=>{
    if(element.tabIndex<0&&element.hasAttribute('tabindex')||interactive(element)||element.closest('[inert]'))return
    if(element.matches('input[readonly],textarea[readonly],[aria-readonly="true"],[tabindex]')){stops.push(element);return}
    // Chromium can otherwise insert overflow containers into the tab sequence implicitly.
    if(element.scrollHeight<=element.clientHeight+1&&element.scrollWidth<=element.clientWidth+1)return
    const style=getComputedStyle(element)
    if(/auto|scroll/.test(style.overflowX+' '+style.overflowY))stops.push(element)
   })
   // Apply after measuring, so each Tab does not alternate layout reads and writes.
   stops.forEach(element=>{if(!suppressed.has(element))suppressed.set(element,element.getAttribute('tabindex'));element.tabIndex=-1})
  }
  window.addEventListener('keydown',prepare,true)
  return()=>{window.removeEventListener('keydown',prepare,true);suppressed.forEach((previous,element)=>{if(previous===null)element.removeAttribute('tabindex');else element.setAttribute('tabindex',previous)})}
 },[])
}
