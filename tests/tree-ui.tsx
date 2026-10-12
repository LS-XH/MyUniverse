import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import '../src/ui/styles/index.css'
import PluginTree from '../src/ui/PluginTree'
import WorkflowEditor from '../src/ui/WorkflowEditor'
import {agentGraph} from '../src/model/workflows'
import {createFlow} from '../src/model/flow'
import FunctionsPage from '../src/ui/FunctionsPage'
import useTreeDrag from '../src/ui/useTreeDrag'
import {moveTreeItem} from '../src/model/treeMoves'
import {pluginFolderPath} from '../src/model/pluginFolders'
import {Workspace} from '../src/model/types'
import {themeStyle,activeTheme} from '../src/model/themes'
function Preview(){
 const [workspace,setWorkspace]=useState<Workspace>({worlds:[],activeWorldId:null,themeId:'violet',pluginFolders:[{id:'a',name:'文字处理',section:'functions',parentId:null},{id:'b',name:'测试目录',section:'functions',parentId:null}],functions:[{id:'fn',name:'整理章节',language:'js',code:'function transform(input){return input}',folderId:'a'},{id:'py',name:'处理人物',language:'py',code:'def transform(input):\n    return input',folderId:null},{id:'flow',name:'章节流程',language:'flow',code:'',flow:createFlow(),folderId:null}]})
 const [selected,setSelected]=useState<string|null>('fn'),[folderId,setFolder]=useState<string|null>('a')
 const [graph,setGraph]=useState(agentGraph),[modelMode,setModelMode]=useState(false)
 const drag=useTreeDrag((...args)=>setWorkspace(w=>moveTreeItem(w,...args)))
 const current=workspace.functions?.find(f=>f.id===selected),folder=current?(current.folderId||null):folderId
 return <div className="app-shell" style={themeStyle(activeTheme(workspace).colors)}><div className="sidebar-region" onPointerDown={drag}><aside className="sidebar plugin-sidebar"><div className="sidebar-header">插件</div><PluginTree workspace={workspace} section="functions" folderId={folder} selectedFunction={selected} onFunction={setSelected} onFolder={(_,id)=>{setFolder(id);setSelected(null)}} onAddFolder={()=>{}}/></aside></div><main className="main-area object-page"><div className="topbar"><button onClick={()=>setModelMode(!modelMode)} className="ui-surface ui-button">切换模型画布</button><div className="breadcrumbs">插件 / 函数 / {pluginFolderPath(workspace,folder||null).map(f=>f.name).join(' / ')} / {current?.name}</div></div><div hidden={!modelMode} style={{display:modelMode?'flex':'none',flex:1,minHeight:0}}><WorkflowEditor title="小说规划工作流" value={graph} onChange={setGraph} workspace={workspace} mode="agent"/></div><div hidden={modelMode} style={{display:modelMode?'none':'flex',flex:1,minHeight:0}}><FunctionsPage workspace={workspace} onChange={setWorkspace} selected={selected} onSelect={setSelected} folderId={folder||null} folderTools={null} onFolder={setFolder}/></div></main></div>
}
createRoot(document.getElementById('root')!).render(<Preview/> )
