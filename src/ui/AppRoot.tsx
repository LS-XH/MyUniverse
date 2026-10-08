import { useEffect, useRef, useState } from 'react'
import { Bolt, ChevronDown, ChevronRight, CircleHelp, Folder, Layers3, MessageCircle, MoreHorizontal, Orbit, PencilLine, Plus, Trash2, Settings, Settings2, Sparkles } from 'lucide-react'
import { createWorld } from '../model/templates'
import { activeTheme, themeStyle } from '../model/themes'
import { ClassDocument, Workspace, World } from '../model/types'
import { applySyncResult, clearMarkdownConflict, loadWorkspace, MarkdownConflictError, refreshWorkspace, saveWorkspace } from '../services/storage'
import { CollectionPage, GraphPage, ViewConfig, syncFields, viewIcon } from './App'
import DocumentWorkspace from './DocumentWorkspace'
import SchemaEditor from './SchemaEditor'
import GraphConfigPage from './GraphConfigPage'
import ChatPage from './ChatPage'
import MapPage from './MapPage'
import ModelsPage from './ModelsPage'
import SettingsPage, { SettingsSidebar } from './SettingsPage'

type Selection={nodeId:string;config?:boolean}
type Page='create'|'plugins'|'settings'

export default function AppRoot(){
  const [workspace,setWorkspace]=useState<Workspace>({worlds:[],activeWorldId:null,themeId:'violet',themes:[]})
  const [ready,setReady]=useState(false),[selection,setSelection]=useState<Selection|null>(null),[page,setPage]=useState<Page>('create')
  const [settingsSection,setSettingsSection]=useState<'themes'|'models'>('themes'),[selectedModelId,setSelectedModelId]=useState<string|null>(null)
  const [expanded,setExpanded]=useState<Record<string,boolean>>({}),[projectsOpen,setProjectsOpen]=useState(true)
  const [,setSaveStatus]=useState<'saved'|'saving'|'error'>('saved')
  const [syncError,setSyncError]=useState(''),[loadError,setLoadError]=useState(''),[syncConflict,setSyncConflict]=useState<MarkdownConflictError|null>(null)
  const latest=useRef(workspace),busy=useRef(false),conflictRef=useRef(syncConflict),errorRef=useRef(syncError)
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
  const setDoc=(next:ClassDocument)=>world&&setWorld({...world,documents:world.documents.map(item=>item.id===next.id?{...next,entities:next.entities.map(entity=>({...entity,fields:syncFields(next.schema,entity.fields)}))}:item)})
  const ask=(title:string,initial:string,onSubmit:(value:string)=>void)=>setDialog({title,value:initial,onSubmit})
  const submitDialog=()=>{if(!dialog?.value.trim())return;const callback=dialog.onSubmit,value=dialog.value.trim();setDialog(null);callback(value)}
  const addWorld=()=>ask('新世界名称','未命名世界',name=>{const next=createWorld(name);setWorkspace(current=>({...current,worlds:[...current.worlds,next],activeWorldId:next.id}));setSelection({nodeId:next.id});setExpanded({[next.id]:true,...Object.fromEntries(next.nodes.filter(node=>node.type==='collection').map(node=>[node.id,true]))});setProjectsOpen(true);setPage('create')})
  const selectWorld=(next:World)=>{setWorkspace(current=>({...current,activeWorldId:next.id}));setSelection({nodeId:next.id});setExpanded(current=>({...current,[next.id]:!current[next.id]}))}
  const selectNode=(next:Selection,current:World|undefined=world)=>{setSelection(next);if(current&&current.id!==workspace.activeWorldId)setWorkspace(previous=>({...previous,activeWorldId:current.id}))}
  const selectConversation=(current:World,nodeId:string,id:string|null)=>{setWorkspace(previous=>({...previous,activeWorldId:current.id,worlds:previous.worlds.map(item=>item.id===current.id?{...item,chat:{...item.chat,activeConversationId:id}}:item)}));setSelection({nodeId})}
  const removeWorld=()=>{if(!world||!confirm(`删除项目“${world.name}”及其中的全部内容？`))return;const remaining=workspace.worlds.filter(item=>item.id!==world.id);setWorkspace({...workspace,worlds:remaining,activeWorldId:remaining[0]?.id||null});setSelection(remaining[0]?{nodeId:remaining[0].id}:null)}
  const removeDoc=()=>{if(!world||!doc||doc.protected)return;if(!confirm(`删除“${doc.name}”及全部实例？`))return;setWorld({...world,documents:world.documents.filter(item=>item.id!==doc.id),nodes:world.nodes.filter(item=>item.classId!==doc.id)});setSelection({nodeId:node?.parentId||world.nodes[0].id})}
  const renderTree=(current:World,parentId:string|null):React.ReactNode=>current.nodes.filter(item=>item.parentId===parentId).map(item=>{
    const Icon=viewIcon(item),isOpen=expanded[item.id]??false,selected=world?.id===current.id&&selection?.nodeId===item.id&&!selection.config,hasChild=item.type==='collection'||item.type==='file'||item.type==='view'
    return <div className="tree-node" key={item.id}><div className={`tree-row ${selected?'active':''}`}><button className="tree-main" aria-expanded={isOpen} onClick={()=>{selectNode({nodeId:item.id},current);if(hasChild)setExpanded(previous=>({...previous,[item.id]:!isOpen}))}}>{hasChild?(isOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>):<span className="tree-spacer"/>}<Icon size={15}/><span>{item.name}</span></button></div>{isOpen&&item.type!=='collection'&&<div className="tree-branch"><div className={`tree-row config-row ${selection?.nodeId===item.id&&selection.config?'active':''}`}><button className="tree-main" onClick={()=>selectNode({nodeId:item.id,config:true},current)}>{item.type==='file'?<Settings size={14}/>:<Settings2 size={14}/>}<span>{item.name}{item.type==='file'?'属性配置':'配置'}</span></button></div>{item.viewType==='chat'&&<><div className="tree-row chat-new-row"><button className="tree-main" onClick={()=>selectConversation(current,item.id,null)}><Plus size={14}/><span>新建聊天</span></button></div>{(current.chat.conversations||[]).slice().reverse().map(conversation=><div key={conversation.id} className={`tree-row chat-record-row ${selected&&current.chat.activeConversationId===conversation.id?'active':''}`}><button className="tree-main" title={conversation.title} onClick={()=>selectConversation(current,item.id,conversation.id)}><MessageCircle size={14}/><span>{conversation.title}</span></button><button className="chat-record-delete icon-button subtle" title="删除对话" onClick={()=>setWorld({...current,chat:{...current.chat,conversations:current.chat.conversations.filter(chat=>chat.id!==conversation.id),activeConversationId:current.chat.activeConversationId===conversation.id?null:current.chat.activeConversationId}})}><Trash2 size={13}/></button></div>)}</>}</div>}{isOpen&&item.type==='collection'&&<div className="tree-branch">{renderTree(current,item.id)}</div>}</div>
  })
  const renderSidebar=()=>{
    if(page==='settings')return <aside className="sidebar settings-sidebar"><div className="sidebar-header"><strong>设置</strong><Settings size={18}/></div><SettingsSidebar workspace={workspace} onChange={setWorkspace} section={settingsSection} selectedModelId={selectedModelId} onSection={setSettingsSection} onSelectModel={setSelectedModelId}/></aside>
    if(page==='plugins')return <aside className="sidebar plugin-sidebar"><div className="sidebar-header"><strong>插件</strong><Orbit size={18}/></div><div className="sidebar-group-title"><Sparkles size={16}/> 扩展能力</div><button className="plugin-nav active"><Layers3 size={15}/> 已安装</button><button className="plugin-nav"><Plus size={15}/> 发现插件</button></aside>
    return <aside className="sidebar creation-sidebar"><div className="sidebar-header"><div className="sidebar-brand">MY<span>UNIVERSE</span></div><MoreHorizontal size={18}/></div><div className="project-nav"><button className="tree-row create-entry" onClick={addWorld}><span className="tree-spacer"/><Plus size={17}/><span>创建世界</span></button><button className="tree-row projects-heading tree-main" aria-expanded={projectsOpen} onClick={()=>setProjectsOpen(!projectsOpen)}>{projectsOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>}<Folder size={17}/><span>我的项目</span><strong>{workspace.worlds.length}</strong></button></div>{projectsOpen&&<div className="projects-scroll"><div className="projects-children tree-branch"><div className="tree project-tree">{workspace.worlds.map(item=><div className="tree-node world-tree-node" key={item.id}><div className={`tree-row world-row ${world?.id===item.id?'active-world':''}`}><button className="tree-main" aria-expanded={!!expanded[item.id]} onClick={()=>selectWorld(item)}>{expanded[item.id]?<ChevronDown size={14}/>:<ChevronRight size={14}/>}<Layers3 size={16}/><span>{item.name}</span></button></div>{expanded[item.id]&&<div className="tree-branch">{renderTree(item,null)}</div>}</div>)}</div></div></div>}</aside>
  }
  const renderMain=()=>{
    if(loadError)return <div className="loading" role="alert">工作区加载失败：{loadError}。请修复文件后重新打开程序。</div>
    if(!ready)return <div className="loading">正在打开宇宙…</div>
    if(page==='settings')return settingsSection==='models'?<ModelsPage workspace={workspace} onChange={setWorkspace} selectedId={selectedModelId} onSelect={setSelectedModelId}/>:<SettingsPage workspace={workspace} onChange={setWorkspace}/>
    if(page==='plugins')return <div className="page-scroll simple-page"><div className="eyebrow">EXTENSIONS</div><h1>插件</h1><p>在这里管理创作能力与外部工具。</p><div className="empty-card"><Bolt size={28}/><h2>插件中心即将开放</h2><p>后续可以在这里扩展写作、插图与资料检索能力。</p></div></div>
    if(!world)return <div className="welcome"><div className="welcome-symbol"><Sparkles size={34}/></div><div className="eyebrow">YOUR CREATIVE UNIVERSE</div><h1>从一个世界开始</h1><p>把人物、势力、地点与事件编织成属于你的故事。</p><button className="primary big" onClick={addWorld}><Plus size={19}/> 创建世界</button></div>
    if(selection?.nodeId===world.id||!node)return <CollectionPage world={world} node={{id:world.id,name:world.name,type:'collection',parentId:null}} root onDeleteProject={removeWorld} onChange={setWorld} onSelect={selectNode} ask={ask}/>
    if(node.type==='collection')return <CollectionPage world={world} node={node} onChange={setWorld} onSelect={selectNode} ask={ask}/>
    if(node.type==='file'&&doc)return selection?.config?<SchemaEditor world={world} doc={doc} onChange={setDoc}/>:<DocumentWorkspace key={doc.id} world={world} doc={doc} onChange={setDoc} onDelete={removeDoc}/>
    if(node.viewType==='graph')return selection?.config?<GraphConfigPage world={world} onChange={setWorld}/>:<GraphPage world={world} onChange={setWorld} onOpenPerson={()=>{const person=world.nodes.find(item=>item.classId==='people');if(person)selectNode({nodeId:person.id})}}/>
    if(node.viewType==='map')return selection?.config?<ViewConfig kind="map" world={world} onChange={setWorld}/>:<MapPage/>
    if(node.viewType==='chat')return selection?.config?<ViewConfig kind="chat" world={world} onChange={setWorld}/>:<ChatPage world={world} onChange={setWorld} models={workspace.models||[]} onModelSettings={()=>{setSettingsSection('models');setPage('settings')}}/>
    return null
  }
  return <div className="app-shell" style={themeStyle(theme.colors)} data-theme={theme.id}><nav className="rail"><div className="brand-mark"><Sparkles size={21}/></div><div className="rail-items"><span className="rail-selection" aria-hidden="true" style={{transform:`translateY(${({create:0,plugins:1,settings:2}[page])*52}px)`}}/><button title="创作" className={page==='create'?'active':''} onClick={()=>{setPage('create')}}><PencilLine size={21}/></button><button title="插件" className={page==='plugins'?'active':''} onClick={()=>setPage('plugins')}><Orbit size={21}/></button><button title="设置" className={page==='settings'?'active':''} onClick={()=>setPage('settings')}><Bolt size={21}/></button></div><div className="rail-bottom"><button title="帮助"><CircleHelp size={19}/></button><div className="user-avatar">U</div></div></nav>{renderSidebar()}<main className="main-area"><div className="topbar"><div className="breadcrumbs"><span>{page==='create'?world?.name||'我的宇宙':page==='settings'?'设置':'插件'}</span>{page==='create'&&node&&<><ChevronRight size={14}/><strong>{node.name}{selection?.config?' / 配置':''}</strong></>}</div></div>{syncError&&<div className="markdown-sync-banner" role="alert"><span>{syncError}</span>{syncConflict?<div><button className="ghost" onClick={()=>resolveSyncConflict('remote')}>采用文件内容</button><button className="ghost" onClick={()=>resolveSyncConflict('local')}>保留界面内容</button></div>:<button className="ghost" onClick={reloadMarkdown}>重新读取</button>}</div>}{renderMain()}</main>{dialog&&<div className="modal-backdrop" onPointerDown={()=>setDialog(null)}><div className="modal" onPointerDown={event=>event.stopPropagation()}><div className="eyebrow">CREATE IN MYUNIVERSE</div><h2>{dialog.title}</h2><input autoFocus value={dialog.value} onChange={event=>setDialog({...dialog,value:event.target.value})} onKeyDown={event=>{if(event.key==='Enter')submitDialog();if(event.key==='Escape')setDialog(null)}}/><div className="modal-actions"><button className="ghost" onClick={()=>setDialog(null)}>取消</button><button className="primary" onClick={submitDialog}>确认创建</button></div></div></div>}</div>
}
