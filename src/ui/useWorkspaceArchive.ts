import {useEffect,useRef,useState} from 'react'
import type {Workspace} from '../model/types'
import {checkpointWorkspace} from '../services/storage'
import {appLog} from '../services/runtimeLog'

/** A bounded-rate writer checkpoints whole JSON snapshots, never chasing a live stream indefinitely. */
export default function useWorkspaceArchive(workspace:Workspace,ready:boolean){
 const newest=useRef({workspace,revision:0}),written=useRef(-1),flight=useRef<Promise<void>|null>(null)
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),mounted=useRef(true),failed=useRef(false)
 const [status,setStatus]=useState<'saved'|'pending'|'error'>('saved'),[error,setError]=useState('')
 if(newest.current.workspace!==workspace)newest.current={workspace,revision:newest.current.revision+1}
 const schedule=()=>{if(timer.current!==undefined||!mounted.current||failed.current)return;timer.current=setTimeout(()=>{timer.current=undefined;void drain().catch(()=>{})},250)}
 const drain=():Promise<void>=>{
  if(flight.current)return flight.current
  if(written.current>=newest.current.revision)return Promise.resolve()
  const snapshot=newest.current
  const task=(async()=>{
   try{await checkpointWorkspace(snapshot.workspace);written.current=snapshot.revision;failed.current=false;if(mounted.current){setStatus(written.current>=newest.current.revision?'saved':'pending');setError('')}}
   catch(failure){appLog.error('JSON 存档',failure);failed.current=true;if(mounted.current){setStatus('error');setError(String(failure))}throw failure}
  })()
  flight.current=task.finally(()=>{flight.current=null;if(written.current<newest.current.revision)schedule()});return flight.current
 }
 const flush=async(snapshot?:Workspace)=>{
  if(snapshot&&snapshot!==newest.current.workspace)newest.current={workspace:snapshot,revision:newest.current.revision+1}
  // Wait for the revision requested now; edits arriving later are separately scheduled.
  const target=newest.current.revision;failed.current=false
  if(timer.current!==undefined){clearTimeout(timer.current);timer.current=undefined}
  while(written.current<target)await drain()
 }
 useEffect(()=>{if(!ready||written.current>=newest.current.revision)return;failed.current=false;setStatus('pending');schedule()},[workspace,ready])
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;clearTimeout(timer.current);timer.current=undefined}},[])
 useEffect(()=>{if(!ready||status==='saved')return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';void flush().catch(()=>{})};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[ready,status])
 return {status,error,flush}
}
