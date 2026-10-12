import type {CSSProperties} from 'react'
import {themeFields} from '../model/themes'
/** Copy theme and reusable tokens, never the trigger's own surface parameters. */
export function portalTheme(element:HTMLElement):CSSProperties {
 const style=getComputedStyle(element)
 const keys=new Set(themeFields.map(({key})=>`--${key}`))
 for(let i=0;i<style.length;i++){
  const key=style[i]
  if(/^--ui-(duration-|radius-\d|shadow-|scrim$)/.test(key))keys.add(key)
 }
 return Object.fromEntries([...keys].map(key=>[key,style.getPropertyValue(key)])) as CSSProperties
}
