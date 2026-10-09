import CreateInterfaceDialog from './CreateInterfaceDialog'
import InterfaceConfigPage from './InterfaceConfigPage'
import {removeInterfaceView} from '../model/interfaceViews'
import { invoke } from '@tauri-apps/api/core'
import TreeDisclosure from './TreeDisclosure'
import PageSession, { type PageMemory } from './PageSession'
import SidebarActions from './SidebarActions'
import TopbarActions from './TopbarActions'
import PluginTree from './PluginTree'
import PluginFolderContents from './PluginFolderContents'
import { createPluginFolder, pluginSectionNames, pluginFolderPath, removePluginFolder } from '../model/pluginFolders'
import FunctionsPage from './FunctionsPage'
import { FunctionContext } from './FunctionContext'
import { applyFunctionResult, functionJobs, runFunctionValue } from '../services/functions'
import { functionFile } from '../model/functions'
import { useEffect, useRef, useState } from 'react'
import { Bolt, ChevronRight, CircleHelp, Folder, Layers3, MessageCircle, PanelLeft, Puzzle, PencilLine, Plus, FolderPlus, Trash2, Settings, Settings2, Sparkles } from 'lucide-react'
import { createWorld } from '../model/templates'
import { activeTheme, themeStyle } from '../model/themes'
import { ClassDocument, ModelSection, PluginSection, Workspace, World } from '../model/types'
import { applySyncResult, clearMarkdownConflict, loadWorkspace, MarkdownConflictError, refreshWorkspace, saveWorkspace } from '../services/storage'
import { CollectionPage, GraphPage, ViewConfig, syncFields, viewIcon } from './App'
import DocumentWorkspace from './DocumentWorkspace'
import SchemaEditor from './SchemaEditor'
import ChatPage from './ChatPage'
import MapPage from './MapPage'
import ModelsPage from './ModelsPage'
import SettingsPage from './SettingsPage'
import { SettingsSidebar } from './SettingsSidebar'
import ModelsSidebar from './ModelsSidebar'
import ModelWorkflowPage from './ModelWorkflowPage'
import ToolsPage from './ToolsPage'
import { callLLM } from '../services/llm'
import { runAgent, workflowText } from '../services/workflows'
import { uid } from '../model/types'

type Selection={nodeId:string;config?:boolean;entityId?:string;focusToken?:number}
type Page='create'|'plugins'|'models'|'settings'

export default function AppRoot(){
  const [workspace,setWorkspace]=useState<Workspace>({worlds:[],activeWorldId:null,themeId:'violet',themes:[]})
  const [ready,setReady]=useState(false),[selection,setSelection]=useState<Selection|null>(null),[page,setPage]=useState<Page>('create')
  const [modelSection,setModelSection]=useState<ModelSection>('llm'),[selectedModelId,setSelectedModelId]=useState<string|null>(null)
  const [pluginSection,setPluginSection]=useState<PluginSection>('functions'),[selectedFunction,setSelectedFunction]=useState<string|null>(null)
  const memories=useRef(new Map<string,PageMemory>())
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false)
  const [sidebarMenu,setSidebarMenu]=useState<{x:number;y:number;target:HTMLButtonElement;names:string[]}|null>(null)
  useEffect(()=>{const suppress=(event:MouseEvent)=>event.preventDefault();document.addEventListener('contextmenu',suppress);return()=>document.removeEventListener('contextmenu',suppress)},[])
  const [pluginFolderId,setPluginFolderId]=useState<string|null>(null),[selectedTool,setSelectedTool]=useState<string|null>(null)
  const [showProjects,setShowProjects]=useState(false)
  const [expanded,setExpanded]=useState<Record<string,boolean>>({}),[projectsOpen,setProjectsOpen]=useState(true)
  const [,setSaveStatus]=useState<'saved'|'saving'|'error'>('saved')
  const [syncError,setSyncError]=useState(''),[loadError,setLoadError]=useState(''),[syncConflict,setSyncConflict]=useState<MarkdownConflictError|null>(null)
  const latest=useRef(workspace),busy=useRef(false),conflictRef=useRef(syncConflict),errorRef=useRef(syncError)
  const chatRequests=useRef(new Map<string,AbortController>())
  const [chatRuns,setChatRuns]=useState<Record<string,{pending:boolean;error?:string}>>({})
  useEffect(()=>()=>{chatRequests.current.forEach(controller=>controller.abort())},[])
  latest.current=workspace;conflictRef.current=syncConflict;errorRef.current=syncError
  const [dialog,setDialog]=useState<{title:string;value:string;onSubmit:(value:string)=>void}|null>(null)
  useEffect(()=>{loadWorkspace().then(next=>{setWorkspace(next);setReady(true);const current=next.worlds.find(world=>world.id===next.activeWorldId)||next.worlds[0];if(current){setSelection({nodeId:current.id});setExpanded({[current.id]:true,...Object.fromEntries(current.nodes.filter(node=>node.type==='collection').map(node=>[node.id,true]))})}}).catch(error=>setLoadError(String(error)))},[])
  const handleSyncError=(error:unknown)=>{setSaveStatus('error');setSyncError(error instanceof Error?error.message:String(error));if(error instanceof MarkdownConflictError)setSyncConflict(error)}
  useEffect(()=>{
    if(!ready||syncConflict)return
    setSaveStatus('saving')
    const timer=setTimeout(()=>{busy.current=true;saveWorkspace(workspace).then(next=>{setWorkspace(current=>applySyncResult(workspace,current,next));setSaveStatus('saved');setSyncError('')}).catch(handleSyncError).finally(()=>{busy.current=false})},400)
    return()=>clearTimeout(timer)
  },[workspace,ready,syncConflict])
  useEffect(()=>{
    if(!ready)return
    let cancelled=false
    const timer=setTimeout(async()=>{
      for(const job of functionJobs(workspace)){
        if(cancelled)return
        let output:Awaited<ReturnType<typeof runFunctionValue>>={value:''},error:string|undefined
        try{if(job.error)throw new Error(job.error);output=await runFunctionValue(job.fn,job.input,workspace.worlds.find(w=>w.id===job.worldId),job.context)}catch(e){error=String(e)}
        if(cancelled)return
        const result={functionId:job.fn.id,name:job.fn.name,fileName:`../../functions/${functionFile(job.fn)}`,input:job.input,...output,source:job.source,...(job.contextKey?{contextKey:job.contextKey}:{}),...(error?{error}:{})}
        setWorkspace(current=>applyFunctionResult(current,job,result))
      }
    },500)
    return()=>{cancelled=true;clearTimeout(timer)}
  },[workspace,ready])
  const reloadMarkdown=()=>{
    if(!ready||busy.current||conflictRef.current)return
    const submitted=latest.current;busy.current=true
    refreshWorkspace(submitted).then(async next=>{
      if(errorRef.current){next=await saveWorkspace(applySyncResult(submitted,latest.current,next));setSyncError('');setSaveStatus('saved')}
      setWorkspace(current=>applySyncResult(submitted,current,next))
    }).catch(handleSyncError).finally(()=>{busy.current=false})
  }
  useEffect(()=>{
    if(!ready)return
    const poll=setInterval(()=>{if(document.visibilityState==='visible')reloadMarkdown()},3000)
    window.addEventListener('focus',reloadMarkdown)
    document.addEventListener('visibilitychange',reloadMarkdown)
    return()=>{clearInterval(poll);window.removeEventListener('focus',reloadMarkdown);document.removeEventListener('visibilitychange',reloadMarkdown)}
  },[ready])
  const resolveSyncConflict=(choice:'local'|'remote')=>{if(!syncConflict)return;const selected=choice==='local'?syncConflict.local:syncConflict.remote;clearMarkdownConflict();setWorkspace(current=>applySyncResult(syncConflict.submitted,current,selected));setSyncConflict(null);setSyncError('')}
  const world=workspace.worlds.find(item=>item.id===workspace.activeWorldId)||workspace.worlds[0]
  const node=world?.nodes.find(item=>item.id===selection?.nodeId)
  const doc=world?.documents.find(item=>item.id===node?.classId)
  const theme=activeTheme(workspace)
  const setWorld=(next:World)=>setWorkspace(current=>({...current,worlds:current.worlds.map(item=>item.id===next.id?next:item)}))
  const sendChat=async(content:string)=>{
    if(!world)return
    const submitted=latest.current,currentWorld=submitted.worlds.find(item=>item.id===world.id);if(!currentWorld)return
    const existing=currentWorld.chat.conversations.find(item=>item.id===currentWorld.chat.activeConversationId),conversation=existing||{id:uid(),title:content.slice(0,24),messages:[],createdAt:Date.now()},key=`${world.id}:${conversation.id}`
    if(chatRequests.current.has(key))return
    const next={...conversation,messages:[...conversation.messages,{id:uid(),role:'user' as const,content,createdAt:Date.now()}]},controller=new AbortController()
    chatRequests.current.set(key,controller);setChatRuns(runs=>({...runs,[key]:{pending:true}}))
    setWorkspace(state=>({...state,worlds:state.worlds.map(item=>item.id===world.id?{...item,chat:{...item.chat,activeConversationId:conversation.id,conversations:existing?item.chat.conversations.map(c=>c.id===conversation.id?next:c):[...item.chat.conversations,next]}}:item)}))
    try{
      const agent=submitted.agents?.find(item=>item.id===currentWorld.chat.agent),model=submitted.models?.find(item=>item.id===currentWorld.chat.modelId)
      let value:string,variables:Record<string,unknown>|undefined
      if(agent){const output=await runAgent(agent,content,submitted,currentWorld,controller.signal);value=workflowText(output.value);variables=output.variables}
      else{if(!model)throw new Error('请选择 LLM 模型或 Agent');value=await callLLM(model,next.messages.map(message=>({role:message.role,content:message.content})),controller.signal)}
      if(controller.signal.aborted)return
      setWorkspace(state=>({...state,...(agent&&variables?{agents:state.agents?.map(item=>item.id===agent.id?{...item,memory:{...item.memory,[currentWorld.id]:variables!}}:item)}:{}),worlds:state.worlds.map(item=>item.id===world.id?{...item,chat:{...item.chat,conversations:item.chat.conversations.map(c=>c.id===conversation.id?{...c,messages:[...c.messages,{id:uid(),role:'assistant',content:value,createdAt:Date.now()}]}:c)}}:item)}))
      setChatRuns(runs=>({...runs,[key]:{pending:false}}))
    }catch(error){setChatRuns(runs=>({...runs,[key]:{pending:false,error:controller.signal.aborted?'已停止等待，远程请求可能仍在执行':String(error)}}))}
    finally{chatRequests.current.delete(key)}
  }
  const setDoc=(next:ClassDocument)=>world&&setWorld({...world,documents:world.documents.map(item=>item.id===next.id?{...next,entities:next.entities.map(entity=>({...entity,fields:syncFields(next.schema,entity.fields)}))}:item)})
  const ask=(title:string,initial:string,onSubmit:(value:string)=>void)=>setDialog({title,value:initial,onSubmit})
  const selectPluginFolder=(section:PluginSection,id:string|null)=>{setPluginSection(section);setPluginFolderId(id);setSelectedFunction(null);setSelectedTool(null)}
  const selectFunction=(id:string|null)=>{setSelectedFunction(id);if(id){const fn=workspace.functions?.find(fn=>fn.id===id);setPluginSection('functions');if(fn)setPluginFolderId(fn.folderId||null)}}
  useEffect(()=>{if(selectedFunction){const fn=workspace.functions?.find(fn=>fn.id===selectedFunction);if(fn)setPluginFolderId(fn.folderId||null)}},[selectedFunction,workspace.functions])
  const addPluginFolder=(section:PluginSection,parentId:string|null)=>ask('新文件夹名称','新文件夹',name=>{
    const folder=createPluginFolder(latest.current,section,parentId,name)
    setWorkspace(current=>({...current,pluginFolders:[...(current.pluginFolders||[]),folder]}));selectPluginFolder(section,folder.id)
  })
  const currentPluginFolder=workspace.pluginFolders?.find(f=>f.id===pluginFolderId)
  const pluginFolderTools=<><button className="ghost" onClick={()=>addPluginFolder(pluginSection,pluginFolderId)}><FolderPlus size={16}/> 新建文件夹</button>{currentPluginFolder&&<><button className="ghost" onClick={()=>ask('重命名文件夹',currentPluginFolder.name,name=>setWorkspace(current=>({...current,pluginFolders:current.pluginFolders?.map(f=>f.id===pluginFolderId?{...f,name}:f)})))}><PencilLine size={15}/> 重命名</button><button className="ghost danger" onClick={()=>{if(confirm('删除此文件夹？其中的文件和子文件夹会移到上一级。')){setWorkspace(current=>removePluginFolder(current,currentPluginFolder.id));selectPluginFolder(pluginSection,currentPluginFolder.parentId)}}}><Trash2 size={15}/> 删除文件夹</button></>}</>
  const submitDialog=()=>{if(!dialog?.value.trim())return;const callback=dialog.onSubmit,value=dialog.value.trim();setDialog(null);callback(value)}
  const addWorld=()=>ask('新世界名称','未命名世界',name=>{setShowProjects(false);const next=createWorld(name);setWorkspace(current=>({...current,worlds:[...current.worlds,next],activeWorldId:next.id}));setSelection({nodeId:next.id});setExpanded({[next.id]:true,...Object.fromEntries(next.nodes.filter(node=>node.type==='collection').map(node=>[node.id,true]))});setProjectsOpen(true);setPage('create')})
  const selectWorld=(next:World)=>{setShowProjects(false);setWorkspace(current=>({...current,activeWorldId:next.id}));setSelection({nodeId:next.id})}
  const selectNode=(next:Selection,current:World|undefined=world)=>{setShowProjects(false);setSelection(next);if(current&&current.id!==workspace.activeWorldId)setWorkspace(previous=>({...previous,activeWorldId:current.id}))}
  const selectConversation=(current:World,nodeId:string,id:string|null)=>{setShowProjects(false);setWorkspace(previous=>({...previous,activeWorldId:current.id,worlds:previous.worlds.map(item=>item.id===current.id?{...item,chat:{...item.chat,activeConversationId:id}}:item)}));setSelection({nodeId})}
  const removeWorld=()=>{if(!world||!confirm(`删除项目“${world.name}”及其中的全部内容？`))return;const remaining=workspace.worlds.filter(item=>item.id!==world.id);setWorkspace({...workspace,worlds:remaining,activeWorldId:remaining[0]?.id||null});setSelection(remaining[0]?{nodeId:remaining[0].id}:null)}
  const removeDoc=()=>{if(!world||!doc||doc.protected)return;if(!confirm(`删除“${doc.name}”及全部实例？`))return;setWorld({...world,documents:world.documents.filter(item=>item.id!==doc.id),nodes:world.nodes.filter(item=>item.classId!==doc.id),views:Object.fromEntries(Object.entries(world.views||{}).filter(([,v])=>v.parentClassId!==doc.id))});setSelection({nodeId:node?.parentId||world.nodes[0].id})}
  const [interfaceParent,setInterfaceParent]=useState<{worldId:string;classId:string;parentId:string|null}|null>(null)
  const renderTree=(current:World,parentId:string|null):React.ReactNode=>current.nodes.filter(item=>item.parentId===parentId).map(item=>{
    const Icon=viewIcon(item),isOpen=expanded[item.id]??false,selected=world?.id===current.id&&selection?.nodeId===item.id&&!selection.config,hasChild=item.type==='collection'||item.type==='file'||item.type==='view'
    return <div className="tree-node" key={item.id}><div className={`tree-row ${selected?'active':''}`}><button data-context-actions={JSON.stringify(item.type==='collection'?['新建集合','新建界面','新建类',...(!item.protected?['删除集合']:[])]:item.type==='file'?['新建实例','新建界面','导入 MD','Markdown 预览',...(!current.documents.find(d=>d.id===item.classId)?.protected?['删除类']:[])]:item.viewType==='graph'?['连线',current.documents.find(d=>d.id===item.classId)?.name||'对象','关系文字','删除界面']:item.viewType==='map'?['放大','缩小','适应屏幕','删除界面']:[])} className="tree-main" onClick={()=>selectNode({nodeId:item.id},current)} onDoubleClick={()=>{if(hasChild)setExpanded(previous=>({...previous,[item.id]:!isOpen}))}}><Icon size={15}/><span>{item.name}</span></button>{hasChild&&<TreeDisclosure open={isOpen} name={item.name} onToggle={()=>setExpanded(previous=>({...previous,[item.id]:!isOpen}))}/>}</div>{isOpen&&item.type!=='collection'&&<div className="tree-branch"><div className={`tree-row config-row ${selection?.nodeId===item.id&&selection.config?'active':''}`}><button data-context-actions={JSON.stringify(item.type==='file'?['添加属性']:item.viewType==='graph'||item.viewType==='map'?['删除界面']:[])} className="tree-main" onClick={()=>selectNode({nodeId:item.id,config:true},current)}>{item.type==='file'?<Settings size={14}/>:<Settings2 size={14}/>}<span>{item.name}{item.type==='file'?'属性配置':'配置'}</span></button></div>{item.viewType==='chat'&&<><div className="tree-row chat-new-row"><button className="tree-main" onClick={()=>selectConversation(current,item.id,null)}><Plus size={14}/><span>新建聊天</span></button></div>{(current.chat.conversations||[]).slice().reverse().map(conversation=><div key={conversation.id} className={`tree-row chat-record-row ${selected&&current.chat.activeConversationId===conversation.id?'active':''}`}><button className="tree-main" title={conversation.title} onClick={()=>selectConversation(current,item.id,conversation.id)}><MessageCircle size={14}/><span>{conversation.title}</span></button><button className="chat-record-delete icon-button subtle" title="删除对话" onClick={()=>setWorld({...current,chat:{...current.chat,conversations:current.chat.conversations.filter(chat=>chat.id!==conversation.id),activeConversationId:current.chat.activeConversationId===conversation.id?null:current.chat.activeConversationId}})}><Trash2 size={13}/></button></div>)}</>}</div>}{isOpen&&item.type==='collection'&&<div className="tree-branch">{renderTree(current,item.id)}</div>}</div>
  })
  const renderSidebar=()=>{
    if(page==='settings')return <aside className="sidebar settings-sidebar"><div className="sidebar-header"><strong>设置</strong></div><SettingsSidebar workspace={workspace} onChange={setWorkspace}/></aside>
    if(page==='models')return <aside className="sidebar models-sidebar"><div className="sidebar-header"><strong>模型</strong></div><ModelsSidebar workspace={workspace} section={modelSection} selected={selectedModelId} onSelect={(section,id)=>{setModelSection(section);setSelectedModelId(id)}}/></aside>
    if(page==='plugins')return <aside className="sidebar plugin-sidebar"><div className="sidebar-header"><strong>插件</strong></div><PluginTree workspace={workspace} section={pluginSection} folderId={pluginFolderId} selectedFunction={selectedFunction} selectedTool={selectedTool} onTool={id=>{setPluginSection('tools');setSelectedFunction(null);setSelectedTool(id);setPluginFolderId(workspace.tools?.find(item=>item.id===id)?.folderId||null)}} onFolder={selectPluginFolder} onFunction={selectFunction} onAddFolder={addPluginFolder}/></aside>
    return <aside className="sidebar creation-sidebar"><div className="sidebar-header"><div className="sidebar-brand">MY<span>UNIVERSE</span></div></div><div className="projects-scroll"><div className="project-nav"><button className="tree-row create-entry" onClick={addWorld}><Plus size={17}/><span>创建世界</span></button><div className={`tree-row projects-heading ${showProjects?'active':''}`}><button data-context-actions={JSON.stringify(['创建世界'])} className="tree-main" onClick={()=>setShowProjects(true)} onDoubleClick={()=>setProjectsOpen(!projectsOpen)}><Folder size={17}/><span>我的项目</span><strong>{workspace.worlds.length}</strong></button><TreeDisclosure open={projectsOpen} name="我的项目" onToggle={()=>setProjectsOpen(!projectsOpen)}/></div></div>{projectsOpen&&<div className="projects-children tree-branch"><div className="tree project-tree">{workspace.worlds.map(item=><div className="tree-node world-tree-node" key={item.id}><div className={`tree-row world-row ${world?.id===item.id?'active-world':''}`}><button data-context-actions={JSON.stringify(['新建集合','新建界面','新建类','删除项目'])} className="tree-main" onClick={()=>selectWorld(item)} onDoubleClick={()=>setExpanded(previous=>({...previous,[item.id]:!previous[item.id]}))}><Layers3 size={16}/><span>{item.name}</span></button><TreeDisclosure open={!!expanded[item.id]} name={item.name} onToggle={()=>setExpanded(previous=>({...previous,[item.id]:!previous[item.id]}))}/></div>{expanded[item.id]&&<div className="tree-branch">{renderTree(item,null)}</div>}</div>)}</div></div>}</div></aside>
  }
  const renderMain=()=>{
    if(loadError)return <div className="loading" role="alert">工作区加载失败：{loadError}。请修复文件后重新打开程序。</div>
    if(!ready)return <div className="loading">正在打开宇宙…</div>
    if(page==='settings')return <SettingsPage workspace={workspace} onChange={setWorkspace}/>
    if(page==='models')return modelSection==='llm'?<ModelsPage workspace={workspace} onChange={setWorkspace} selectedId={selectedModelId} onSelect={setSelectedModelId}/>:<ModelWorkflowPage workspace={workspace} onChange={setWorkspace} selectedId={selectedModelId} onSelect={setSelectedModelId} mode={modelSection==='sd'?'sd':'agent'}/>
    if(page==='plugins'&&pluginSection==='tools')return <ToolsPage workspace={workspace} onChange={setWorkspace} folderId={pluginFolderId} selected={selectedTool} onSelect={setSelectedTool} onFolder={id=>selectPluginFolder('tools',id)} folderTools={pluginFolderTools}/>
    if(page==='plugins')return pluginSection==='functions'?<FunctionsPage workspace={workspace} onChange={setWorkspace} selected={selectedFunction} onSelect={selectFunction} folderId={pluginFolderId} folderTools={pluginFolderTools} onFolder={id=>selectPluginFolder('functions',id)}/>:<div className="page-scroll"><div className="page-heading"><div><div className="eyebrow">PLUGINS · {pluginSectionNames[pluginSection]}{pluginFolderPath(workspace,pluginFolderId).map(f=>` / ${f.name}`).join('')}</div><h1>{currentPluginFolder?.name||pluginSectionNames[pluginSection]}</h1><p>使用文件夹整理{pluginSectionNames[pluginSection]}。{pluginSectionNames[pluginSection]}文件编辑功能待实现。</p></div><div className="heading-actions">{pluginFolderTools}</div></div><div className="collection-grid"><PluginFolderContents workspace={workspace} section={pluginSection} folderId={pluginFolderId} onOpen={id=>selectPluginFolder(pluginSection,id)}/></div></div>
    if(showProjects)return <div className="page-scroll"><div className="page-heading"><div><div className="eyebrow">PROJECTS</div><h1>我的项目</h1></div><div className="heading-actions"><button className="primary" onClick={addWorld}><Plus size={16}/> 创建世界</button></div></div><div className="collection-grid">{workspace.worlds.map(project=><button className="collection-card" key={project.id} onClick={()=>selectWorld(project)}><Layers3 size={22}/><div><strong>{project.name}</strong><span>世界项目</span></div></button>)}</div>{!workspace.worlds.length&&<div className="empty-card"><Folder size={25}/><h2>暂无项目</h2></div>}</div>
    if(!world)return <div className="welcome"><div className="welcome-symbol"><Sparkles size={34}/></div><div className="eyebrow">YOUR CREATIVE UNIVERSE</div><h1>从一个世界开始</h1><p>把人物、势力、地点与事件编织成属于你的故事。</p><button className="primary big" onClick={addWorld}><Plus size={19}/> 创建世界</button></div>
    if(selection?.nodeId===world.id||!node)return <CollectionPage world={world} node={{id:world.id,name:world.name,type:'collection',parentId:null}} root onDeleteProject={removeWorld} onChange={setWorld} onSelect={selectNode} ask={ask}/>
    if(node.type==='collection')return <CollectionPage world={world} node={node} onChange={setWorld} onSelect={selectNode} ask={ask}/>
    if(node.type==='file'&&doc)return selection?.config?<SchemaEditor world={world} doc={doc} onChange={setDoc}/>:<DocumentWorkspace key={doc.id} focusEntity={selection?.entityId} focusToken={selection?.focusToken} world={world} doc={doc} onChange={setDoc} onDelete={removeDoc} onNewView={()=>setInterfaceParent({worldId:world.id,classId:doc.id,parentId:node.parentId})}/>
    if(node.viewType==='graph'||node.viewType==='map'){
      const view=world.views?.[node.id]
      if(!view)return <div className="loading">界面父类型已不存在，请重新创建界面。</div>
      const open=(entityId:string)=>{const file=world.nodes.find(item=>item.type==='file'&&item.classId===view.parentClassId);if(file)selectNode({nodeId:file.id,entityId,focusToken:Date.now()})}
      const remove=()=>{if(confirm(`删除界面“${view.name}”？父类型和实例将保留。`)){setWorld(removeInterfaceView(world,view.id));selectNode({nodeId:node.parentId||world.id})}}
      return selection?.config?<InterfaceConfigPage world={world} view={view} onChange={setWorld} onDelete={remove}/>:<div className="interface-workspace"><div className="editor-file-actions interface-file-actions"><button className="ghost danger" onClick={remove}><Trash2 size={16}/> 删除界面</button></div>{node.viewType==='graph'?<GraphPage world={world} view={view} onChange={setWorld} onOpenPerson={open}/>:<MapPage world={world} view={view} onChange={setWorld} onOpen={open}/>}</div>
    }
    if(node.viewType==='chat')return selection?.config?<ViewConfig kind="chat" world={world} onChange={setWorld}/>:<ChatPage world={world} onChange={setWorld} models={workspace.models||[]} agents={workspace.agents||[]} onSend={content=>{void sendChat(content)}} sending={!!chatRuns[`${world.id}:${world.chat.activeConversationId}`]?.pending} error={chatRuns[`${world.id}:${world.chat.activeConversationId}`]?.error} onStop={()=>chatRequests.current.get(`${world.id}:${world.chat.activeConversationId}`)?.abort()} onModelSettings={()=>{setModelSection('llm');setSelectedModelId(null);setPage('models')}}/>
    return null
  }
  const pageKey=page==='create'&&showProjects?'create:projects':page==='create'?`${page}:${world?.id}:${selection?.nodeId}:${!!selection?.config}:${node?.viewType==='chat'?world?.chat.activeConversationId||'new':''}`:page==='plugins'?`${page}:${pluginSection}:${pluginFolderId}:${selectedFunction}:${selectedTool}`:`${page}:${modelSection}:${selectedModelId}`
  if(!memories.current.has(pageKey))memories.current.set(pageKey,new Map())
  const fileLocation:string[]|null=page==='models'||page==='settings'?['workspace.json']:page==='plugins'?pluginSection==='functions'?(selectedFunction&&workspace.functions?.find(fn=>fn.id===selectedFunction)?['functions',functionFile(workspace.functions.find(fn=>fn.id===selectedFunction)!)]:['functions']):['workspace.json']:showProjects||!world?['workspace.json']:selection?.config&&node?.type==='file'&&doc?['worlds',world.id,doc.fileName.replace(/\.md$/i,'.schema.json')]:node?.type==='file'&&doc?['worlds',world.id,doc.fileName]:(selection?.config||!!world.views?.[node?.id||''])&&node?.viewType?['worlds',world.id,world.views?.[node.id]?.fileName||'聊天框配置.json']:!node||node.type==='collection'?['worlds',world.id]:null
  const revealLocation=async()=>{
    if(!fileLocation)return
    try{const submitted=latest.current,next=await saveWorkspace(submitted);setWorkspace(current=>applySyncResult(submitted,current,next));setSaveStatus('saved');setSyncError('');await invoke('reveal_file',{components:fileLocation})}catch(error){handleSyncError(error)}
  }
  const folderPage=page==='create'?(showProjects||!selection?.config&&(!node||node.type==='collection')):page==='plugins'?(pluginSection==='functions'?!selectedFunction:pluginSection==='tools'?!selectedTool:true):page==='models'?!selectedModelId:false
  return <FunctionContext.Provider value={workspace.functions||[]}><div className={`app-shell ${sidebarCollapsed?'sidebar-collapsed':''}`} onClick={()=>setSidebarMenu(null)} onContextMenu={event=>{event.preventDefault();const target=event.target as HTMLElement,button=target.closest('.sidebar .tree-main,.sidebar .settings-tree-heading,.sidebar .model-nav-row,.sidebar .theme-nav-row');if(button&&!button.classList.contains('projects-heading')){setSidebarMenu({x:event.clientX,y:event.clientY,target:button as HTMLButtonElement,names:JSON.parse((button as HTMLElement).dataset.contextActions||'[]')})}}} style={themeStyle(theme.colors)} data-theme={theme.id}><nav className="rail"><div className="brand-mark"><Sparkles size={21}/></div><div className="rail-items"><span className="rail-selection" aria-hidden="true" style={{transform:`translateY(${({create:0,plugins:1,models:2,settings:3}[page])*52}px)`}}/><button title="创作" className={page==='create'?'active':''} onClick={()=>{setPage('create')}}><PencilLine size={21}/></button><button title="插件" className={page==='plugins'?'active':''} onClick={()=>setPage('plugins')}><Puzzle size={21}/></button><button title="模型" className={page==='models'?'active':''} onClick={()=>setPage('models')}><Sparkles size={21}/></button><button title="设置" className={page==='settings'?'active':''} onClick={()=>setPage('settings')}><Bolt size={21}/></button></div><div className="rail-bottom"><button title="帮助"><CircleHelp size={19}/></button><div className="user-avatar">U</div></div></nav><div className="sidebar-region" inert={sidebarCollapsed} aria-hidden={sidebarCollapsed}>{renderSidebar()}</div><button className="sidebar-toggle icon-button" title={sidebarCollapsed?'展开侧边栏':'收起侧边栏'} aria-label={sidebarCollapsed?'展开侧边栏':'收起侧边栏'} aria-expanded={!sidebarCollapsed} onClick={()=>{setSidebarCollapsed(!sidebarCollapsed);setSidebarMenu(null)}}><PanelLeft size={20}/></button><main className={`main-area ${folderPage?'folder-page':'object-page'}`}><div className="topbar"><div className="breadcrumbs"><span>{page==='create'?showProjects?'我的项目':world?.name||'我的宇宙':page==='settings'?'设置':page==='models'?'模型':'插件'}</span>{page==='create'&&!showProjects&&node&&<><ChevronRight size={14}/><strong>{node.name}{selection?.config?' / 配置':''}</strong></>}</div><TopbarActions revision={pageKey} location={fileLocation} onReveal={revealLocation}/></div>{syncError&&<div className="markdown-sync-banner" role="alert"><span>{syncError}</span>{syncConflict?<div><button className="ghost" onClick={()=>resolveSyncConflict('remote')}>采用文件内容</button><button className="ghost" onClick={()=>resolveSyncConflict('local')}>保留界面内容</button></div>:<button className="ghost" onClick={reloadMarkdown}>重新读取</button>}</div>}{<PageSession key={pageKey} memory={memories.current.get(pageKey)!}>{renderMain()}</PageSession>}</main>{interfaceParent&&workspace.worlds.find(w=>w.id===interfaceParent.worldId)&&<CreateInterfaceDialog world={workspace.worlds.find(w=>w.id===interfaceParent.worldId)!} parentId={interfaceParent.parentId} initialClassId={interfaceParent.classId} onChange={setWorld} onSelect={selectNode} onClose={()=>setInterfaceParent(null)}/>}<SidebarActions target={sidebarMenu?.target} names={sidebarMenu?.names} position={sidebarMenu} revision={pageKey+JSON.stringify(workspace.functions?.map(fn=>fn.id))} onClose={()=>setSidebarMenu(null)}/>{dialog&&<div className="modal-backdrop" onPointerDown={()=>setDialog(null)}><div className="modal" onPointerDown={event=>event.stopPropagation()}><div className="eyebrow">CREATE IN MYUNIVERSE</div><h2>{dialog.title}</h2><input autoFocus value={dialog.value} onChange={event=>setDialog({...dialog,value:event.target.value})} onKeyDown={event=>{if(event.key==='Enter')submitDialog();if(event.key==='Escape')setDialog(null)}}/><div className="modal-actions"><button className="ghost" onClick={()=>setDialog(null)}>取消</button><button className="primary" onClick={submitDialog}>确认创建</button></div></div></div>}</div></FunctionContext.Provider>
}
