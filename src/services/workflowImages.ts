import {invoke,isTauri} from '@tauri-apps/api/core'
import {ImageValue} from '../model/workflowValues'
import {modelImage} from './modelHttp'
export async function workflowImageAction(action:'save'|'display',image:ImageValue,filename?:string):Promise<void>{
 if(action==='display')return // The workflow run panel renders Image values in the execution trace.
 const name=(filename||image.filename||'workflow-image.png').trim();if(!name||/[\\/:<>"|?*]/.test(name)||name==='.'||name==='..')throw new Error('请输入文件名，不允许路径')
 const data=image.url.startsWith('data:image/')?image.url:await modelImage(image.url)
 if(isTauri()){await invoke('save_workflow_image',{filename:name,data});return}
 const a=document.createElement('a');a.href=data;a.download=name;a.click()
}
