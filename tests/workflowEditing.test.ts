import test from 'node:test'
import assert from 'node:assert/strict'
import {graphFragment,pasteGraphFragment,removeGraphSelection,directedConnection,marqueeNodeIds} from '../src/model/graphEditing'
import {typedVariableNode,strictValue,invokeValueMember,validateMessages} from '../src/model/workflowValues'
import {workflowNode,connectWorkflow,createAgent,comfyNode} from '../src/model/workflows'
import {runAgent} from '../src/services/workflows'
import {WorkflowGraph,Workspace,uid} from '../src/model/types'
const ws:Workspace={worlds:[],activeWorldId:null,models:[{id:'m',name:'test',model:'m',baseUrl:'https://test.invalid',apiKey:'',enabled:true}]}
const edge=(from:string,to:string,input:string,output='value')=>({id:uid(),from,to,input,output})
test('graph fragments preserve internal wires, clone identities and remove all incident selected edges',()=>{
 const a=workflowNode('concat',10,20),b=workflowNode('concat',50,90),c=workflowNode('return');const graph:WorkflowGraph={version:1,nodes:[a,b,c],links:[edge(a.id,b.id,'a'),edge(b.id,c.id,'value')]};const fragment=graphFragment(graph,[a.id,b.id]);assert.equal(fragment.links.length,1);const paste=pasteGraphFragment(graph,fragment);assert.equal(paste.ids.length,2);assert.equal(paste.graph.links.length,3);assert.equal(paste.graph.nodes[4].y-paste.graph.nodes[3].y,70);assert.notEqual(paste.ids[0],a.id);const removed=removeGraphSelection(graph,[a.id,b.id,c.id],[]);assert.deepEqual(removed.nodes,[]);assert.equal(removed.links.length,0);assert.equal(graph.nodes.length,3)
})
test('input-first connections normalize to output-first and invalid directions never connect',()=>{
 assert.deepEqual(directedConnection({id:'b',port:'self',direction:'in'},{id:'a',port:'value',direction:'out'}),{from:'a',output:'value',to:'b',input:'self'});assert.throws(()=>directedConnection({id:'a',port:'x',direction:'in'},{id:'b',port:'y',direction:'in'}));assert.throws(()=>directedConnection({id:'a',port:'x',direction:'in'},{id:'a',port:'y',direction:'out'}))
})
test('typed variables reject mismatched wires and finite-number/string/boolean coercion',()=>{
 const a=typedVariableNode('Number'),b=typedVariableNode('String');assert.throws(()=>connectWorkflow({version:1,nodes:[a,b],links:[]},{from:a.id,output:'value',to:b.id,input:'value'}),/类型/);for(const [type,v] of [['Number','1'],['Number',Infinity],['Boolean',1],['String',{}]] as const)assert.throws(()=>strictValue(type,v));assert.equal(strictValue('Number',2),2);const image=typedVariableNode('Image'),native=comfyNode('ImageOp',{input:{required:{image:['IMAGE']}},output:[]});assert.throws(()=>connectWorkflow({version:1,nodes:[image,native],links:[]},{from:image.id,output:'value',to:native.id,input:'image'}),/类型/)
})
test('one variable reads or writes through its value port and persisted envelopes retain type',async()=>{
 const agent=createAgent(),v=typedVariableNode('Number'),out=workflowNode('return');v.settings.name='counter';agent.graph={version:1,nodes:[v,out],links:[edge(v.id,out.id,'value')]};agent.variables={counter:{type:'Number',value:4}};let result=await runAgent(agent,'',ws);assert.equal(result.value,4);v.settings['port:value']='7';result=await runAgent(agent,'',ws);assert.equal(result.value,7);assert.deepEqual(result.variables.counter,{type:'Number',value:7});assert.deepEqual(agent.variables.counter,{type:'Number',value:4});v.settings['port:value']='"oops"';await assert.rejects(()=>runAgent(agent,'',ws),/Number/)
})
test('declared variables cannot silently reuse a different stored or graph type',async()=>{
 const agent=createAgent(),a=typedVariableNode('Number'),b=typedVariableNode('String'),out=workflowNode('return');a.settings.name=b.settings.name='x';agent.graph={version:1,nodes:[a,b,out],links:[edge(a.id,out.id,'value')]};await assert.rejects(()=>runAgent(agent,'',ws),/不同类型/);agent.graph.nodes=[a,out];agent.variables={x:{type:'String',value:'x'}};await assert.rejects(()=>runAgent(agent,'',ws),/不能改/)
})
test('Messages preserve ToolUse metadata, require matching returns and trim complete rounds',async()=>{
 let m:any={type:'Messages',version:1,items:[{role:'system',content:'system'},{role:'user',content:'old'},{role:'assistant',content:'old reply'},{role:'user',content:'new'}]};const call={id:'call1',type:'function',function:{name:'search',arguments:'{"q":"hello"}'},mcp:{server:'test',tool:'search'}};m=await invokeValueMember('Messages','toolCall',m,JSON.stringify(call),{});assert.equal(JSON.parse(await invokeValueMember('Messages','pendingTools',m,undefined,{}) as string)[0].mcp.tool,'search');assert.throws(()=>validateMessages({...m,items:[...m.items,{role:'tool',content:'bad',tool_call_id:'missing'}]}));m=await invokeValueMember('Messages','toolResult',m,'result',{toolCallId:'call1'});assert.equal(await invokeValueMember('Messages','pendingTools',m,undefined,{}),'[]');m=await invokeValueMember('Messages','trim',m,1,{});assert.deepEqual(m.items.map((i:any)=>i.role),['system','user','assistant','tool']);assert.equal(m.items[3].tool_call_id,'call1')
})
test('LLM messages output preserves tool calls while text output remains compatible',async()=>{
 const agent=createAgent(),llm=workflowNode('llm'),out=workflowNode('return');llm.settings.modelId='m';llm.settings['port:prompt']='"hi"';agent.graph={version:1,nodes:[llm,out],links:[edge(llm.id,out.id,'value','messages')]};const call={id:'one',type:'function' as const,function:{name:'lookup',arguments:'{}'}};const result=await runAgent(agent,'',ws,undefined,undefined,undefined,{llmMessage:async()=>({role:'assistant',content:null,tool_calls:[call]})});assert.deepEqual((result.value as any).items[0].tool_calls,[call]);agent.graph.links=[edge(llm.id,out.id,'value')];assert.equal((await runAgent(agent,'',ws,undefined,undefined,undefined,{llm:async()=> 'text'})).value,'text')
})
test('Image nodes produce structured values, properties and explicit save/display effects',async()=>{
 const image:any=await invokeValueMember('Image','fromSD',{type:'Image',version:1,url:''},[{url:'https://test.invalid/a.png',filename:'a.png'}],{});assert.equal(image.type,'Image');assert.equal(await invokeValueMember('Image','filename',image,undefined,{}),'a.png');const effects:string[]=[];assert.deepEqual(await invokeValueMember('Image','save',image,'new.png',{},async(action,_,filename)=>{effects.push(action+':'+filename)}),image);await invokeValueMember('Image','display',image,undefined,{},async(action)=>{effects.push(action)});assert.deepEqual(effects,['save:new.png','display']);assert.throws(()=>strictValue('Image',{type:'Image',version:1,url:'javascript:bad'}));await assert.rejects(()=>invokeValueMember('Image','fromSD',image,[],{}),/不存在/)
})

test('marquee selection intersects cards in either drag direction and negative world coordinates',()=>{
 const nodes=[{id:'a',x:-100,y:-40},{id:'b',x:150,y:80},{id:'c',x:900,y:900}],sizes=new Map([['a',{width:60,height:40}],['b',{width:300,height:100}]]),a={x:-70,y:-30},b={x:200,y:120};assert.deepEqual(marqueeNodeIds(nodes,a,b,sizes),['a','b']);assert.deepEqual(marqueeNodeIds(nodes,b,a,sizes),['a','b']);assert.deepEqual(marqueeNodeIds(nodes,{x:0,y:0},{x:10,y:10},sizes),[])
})
