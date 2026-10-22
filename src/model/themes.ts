import {normalizeAgentModels} from './builtinAgents'
import {installBuiltinTools} from './builtinTools'
import { reconcileFunctionBindings } from './functionAppend'
import {normalizeChatRuns} from './chatRuns'
import {migrateWorkflowTypes} from './workflowMigration'
import {normalizeViews} from './interfaceViews'
import type { CSSProperties } from 'react'
import { Theme, ThemeColors, Workspace, World } from './types'

const violet: ThemeColors = {rail:'#0a0e18',sidebar:'#111624',surface:'#0e1320',canvas:'#101827',panel:'#171e2c',input:'#111827',border:'#30394b',text:'#e8ebf6',muted:'#8e9bb0',accent:'#8d74e7',accentText:'#ffffff',hover:'#242b3d',active:'#302a51',navItem:'#111624',button:'#20283a',buttonText:'#d1d9e8',treeItem:'#111624',treeSelected:'#302a51',graphNode:'#242d40',chatMessage:'#262b45',composer:'#171e2c',mapPin:'#171e2c',markdownHighlight:'#3060a5fa',markdownAdded:'#3059c48d',markdownRemoved:'#30ef7777',danger:'#ef7777',success:'#59c48d',warning:'#dfa158'}
const dark: ThemeColors = {rail:'#171717',sidebar:'#202020',surface:'#212121',canvas:'#181818',panel:'#2b2b2b',input:'#303030',border:'#3d3d3d',text:'#f4f4f4',muted:'#a0a0a0',accent:'#f3f3f3',accentText:'#171717',hover:'#303030',active:'#393939',navItem:'#171717',button:'#303030',buttonText:'#f4f4f4',treeItem:'#202020',treeSelected:'#393939',graphNode:'#2b2b2b',chatMessage:'#303030',composer:'#2b2b2b',mapPin:'#303030',markdownHighlight:'#3060a5fa',markdownAdded:'#3059c48d',markdownRemoved:'#30ef7777',danger:'#ef7777',success:'#59c48d',warning:'#dfa158'}
const light: ThemeColors = {rail:'#f3f4f6',sidebar:'#f8f9fb',surface:'#ffffff',canvas:'#f4f6f9',panel:'#ffffff',input:'#f9fafb',border:'#dce1e8',text:'#202633',muted:'#647084',accent:'#6953ca',accentText:'#ffffff',hover:'#eaedf3',active:'#e9e3ff',navItem:'#f3f4f6',button:'#f8f9fb',buttonText:'#202633',treeItem:'#f8f9fb',treeSelected:'#e9e3ff',graphNode:'#ffffff',chatMessage:'#f2f3f6',composer:'#ffffff',mapPin:'#ffffff',markdownHighlight:'#3060a5fa',markdownAdded:'#3059c48d',markdownRemoved:'#30ef7777',danger:'#ef7777',success:'#59c48d',warning:'#dfa158'}
export const builtinThemes: Theme[] = [
  {id:'violet',name:'星雾蓝紫',colors:violet,builtin:true},
  {id:'dark',name:'经典暗黑',colors:dark,builtin:true},
  {id:'light',name:'晨光浅色',colors:light,builtin:true}
]
export const themeFields: {key:keyof ThemeColors;label:string}[] = [
  {key:'rail',label:'导航栏'}, {key:'sidebar',label:'侧边栏'}, {key:'surface',label:'主背景'},
  {key:'canvas',label:'画布'}, {key:'panel',label:'卡片与面板'}, {key:'input',label:'输入框'},
  {key:'border',label:'边框'}, {key:'text',label:'主要文字'}, {key:'muted',label:'次要文字'},
  {key:'accent',label:'强调色'}, {key:'accentText',label:'强调色文字'}, {key:'hover',label:'悬停状态'}, {key:'active',label:'选中状态'},
  {key:'navItem',label:'导航项'}, {key:'button',label:'普通按钮'}, {key:'buttonText',label:'按钮文字'},
  {key:'treeItem',label:'项目树条目'}, {key:'treeSelected',label:'项目树选中'}, {key:'graphNode',label:'关系网节点'},
  {key:'chatMessage',label:'聊天消息'}, {key:'composer',label:'聊天输入框'}, {key:'mapPin',label:'地图标记'}, {key:'markdownHighlight',label:'Markdown 选中对象'}, {key:'markdownAdded',label:'Markdown 新增行'}, {key:'markdownRemoved',label:'Markdown 删除行'},
  {key:'danger',label:'危险与错误'}, {key:'success',label:'成功状态'}, {key:'warning',label:'警告状态'}
]
export function normalizeWorkspace(workspace: Workspace): Workspace {
  workspace=normalizeAgentModels(installBuiltinTools(workspace))
  return reconcileFunctionBindings(normalizeChatRuns({...workspace,tools:workspace.tools||[],sdWorkflows:(workspace.sdWorkflows||[]).map(migrateWorkflowTypes),agents:(workspace.agents||[]).map(migrateWorkflowTypes),pluginFolders:workspace.pluginFolders||[],functions:workspace.functions||[],models:(workspace.models||[]).map(model=>({...model,enabled:model.enabled!==false})),themeId:workspace.themeId||'violet',themes:(workspace.themes||[]).map(theme=>({...theme,colors:{...violet,...theme.colors}})),worlds:workspace.worlds.map(normalizeWorld)}))
}
function normalizeWorld(world: World): World {
  return normalizeViews({...world,chat:Object.assign({agent:'',files:[],skills:[],conversations:[],activeConversationId:null},world.chat)})
}
export function activeTheme(workspace:Workspace): Theme {
  return [...builtinThemes,...(workspace.themes||[])].find(theme=>theme.id===workspace.themeId)||builtinThemes[0]
}
export function themeStyle(colors:ThemeColors): CSSProperties {
  return Object.fromEntries(Object.entries(colors).map(([key,value])=>{
    if(/^#[0-9A-Fa-f]{8}$/.test(value)){
      const a=parseInt(value.slice(1,3),16)/255,r=parseInt(value.slice(3,5),16),g=parseInt(value.slice(5,7),16),b=parseInt(value.slice(7,9),16)
      return [`--${key}`,`rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`]
    }
    return [`--${key}`,value]
  })) as CSSProperties
}
