import {isSystemFolder} from '../model/toolRoles'
import {bindSkillRuntime} from '../services/runtimeSkills'
import {checkpointWorkspace} from '../services/storage'
import useNativeInteractionPolicy from './useNativeInteractionPolicy'
import useVisitHistory from './useVisitHistory'
import {ChatDirective,resolveChatDirectives} from '../model/chatDirectives'
import {answerChatQuestion,hasChatQuestion} from '../services/chatQuestions'
import {AgentSession} from '../services/agentSessions'
import ChatConversationTree from './ChatConversationTree'
import {SkillPart} from './SkillTree'
import {createModelFolder,removeModelFolder,modelFolderPath,modelItems} from '../model/modelFolders'
import SkillsPage from './SkillsPage'
import {FileActionsContext} from './FileActionsContext'
import {saveProjection,dirtyTreeItems,dirtyEntityItems,type CreationFile} from '../model/manualSave'
import {functionFile} from '../model/functions'
import { reconcileChangedFunctionBindings } from '../model/functionAppend'
import type {ProposalAction} from '../model/types'
import {chatTarget,mergeChatEvents,updateChatMessage} from '../model/chatRuns'
import {editChatHistory} from '../model/chatRuns'

import {agentChatReason} from '../model/agents'
import {WorkflowEvent} from '../services/workflowExecution'
import {ContextMessage} from '../model/workflowValues'
import {normalizeAgentModels} from '../model/builtinAgents'
import {appendInstanceProposal,decideInstanceProposal,decideInstanceProposals,onInstanceProposal} from '../services/instanceProposals'
import {registeredTools} from '../model/builtinTools'
import {bindScriptHost} from '../services/scriptHost'
import useTreeDrag from './useTreeDrag'
import { moveTreeItem } from '../model/treeMoves'
import CreateInterfaceDialog from './CreateInterfaceDialog'
import InterfaceConfigPage from './InterfaceConfigPage'
import {removeInterfaceView,graphView,isGraphKind} from '../model/interfaceViews'
import { invoke } from '@tauri-apps/api/core'
import TreeDisclosure from './TreeDisclosure'
import PageSession, { type PageMemory } from './PageSession'
import SidebarActions from './SidebarActions'
import TopbarActions from './TopbarActions'
import PluginTree from './PluginTree'
import { createPluginFolder, pluginSectionNames, pluginFolderPath, removePluginFolder } from '../model/pluginFolders'
import FunctionsPage from './FunctionsPage'
import { FunctionContext } from './FunctionContext'
import {recomputeFunctions} from '../services/recompute'
import {bindToolExecutor} from '../services/tools'
import {executeToolInBackground} from '../services/toolExecutor'
import {bindFunctionExecutor} from '../services/functions'
import {executeFunctionInBackground} from '../services/functionExecutor'
import useWorkspaceArchive from './useWorkspaceArchive'
import RuntimeLogPanel from './RuntimeLogPanel'
import {installRuntimeLogging} from '../services/runtimeLog'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bolt, ChevronRight, CircleHelp, Folder, Layers3, PanelLeft, Puzzle, PencilLine, Plus, FolderPlus, Trash2, Settings, Settings2, Sparkles, SquareTerminal } from 'lucide-react'
import { createWorld } from '../model/templates'
import { activeTheme, themeStyle } from '../model/themes'
import { ChatMessage,Conversation,ClassDocument, ModelSection, PluginSection, Workspace, World } from '../model/types'
import { applyImportProgress,loadWorkspace,reloadCreationFile,savedWorkspace,saveWorkspace } from '../services/storage'
import { CollectionPage, GraphPage, ViewConfig, syncFields, viewIcon } from './App'
import DocumentWorkspace from './DocumentWorkspace'
import GraphDocumentActions from './DocumentFileActions'
import SchemaEditor from './SchemaEditor'
import ChatPage from './ChatPage'
import MapPage from './MapPage'
import ModelsPage from './ModelsPage'
import SettingsPage from './SettingsPage'
import { SettingsSidebar } from './SettingsSidebar'
import ModelsSidebar, { modelSectionNames } from './ModelsSidebar'
import ModelWorkflowPage from './ModelWorkflowPage'
import ToolsPage from './ToolsPage'
import { commitAgentMemory,runAgent, workflowText } from '../services/workflows'
import { uid } from '../model/types'

type Selection={nodeId:string;config?:boolean;entityId?:string;focusToken?:number;graphFocusId?:string}
type Page='create'|'plugins'|'models'|'settings'

export default function AppRoot(){
  useNativeInteractionPolicy()
  useEffect(()=>installRuntimeLogging(),[])
  const [agentView,setAgentView]=useState<string|undefined>(),[logOpen,setLogOpen]=useState(false),closeLog=useCallback(()=>setLogOpen(false),[])
  const [workspace,rawSetWorkspace]=useState<Workspace>({worlds:[],activeWorldId:null,themeId:'violet',themes:[]})
  const setWorkspace=(action:import('react').SetStateAction<Workspace>)=>{
    const previous=latest.current,candidate=typeof action==='function'?action(previous):action
    const next=reconcileChangedFunctionBindings(previous,candidate)
    latest.current=next;rawSetWorkspace(next)
  }
  const [saved,setSaved]=useState<Workspace>({worlds:[],activeWorldId:null}),[fileBusy,setFileBusy]=useState(false)
  const persistence=useRef<{all:()=>Promise<void>;save:()=>Promise<void>;refresh:()=>Promise<void>}>({all:async()=>{},save:async()=>{},refresh:async()=>{}})
  const treeDrag=useTreeDrag((source,target,inside,after)=>setWorkspace(current=>moveTreeItem(current,source,target,inside,after)))
  const [ready,setReady]=useState(false),[selection,setSelection]=useState<Selection|null>(null),[page,setPage]=useState<Page>('create')
  const [modelSection,setModelSection]=useState<ModelSection>('llm'),[selectedModelId,setSelectedModelId]=useState<string|null>(null),[modelFolderId,setModelFolderId]=useState<string|null>(null)
  const [pluginSection,setPluginSection]=useState<PluginSection>('functions'),[selectedFunction,setSelectedFunction]=useState<string|null>(null)
  const memories=useRef(new Map<string,PageMemory>())
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false)
  const [sidebarMenu,setSidebarMenu]=useState<{x:number;y:number;target:HTMLButtonElement;names:string[]}|null>(null)
  useEffect(()=>{const suppress=(event:MouseEvent)=>event.preventDefault();document.addEventListener('contextmenu',suppress);return()=>document.removeEventListener('contextmenu',suppress)},[])
  const [pluginFolderId,setPluginFolderId]=useState<string|null>(null),[selectedTool,setSelectedTool]=useState<string|null>(null),[selectedSkill,setSelectedSkill]=useState<string|null>(null),[skillPart,setSkillPart]=useState<SkillPart>('overview'),[skillEntry,setSkillEntry]=useState<string|undefined>(undefined)
  const [showProjects,setShowProjects]=useState(false)
  const [expanded,setExpanded]=useState<Record<string,boolean>>({})
  const [,setSaveStatus]=useState<'saved'|'saving'|'error'>('saved')
  const [syncError,setSyncError]=useState(''),[loadError,setLoadError]=useState('')
  const latest=useRef(workspace),busy=useRef(false)
  const chatRequests=useRef(new Map<string,AbortController>()),chatSessions=useRef(new Map<string,{session:AgentSession;observe:(event:WorkflowEvent)=>void;messageId:string}>())
  const [chatRuns,setChatRuns]=useState<Record<string,{pending:boolean;error?:string}>>({})
  useEffect(()=>()=>{chatRequests.current.forEach(controller=>controller.abort())},[])
  latest.current=workspace
  const [dialog,setDialog]=useState<{title:string;value:string;onSubmit:(value:string)=>void}|null>(null)
  useEffect(()=>{loadWorkspace().then(loaded=>{const next=normalizeAgentModels(loaded);setSaved(savedWorkspace()||loaded);setWorkspace(next);setReady(true);const current=next.worlds.find(world=>world.id===next.activeWorldId)||next.worlds[0];if(current){setSelection({nodeId:current.id});setExpanded({[current.id]:true,...Object.fromEntries(current.nodes.filter(node=>node.type==='collection').map(node=>[node.id,true]))})}}).catch(error=>setLoadError(String(error)))},[])
  useEffect(()=>bindScriptHost({autoSave:false,get:()=>latest.current,update:change=>setWorkspace(change),save:async()=>{if(!busy.current)await persistence.current.all()}}),[])
  useEffect(()=>bindSkillRuntime({read:()=>latest.current,update:next=>{latest.current=next;setWorkspace(next)},save:next=>checkpointWorkspace(next)}),[])
  useEffect(()=>bindFunctionExecutor(executeFunctionInBackground),[])
  useEffect(()=>bindToolExecutor(executeToolInBackground),[])
  useEffect(()=>onInstanceProposal(event=>{const next=appendInstanceProposal(latest.current,event);latest.current=next;setWorkspace(next)}),[])
  const decideProposal=async(worldId:string,conversationId:string,proposalId:string,save:ProposalAction,ids?:string[])=>{
    const next=ids?decideInstanceProposals(latest.current,worldId,conversationId,ids,save):decideInstanceProposal(latest.current,worldId,conversationId,proposalId,save);latest.current=next;setWorkspace(next);await checkpointWorkspace(next)
  }
  const handleSyncError=(error:unknown)=>{setSaveStatus('error');setSyncError(error instanceof Error?error.message:String(error))}
  const archiveStatus=useWorkspaceArchive(workspace,ready)
  const world=workspace.worlds.find(item=>item.id===workspace.activeWorldId)||workspace.worlds[0]
  const node=world?.nodes.find(item=>item.id===selection?.nodeId)
  const doc=world?.documents.find(item=>item.id===node?.classId)
  const route={page,selection:selection?{nodeId:selection.nodeId,config:selection.config,entityId:selection.entityId,graphFocusId:selection.graphFocusId}:null,worldId:workspace.activeWorldId,conversationId:world?.chat.activeConversationId,modelSection,selectedModelId,modelFolderId,pluginSection,selectedFunction,pluginFolderId,selectedTool,selectedSkill,skillPart,skillEntry,showProjects,agentView}
  useVisitHistory(route,next=>{
    setPage(next.page);setSelection(next.selection?{...next.selection,focusToken:next.selection.entityId?Date.now():undefined}:null);setModelSection(next.modelSection);setSelectedModelId(next.selectedModelId);setModelFolderId(next.modelFolderId);setPluginSection(next.pluginSection);setSelectedFunction(next.selectedFunction);setPluginFolderId(next.pluginFolderId);setSelectedTool(next.selectedTool);setSelectedSkill(next.selectedSkill);setSkillPart(next.skillPart);setSkillEntry(next.skillEntry);setShowProjects(next.showProjects);setAgentView(next.agentView)
    setWorkspace(current=>({...current,activeWorldId:current.worlds.some(w=>w.id===next.worldId)?next.worldId:current.activeWorldId,worlds:current.worlds.map(w=>w.id===next.worldId?{...w,chat:{...w.chat,activeConversationId:next.conversationId&&w.chat.conversations.some(c=>c.id===next.conversationId)?next.conversationId:null}}:w)}))
  },ready)

  const graphViewDocument=world&&node?.type==='view'&&isGraphKind(node.viewType)&&!selection?.config&&world.views?.[node.id]?world.documents.find(d=>d.id===graphView(world,world.views![node.id]).parentClassId):undefined
  const currentFile:CreationFile|undefined=page==='create'&&world&&!showProjects?{worldId:world.id,kind:graphViewDocument||node?.type==='file'?'document':node?.viewType==='chat'?'chat':node?.type==='view'?'view':'world',id:graphViewDocument?graphViewDocument.id:node?.type==='file'?(doc?.id||node.classId||node.id):(node?.id||world.id)}:undefined
  const attributePage=page==='create'&&node?.type==='file'&&!!selection?.config
  const persist=async(all=false)=>{
    if(!ready||busy.current)return
    busy.current=true;setFileBusy(true)
    try{
      const current=latest.current,submitted=all?current:saveProjection(current,savedWorkspace()||saved,currentFile)
      await archiveStatus.flush(current)
      const result=await saveWorkspace(submitted,undefined,all?undefined:currentFile||'preferences')
      setSaved(result);setSaveStatus('saved');setSyncError('')
    }catch(error){handleSyncError(error)}finally{busy.current=false;setFileBusy(false)}
  }
  const [refreshProgress,setRefreshProgress]=useState<number|null>(null)
  const operation=useRef<AbortController|null>(null)
  useEffect(()=>()=>operation.current?.abort(),[])
  const runCalculation=async(scope:CreationFile,signal:AbortSignal)=>{
    const docId=scope.kind==='document'?scope.id:scope.kind==='view'?latest.current.worlds.find(w=>w.id===scope.worldId)?.views?.[scope.id]?.parentClassId:undefined
    await recomputeFunctions(()=>latest.current,setWorkspace,{worldId:scope.worldId,docId},(done,total)=>setRefreshProgress(.2+.8*done/Math.max(1,total)),signal)
  }
  const recomputeCurrent=async()=>{
    if(!ready||busy.current||!currentFile)return
    busy.current=true;setFileBusy(true);setRefreshProgress(.05);const controller=new AbortController();operation.current=controller
    try{await runCalculation(currentFile,controller.signal);setSyncError('')}catch(error){if(!controller.signal.aborted)handleSyncError(error)}finally{operation.current=null;setRefreshProgress(null);busy.current=false;setFileBusy(false)}
  }
  const refreshCurrent=async()=>{
    if(!ready||busy.current||attributePage)return
    busy.current=true;setFileBusy(true);setRefreshProgress(.05);const controller=new AbortController();operation.current=controller
    try{
      if(!currentFile)return
      const scope:CreationFile=currentFile.kind==='view'?{worldId:currentFile.worldId,kind:'document',id:latest.current.worlds.find(w=>w.id===currentFile.worldId)?.views?.[currentFile.id]?.parentClassId||''}:currentFile
      await reloadCreationFile(latest.current,scope,{signal:controller.signal,preserveFunctionOrigin:true,onProgress:progress=>{
        setWorkspace(current=>({...current,worlds:current.worlds.map(w=>w.id!==progress.worldId?w:{...w,documents:w.documents.map(d=>d.id===progress.docId?applyImportProgress(d,progress):d)})}))
        setRefreshProgress(progress.completed/Math.max(1,progress.total))
      }})
      setRefreshProgress(1);setSyncError('')
    }catch(error){if(!controller.signal.aborted)handleSyncError(error)}finally{operation.current=null;setRefreshProgress(null);busy.current=false;setFileBusy(false)}
  }
  persistence.current={all:()=>persist(true),save:()=>persist(),refresh:refreshCurrent}
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{if(!(event.ctrlKey||event.metaKey)||event.altKey)return;const key=event.key.toLowerCase();if(key==='s'||key==='r'){event.preventDefault();event.stopPropagation();void (key==='s'?persistence.current.save():persistence.current.refresh())}}
    window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true)
  },[page])
  const dirty=useMemo(()=>new Map(workspace.worlds.map(w=>[w.id,dirtyTreeItems(w,saved.worlds.find(v=>v.id===w.id))])),[workspace.worlds,saved.worlds])
  const dirtyEntities=useMemo(()=>doc?dirtyEntityItems(doc,saved.worlds.find(w=>w.id===world?.id)?.documents.find(d=>d.id===doc.id)):new Set<string>(),[doc,world?.id,saved.worlds])
  const theme=activeTheme(workspace)
  const setWorld=(next:World)=>setWorkspace(current=>({...current,worlds:current.worlds.map(item=>item.id===next.id?next:item)}))
  const sendChat=async(content:string,editId?:string,directives:ChatDirective[]=[])=>{
    if(!world)return
    const submitted=latest.current,currentWorld=submitted.worlds.find(w=>w.id===world.id);if(!currentWorld)return
    const existing=currentWorld.chat.conversations.find(c=>c.id===currentWorld.chat.activeConversationId),conversation:Conversation=editId&&existing?editChatHistory(existing,editId):existing||{id:uid(),title:content.slice(0,24),messages:[],createdAt:Date.now()},key=world.id+':'+conversation.id
    const selectedAgent=submitted.agents?.find(a=>a.id===chatTarget(submitted,currentWorld.chat)?.id)
    let resolved:ReturnType<typeof resolveChatDirectives>
    try{if(!selectedAgent)throw new Error('所选 Agent 已不存在');resolved=resolveChatDirectives(content,directives,submitted,currentWorld,selectedAgent)}catch(error){setChatRuns(runs=>({...runs,[key]:{...runs[key],error:String(error)}}));return}
    if(chatRequests.current.has(key)){
      const active=chatSessions.current.get(key)
      if(!active||existing?.chatKind!=='roleplay'||editId)return
      const message:ChatMessage={id:uid(),role:'user',content,createdAt:Date.now(),directives:resolved.directives,protocolBefore:structuredClone(existing.modelMessages||[]),interjectionRunId:existing.messages.find(m=>m.id===active.messageId)?.run?.id,sessionBefore:structuredClone(active.session.state)}
      setWorkspace(current=>({...current,worlds:current.worlds.map(w=>w.id===world.id?{...w,chat:{...w.chat,conversations:w.chat.conversations.map(c=>c.id===conversation.id?{...c,messages:[...c.messages,message]}:c)}}:w)}))
      active.observe({kind:'userInput',id:message.id,content,name:active.session.state.human?.mode==='character'?active.session.state.human.name:undefined})
      active.session.requestSkills(resolved.skillIds);active.session.interject(resolved.input)
      const question=existing.messages.flatMap(m=>m.run?.status==='running'?m.run.events:[]).find(e=>e.kind==='question'&&!e.answer)
      if(question?.kind==='question'&&hasChatQuestion(question.id))answerChatQuestion(question.id,content)
      return
    }
    const target=chatTarget(submitted,currentWorld.chat)
    if(!target){setChatRuns(runs=>({...runs,[`${world.id}:${currentWorld.chat.activeConversationId}`]:{pending:false,error:'请选择模型或 Agent'}}));return}
    const agent=submitted.agents?.find(a=>a.id===target.id)
    const invalid=!agent?'所选 Agent 已不存在':agentChatReason(agent)
    if(invalid){setChatRuns(runs=>({...runs,[`${world.id}:${currentWorld.chat.activeConversationId}`]:{pending:false,error:invalid}}));return}
    const controller=new AbortController(),messageId=uid(),user:ChatMessage={id:uid(),role:'user',content,directives:resolved.directives,createdAt:Date.now()},assistant:ChatMessage={id:messageId,role:'assistant',content:'',createdAt:Date.now(),run:{id:uid(),target,status:'running',events:[]}}
    const history:ContextMessage[]=conversation.modelMessages||conversation.messages.filter(m=>!m.proposal&&m.content&&(!m.run||m.run.status==='complete')).map(m=>({role:m.role,content:m.content}))
    user.protocolBefore=structuredClone(history)
    user.sessionBefore=structuredClone(conversation.session||{participants:[],publicMessages:[],human:currentWorld.chat.participation||{mode:'observer'}})
    const next:Conversation={...conversation,target,chatKind:conversation.chatKind||(agent!.preset==='roleplay'?'roleplay':'standard'),modelMessages:[...history,{role:'user',content:resolved.input}],messages:[...conversation.messages,user,assistant]}
    const publish=(value:Workspace)=>{latest.current=value;setWorkspace(value)}
    publish({...latest.current,worlds:latest.current.worlds.map(w=>w.id===world.id?{...w,chat:{...w.chat,activeConversationId:conversation.id,conversations:existing?w.chat.conversations.map(c=>c.id===conversation.id?next:c):[...w.chat.conversations,next]}}:w)})
    chatRequests.current.set(key,controller);setChatRuns(runs=>({...runs,[key]:{pending:true}}))
    let displaySequence=0,pending:WorkflowEvent[]=[],timer:ReturnType<typeof setTimeout>|undefined
    const flush=()=>{if(timer)clearTimeout(timer);timer=undefined;if(!pending.length)return;const batch=pending;pending=[];try{publish(updateChatMessage(latest.current,world.id,conversation.id,messageId,m=>({...m,run:{...m.run!,events:mergeChatEvents(m.run!.events,batch)}})))}catch{controller.abort()}}
    const observe=(event:WorkflowEvent)=>{if(event.kind==='edge'||event.kind==='variables')return;if(controller.signal.aborted&&event.kind!=='agent')return;pending.push({...event,displaySequence:++displaySequence});if(!timer)timer=setTimeout(flush,50)}
    try{
      const states=conversation.messages.filter(m=>m.proposal).map(m=>'修改建议 '+m.proposal!.id+'：'+m.proposal!.status).join('\n')
      const initial:ContextMessage[]=[...history.filter(m=>m.role!=='system'),...(states?[{role:'assistant' as const,content:states}]:[])]
      const definition=agent!
      const session=new AgentSession(conversation.session||user.sessionBefore,state=>{if(controller.signal.aborted)return;const live=latest.current;if(!live.worlds.find(w=>w.id===world.id)?.chat.conversations.some(c=>c.id===conversation.id)){controller.abort();return}publish({...live,worlds:live.worlds.map(w=>w.id===world.id?{...w,chat:{...w.chat,conversations:w.chat.conversations.map(c=>c.id===conversation.id?{...c,session:state}:c)}}:w)})})
      chatSessions.current.set(key,{session,observe,messageId})
      const output=await runAgent(definition,resolved.input,submitted,currentWorld,controller.signal,undefined,{forcedSkillIds:resolved.skillIds,agentSession:session,defaultModelId:currentWorld.chat.modelId||undefined,chatHistory:initial,runId:assistant.run!.id,stream:true,onEvent:observe,toolContext:{conversationId:conversation.id}})
      flush();if(controller.signal.aborted)throw new DOMException('已取消','AbortError')
      const value=workflowText(output.value),committed=commitAgentMemory(latest.current,output.memoryChanges||[])
      let completed=updateChatMessage(committed,world.id,conversation.id,messageId,m=>({...m,content:value,run:{...m.run!,status:'complete'}}))
      const protocol=agent?.preset?(output.variables.history as {value:{items:ContextMessage[]}}).value.items.filter(m=>m.role!=='system'):[...next.modelMessages!,{role:'assistant' as const,content:value}]
      completed={...completed,worlds:completed.worlds.map(w=>w.id===world.id?{...w,chat:{...w.chat,conversations:w.chat.conversations.map(c=>c.id===conversation.id?{...c,modelMessages:protocol}:c)}}:w)}
      publish(completed);setChatRuns(runs=>({...runs,[key]:{pending:false}}))
    }catch(error){
      flush();const message=controller.signal.aborted?'已停止执行':String(error)
      try{let failed=updateChatMessage(latest.current,world.id,conversation.id,messageId,m=>({...m,run:{...m.run!,status:controller.signal.aborted?'cancelled':'error',error:message}}));failed={...failed,worlds:failed.worlds.map(w=>w.id===world.id?{...w,chat:{...w.chat,conversations:w.chat.conversations.map(c=>c.id===conversation.id?{...c,modelMessages:[...(c.modelMessages||[]),...c.messages.filter(m=>m.interjectionRunId===assistant.run!.id).map(m=>({role:'user' as const,content:m.content}))]}:c)}}:w)};publish(failed)}catch{/* The original conversation was deleted. */}
      setChatRuns(runs=>({...runs,[key]:{pending:false,error:message}}))
    }finally{if(timer)clearTimeout(timer);chatRequests.current.delete(key);chatSessions.current.delete(key)}
  }
  const setDoc=(next:ClassDocument)=>{
    if(!world)return
    const worldId=world.id
    setWorkspace(current=>({...current,worlds:current.worlds.map(item=>{
      if(item.id!==worldId)return item
      const previous=item.documents.find(doc=>doc.id===next.id),fields=new Map(previous?.entities.map(entity=>[entity.id,entity.fields]))
      const normalized={...next,entities:next.entities.map(entity=>previous?.schema===next.schema&&fields.get(entity.id)===entity.fields?entity:{...entity,fields:syncFields(next.schema,entity.fields)})}
      return {...item,documents:item.documents.map(doc=>doc.id===next.id?normalized:doc)}
    })}))
  }
  const ask=(title:string,initial:string,onSubmit:(value:string)=>void)=>setDialog({title,value:initial,onSubmit})
  const selectSkill=(id:string|null,part:SkillPart='overview',entry?:string)=>{setSelectedSkill(id);setSkillPart(part);setSkillEntry(entry);setPluginSection('skills');setSelectedFunction(null);setSelectedTool(null);if(id)setPluginFolderId(workspace.skills?.find(s=>s.id===id)?.folderId||null)}
  const selectPluginFolder=(section:PluginSection,id:string|null)=>{setPluginSection(section);setPluginFolderId(id);setSelectedFunction(null);setSelectedTool(null);setSelectedSkill(null)}
  const selectFunction=(id:string|null)=>{setSelectedSkill(null);setSelectedFunction(id);if(id){const fn=workspace.functions?.find(fn=>fn.id===id);setPluginSection('functions');if(fn)setPluginFolderId(fn.folderId||null)}}
  useEffect(()=>{if(selectedFunction){const fn=workspace.functions?.find(fn=>fn.id===selectedFunction);if(fn)setPluginFolderId(fn.folderId||null)}},[selectedFunction,workspace.functions])
  useEffect(()=>{if(selectedTool){const tool=registeredTools(workspace).find(t=>t.id===selectedTool);if(tool)setPluginFolderId(tool.folderId||null)}},[selectedTool,workspace.tools])
  const addPluginFolder=(section:PluginSection,parentId:string|null)=>ask('新文件夹名称','新文件夹',name=>{
    const folder=createPluginFolder(latest.current,section,parentId,name)
    setWorkspace(current=>({...current,pluginFolders:[...(current.pluginFolders||[]),folder]}));selectPluginFolder(section,folder.id)
  })
  const selectModelFolder=(section:ModelSection,id:string|null)=>{setModelSection(section);setModelFolderId(id);setSelectedModelId(null)}
  const selectModel=(section:ModelSection,id:string|null)=>{setModelSection(section);setSelectedModelId(id);if(id)setModelFolderId(modelItems(latest.current,section).find(m=>m.id===id)?.folderId||null)}
  const addModelFolder=(section:ModelSection,parentId:string|null)=>ask('新文件夹名称','新文件夹',name=>{const folder=createModelFolder(latest.current,section,parentId,name);setWorkspace(current=>({...current,modelFolders:[...(current.modelFolders||[]),folder]}));selectModelFolder(section,folder.id)})
  useEffect(()=>{if(selectedModelId){const item=modelItems(workspace,modelSection).find(m=>m.id===selectedModelId);if(item)setModelFolderId(item.folderId||null)}},[selectedModelId,modelSection,workspace.models,workspace.agents,workspace.sdWorkflows])
  useEffect(()=>{if(selectedSkill){const skill=workspace.skills?.find(s=>s.id===selectedSkill);if(skill)setPluginFolderId(skill.folderId||null)}},[selectedSkill,workspace.skills])
  const currentModelFolder=workspace.modelFolders?.find(f=>f.id===modelFolderId)
  const modelFolderTools=<><button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" onClick={()=>addModelFolder(modelSection,modelFolderId)}><FolderPlus size={16}/>新建文件夹</button>{currentModelFolder&&!isSystemFolder(currentModelFolder.id)&&<><button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" onClick={()=>ask('重命名文件夹',currentModelFolder.name,name=>setWorkspace(current=>({...current,modelFolders:current.modelFolders?.map(f=>f.id===modelFolderId?{...f,name}:f)})))}><PencilLine size={15}/>重命名</button><button className="ghost ui-button--ghost danger ui-surface ui-button ui-button--standard" onClick={()=>{if(confirm('删除文件夹？其中的内容移到上一级。')){setWorkspace(current=>removeModelFolder(current,currentModelFolder.id));selectModelFolder(modelSection,currentModelFolder.parentId)}}}><Trash2 size={15}/>删除文件夹</button></>}</>
  const currentPluginFolder=workspace.pluginFolders?.find(f=>f.id===pluginFolderId)
  const pluginFolderTools=<><button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard ui-button--elevated" onClick={()=>addPluginFolder(pluginSection,pluginFolderId)}><FolderPlus size={16}/> 新建文件夹</button>{currentPluginFolder&&!isSystemFolder(currentPluginFolder.id)&&<><button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard ui-button--elevated" onClick={()=>ask('重命名文件夹',currentPluginFolder.name,name=>setWorkspace(current=>({...current,pluginFolders:current.pluginFolders?.map(f=>f.id===pluginFolderId?{...f,name}:f)})))}><PencilLine size={15}/> 重命名</button><button className="ghost ui-button--ghost danger ui-surface ui-button ui-button--standard ui-button--elevated" onClick={()=>{if(confirm('删除此文件夹？其中的文件和子文件夹会移到上一级。')){setWorkspace(current=>removePluginFolder(current,currentPluginFolder.id));selectPluginFolder(pluginSection,currentPluginFolder.parentId)}}}><Trash2 size={15}/> 删除文件夹</button></>}</>
  const submitDialog=()=>{if(!dialog?.value.trim())return;const callback=dialog.onSubmit,value=dialog.value.trim();setDialog(null);callback(value)}
  const addWorld=()=>ask('新世界名称','未命名世界',name=>{setShowProjects(false);const next=createWorld(name);setWorkspace(current=>({...current,worlds:[...current.worlds,next],activeWorldId:next.id}));setSelection({nodeId:next.id});setExpanded({[next.id]:true,...Object.fromEntries(next.nodes.filter(node=>node.type==='collection').map(node=>[node.id,true]))});setPage('create')})
  const selectWorld=(next:World)=>{setShowProjects(false);setWorkspace(current=>({...current,activeWorldId:next.id}));setSelection({nodeId:next.id})}
  const selectNode=(next:Selection,current:World|undefined=world)=>{if(current){const parents:string[]=[];let parent=current.nodes.find(n=>n.id===next.nodeId)?.parentId;while(parent){parents.push(parent);parent=current.nodes.find(n=>n.id===parent)?.parentId}setExpanded(previous=>({...previous,[current.id]:true,...Object.fromEntries(parents.map(id=>[id,true]))}))}setShowProjects(false);setSelection(next);if(current&&current.id!==workspace.activeWorldId)setWorkspace(previous=>({...previous,activeWorldId:current.id}))}
  const selectConversation=(current:World,nodeId:string,id:string|null)=>{setAgentView(undefined);setShowProjects(false);setWorkspace(previous=>({...previous,activeWorldId:current.id,worlds:previous.worlds.map(item=>item.id===current.id?{...item,chat:{...item.chat,activeConversationId:id}}:item)}));setSelection({nodeId})}
  const removeWorld=()=>{if(!world||!confirm(`删除项目“${world.name}”及其中的全部内容？`))return;const remaining=workspace.worlds.filter(item=>item.id!==world.id);setWorkspace({...workspace,worlds:remaining,activeWorldId:remaining[0]?.id||null});setSelection(remaining[0]?{nodeId:remaining[0].id}:null)}
  const removeDoc=()=>{if(!world||!doc||doc.protected)return;if(!confirm(`删除“${doc.name}”及全部实例？`))return;setWorld({...world,documents:world.documents.filter(item=>item.id!==doc.id),nodes:world.nodes.filter(item=>item.classId!==doc.id),views:Object.fromEntries(Object.entries(world.views||{}).filter(([,v])=>v.parentClassId!==doc.id))});setSelection({nodeId:node?.parentId||world.nodes[0].id})}
  const [interfaceParent,setInterfaceParent]=useState<{worldId:string;classId:string;parentId:string|null}|null>(null)
  const renderConfigRow=(current:World,item:World["nodes"][number])=><div className={`tree-row ui-tree-row--navigation config-row ${world?.id===current.id&&selection?.nodeId===item.id&&selection.config?'active':''} ui-surface ui-tree-row`}><button data-context-actions={JSON.stringify([...(item.type==='file'?[]:['保存当前文件','刷新当前文件']),...(item.type==='file'?['添加属性']:isGraphKind(item.viewType)||item.viewType==='map'?['删除界面']:[])])} className="tree-main ui-surface ui-button" onClick={()=>selectNode({nodeId:item.id,config:true},current)}>{item.type==='file'?<Settings size={14}/>:<Settings2 size={14}/>}<span>{item.name}{item.type==='file'?'属性配置':'配置'}</span>{item.type!=='file'&&dirty.get(current.id)?.has(item.id)&&<span className="tree-dirty-dot" title="有未保存的更改"/>}</button></div>
  const renderTree=(current:World,parentId:string|null):React.ReactNode=>current.nodes.filter(item=>item.parentId===parentId).map(item=>{
    const Icon=viewIcon(item),isOpen=expanded[item.id]??false,selected=world?.id===current.id&&selection?.nodeId===item.id&&!selection.config,hasChild=item.type==='collection'||item.type==='file'||item.viewType==='chat'
    return <div className="tree-node ui-tree-node" key={item.id}><div data-tree-id={`world:${current.id}:${item.id}`} data-tree-folder={item.type==='collection'} data-tree-readonly={item.type==='collection'&&item.protected||undefined} className={`tree-row ui-tree-row--navigation ${selected?'active':''} ui-surface ui-tree-row`}><button data-context-actions={JSON.stringify(['保存当前文件','刷新当前文件',...(item.type==='collection'?['新建集合','新建界面','新建类',...(!item.protected?['删除集合']:[])]:item.type==='file'?['新建实例','新建界面','导入 MD','Markdown 预览',...(!current.documents.find(d=>d.id===item.classId)?.protected?['删除类']:[])]:isGraphKind(item.viewType)?['连线',current.documents.find(d=>d.id===item.classId)?.name||'对象','关系文字','删除界面']:item.viewType==='map'?['放大','缩小','适应屏幕','删除界面']:[])])} className="tree-main ui-surface ui-button" onClick={()=>selectNode({nodeId:item.id},current)} onDoubleClick={()=>{if(hasChild)setExpanded(previous=>({...previous,[item.id]:!isOpen}))}}><Icon size={15}/><span>{item.name}</span>{dirty.get(current.id)?.has(item.id)&&<span className="tree-dirty-dot" title="有未保存的更改" aria-label="未保存"/>}</button>{hasChild&&<TreeDisclosure open={isOpen} name={item.name} onToggle={()=>setExpanded(previous=>({...previous,[item.id]:!isOpen}))}/>}</div>{isOpen&&(item.type==='file'||item.viewType==='chat')&&<div className="tree-branch ui-tree-branch">{renderConfigRow(current,item)}{item.type==='file'&&<>{renderTree(current,item.id)}<div className="tree-row ui-tree-row--navigation ui-surface ui-tree-row"><button className="tree-main ui-surface ui-button" onClick={()=>setInterfaceParent({worldId:current.id,classId:item.classId!,parentId:item.id})}><Plus size={14}/><span>新建视图</span></button></div></>}{item.viewType==='chat'&&<><div className="tree-row ui-tree-row--navigation chat-new-row ui-surface ui-tree-row"><button className="tree-main ui-surface ui-button" onClick={()=>{selectConversation(current,item.id,null);setAgentView(undefined)}}><Plus size={14}/><span>新建聊天</span></button></div>{(current.chat.conversations||[]).slice().reverse().map(conversation=><ChatConversationTree key={conversation.id} conversation={conversation} agents={workspace.agents||[]} selected={selected&&current.chat.activeConversationId===conversation.id} agentView={agentView} onSelect={view=>{selectConversation(current,item.id,conversation.id);setAgentView(view)}} onDelete={()=>setWorld({...current,chat:{...current.chat,conversations:current.chat.conversations.filter(chat=>chat.id!==conversation.id),activeConversationId:current.chat.activeConversationId===conversation.id?null:current.chat.activeConversationId}})}/>)}</>}</div>}{item.type==='view'&&item.viewType!=='chat'&&renderConfigRow(current,item)}{isOpen&&item.type==='collection'&&<div className="tree-branch ui-tree-branch">{renderTree(current,item.id)}</div>}</div>
  })
  const renderSidebar=()=>{
    if(page==='settings')return <aside className="sidebar settings-sidebar"><div className="sidebar-header"><strong>设置</strong></div><SettingsSidebar workspace={workspace} onChange={setWorkspace}/></aside>
    if(page==='models')return <aside className="sidebar models-sidebar"><div className="sidebar-header"><strong>模型</strong></div><ModelsSidebar workspace={workspace} section={modelSection} selected={selectedModelId} folderId={modelFolderId} onSelect={selectModel} onFolder={selectModelFolder} onAddFolder={addModelFolder}/></aside>
    if(page==='plugins')return <aside className="sidebar plugin-sidebar"><div className="sidebar-header"><strong>插件</strong></div><PluginTree workspace={workspace} section={pluginSection} folderId={pluginFolderId} selectedFunction={selectedFunction} selectedTool={selectedTool} selectedSkill={selectedSkill} skillPart={skillPart} skillEntry={skillEntry} onSkill={selectSkill} onTool={id=>{setPluginSection('tools');setSelectedSkill(null);setSelectedFunction(null);setSelectedTool(id);setPluginFolderId(registeredTools(workspace).find(item=>item.id===id)?.folderId||null)}} onFolder={selectPluginFolder} onFunction={selectFunction} onAddFolder={addPluginFolder}/></aside>
    return <aside className="sidebar creation-sidebar"><div className="sidebar-header"><div className="sidebar-brand">MY<span>UNIVERSE</span></div></div><div className="projects-scroll"><div className="project-nav"><button className="tree-row ui-tree-row--navigation create-entry ui-surface ui-tree-row" onClick={addWorld}><Plus size={17}/><span>创建世界</span></button></div><div className="project-roots"><div className="tree project-tree">{workspace.worlds.map(item=><div className="tree-node world-tree-node ui-tree-node" key={item.id}><div data-tree-id={`world:${item.id}:root`} data-tree-folder="true" className={`tree-row ui-tree-row--navigation world-row ${world?.id===item.id?'active-world':''} ui-surface ui-tree-row`}><button data-context-actions={JSON.stringify(['保存当前文件','刷新当前文件','新建集合','新建界面','新建类','删除项目'])} className="tree-main ui-surface ui-button" onClick={()=>selectWorld(item)} onDoubleClick={()=>setExpanded(previous=>({...previous,[item.id]:!previous[item.id]}))}><Layers3 size={16}/><span>{item.name}</span>{dirty.get(item.id)?.has(item.id)&&<span className="tree-dirty-dot" title="有未保存的更改" aria-label="未保存"/>}</button><TreeDisclosure open={!!expanded[item.id]} name={item.name} onToggle={()=>setExpanded(previous=>({...previous,[item.id]:!previous[item.id]}))}/></div>{expanded[item.id]&&<div className="tree-branch ui-tree-branch">{renderTree(item,null)}</div>}</div>)}</div></div></div></aside>
  }
  const renderMain=()=>{
    if(loadError)return <div className="loading" role="alert">工作区加载失败：{loadError}。请修复文件后重新打开程序。</div>
    if(!ready)return <div className="loading">正在打开宇宙…</div>
    if(page==='settings')return <SettingsPage workspace={workspace} onChange={setWorkspace}/>
    if(page==='models')return modelSection==='llm'?<ModelsPage workspace={workspace} onChange={setWorkspace} folderId={modelFolderId} folderTools={modelFolderTools} onFolder={id=>selectModelFolder(modelSection,id)} selectedId={selectedModelId} onSelect={id=>selectModel(modelSection,id)}/>:<ModelWorkflowPage workspace={workspace} onChange={setWorkspace} folderId={modelFolderId} folderTools={modelFolderTools} onFolder={id=>selectModelFolder(modelSection,id)} selectedId={selectedModelId} onSelect={id=>selectModel(modelSection,id)} mode={modelSection==='sd'?'sd':'agent'}/>
    if(page==='plugins'&&pluginSection==='tools')return <ToolsPage workspace={workspace} onChange={setWorkspace} folderId={pluginFolderId} selected={selectedTool} onSelect={setSelectedTool} onFolder={id=>selectPluginFolder('tools',id)} folderTools={pluginFolderTools}/>
    if(page==='plugins')return pluginSection==='functions'?<FunctionsPage workspace={workspace} onChange={setWorkspace} selected={selectedFunction} onSelect={selectFunction} folderId={pluginFolderId} folderTools={pluginFolderTools} onFolder={id=>selectPluginFolder('functions',id)}/>:<SkillsPage workspace={workspace} onChange={setWorkspace} selected={selectedSkill} onSelect={id=>selectSkill(id)} part={skillPart} entry={skillEntry} onOpen={(part,entry)=>{setSkillPart(part);setSkillEntry(entry)}} folderId={pluginFolderId} onFolder={id=>selectPluginFolder('skills',id)} folderTools={pluginFolderTools}/>
    if(showProjects)return <div className="page-scroll"><div className="page-heading ui-page-toolbar ui-page-toolbar--page"><div><div className="eyebrow">PROJECTS</div><h1>我的项目</h1></div><div className="heading-actions"><button className="primary ui-button--primary ui-surface ui-button ui-button--elevated ui-button--standard" onClick={addWorld}><Plus size={16}/> 创建世界</button></div></div><div className="collection-grid">{workspace.worlds.map(project=><button className="collection-card ui-card--collection ui-surface ui-card ui-card--themed ui-card--text" key={project.id} onClick={()=>selectWorld(project)}><Layers3 size={22}/><div><strong>{project.name}</strong><span>世界项目</span></div></button>)}</div>{!workspace.worlds.length&&<div className="empty-card ui-panel--empty ui-surface ui-panel ui-panel--themed ui-panel--text"><Folder size={25}/><h2>暂无项目</h2></div>}</div>
    if(!world)return <div className="welcome"><div className="welcome-symbol ui-icon-surface--welcome ui-surface ui-icon-surface ui-icon-surface--themed ui-icon-surface--text"><Sparkles size={34}/></div><div className="eyebrow">YOUR CREATIVE UNIVERSE</div><h1>从一个世界开始</h1><p>把人物、势力、地点与事件编织成属于你的故事。</p><button className="primary ui-button--primary big ui-surface ui-button ui-button--standard" onClick={addWorld}><Plus size={19}/> 创建世界</button></div>
    if(selection?.nodeId===world.id||!node)return <CollectionPage world={world} node={{id:world.id,name:world.name,type:'collection',parentId:null}} root onDeleteProject={removeWorld} onChange={setWorld} onSelect={selectNode} ask={ask}/>
    if(node.type==='collection')return <CollectionPage world={world} node={node} onChange={setWorld} onSelect={selectNode} ask={ask}/>
    if(node.type==='file'&&doc)return selection?.config?<SchemaEditor world={world} doc={doc} onChange={setDoc}/>:<DocumentWorkspace key={doc.id} focusEntity={selection?.entityId} focusToken={selection?.focusToken} world={world} doc={doc} onChange={setDoc} onDelete={removeDoc}/>
    if(isGraphKind(node.viewType)||node.viewType==='map'){
      const storedView=world.views?.[node.id],view=storedView&&isGraphKind(storedView.kind)?graphView(world,storedView):storedView
      if(!view)return <div className="loading">界面父类型已不存在，请重新创建界面。</div>
      const open=(entityId:string)=>{const file=world.nodes.find(item=>item.type==='file'&&item.classId===view.parentClassId);if(file)selectNode({nodeId:file.id,entityId,focusToken:Date.now()})}
      const remove=()=>{if(confirm(`删除界面“${view.name}”？父类型和实例将保留。`)){setWorld(removeInterfaceView(world,view.id));selectNode({nodeId:node.parentId||world.id})}}
      return selection?.config?<InterfaceConfigPage world={world} view={view} onChange={setWorld} onDelete={remove}/>:<div className="interface-workspace">{isGraphKind(node.viewType)&&graphViewDocument?<><GraphDocumentActions world={world} doc={graphViewDocument} onChange={setDoc}/><GraphPage world={world} view={storedView!} onChange={setWorld} onOpenPerson={open} graphFocusId={selection?.graphFocusId||null} onGraphFocusChange={id=>setSelection(previous=>previous?{...previous,graphFocusId:id||undefined}:previous)}/></>:<><div className="editor-file-actions interface-file-actions"><button className="ghost ui-button--ghost danger ui-surface ui-button ui-button--standard" onClick={remove}><Trash2 size={16}/> 删除界面</button></div><MapPage world={world} view={view} onChange={setWorld} onOpen={open}/></>}</div>
    }
    if(node.viewType==='chat')return selection?.config?<ViewConfig kind="chat" world={world} onChange={setWorld}/>:<ChatPage skills={workspace.skills||[]} agentView={agentView} onMain={()=>setAgentView(undefined)} onProposalDecision={(id,save,ids)=>decideProposal(world.id,world.chat.activeConversationId!,id,save,ids)} world={world} onChange={setWorld} models={workspace.models||[]} agents={workspace.agents||[]} onSend={(content,editId,directives)=>{void sendChat(content,editId,directives)}} sending={!!chatRuns[`${world.id}:${world.chat.activeConversationId}`]?.pending} error={chatRuns[`${world.id}:${world.chat.activeConversationId}`]?.error} onStop={()=>chatRequests.current.get(`${world.id}:${world.chat.activeConversationId}`)?.abort()} onModelSettings={()=>{setModelSection('llm');setModelFolderId(null);setSelectedModelId(null);setPage('models')}}/>
    return null
  }
  const pageKey=page==='create'&&showProjects?'create:projects':page==='create'?`${page}:${world?.id}:${selection?.nodeId}:${!!selection?.config}:${node?.viewType==='chat'?world?.chat.activeConversationId||'new':''}`:page==='plugins'?`${page}:${pluginSection}:${pluginFolderId}:${selectedFunction}:${selectedTool}:${selectedSkill}`:`${page}:${modelSection}:${modelFolderId}:${selectedModelId}`
  if(!memories.current.has(pageKey))memories.current.set(pageKey,new Map())
  const fileLocation:string[]|null=page==='models'||page==='settings'?['workspace.json']:page==='plugins'?pluginSection==='functions'?(selectedFunction&&workspace.functions?.find(fn=>fn.id===selectedFunction)?['functions',functionFile(workspace.functions.find(fn=>fn.id===selectedFunction)!)]:['functions']):['workspace.json']:showProjects||!world?['workspace.json']:selection?.config&&node?.type==='file'&&doc?['worlds',world.id,doc.fileName.replace(/\.md$/i,'.schema.json')]:graphViewDocument?['worlds',world.id,graphViewDocument.fileName]:node?.type==='file'&&doc?['worlds',world.id,doc.fileName]:(selection?.config||!!world.views?.[node?.id||''])&&node?.viewType?['worlds',world.id,world.views?.[node.id]?.fileName||'聊天框配置.json']:!node||node.type==='collection'?['worlds',world.id]:null
  const revealLocation=async()=>{
    if(!fileLocation)return
    try{await invoke('reveal_file',{components:fileLocation})}catch(error){handleSyncError(error)}
  }
  const crumbs:{label:string;run:()=>void}[]=[]
  if(page==='plugins'){
    crumbs.push({label:'插件',run:()=>selectPluginFolder('functions',null)},{label:pluginSectionNames[pluginSection],run:()=>selectPluginFolder(pluginSection,null)})
    for(const folder of pluginFolderPath(workspace,pluginFolderId))crumbs.push({label:folder.name,run:()=>selectPluginFolder(pluginSection,folder.id)})
    const label=selectedFunction?workspace.functions?.find(f=>f.id===selectedFunction)?.name:selectedTool?registeredTools(workspace).find(t=>t.id===selectedTool)?.name:selectedSkill?workspace.skills?.find(t=>t.id===selectedSkill)?.name:undefined;if(label)crumbs.push({label,run:()=>{}})
  }else if(page==='models'){
    crumbs.push({label:'模型',run:()=>selectModelFolder('llm',null)},{label:modelSectionNames[modelSection],run:()=>selectModelFolder(modelSection,null)})
    for(const folder of modelFolderPath(workspace,modelFolderId))crumbs.push({label:folder.name,run:()=>selectModelFolder(modelSection,folder.id)})
    const label=(modelSection==='llm'?workspace.models:modelSection==='sd'?workspace.sdWorkflows:workspace.agents)?.find(m=>m.id===selectedModelId)?.name;if(label)crumbs.push({label,run:()=>{}})
  }else if(page==='settings')crumbs.push({label:'设置',run:()=>setPage('settings')})
  else if(showProjects||!world)crumbs.push({label:'我的项目',run:()=>setShowProjects(true)})
  else{
    crumbs.push({label:world.name,run:()=>selectWorld(world)})
    const path:World['nodes']=[],seen=new Set<string>();let item=node;while(item&&!seen.has(item.id)){path.unshift(item);seen.add(item.id);item=world.nodes.find(n=>n.id===item?.parentId)}
    for(const item of path)crumbs.push({label:item.name,run:()=>selectNode({nodeId:item.id})})
    if(selection?.config)crumbs.push({label:'配置',run:()=>{}})
    else if(selection?.graphFocusId&&graphViewDocument){const person=graphViewDocument.entities.find(entity=>entity.id===selection.graphFocusId);if(person)crumbs.push({label:`${person.name}的子视图`,run:()=>{}})}
  }
  const folderPage=page==='create'?(showProjects||!selection?.config&&(!node||node.type==='collection')):page==='plugins'?(pluginSection==='functions'?!selectedFunction:pluginSection==='tools'?!selectedTool:!selectedSkill):page==='models'?!selectedModelId:false
  return <FileActionsContext.Provider value={currentFile?{save:()=>{void persist()},refresh:()=>{void refreshCurrent()},busy:fileBusy,recompute:()=>{void recomputeCurrent()},cancel:()=>operation.current?.abort(),dirtyEntities,savedDocument:saved.worlds.find(w=>w.id===world?.id)?.documents.find(d=>d.id===doc?.id)}:null}><FunctionContext.Provider value={workspace.functions||[]}><div className={`app-shell ${sidebarCollapsed?'sidebar-collapsed':''}`} onClick={()=>setSidebarMenu(null)} onContextMenu={event=>{event.preventDefault();const target=event.target as HTMLElement,button=target.closest('.sidebar .tree-main,.sidebar .settings-tree-heading,.sidebar .model-nav-row,.sidebar .theme-nav-row');if(button&&!button.classList.contains('projects-heading')){setSidebarMenu({x:event.clientX,y:event.clientY,target:button as HTMLButtonElement,names:JSON.parse((button as HTMLElement).dataset.contextActions||'[]')})}}} style={themeStyle(theme.colors)} data-theme={theme.id}><nav className="rail"><div className="brand-mark ui-icon-surface--brand ui-surface ui-icon-surface"><Sparkles size={21}/></div><div className="rail-items"><span className="rail-selection" aria-hidden="true" style={{transform:`translateY(${({create:0,plugins:1,models:2,settings:3}[page])*52}px)`}}/><button title="创作" className={`${page==='create'?'active':''} ui-surface ui-button`} onClick={()=>{setPage('create')}}><PencilLine size={21}/></button><button title="插件" className={`${page==='plugins'?'active':''} ui-surface ui-button`} onClick={()=>setPage('plugins')}><Puzzle size={21}/></button><button title="模型" className={`${page==='models'?'active':''} ui-surface ui-button`} onClick={()=>setPage('models')}><Sparkles size={21}/></button><button title="设置" className={`${page==='settings'?'active':''} ui-surface ui-button`} onClick={()=>setPage('settings')}><Bolt size={21}/></button></div><div className="rail-bottom"><button title="帮助" className="ui-surface ui-button"><CircleHelp size={19}/></button><button className={`runtime-log-toggle ${logOpen?"is-open":""} ui-surface ui-button`} title={logOpen?"收起日志":"打开日志"} aria-label="日志输出" aria-controls="runtime-log-panel" aria-expanded={logOpen} aria-pressed={logOpen} onClick={()=>setLogOpen(open=>!open)}><SquareTerminal size={20}/></button><div className="user-avatar ui-avatar--user ui-surface ui-avatar">U</div></div></nav><div className="sidebar-region" onPointerDown={treeDrag} inert={sidebarCollapsed} aria-hidden={sidebarCollapsed}>{renderSidebar()}</div><button className="sidebar-toggle ui-button--sidebar-toggle icon-button ui-button--icon ui-surface ui-button" title={sidebarCollapsed?'展开侧边栏':'收起侧边栏'} aria-label={sidebarCollapsed?'展开侧边栏':'收起侧边栏'} aria-expanded={!sidebarCollapsed} onClick={()=>{setSidebarCollapsed(!sidebarCollapsed);setSidebarMenu(null)}}><PanelLeft size={20}/></button><main className={`main-area ${folderPage?'folder-page':'object-page'}`}><div className="topbar"><nav className="breadcrumbs" aria-label="当前位置">{crumbs.map((part,index)=><span className="breadcrumb-part" key={index}>{index>0&&<ChevronRight size={14}/>}<button type="button" className="breadcrumb-button ghost ui-button--ghost ui-button--standard ui-surface ui-button" aria-current={index===crumbs.length-1?'page':undefined} onClick={part.run}>{part.label}</button></span>)}</nav><TopbarActions saveAll={{run:()=>{void persist(true)},disabled:!ready||fileBusy}} revision={pageKey} location={fileLocation} onReveal={revealLocation} fileActions={ready&&!attributePage?{save:()=>{void persist()},refresh:()=>{void refreshCurrent()},busy:fileBusy}:undefined}/></div><div className={`topbar-progress ${refreshProgress!==null?'is-active':''}`} role="progressbar" aria-label="读取 Markdown 更新 JSON" aria-valuemin={0} aria-valuemax={100} aria-valuenow={refreshProgress===null?undefined:Math.round(refreshProgress*100)} aria-hidden={refreshProgress===null}><span style={{transform:`scaleX(${refreshProgress??0})`}}/></div>{(syncError||archiveStatus.error)&&<div className="markdown-sync-banner ui-alert--sync ui-surface ui-alert" role="alert"><span>{syncError||archiveStatus.error}</span><button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" onClick={()=>{void archiveStatus.flush().catch(handleSyncError)}}>重试 JSON 存档</button></div>}{refreshProgress!==null&&<button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" onClick={()=>operation.current?.abort()}>停止当前任务</button>}<span className="archive-status" role="status">{archiveStatus.status==='pending'?'JSON 存档中…':archiveStatus.status==='error'?'JSON 存档失败':'JSON 已存档'}</span>{<PageSession key={pageKey} memory={memories.current.get(pageKey)!}>{renderMain()}</PageSession>}</main><RuntimeLogPanel open={logOpen} onClose={closeLog}/>{interfaceParent&&workspace.worlds.find(w=>w.id===interfaceParent.worldId)&&<CreateInterfaceDialog world={workspace.worlds.find(w=>w.id===interfaceParent.worldId)!} parentId={interfaceParent.parentId} initialClassId={interfaceParent.classId} onChange={setWorld} onSelect={selectNode} onClose={()=>setInterfaceParent(null)}/>}<SidebarActions target={sidebarMenu?.target} names={sidebarMenu?.names} position={sidebarMenu} revision={pageKey+JSON.stringify(workspace.functions?.map(fn=>fn.id))} onClose={()=>setSidebarMenu(null)}/>{dialog&&<div className="modal-backdrop" onPointerDown={()=>setDialog(null)}><div className="modal ui-dialog--standard ui-surface ui-dialog ui-dialog--themed ui-dialog--text" onPointerDown={event=>event.stopPropagation()}><div className="eyebrow">CREATE IN MYUNIVERSE</div><h2>{dialog.title}</h2><input autoFocus value={dialog.value} onChange={event=>setDialog({...dialog,value:event.target.value})} onKeyDown={event=>{if(event.key==='Enter')submitDialog();if(event.key==='Escape')setDialog(null)}} className="ui-surface ui-field"/><div className="modal-actions"><button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" onClick={()=>setDialog(null)}>取消</button><button className="primary ui-button--primary ui-surface ui-button ui-button--standard" onClick={submitDialog}>确认创建</button></div></div></div>}</div></FunctionContext.Provider></FileActionsContext.Provider>
}
