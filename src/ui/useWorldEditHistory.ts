import type {World} from '../model/types'
import useEditHistory from './useEditHistory'

export function useWorldEditHistory(world:World,save:(world:World)=>void,key:string){
 return useEditHistory(world,save,'world:'+key)
}
