import {textareaCaret} from './textareaCaret'
import ScriptEditor from './ScriptEditor'
import {scriptCompletions,tokenizeScript} from '../model/scriptEditor'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Braces, FileCode2 } from 'lucide-react'
import { objectCode } from '../model/worldApi'
import { ObjectSelection, World } from '../model/types'
import ObjectPicker from './ObjectPicker'

export default function FunctionCodeEditor({value,onChange,world,language='js',block=false,typed=false,entry='function'}:{value:string;onChange:(v:string)=>void;world?:World;language?:'js'|'py';block?:boolean;typed?:boolean;entry?:'function'|'tool'}) {
  const editor=useRef<HTMLTextAreaElement>(null),menu=useRef<HTMLDivElement>(null)
  const [object,setObject]=useState<ObjectSelection>({classId:'',entityId:'',path:[]}),[suggestions,setSuggestions]=useState<string[]>([]),[index,setIndex]=useState(0)
  useEffect(()=>{menu.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'})},[index,suggestions])
  const positionCompletion=()=>{
    const input=editor.current,popup=menu.current,host=input?.closest<HTMLElement>('.function-code-input')
    if(!input||!popup||!host)return
    const caret=textareaCaret(input),bounds=host.getBoundingClientRect(),area=input.getBoundingClientRect()
    const left=Math.max(area.left,Math.min(caret.left,area.right-popup.offsetWidth))
    const lineTop=Math.max(area.top,Math.min(caret.top,area.bottom-caret.lineHeight))
    const below=Math.max(0,Math.min(area.bottom,window.innerHeight-8)-lineTop-caret.lineHeight-4),above=Math.max(0,lineTop-Math.max(area.top,8)-4)
    const upwards=below<Math.min(160,popup.scrollHeight)&&above>below
    popup.style.maxHeight=`${Math.min(240,Math.max(36,upwards?above:below))}px`
    popup.style.left=`${left-bounds.left}px`
    popup.style.top=`${(upwards?lineTop-popup.offsetHeight-4:lineTop+caret.lineHeight+4)-bounds.top}px`
  }
  useLayoutEffect(()=>{positionCompletion()},[suggestions,index,value])
  useEffect(()=>{if(!suggestions.length)return;window.addEventListener('resize',positionCompletion);window.addEventListener('scroll',positionCompletion,true);return()=>{window.removeEventListener('resize',positionCompletion);window.removeEventListener('scroll',positionCompletion,true)}},[suggestions])
  const quote=(text:string)=>JSON.stringify(text)
  const selectedWorld=world?.documents.some(d=>d.id===object.classId)?world:undefined
  const insert=(text:string,start=editor.current?.selectionStart??value.length,end=editor.current?.selectionEnd??start)=>{onChange(value.slice(0,start)+text+value.slice(end));setSuggestions([]);requestAnimationFrame(()=>{editor.current?.focus();editor.current?.setSelectionRange(start+text.length,start+text.length)})}
  const complete=(text:string,caret:number)=>{
    const prefix=text.slice(0,caret),term=prefix.match(/\.([a-z_]*)$/)?.[1]
    if(term===undefined){setSuggestions(scriptCompletions(text,caret,language));setIndex(0);return}
    const context=tokenizeScript(text,language).find(t=>t.start<caret&&t.end>=caret);if(context&&['string','comment'].includes(context.kind)){setSuggestions([]);return}
    let methods:string[]=[]
    if(/world\.[a-z_]*$/.test(prefix))methods=['classes()','get_class("")']
    else if(/self\.[a-z_]*$/.test(prefix))methods=['id','name','classId','schema()','members()','get_member("")','markdown()','to_value()']
    else if(/input\.[a-z_]*$/.test(prefix))methods=['type','classId','entityId','value()','members()','get_member("")','instance()','markdown()','to_value()','schema()','add("", values.text(""))','add(values.text(""))']
    else if(/values\.[a-z_]*$/.test(prefix))methods=['text("")','content("")','integer(0)','decimal(0)','date("20261009")','null()','object({})',language==='py'?'reference("", "")':'class("", "")']
    else if(/get_class\([^)]*\)\.[a-z_]*$/.test(prefix))methods=['instances()','get_instance("")','markdown()','schema()','set_markdown("")','delete()']
    else if(/get_member\([^)]*\)\.[a-z_]*$/.test(prefix))methods=['members()','get_member("")','markdown()','value()','to_value()','type','schema()','add("", values.text(""))','add(values.text(""))',...(entry==='tool'?['set_value("")']:[])]
    else if(/get_instance\([^)]*\)\.[a-z_]*$/.test(prefix))methods=['members()','get_member("")','markdown()','delete()']
    setSuggestions(methods.filter(method=>method.startsWith(term)));setIndex(0)
  }
  const accept=(method:string)=>{const caret=editor.current?.selectionStart??value.length,prefix=value.slice(0,caret);insert(method,caret-(prefix.match(/[$_\p{L}][$_\p{L}\p{N}]*$/u)?.[0].length||0),caret)}
  const expression=objectCode(object,language).replace(/;$/,'')
  const typedExpression=object.path.length?expression.replace(/\.markdown\(\)$/,'.to_value()'):`values.${language==='py'?'reference':'class'}(${quote(object.classId)}, ${quote(object.entityId)})`
  return <div className="function-code-workbench"><div className="function-code-input"><ScriptEditor onSelect={()=>positionCompletion()} onScroll={()=>positionCompletion()} language={language} editorRef={editor} className="function-code ui-field--code ui-surface ui-field" aria-label={entry==='tool'?'Tool 脚本':block?'代码块脚本':'函数脚本'} spellCheck={false} value={value} onCompositionEnd={e=>complete(e.currentTarget.value,e.currentTarget.selectionStart)} onBlur={()=>setSuggestions([])} onChange={e=>{onChange(e.target.value);if(!(e.nativeEvent as InputEvent).isComposing)complete(e.target.value,e.target.selectionStart)}} onKeyDown={e=>{
    if(e.nativeEvent.isComposing)return
    if(e.ctrlKey&&e.code==='Space'){e.preventDefault();complete(value,e.currentTarget.selectionStart);return}
    if(e.key==='Escape'){setSuggestions([]);return}
    if(suggestions.length&&['ArrowDown','ArrowUp','Enter','Tab'].includes(e.key)){e.preventDefault();if(e.key==='Enter'||e.key==='Tab')accept(suggestions[index]);else setIndex((index+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length);return}
    if(e.key==='Tab'){e.preventDefault();insert(language==='py'?'    ':'  ')}
  }}/>{suggestions.length>0&&<div ref={menu} className="code-completions ui-menu--completion ui-surface ui-menu ui-menu--themed ui-surface--bordered" role="listbox" aria-label="脚本自动补全">{suggestions.map((method,i)=><button key={method} role="option" aria-selected={index===i} className={`${index===i?'active':''} ui-surface ui-button ui-menu-item`} onPointerDown={e=>e.preventDefault()} onClick={()=>accept(method)}>{method}</button>)}</div>}</div><aside className="object-call-assistant ui-panel--object-assistant ui-surface ui-panel ui-surface--bordered"><strong><Braces size={16}/> 对象调用助手</strong><p>选择对象后插入调用。ID 引用可在重命名后继续使用。</p><ObjectPicker world={world} value={object} onChange={setObject}/><div className="object-call-actions"><button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" disabled={!object.entityId||!selectedWorld} onClick={()=>insert(expression+(language==='js'?';':''))}><FileCode2 size={14}/> 插入读取调用</button>{entry==='tool'&&<button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" disabled={!object.entityId||!selectedWorld} onClick={()=>insert(`return ${typed?'values.text('+expression+')':expression}${language==='js'?';':''}`)}>{typed?'插入 Markdown 文字返回':'插入返回语句'}</button>}{typed&&entry==='tool'&&<button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" disabled={!object.entityId||!selectedWorld} onClick={()=>insert(`return ${typedExpression}${language==='js'?';':''}`)}>插入类型值返回</button>}{object.path.length>0&&<button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" disabled={!selectedWorld} onClick={()=>insert(expression.replace(/\.markdown\(\)$/,'.value()')+(language==='js'?';':''))}>插入原始值读取</button>}</div><div className="code-api-tools"><strong>接口速查</strong>{typed&&<><button onClick={()=>insert('self.get_member("").to_value()')} className="ui-surface ui-button">self → 当前实例属性</button><button onClick={()=>insert('input.value()')} className="ui-surface ui-button">input → 类型值</button><button onClick={()=>insert('input.add("Schema ID", values.text(""))')} className="ui-surface ui-button">input → 追加可重复子成员</button><button onClick={()=>insert('input.add(values.text(""))')} className="ui-surface ui-button">input → 追加同级可重复值</button><button onClick={()=>insert(language==='py'?'values.object({"名称": values.text(self.name)})':'values.object({名称: values.text(self.name)})')} className="ui-surface ui-button">Object → 结构化值</button><button onClick={()=>insert(language==='py'?'values.integer(0)':'values.integer(0)')} className="ui-surface ui-button">Integer → 整数值</button></>}<button onClick={()=>insert('world.classes()')} className="ui-surface ui-button">world.classes()</button><button onClick={()=>insert(`world.get_class(${quote(object.classId)})`)} className="ui-surface ui-button">get_class → 类</button><button onClick={()=>insert('.instances()')} className="ui-surface ui-button">instances → 实例列表</button><button onClick={()=>insert('.members()')} className="ui-surface ui-button">members → 属性列表</button><button onClick={()=>insert('.markdown()')} className="ui-surface ui-button">markdown → 全部文本</button><button onClick={()=>insert('.value()')} className="ui-surface ui-button">value → 原始值</button></div><p>{entry==='tool'?'入口 execute(params)，自由参数与普通返回值；world 和 app.world 使用主程序对象接口。':block?'代码块可使用 inputs、world，支持分支、循环和 await。':typed?'入口 transform(self, input)，使用 values 构造添加值；input.type 保留配置类型，input.value() 读取值。':'旧接口 transform(input) / transform(input, world)。'}{entry==='tool'?'JS Tool 可通过 set_value、set_markdown 和 delete 修改世界，成功后统一保存。':'绑定函数仅可通过 add 追加符合 Schema 的可重复成员；不能修改或删除已有值。'}</p></aside></div>
}
