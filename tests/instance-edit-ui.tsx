import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import DocumentWorkspace from '../src/ui/DocumentWorkspace'
import SchemaEditor from '../src/ui/SchemaEditor'
import {createWorld} from '../src/model/templates'
import {ClassDocument} from '../src/model/types'
import {themeStyle,activeTheme} from '../src/model/themes'
import '../src/ui/styles/index.css'
const world=createWorld('测试'),initial:ClassDocument={id:'locations',name:'地点',fileName:'地点.md',schema:[{id:'description',keyType:'Const',key:'描述',valueType:'Text'}],entities:['甲','乙','丙'].map((name,index)=>({id:`instance-${index}`,name,fields:[{id:`field-${index}`,schemaId:'description',key:'描述',value:'示例内容',children:[]}]})),labels:[{id:'important',name:'重要',color:'#335974E7'}]}
function Preview(){const[doc,setDoc]=useState(initial),[schema,setSchema]=useState(false),[marquee,setMarquee]=useState(false);const change=(value:ClassDocument)=>setDoc(structuredClone(value));return <div className="app-shell" style={themeStyle(activeTheme({worlds:[],activeWorldId:null}).colors)}><main className="main-area" onPointerDownCapture={e=>{if(marquee)Object.defineProperty(e.nativeEvent,'shiftKey',{value:true})}}><div className="topbar"><button className="ui-surface ui-button" onClick={()=>setSchema(!schema)}>{schema?'文件操作':'属性配置'}</button><label><input type="checkbox" aria-label="框选验收模式" checked={marquee} onChange={e=>setMarquee(e.target.checked)}/>框选验收模式（仅夹具）</label><output id="instance-audit">{JSON.stringify({names:doc.entities.map(e=>e.name),ids:doc.entities.map(e=>e.id),labels:doc.entityLabels})}</output></div>{schema?<SchemaEditor world={{...world,documents:[doc]}} doc={doc} onChange={change}/>:<DocumentWorkspace world={{...world,documents:[doc]}} doc={doc} onChange={change} onDelete={()=>{}}/>}</main></div>}
createRoot(document.getElementById('root')!).render(<Preview/> )
