import type {ModelConnection} from './types'
import type {WorkflowEvent} from '../services/workflowExecution'
export interface ModelUsage {input:number;cached:number;output:number;total:number;cost?:number;currency:string;modelName:string}
export function modelUsage(raw:any,model:ModelConnection):ModelUsage|undefined {
 const input=raw?.prompt_tokens??raw?.input_tokens,output=raw?.completion_tokens??raw?.output_tokens
 if(!Number.isSafeInteger(input)||input<0||!Number.isSafeInteger(output)||output<0)return
 const cache=raw.prompt_tokens_details?.cached_tokens??raw.prompt_cache_hit_tokens??raw.input_tokens_details?.cached_tokens??0
 if(!Number.isSafeInteger(cache)||cache<0||cache>input)return
 const prices=[model.inputPrice,model.cachedInputPrice,model.outputPrice],counts=[input-cache,cache,output]
 const known=counts.every((count,i)=>!count||typeof prices[i]==='number'&&Number.isFinite(prices[i])&&prices[i]!>=0)
 return {input,cached:cache,output,total:input+output,currency:model.priceCurrency||'CNY',modelName:model.name,...(known?{cost:counts.reduce((sum,count,i)=>sum+count*(prices[i]||0)/1e6,0)}:{})}
}
export function usageSummary(events:WorkflowEvent[]){
 const requests=events.filter((e):e is Extract<WorkflowEvent,{kind:'model'}>=>e.kind==='model'),values=requests.flatMap(e=>e.usage?[e.usage]:[]),costs=new Map<string,number>()
 for(const v of values)if(v.cost!==undefined)costs.set(v.currency,(costs.get(v.currency)||0)+v.cost)
 return {input:values.reduce((s,v)=>s+v.input,0),output:values.reduce((s,v)=>s+v.output,0),total:values.reduce((s,v)=>s+v.total,0),cached:values.reduce((s,v)=>s+v.cached,0),context:values.at(-1)?.input,costs,missing:requests.some(e=>!e.usage),unpriced:values.some(v=>v.cost===undefined),count:values.length}
}
