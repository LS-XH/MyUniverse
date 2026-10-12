// Local-only, deterministic transport for /tests/agent-ui.html. No files or credentials.
import {createServer} from 'node:http'
const server=createServer(async(request,response)=>{
 response.setHeader('Access-Control-Allow-Origin','*');response.setHeader('Access-Control-Allow-Headers','content-type,authorization');response.setHeader('Access-Control-Allow-Methods','POST,OPTIONS')
 if(request.method==='OPTIONS'){response.writeHead(204);response.end();return}
 try{
  const parts=[];for await(const part of request)parts.push(part);const body=JSON.parse(Buffer.concat(parts).toString())
  response.writeHead(200,{'Content-Type':'text/event-stream'});const messages=body.messages,last=messages.at(-1)
  if(String(last?.content).includes('取消')){response.write(': waiting\n\n');return}
  let call,text='## 创作建议\n\n这是 **Markdown 格式** 的流式回答。\n\n- 保留人物动机\n- 补充世界设定\n\n> 过程和正文使用同一主题。\n\n| 内容 | 状态 |\n| --- | --- |\n| 工具与 Agent | 已完成 |\n\n```json\n{"result":"完成"}\n```'
  if(last?.role==='user'){
   const agent=body.tools?.find(t=>t.function.name.startsWith('agent_'))
   if(agent&&!String(last.content).includes('审校任务'))call={id:crypto.randomUUID(),type:'function',function:{name:agent.function.name,arguments:JSON.stringify({input:'审校任务：'+last.content})}}
   else if(String(last.content).includes('建议'))call={id:crypto.randomUUID(),type:'function',function:{name:'universe_propose_instance_change',arguments:JSON.stringify({className:'物件',instanceName:'甲',markdown:'## 甲\n\n### 描述\n建议值：'+('人物面对危机时保持冷静，并在行动中体现自己的选择。'.repeat(30))+'\n'+('%E4%BA%BA%E7%89%A9'.repeat(60))})}}
   else if(!String(last.content).includes('审校任务'))call={id:crypto.randomUUID(),type:'function',function:{name:'universe_list_classes',arguments:'{}'}}
   else text='审校完成：人物动机与世界设定保持一致。'
  }
  const calls=call?[call]:[]
  if(last?.role==='user'&&String(last.content).includes('批量提议'))for(const name of ['丙','丁'])calls.push({id:crypto.randomUUID(),type:'function',function:{name:'universe_propose_instance_add',arguments:JSON.stringify({className:'物件',instanceName:name,markdown:['## '+name,'','### 描述','新实例内容'].join(String.fromCharCode(10))})}});
  const deltas=[{reasoning_content:'正在检查任务与可调用能力。'},...(calls.length?calls.flatMap((item,index)=>[{tool_calls:[{index,...item,function:{name:item.function.name,arguments:''}}]},{tool_calls:[{index,function:{arguments:item.function.arguments}}]}]):[...text].map(content=>({content})))];let index=0
  const timer=setInterval(()=>{if(index<deltas.length)response.write('data: '+JSON.stringify({choices:[{index:0,delta:deltas[index++]}]})+'\n\n');else{clearInterval(timer);response.end('data: [DONE]\n\n')}},35)
  response.on('close',()=>clearInterval(timer))
 }catch(error){response.end('data: '+JSON.stringify({error:{message:String(error)}})+'\n\n')}
})
server.listen(1431,'127.0.0.1',()=>console.log('Local SSE fixture: http://127.0.0.1:1431'))
