import { useRef, useState } from 'react'
import { Braces, FileCode2 } from 'lucide-react'
import { objectCode } from '../model/worldApi'
import { ObjectSelection, World } from '../model/types'
import ObjectPicker from './ObjectPicker'

export default function FunctionCodeEditor({value,onChange,world,language='js',block=false,typed=false}:{value:string;onChange:(v:string)=>void;world?:World;language?:'js'|'py';block?:boolean;typed?:boolean}) {
  const editor=useRef<HTMLTextAreaElement>(null)
  const [object,setObject]=useState<ObjectSelection>({classId:'',entityId:'',path:[]}),[suggestions,setSuggestions]=useState<string[]>([]),[index,setIndex]=useState(0)
  const quote=(text:string)=>JSON.stringify(text)
  const selectedWorld=world?.documents.some(d=>d.id===object.classId)?world:undefined
  const insert=(text:string,start=editor.current?.selectionStart??value.length,end=editor.current?.selectionEnd??start)=>{onChange(value.slice(0,start)+text+value.slice(end));setSuggestions([]);requestAnimationFrame(()=>{editor.current?.focus();editor.current?.setSelectionRange(start+text.length,start+text.length)})}
  const complete=(text:string,caret:number)=>{
    const prefix=text.slice(0,caret),term=prefix.match(/\.([a-z_]*)$/)?.[1]
    if(term===undefined){setSuggestions([]);return}
    let methods:string[]=[]
    if(/world\.[a-z_]*$/.test(prefix))methods=['classes()','get_class("")']
    else if(/self\.[a-z_]*$/.test(prefix))methods=['id','name','classId','schema()','members()','get_member("")','markdown()','to_value()']
    else if(/input\.[a-z_]*$/.test(prefix))methods=['type','classId','entityId','value()','members()','get_member("")','instance()','markdown()','to_value()']
    else if(/values\.[a-z_]*$/.test(prefix))methods=['text("")','content("")','integer(0)','decimal(0)','date("20261009")','null()','object({})',language==='py'?'reference("", "")':'class("", "")']
    else if(/get_class\([^)]*\)\.[a-z_]*$/.test(prefix))methods=['instances()','get_instance("")','markdown()','schema()']
    else if(/get_member\([^)]*\)\.[a-z_]*$/.test(prefix))methods=['members()','get_member("")','markdown()','value()','to_value()','type']
    else if(/get_instance\([^)]*\)\.[a-z_]*$/.test(prefix))methods=['members()','get_member("")','markdown()']
    setSuggestions(methods.filter(method=>method.startsWith(term)));setIndex(0)
  }
  const accept=(method:string)=>{const caret=editor.current?.selectionStart??value.length,prefix=value.slice(0,caret);insert(method,prefix.lastIndexOf('.')+1,caret)}
  const expression=objectCode(object,language).replace(/;$/,'')
  const typedExpression=object.path.length?expression.replace(/\.markdown\(\)$/,'.to_value()'):`values.${language==='py'?'reference':'class'}(${quote(object.classId)}, ${quote(object.entityId)})`
  return <div className="function-code-workbench"><div className="function-code-input"><textarea ref={editor} className="function-code" aria-label={block?'代码块脚本':'函数脚本'} spellCheck={false} value={value} onChange={e=>{onChange(e.target.value);complete(e.target.value,e.target.selectionStart)}} onKeyDown={e=>{
    if(e.key==='Escape'){setSuggestions([]);return}
    if(suggestions.length&&['ArrowDown','ArrowUp','Enter'].includes(e.key)){e.preventDefault();if(e.key==='Enter')accept(suggestions[index]);else setIndex((index+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length);return}
    if(e.key==='Tab'){e.preventDefault();insert(language==='py'?'    ':'  ')}
  }}/>{suggestions.length>0&&<div className="code-completions" role="listbox" aria-label="对象接口补全">{suggestions.map((method,i)=><button key={method} className={index===i?'active':''} onPointerDown={e=>e.preventDefault()} onClick={()=>accept(method)}>{method}</button>)}</div>}</div><aside className="object-call-assistant"><strong><Braces size={16}/> 对象调用助手</strong><p>选择对象后插入调用。ID 引用可在重命名后继续使用。</p><ObjectPicker world={world} value={object} onChange={setObject}/><div className="object-call-actions"><button className="ghost" disabled={!object.entityId||!selectedWorld} onClick={()=>insert(expression+(language==='js'?';':''))}><FileCode2 size={14}/> 插入读取调用</button><button className="ghost" disabled={!object.entityId||!selectedWorld} onClick={()=>insert(`return ${typed?'values.text('+expression+')':expression}${language==='js'?';':''}`)}>{typed?'插入 Markdown 文字返回':'插入返回语句'}</button>{typed&&<button className="ghost" disabled={!object.entityId||!selectedWorld} onClick={()=>insert(`return ${typedExpression}${language==='js'?';':''}`)}>插入类型值返回</button>}{object.path.length>0&&<button className="ghost" disabled={!selectedWorld} onClick={()=>insert(expression.replace(/\.markdown\(\)$/,'.value()')+(language==='js'?';':''))}>插入原始值读取</button>}</div><div className="code-api-tools"><strong>接口速查</strong>{typed&&<><button onClick={()=>insert('self.get_member("").to_value()')}>self → 当前实例属性</button><button onClick={()=>insert('input.value()')}>input → 类型值</button><button onClick={()=>insert('input.to_value()')}>input → 原类型返回</button><button onClick={()=>insert(language==='py'?'values.object({"名称": values.text(self.name)})':'values.object({名称: values.text(self.name)})')}>Object → 结构化返回</button><button onClick={()=>insert(language==='py'?'values.integer(0)':'values.integer(0)')}>Integer → 整数返回</button></>}<button onClick={()=>insert('world.classes()')}>world.classes()</button><button onClick={()=>insert(`world.get_class(${quote(object.classId)})`)}>get_class → 类</button><button onClick={()=>insert('.instances()')}>instances → 实例列表</button><button onClick={()=>insert('.members()')}>members → 属性列表</button><button onClick={()=>insert('.markdown()')}>markdown → 全部文本</button><button onClick={()=>insert('.value()')}>value → 原始值</button></div><p>{block?'代码块可使用 inputs、world，支持分支、循环和 await。':typed?'入口 transform(self, input)，使用 values 构造返回值；input.type 保留配置类型，input.value() 读取值。':'旧接口 transform(input) / transform(input, world)。'}对象接口读取当前世界，不直接修改对象。</p></aside></div>
}
