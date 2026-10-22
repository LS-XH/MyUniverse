import {usageSummary} from '../model/modelUsage'
import {WorkflowEvent} from '../services/workflowExecution'
export default function ChatUsage({events,context=false}:{events:WorkflowEvent[];context?:boolean}){
 const value=usageSummary(events),cost=[...value.costs].map(([currency,amount])=>`${currency} ${amount.toFixed(6)}`).join(' + ')
 return <small className="chat-usage" title="按接口实际返回的 usage 计算；累计包含工具循环及子智能体请求。当前上下文为最近一次模型请求的输入，不包含尚未发送的草稿。">{context?`最近请求输入 ${value.context??'待返回'} tokens · 会话累计 `:''}{value.count?`${value.total.toLocaleString()} tokens（输入 ${value.input} · 命中 ${value.cached} · 输出 ${value.output}）`:'尚无服务用量'}{cost?` · ${cost}`:''}{value.unpriced?' · 部分价格未配置':''}{value.missing?' · 部分请求无 usage':''}</small>
}
