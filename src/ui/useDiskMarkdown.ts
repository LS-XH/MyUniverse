import {useEffect,useState} from 'react'
import {readDocumentMarkdown} from '../services/storage'

/** Observe a visible preview without importing the file or replacing JSON state. */
export default function useDiskMarkdown(worldId:string,fileName:string,enabled:boolean){
 const [disk,setDisk]=useState<{text:string|null;error?:string}|null>(null)
 useEffect(()=>{
  if(!enabled)return
  let stopped=false,inFlight=false,timer:ReturnType<typeof setTimeout>
  setDisk(null)
  const read=async()=>{
   if(stopped||inFlight)return
   clearTimeout(timer);inFlight=true
   try{
    const text=await readDocumentMarkdown(worldId,fileName)
    if(!stopped)setDisk(previous=>previous?.text===text&&!previous.error?previous:{text})
   }catch(failure){
    if(!stopped)setDisk(previous=>({text:previous?.text??null,error:String(failure)}))
   }finally{
    inFlight=false
    if(!stopped)timer=setTimeout(()=>{void read()},1000)
   }
  }
  const focus=()=>{void read()}
  void read();window.addEventListener('focus',focus)
  return()=>{stopped=true;clearTimeout(timer);window.removeEventListener('focus',focus)}
 },[enabled,worldId,fileName])
 return disk
}
