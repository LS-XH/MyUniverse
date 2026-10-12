import test from 'node:test'
import assert from 'node:assert/strict'
import {builtinThemes,normalizeWorkspace,themeFields,themeStyle,activeTheme} from '../src/model/themes'
import {portalTheme} from '../src/ui/portalTheme'
import type {Theme,Workspace} from '../src/model/types'

test('legacy custom themes acquire semantic colors without replacing saved colors or identity',()=>{
 const {danger:_,success:__,warning:___,...legacy}=builtinThemes[0].colors
 const input={worlds:[],activeWorldId:null,themeId:'old',themes:[{id:'old',name:'旧主题',colors:{...legacy,accent:'#123456',panel:'#234567'}}]} as unknown as Workspace
 const next=normalizeWorkspace(input),theme=activeTheme(next)
 assert.equal(theme.id,'old');assert.equal(theme.name,'旧主题')
 assert.equal(theme.colors.accent,'#123456');assert.equal(theme.colors.panel,'#234567')
 assert.deepEqual([theme.colors.danger,theme.colors.success,theme.colors.warning],['#ef7777','#59c48d','#dfa158'])
 assert.equal('danger' in input.themes![0].colors,false)
})

test('custom semantic colors survive JSON persistence and repeated normalization',()=>{
 const theme:Theme={id:'custom',name:'自定义',colors:{...builtinThemes[2].colors,danger:'#80FF0000',success:'#00aa44',warning:'#eeaa00'}}
 const workspace:Workspace={worlds:[],activeWorldId:null,themeId:theme.id,themes:[theme]}
 const restored=normalizeWorkspace(JSON.parse(JSON.stringify(workspace)))
 assert.deepEqual(activeTheme(restored),theme)
 assert.deepEqual(normalizeWorkspace(restored),restored)
})

test('all built-in themes expose editable semantic colors with stable defaults',()=>{
 for(const theme of builtinThemes){
  assert.deepEqual([theme.colors.danger,theme.colors.success,theme.colors.warning],['#ef7777','#59c48d','#dfa158'])
  for(const key of ['danger','success','warning'])assert.equal(themeFields.filter(field=>field.key===key).length,1)
 }
 assert.equal(new Set(themeFields.map(field=>field.key)).size,themeFields.length)
})

test('theme variables include semantic colors and retain ARGB alpha conversion',()=>{
 const style=themeStyle({...builtinThemes[0].colors,danger:'#80FF0000'}) as Record<string,string>
 assert.equal(style['--danger'],'rgba(255, 0, 0, 0.502)')
 assert.equal(style['--success'],'#59c48d');assert.equal(style['--warning'],'#dfa158')
 assert.equal(Object.keys(style).length,themeFields.length)
})

test('portal themes copy scoped reusable tokens without importing the trigger skin',()=>{
 const vars=new Map([['--panel','#111111'],['--danger','#aa2222'],['--ui-duration-180','240ms'],['--ui-radius-9','11px'],['--ui-shadow-5','#0008'],['--ui-scrim','#0009'],['--ui-bg','#ff00ff'],['--ui-radius','99px'],['--ui-border-top-color','#00ff00']])
 const keys=[...vars.keys()],previous=globalThis.getComputedStyle
 const style={...Object.fromEntries(keys.map((key,i)=>[i,key])),length:keys.length,getPropertyValue:(key:string)=>vars.get(key)||''} as unknown as CSSStyleDeclaration
 globalThis.getComputedStyle=()=>style
 try{
  const copied=portalTheme({} as HTMLElement) as Record<string,string>
  assert.equal(copied['--panel'],'#111111');assert.equal(copied['--danger'],'#aa2222')
  assert.equal(copied['--ui-duration-180'],'240ms');assert.equal(copied['--ui-radius-9'],'11px')
  assert.equal(copied['--ui-shadow-5'],'#0008');assert.equal(copied['--ui-scrim'],'#0009')
  for(const key of ['--ui-bg','--ui-radius','--ui-border-top-color'])assert.equal(key in copied,false)
 }finally{globalThis.getComputedStyle=previous}
})
