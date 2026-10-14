import './manual-save-ui'
import {appLog} from '../src/services/runtimeLog'
import {background} from '../src/services/background'
import {runtimeFixture} from './jsonRuntimeFixture'

const controls=document.createElement('div')
controls.style.cssText='position:fixed;top:78px;right:20px;z-index:1000;display:flex;gap:6px'
const button=(label:string,run:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=run;controls.append(b)}
button('输出验收信息',()=>{appLog.info('内存验收','对象加载完成');console.warn('验收警告：当前使用独立内存数据')})
button('触发格式错误',()=>{const {world,doc}=runtimeFixture(1);void background('parse',{text:'错误 Markdown',doc,world}).catch(error=>appLog.error('格式校验',error))})
button('执行脚本日志',()=>{const {world}=runtimeFixture(1);void background('directFunction',{world,fn:{id:'test-log',name:'日志验收',language:'js',code:'function transform(input){console.log("脚本正在运行");console.error("脚本测试错误");return "完成";}'},input:''}).catch(error=>appLog.error('脚本验收',error))})
button('触发全局错误',()=>{window.dispatchEvent(new ErrorEvent('error',{message:'未捕获异常验收',error:new Error('未捕获异常验收')}))})
document.body.append(controls)
