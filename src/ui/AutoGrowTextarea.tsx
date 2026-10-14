import {forwardRef,useLayoutEffect,useRef,type TextareaHTMLAttributes} from 'react'

/** Shared content textarea: preserve the caret and grow to the wrapped text. */
const AutoGrowTextarea=forwardRef<HTMLTextAreaElement,TextareaHTMLAttributes<HTMLTextAreaElement>>(function AutoGrowTextarea({className='',onInput,...props},forwardedRef){
 const element=useRef<HTMLTextAreaElement|null>(null)
 const fit=()=>{const el=element.current;if(!el)return;const long=(el.value.length>12000);el.classList.toggle('is-long-content',long);if(long){el.style.height='min(60vh, 600px)';el.style.overflowY='auto';return}el.style.overflowY='hidden';el.style.height='0px';const style=getComputedStyle(el);el.style.height=`${el.scrollHeight+(parseFloat(style.borderTopWidth)||0)+(parseFloat(style.borderBottomWidth)||0)}px`}
 useLayoutEffect(()=>{fit()},[props.value,props.defaultValue])
 useLayoutEffect(()=>{
  const el=element.current;if(!el)return
  let width=el.clientWidth,active=true
  const observer=new ResizeObserver(()=>{if(el.clientWidth===width)return;width=el.clientWidth;fit()})
  observer.observe(el)
  document.fonts.ready.then(()=>{if(active)fit()})
  return()=>{active=false;observer.disconnect()}
 },[])
 return <textarea {...props} className={`${className} ui-field--auto-grow`} ref={el=>{element.current=el;if(typeof forwardedRef==='function')forwardedRef(el);else if(forwardedRef)forwardedRef.current=el}} onInput={event=>{fit();onInput?.(event)}}/>
})
export default AutoGrowTextarea
