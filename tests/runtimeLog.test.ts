import test from 'node:test'
import assert from 'node:assert/strict'
import {runtimeLog,writeLog,logText,logOperation} from '../src/services/runtimeLog'
import {emitWorkflowEvent} from '../src/services/workflowExecution'

test('logs retain timestamps, levels and sources, merge repeats and bound session memory',()=>{
 runtimeLog.clear()
 writeLog('info','测试','开始',1000);writeLog('info','测试','开始',1100)
 let rows=runtimeLog.getSnapshot();assert.equal(rows.length,1);assert.equal(rows[0].time,1000);assert.equal(rows[0].lastTime,1100);assert.equal(rows[0].count,2)
 writeLog('error','校验','格式错误',1200);rows=runtimeLog.getSnapshot();assert.equal(rows[1].level,'error');assert.equal(rows[1].source,'校验')
 for(let i=0;i<runtimeLog.limit+10;i++)writeLog('debug','循环',`记录 ${i}`,2000+i)
 assert.equal(runtimeLog.getSnapshot().length,runtimeLog.limit);assert.equal(runtimeLog.getSnapshot().at(-1)!.message,`记录 ${runtimeLog.limit+9}`)
 const snapshot=runtimeLog.getSnapshot();assert.equal(runtimeLog.getSnapshot(),snapshot)
 runtimeLog.clear();assert.equal(runtimeLog.getSnapshot().length,0)
})

test('bounded log formatting handles circular objects, getters, huge arrays and error stacks',()=>{
 const circular:any={name:'对象'};circular.self=circular;Object.defineProperty(circular,'bad',{enumerable:true,get(){throw new Error('不能执行 getter')}})
 assert.match(logText(circular),/Circular/);assert.match(logText(circular),/Getter/)
 assert.ok(logText(Array.from({length:100000},(_,i)=>i)).length<1000)
 assert.ok(logText('x'.repeat(100000)).length<=12000)
 assert.match(logText(new Error('格式校验失败')),/格式校验失败/)
 assert.doesNotThrow(()=>logText(new Proxy({},{getPrototypeOf(){throw new Error('不可读取对象原型')}})))
})

test('operation logs record success, failure and cancellation without changing results or errors',async()=>{
 runtimeLog.clear();assert.equal(await logOperation('任务','成功',async()=>42),42)
 const failure=new Error('无效格式');await assert.rejects(logOperation('任务','失败',async()=>{throw failure}),error=>error===failure)
 await assert.rejects(logOperation('任务','取消',async()=>{throw new DOMException('已取消','AbortError')}),/已取消/)
 const rows=runtimeLog.getSnapshot().filter(e=>e.source==='任务')
 assert.ok(rows.some(e=>e.message.includes('成功：完成')));assert.ok(rows.some(e=>e.level==='error'&&e.message.includes('无效格式')))
 assert.ok(rows.some(e=>e.level==='info'&&e.message.includes('取消：已取消')))
})

test('workflow events log failures even without UI listeners and ignore streaming token fragments',async()=>{
 runtimeLog.clear()
 await emitWorkflowEvent(undefined,{kind:'node',id:'节点甲',state:'error',error:'输入类型不匹配'})
 await emitWorkflowEvent(undefined,{kind:'model',id:'模型',state:'running',text:'逐字输出'})
 assert.ok(runtimeLog.getSnapshot().some(e=>e.level==='error'&&e.message.includes('输入类型不匹配')))
 assert.ok(!runtimeLog.getSnapshot().some(e=>e.message.includes('逐字输出')))
})

test('log notifications are batched and failing observers cannot break other subscribers',async()=>{
 runtimeLog.clear();let calls=0
 const unsubscribe=runtimeLog.subscribe(()=>calls++),broken=runtimeLog.subscribe(()=>{throw new Error('观察器错误')})
 for(let i=0;i<100;i++)writeLog('info','批量',String(i))
 await new Promise(resolve=>setTimeout(resolve,75))
 assert.equal(calls,1);unsubscribe();broken()
})
