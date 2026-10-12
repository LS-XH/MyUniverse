import {createRoot} from 'react-dom/client'
import AppRoot from '../src/ui/AppRoot'
import '../src/ui/styles/index.css'
import {relationGraphFixture} from './relationGraphFixture'
const {world}=relationGraphFixture()
let persisted={worlds:[world],activeWorldId:world.id},writes=0
Object.defineProperty(window,'localStorage',{value:{getItem:()=>JSON.stringify(persisted),setItem:(_key:string,value:string)=>{persisted=JSON.parse(value);writes++},removeItem:()=>{}},configurable:true})
const status=document.createElement('output');status.style.cssText='position:fixed;bottom:0;left:70px;z-index:1000;background:#101010;color:white;padding:3px;font-size:12px';document.body.append(status)
setInterval(()=>{status.textContent=`内存持久化 ${writes} 次；已保存视图 ${Object.keys(persisted.worlds[0].views||{}).length}`},100)
createRoot(document.getElementById('root')!).render(<AppRoot/> )
