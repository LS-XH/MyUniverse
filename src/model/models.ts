import { ModelConnection, Workspace, uid } from './types'

export function createModel(models: ModelConnection[]): ModelConnection {
  let name='新模型',suffix=2
  while(models.some(model=>model.name===name))name=`新模型 ${suffix++}`
  return {id:uid(),name,model:'',baseUrl:'',apiKey:'',enabled:true}
}
export function deleteModel(workspace: Workspace,id: string): Workspace {
  return {...workspace,models:(workspace.models||[]).filter(model=>model.id!==id),worlds:workspace.worlds.map(world=>world.chat.modelId===id?{...world,chat:{...world.chat,modelId:null}}:world)}
}
export function modelReady(model: ModelConnection) {
  try {const url=new URL(model.baseUrl);return !!model.model.trim()&&['http:','https:'].includes(url.protocol)}catch{return false}
}
