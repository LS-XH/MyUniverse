use std::{fs, path::Path, process::{Command, Stdio}, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};
use serde_json::{json, Value};

pub fn execute(root:&Path, language:&str, code:&str, input:&str) -> Result<String,String> {
    execute_with_world(root,language,code,input,&json!({"classes":[]}),"")
}
pub fn execute_with_world(root:&Path, language:&str, code:&str, input:&str, world:&Value, api:&str) -> Result<String,String> {
    execute_with_context(root,language,code,input,world,api,&Value::Null,"",&Value::Null)
}
pub fn execute_with_context(root:&Path, language:&str, code:&str, input:&str, world:&Value, api:&str, context:&Value, runtime_api:&str, contract:&Value) -> Result<String,String> {
    if !["js","py"].contains(&language) { return Err("Unsupported function language".into()); }
    if code.len()>1_000_000 || input.len()>1_000_000 { return Err("Function input or script exceeds 1 MB".into()); }
    let token=SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e|e.to_string())?.as_nanos();
    let directory=root.join("functions").join(".runs").join(format!("{}-{}",std::process::id(),token));
    fs::create_dir_all(&directory).map_err(|e|e.to_string())?;
    let result=(||{
        let request=directory.join("request.json");
        let output=directory.join("result.json");
        // The wrapper uses CommonJS even when an ancestor package declares type: module.
        let script=directory.join(if language=="js" { "runner.cjs" } else { "runner.py" });
        let log=directory.join("console.log");
        fs::write(&request,serde_json::to_vec(&json!({"code":code,"input":input,"world":world,"api":api,"context":context,"runtimeApi":runtime_api,"contract":contract})).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
        let wrapper=if language=="js" { r#"
const fs=require('fs');
const request=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
(async()=>{try{
  const world=request.api?new Function('catalog','return ('+request.api+')(catalog)')(request.world):undefined;
  const typed=request.context&&request.runtimeApi;
  const runtime=typed?new Function('world','context','contract','return ('+request.runtimeApi+')(world,context,contract)')(world,request.context,request.contract):null;
  const transform=new Function('require','world','values',request.code+'\n;return typeof transform === "function" ? transform : null;')(require,world,runtime&&runtime.values);
  if(!transform)throw new Error('需要定义 transform(input)');
  const value=typed?await transform(runtime.self,runtime.input):await transform(request.input,world);
  if(typed?(!value||typeof value!=='object'):typeof value!=='string')throw new Error(typed?'函数必须返回带 type 的值对象':'函数必须返回字符串');
  if(Buffer.byteLength(JSON.stringify(value),'utf8')>1000000)throw new Error('返回值超过 1 MB');
  fs.writeFileSync(process.argv[3],JSON.stringify({value}));
}catch(error){fs.writeFileSync(process.argv[3],JSON.stringify({error:error&&error.stack?String(error.stack):String(error)}));}})();
"# } else { r#"
import json, sys, inspect, traceback
class WorldObject:
    def __init__(self, data):
        self.data = data
        self.id = data.get('id', '')
        self.name = data.get('name', '')
    def _get(self, category, key):
        matches = [item for item in self.data.get(category, []) if item['id'] == key or item['name'] == key]
        if len(matches) != 1:
            raise ValueError('对象不存在或重名，请使用 ID: ' + str(key))
        return WorldObject(matches[0])
    def classes(self): return [WorldObject(item) for item in self.data.get('classes', [])]
    def instances(self): return [WorldObject(item) for item in self.data.get('instances', [])]
    def members(self): return [WorldObject(item) for item in self.data.get('members', [])]
    def get_class(self, key): return self._get('classes', key)
    def get_instance(self, key): return self._get('instances', key)
    def get_member(self, key): return self._get('members', key)
    def markdown(self): return self.data.get('markdown', '')
    def value(self): return self.data.get('value', '')
    def schema(self): return self.data.get('schema', [])
    @property
    def type(self): return self.data.get('typed', {}).get('type')
    def to_value(self):
        if 'typed' not in self.data: raise ValueError('属性值与类型配置不符')
        return self.data['typed']
with open(sys.argv[1], encoding='utf-8') as f:
    request = json.load(f)
try:
    world = WorldObject(request.get('world', {}))
    typed = request.get('context') is not None
    values = TypedValues(request.get('contract') or {}) if typed else None
    scope = {'__name__': '__myuniverse_function__', 'world': world, 'values': values}
    exec(compile(request['code'], '<function>', 'exec'), scope)
    transform = scope.get('transform')
    if not callable(transform):
        raise ValueError('需要定义 transform(input)')
    if typed:
        context = request['context']
        current = world.get_class(context['self']['classId']).get_instance(context['self']['entityId'])
        current.classId = context['self']['classId']
        current.data['typed'] = {'type': 'Class'}
        current.schema = lambda: world.get_class(current.classId).schema()
        current.to_value = lambda: values.reference(current.classId, current.id)
        value = transform(current, TypedInput(context['input'], world))
    else:
        try:
            inspect.signature(transform).bind(request['input'], world)
            two_parameters = True
        except TypeError:
            two_parameters = False
        value = transform(request['input'], world) if two_parameters else transform(request['input'])
    if (typed and not isinstance(value, dict)) or (not typed and not isinstance(value, str)):
        raise TypeError('函数必须返回带 type 的值对象' if typed else '函数必须返回字符串')
    if len(json.dumps(value, ensure_ascii=False).encode('utf-8')) > 1000000:
        raise ValueError('返回值超过 1 MB')
    result = {'value': value}
except BaseException as error:
    result = {'error': traceback.format_exc()}
with open(sys.argv[2], 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False)
"# };
        let wrapper=if language=="py" {format!("{}\n{}",include_str!("function_values.py"),wrapper)}else{wrapper.to_owned()};
        fs::write(&script,wrapper).map_err(|e|e.to_string())?;
        let runtimes=if language=="js" { vec![("node",false)] } else {vec![("python",false),("python3",false),("py",true)]};
        let mut child=None;
        let mut launch_errors=Vec::new();
        for (runtime,launcher) in runtimes {
            let mut command=Command::new(runtime);
            if launcher { command.arg("-3"); }
            command.arg(&script).arg(&request).arg(&output).current_dir(root.join("functions")).stdin(Stdio::null());
            if language=="py" { command.env("PYTHONUTF8","1"); }
            let logfile=fs::File::create(&log).map_err(|e|e.to_string())?;
            command.stdout(Stdio::from(logfile.try_clone().map_err(|e|e.to_string())?)).stderr(Stdio::from(logfile));
            #[cfg(windows)] { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
            match command.spawn() { Ok(process)=>{child=Some(process);break;},Err(error)=>launch_errors.push(format!("{}: {}",runtime,error)) }
        }
        let mut child=child.ok_or_else(||format!("无法启动 {} 运行环境。\n{}",if language=="js" {"Node.js"} else {"Python 3"},launch_errors.join("\n")))?;
        let diagnostics=||{
            let bytes=fs::read(&log).unwrap_or_default();
            String::from_utf8_lossy(&bytes[bytes.len().saturating_sub(65_536)..]).trim().to_owned()
        };
        let start=Instant::now();
        loop {
            if let Some(status)=child.try_wait().map_err(|e|e.to_string())? {
                if !status.success() && !output.exists() { return Err(format!("脚本进程异常退出（{}）。\n{}",status,diagnostics())); }
                break;
            }
            if start.elapsed()>Duration::from_secs(5) || fs::metadata(&log).map(|m|m.len()>2_000_000).unwrap_or(false) {
                let _=child.kill();let _=child.wait();return Err("函数执行超过 5 秒或日志过大，已停止。".into());
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        if fs::metadata(&output).map_err(|_|format!("函数未返回结果。\n{}",diagnostics()))?.len()>6_000_000 {return Err("返回值过大".into());}
        let result:Value=serde_json::from_str(&fs::read_to_string(output).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
        if let Some(error)=result.get("error").and_then(Value::as_str) {return Err(error.into());}
        if !context.is_null(){return serde_json::to_string(result.get("value").ok_or("函数没有返回值")?).map_err(|e|e.to_string());}
        result.get("value").and_then(Value::as_str).map(str::to_owned).ok_or("函数必须返回字符串".into())
    })();
    let _=fs::remove_dir_all(&directory);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn typed_javascript_entry_receives_self_and_input_and_preserves_structures() {
        let root=std::env::temp_dir().join(format!("myuniverse-typed-js-test-{}",std::process::id()));
        let context=json!({"self":{"classId":"people","entityId":"person"},"input":{"type":"Integer","value":12}});
        let api="function(catalog){return {get_class:()=>({get_instance:()=>({id:'person',name:'林青'})})}}";
        let runtime="function(world,context,contract){return {self:world.get_class('people').get_instance('person'),input:{type:context.input.type,value:()=>context.input.value},values:{object:members=>({type:'Object',members:Object.entries(members).map(([key,value])=>({key,value}))}),integer:value=>({type:'Integer',value}),text:value=>({type:'Text',value})}}}";
        let result=execute_with_context(&root,"js","function transform(self,input){return values.object({name:values.text(self.name),count:values.integer(input.value()+1)});}","",&json!({}),api,&context,runtime,&json!({"type":"Object"})).unwrap();
        let value:Value=serde_json::from_str(&result).unwrap();
        assert_eq!(value["type"],"Object");assert_eq!(value["members"][0]["value"]["value"],"林青");assert_eq!(value["members"][1]["value"]["value"],13);
        let error=execute_with_context(&root,"js","function transform(self,input){return 'wrong';}","",&json!({}),api,&context,runtime,&json!({"type":"Text"})).unwrap_err();
        assert!(error.contains("带 type"));
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn typed_python_entry_reads_current_instance_and_nested_values() {
        let root=std::env::temp_dir().join(format!("myuniverse-typed-py-test-{}",std::process::id()));
        let world=json!({"classes":[{"id":"people","name":"人物","instances":[{"id":"person","name":"林青","markdown":"## 林青","members":[{"id":"rank","name":"地位","value":"12","typed":{"type":"Integer","value":12}}]}]}]});
        let context=json!({"self":{"classId":"people","entityId":"person"},"input":{"type":"Object","members":[{"key":"数值","value":{"type":"Integer","value":12}}]}});
        let result=execute_with_context(&root,"py","def transform(self,input):\n    return values.object({'名称': values.text(self.name), '数量': values.integer(input.get_member('数值').value()+1), '地位': self.get_member('rank').to_value(), '实例': self.to_value()})","",&world,"",&context,"",&json!({"type":"Object"})).unwrap();
        let value:Value=serde_json::from_str(&result).unwrap();
        assert_eq!(value["members"][0]["value"]["value"],"林青");assert_eq!(value["members"][1]["value"]["value"],13);assert_eq!(value["members"][2]["value"]["type"],"Integer");assert_eq!(value["members"][3]["value"]["entityId"],"person");
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn javascript_runner_works_inside_an_es_module_package() {
        let root=std::env::temp_dir().join(format!("myuniverse-esm-test-{}",std::process::id()));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("package.json"),r#"{"type":"module"}"#).unwrap();
        assert_eq!(execute(&root,"js","function transform(input){return require('node:path').basename(input);}","folder/example.md").unwrap(),"example.md");
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn both_runtimes_preserve_unicode_and_reject_wrong_return_types() {
        let root=std::env::temp_dir().join(format!("myuniverse-function-test-{}",std::process::id()));
        assert_eq!(execute(&root,"js","function transform(input){ console.log('log');return input+' 世界'; }","你好").unwrap(),"你好 世界");
        assert_eq!(execute(&root,"py","def transform(input):\n    print('log')\n    return input + ' 世界'","你好").unwrap(),"你好 世界");
        assert!(execute(&root,"js","function transform(input){return 42;}","").is_err());
        assert!(execute(&root,"py","def transform(input):\n    return 42","").is_err());
        assert!(execute(&root,"exe","","").is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn scripts_can_read_world_objects_with_old_or_new_entry_signatures() {
        let root=std::env::temp_dir().join(format!("myuniverse-world-api-test-{}",std::process::id()));
        let world=json!({"classes":[{"id":"people","name":"人物","markdown":"# 人物","instances":[{"id":"person","name":"林青","markdown":"## 林青","members":[{"id":"rank","name":"势力地位","value":"10","markdown":"### 势力地位\n\n10","members":[]}]}]}]});
        let api="function(catalog){return {get_class:key=>({get_instance:key=>({get_member:key=>({value:()=>catalog.classes[0].instances[0].members[0].value}),markdown:()=>catalog.classes[0].instances[0].markdown})})}}";
        assert_eq!(execute_with_world(&root,"js","function transform(input,world){return world.get_class('people').get_instance('person').get_member('rank').value()+input;}","!",&world,api).unwrap(),"10!");
        assert_eq!(execute_with_world(&root,"js","function transform(input){return world.get_class('people').get_instance('person').markdown();}","",&world,api).unwrap(),"## 林青");
        assert_eq!(execute_with_world(&root,"py","def transform(input):\n    return world.get_class('人物').get_instance('林青').markdown() + input","!",&world,api).unwrap(),"## 林青!");
        assert_eq!(execute_with_world(&root,"py","def transform(input, world):\n    return world.get_class('people').get_instance('person').get_member('rank').value() + input","!",&world,api).unwrap(),"10!");
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn exceptions_include_type_stack_and_python_traceback() {
        let root=std::env::temp_dir().join(format!("myuniverse-error-test-{}",std::process::id()));
        let js=execute(&root,"js","function transform(input){function broken(){throw new Error('具体异常');}return broken();}","").unwrap_err();
        assert!(js.contains("Error: 具体异常") && js.contains("broken"));
        let syntax=execute(&root,"js","function transform(input) { return ; invalid @ }","").unwrap_err();
        assert!(syntax.contains("SyntaxError"));
        let python=execute(&root,"py","def transform(input):\n    return missing_variable","").unwrap_err();
        assert!(python.contains("Traceback") && python.contains("NameError") && python.contains("line 2"));
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn premature_runtime_exit_reports_exit_status_and_log() {
        let root=std::env::temp_dir().join(format!("myuniverse-exit-test-{}",std::process::id()));
        let error=execute(&root,"js","console.error('runtime startup failed');process.exit(7);","").unwrap_err();
        assert!(error.contains("7") && error.contains("runtime startup failed"));
        fs::remove_dir_all(root).unwrap();
    }
}
