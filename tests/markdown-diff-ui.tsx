import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import MarkdownSourceEditor from '../src/ui/MarkdownSourceEditor'
import {builtinThemes,themeStyle} from '../src/model/themes'
import '../src/ui/style.css'
function Fixture(){const [text,setText]=useState('# 人物\n\n## 新名称\n\n### 关系\n妹妹\n'),[baseline,setBaseline]=useState('# 人物\n\n## 旧名称\n\n### 关系\n哥哥\n');return <div style={{...themeStyle(builtinThemes[2].colors),height:'100vh',background:'white'}}><button style={{position:'absolute',right:20,top:10,zIndex:10}} onClick={()=>setBaseline(text)}>保存测试快照</button><output id="source" style={{position:'absolute',bottom:10,right:10,zIndex:10}}>{JSON.stringify(text)}</output><div style={{position:'absolute',top:50,bottom:70,left:20,right:20}}><MarkdownSourceEditor value={text} baseline={baseline} selectedLine={2} selectedEnd={2} onChange={setText}/></div></div>};createRoot(document.getElementById('root')!).render(<Fixture/> )
