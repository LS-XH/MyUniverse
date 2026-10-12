import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {SSEDecoder} from '../src/services/sse'
import {callLLMStream,requestBody} from '../src/services/llm'
import {ModelConnection} from '../src/model/types'

const model:ModelConnection={id:'m',name:'test',model:'test',baseUrl:'http://test.invalid',apiKey:'dummy',enabled:true}
test('SSE decoder handles every-byte UTF-8 splits, BOM, comments, all line endings and multiline data',()=>{
 const parser=new SSEDecoder(),data='\uFEFF: hello\r\ndata: 你\r\ndata: 好\r\n\r\ndata: second\r\rdata: third\n\ndata: incomplete',events:string[]=[]
 for(const byte of new TextEncoder().encode(data))events.push(...parser.push(new Uint8Array([byte])))
 events.push(...parser.finish());assert.deepEqual(events,['你\n好','second','third'])
 assert.throws(()=>new SSEDecoder().push(new Uint8Array([255])),/encoded|encoding/i)
})
test('basic HTTP and SSE bodies filter implicit callable parameters and keep explicit tools authoritative',()=>{
 const connection={...model,extraBody:JSON.stringify({tools:[{fake:true}],tool_choice:'required',functions:[{}],function_call:'x',parallel_tool_calls:true,stream:true})}
 const body=requestBody(connection,[{role:'user',content:'test'}],[])
 for(const name of ['tools','tool_choice','functions','function_call','parallel_tool_calls'])assert.equal(Object.hasOwn(body,name),false)
 assert.equal(body.stream,false)
})
test('POST SSE streams reasoning and text immediately, accumulates complete tool calls and reports abnormal ends',async()=>{
 let mode='valid',requests=0
 const server=createServer(async(request,response)=>{
  assert.equal(request.method,'POST');assert.equal(request.headers.authorization,'Bearer dummy')
  const parts:Buffer[]=[];for await(const part of request)parts.push(part)
  const body=JSON.parse(Buffer.concat(parts).toString());assert.equal(body.stream,true);assert.equal(body.model,'test');requests++
  response.writeHead(200,{'Content-Type':'text/event-stream'})
  if(mode==='invalid'){response.end('data: nope\n\n');return}
  const chunks=[{choices:[{index:0,delta:{reasoning_content:'实际思考'}}]},{choices:[{index:0,delta:{content:'你好',tool_calls:[{index:0,id:'call',type:'function',function:{name:'fn',arguments:'{"'}}]}}]},{choices:[{index:0,delta:{tool_calls:[{index:0,function:{arguments:'input":"世界"}'}}]},finish_reason:'tool_calls'}]}]
  for(const chunk of chunks){const encoded=Buffer.from('data: '+JSON.stringify(chunk)+'\r\n\r\n');for(let i=0;i<encoded.length;i+=3)response.write(encoded.subarray(i,i+3))}
  response.end(mode==='truncated'?'':'data: [DONE]\n\n')
 })
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address() as {port:number}
 const connection={...model,baseUrl:`http://127.0.0.1:${address.port}`},deltas:{text?:string;reasoning?:string}[]=[]
 try{
  const message=await callLLMStream(connection,[{role:'user',content:'test'}],undefined,[],delta=>{deltas.push(delta)})
  assert.equal(message.content,'你好');assert.equal(message.tool_calls?.[0].function.arguments,'{"input":"世界"}');assert.ok(deltas.some(d=>d.reasoning==='实际思考'));assert.ok(deltas.some(d=>d.text==='你好'))
  mode='truncated';await assert.rejects(callLLMStream(connection,[{role:'user',content:'test'}]),/完成标记/)
  mode='invalid';await assert.rejects(callLLMStream(connection,[{role:'user',content:'test'}]),/JSON|Unexpected/)
  assert.equal(requests,3)
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})
test('SSE cancellation closes the active request and never issues a retry',async()=>{
 let requests=0,connected!:()=>void;const ready=new Promise<void>(resolve=>{connected=resolve})
 const server=createServer((_request,response)=>{requests++;response.writeHead(200,{'Content-Type':'text/event-stream'});response.write(': waiting\n\n');connected()})
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address() as {port:number},controller=new AbortController()
 try{const pending=callLLMStream({...model,baseUrl:`http://127.0.0.1:${address.port}`},[{role:'user',content:'test'}],controller.signal);await ready;controller.abort();await assert.rejects(pending,/取消/);assert.equal(requests,1)}finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})
