import { World } from './types'

/** Remove a custom collection while retaining its contents in the parent. */
export function removeCollection(world:World,id:string):World {
  const node=world.nodes.find(n=>n.id===id)
  if(!node||node.type!=='collection'||node.protected)return world
  return {...world,nodes:world.nodes.filter(n=>n.id!==id).map(n=>n.parentId===id?{...n,parentId:node.parentId}:n)}
}
