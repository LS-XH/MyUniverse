import test from 'node:test'
import assert from 'node:assert/strict'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import ChatMarkdown from '../src/ui/ChatMarkdown'
import ChatPage from '../src/ui/ChatPage'
import ChatExecution from '../src/ui/ChatExecution'
import InstanceProposal from '../src/ui/InstanceProposal'
import ProposalGroup from '../src/ui/ProposalGroup'
import type {InstanceChangeProposal} from '../src/model/types'
import {createWorld} from '../src/model/templates'
import type {ChatMessage} from '../src/model/types'
import {mergeProposalEntity} from '../src/model/proposalMerge'
import {editChatHistory} from '../src/model/chatRuns'
test('question cards show options and retained answers, and disable interrupted interactions',()=>{
 const run:NonNullable<ChatMessage['run']>={id:'r',target:{kind:'model',id:'m'},status:'interrupted',events:[{kind:'question',id:'q',question:'选择哪位人物？',options:['甲','乙']}]}
 const html=renderToStaticMarkup(createElement(ChatExecution,{run,proposals:new Map()}))
 assert.ok(html.includes('需要你确认'));assert.ok(html.includes('自填回答'));assert.ok(html.includes('此提问已中断'));assert.ok(html.includes('disabled'))
 run.events=[{kind:'question',id:'q',question:'选择哪位人物？',options:['甲','乙'],answer:'乙'}];run.status='complete'
 const answered=renderToStaticMarkup(createElement(ChatExecution,{run,proposals:new Map()}));assert.ok(answered.includes('你的回答：'));assert.ok(answered.includes('乙'));assert.ok(!answered.includes('自填回答'))
})
test('adjacent same-class proposals collapse together and offer batch decisions without grouping across prose',()=>{
 const proposal=(id:string):InstanceChangeProposal=>({id,classId:'c',entityId:id,worldId:'w',className:'人物',instanceName:id,before:'旧',after:'新',reason:'',schemaSignature:'[]',status:'pending'})
 const proposals=new Map(['a','b','c'].map(id=>[id,proposal(id)]))
 const run:NonNullable<ChatMessage['run']>={id:'r',target:{kind:'model',id:'m'},status:'complete',events:[{kind:'proposal',id:'a'},{kind:'tool',id:'t',name:'universe_propose_instance_change',state:'complete',result:{proposalId:'b'}},{kind:'proposal',id:'b'},{kind:'model',id:'text',state:'complete',text:'另一段说明'},{kind:'proposal',id:'c'}]}
 const html=renderToStaticMarkup(createElement(ChatExecution,{run,proposals}))
 assert.equal((html.match(/proposal-group/g)||[]).length,1);assert.ok(html.includes('人物 · 2 项提议'));assert.ok(html.includes('全部保存'));assert.ok(html.includes('全部拒绝'))
 assert.equal(/<details[^>]*proposal-group[^>]* open/.test(html),false)
 const group=renderToStaticMarkup(createElement(ProposalGroup,{proposals:[{...proposal('a'),status:'saved',savedAfter:{id:'a',name:'a',fields:[]}}]}))
 assert.ok(group.includes('回退已保存'));assert.ok(group.includes('回退保存'))
})
test('proposal content matches within one member and rejects ambiguous or conflicting targets',()=>{
 const entity=(value:string)=>({id:'e',name:'甲',fields:[{id:'f',schemaId:'s',key:'内容',value,children:[]}]})
 assert.equal(mergeProposalEntity(entity('开头\n旧段\n末尾'),entity('开头\n新段\n末尾'),entity('新开头\n旧段\n末尾')).fields[0].value,'新开头\n新段\n末尾')
 assert.throws(()=>mergeProposalEntity(entity('旧段'),entity('新段'),entity('旧段旧段')),/唯一匹配/)
 assert.throws(()=>mergeProposalEntity(entity('旧段'),entity('新段'),entity('别的内容')),/已变化/)
})
test('editing a user message restores its protocol snapshot and truncates subsequent conversation',()=>{
 const protocol=[{role:'user' as const,content:'之前'},{role:'assistant' as const,content:null,tool_calls:[{id:'call',type:'function' as const,function:{name:'工具',arguments:'{}'}}]},{role:'tool' as const,content:'结果',tool_call_id:'call'}]
 const edited=editChatHistory({id:'c',title:'对话',createdAt:0,messages:[{id:'first',role:'user',content:'之前',createdAt:0},{id:'edit',role:'user',content:'原文',createdAt:1,protocolBefore:protocol},{id:'reply',role:'assistant',content:'后续',createdAt:2}]},'edit')
 assert.deepEqual(edited.messages.map(m=>m.id),['first']);assert.deepEqual(edited.modelMessages,protocol)
 assert.throws(()=>editChatHistory(edited,'missing'),/已不存在/)
})
test('instance proposals start closed and report all added and removed lines',()=>{
 const html=renderToStaticMarkup(createElement(InstanceProposal,{proposal:{id:'p',worldId:'w',classId:'c',entityId:'e',className:'人物',instanceName:'甲',before:'相同\n旧值',after:'相同\n新值\n新行',reason:'',schemaSignature:'',status:'pending'}}))
 assert.match(html,/^<details[^>]*instance-proposal/);assert.equal(/^<details[^>]* open/.test(html),false)
 assert.ok(html.includes('新增 2 行，删除 1 行'));assert.ok(html.includes('保存修改'));assert.ok(html.includes('拒绝'))
})

test('workflow progress displays saved operation names and readable loop rounds, including old events',()=>{
 const run:NonNullable<ChatMessage['run']>={id:'run',status:'error',events:[{kind:'node',id:'opaque-node-id',title:'LLM 模型',state:'error',frame:'/opaque-loop-id:7',scopeLabel:'工具交流循环 · 第 7 轮'},{kind:'loop',id:'opaque-loop-id',iteration:7,state:'running'},{kind:'node',id:'legacy-node-id',state:'complete',frame:'/legacy-loop-id:2'}]}
 const html=renderToStaticMarkup(createElement(ChatExecution,{run,proposals:new Map()}))
 assert.ok(html.includes('LLM 模型 · 失败'));assert.ok(html.includes('工具交流循环 · 第 7 轮'));assert.ok(html.includes('循环 · 第 7 轮 · 失败'));assert.ok(html.includes('执行步骤 3 · 完成'));assert.ok(html.includes('循环 · 第 2 轮'))
 for(const id of ['opaque-node-id','opaque-loop-id','legacy-node-id','legacy-loop-id'])assert.equal(html.includes(id),false)
})

test('chat Markdown renders GFM and incomplete streaming code as React elements without active HTML or unsafe URLs',()=>{
 const markdown='# 标题\n\n**强调**\n\n- 列表项\n\n| 名称 | 状态 |\n| --- | --- |\n| 甲 | 完成 |\n\n```js\nconst x = 1\n```\n\n[危险](javascript:alert%281%29)\n\n<script>alert(1)</script>'
 const html=renderToStaticMarkup(createElement(ChatMarkdown,{children:markdown}))
 for(const expected of ['<h1>标题</h1>','<strong>强调</strong>','<li>列表项</li>','<table>','<code class="language-js">'])assert.ok(html.includes(expected),expected)
 assert.equal(html.includes('<script'),false);assert.equal(/href="javascript:/.test(html),false)
 assert.ok(renderToStaticMarkup(createElement(ChatMarkdown,{children:'```js\nconst x ='})).includes('<pre'))
})

test('chat user content has no injected whitespace and assistant answers render Markdown',()=>{
 const world=createWorld('chat');world.chat.activeConversationId='c';world.chat.conversations=[{id:'c',createdAt:0,title:'chat',messages:[{id:'u',role:'user',createdAt:0,content:'第一行\n第二行'},{id:'a',role:'assistant',createdAt:0,content:'**回复**'}]}]
 const html=renderToStaticMarkup(createElement(ChatPage,{world,models:[],agents:[],sending:false,onChange:()=>{},onModelSettings:()=>{},onSend:()=>{},onStop:()=>{}}))
 assert.ok(html.includes('<div class="chat-user-text">第一行\n第二行</div>'));assert.ok(html.includes('<strong>回复</strong>'))
 assert.match(html,/class="message-content[^\"]*">\s*<div class="chat-user-text">/)
})

test('the composer uses one action button that switches from sending to stopping',()=>{
 const world=createWorld('chat'),props={world,models:[],agents:[],onChange:()=>{},onModelSettings:()=>{},onSend:()=>{},onStop:()=>{}}
 const idle=renderToStaticMarkup(createElement(ChatPage,{...props,sending:false})),running=renderToStaticMarkup(createElement(ChatPage,{...props,sending:true}))
 assert.equal((idle.match(/class="send-button /g)||[]).length,1);assert.equal((running.match(/class="send-button /g)||[]).length,1)
 assert.ok(idle.includes('aria-label="发送"'));assert.ok(running.includes('aria-label="停止执行"'));assert.equal(running.includes('aria-label="发送"'),false)
 assert.equal(/<button class="send-button [^>]*disabled/.test(running),false)
})

test('consecutive tools form a closed group while visible model content separates groups',()=>{
 const run:NonNullable<ChatMessage['run']>={id:'r',target:{kind:'model',id:'m'},status:'complete',events:[
 {kind:'tool',id:'a',name:'工具甲',state:'complete'},{kind:'node',id:'n',state:'complete'},{kind:'tool',id:'b',name:'工具乙',state:'complete'},
 {kind:'model',id:'m',state:'complete',text:'中间回复'},{kind:'tool',id:'c',name:'工具丙',state:'complete'}]}
 const html=renderToStaticMarkup(createElement(ChatExecution,{run,proposals:new Map()}))
 assert.equal((html.match(/chat-tool-group/g)||[]).length,1)
 assert.ok(html.includes('工具调用 · 2 次'));assert.ok(html.includes('中间回复'));assert.ok(html.includes('工具丙'))
 assert.equal(/<details[^>]*chat-tool-group[^>]* open/.test(html),false)
})
