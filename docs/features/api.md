# API 使用方法

以下是应用内脚本、前端服务和 Tauri 桥的当前契约。外部模型/ComfyUI 由调用器访问，应用尚未提供对外 REST 或 MCP 服务。数据格式见 [数据目录](../data/README.md)。

## 世界对象门面

[hostWorldApi.ts](../../src/model/hostWorldApi.ts) 按 ID 懒解析世界、类、实例和成员，名称查询必须唯一；schema/to_value 返回副本，不能通过直接改对象绕过会话。JS 全局 world 与 app.world 指向本次草稿。

| 对象 | 读取 | 修改 |
| --- | --- | --- |
| world | id/name、classes()、get_class(idOrName) | 使用下级门面 |
| Class | id/name、schema()、markdown()、instances()、get_instance(idOrName) | set_markdown(text)、delete() |
| 实例 | id/name/classId、schema()、markdown()、members()、get_member(idOrKey)、to_value() | delete() |
| 成员 | id/name/type、schema()、value()、to_value()、markdown()、members()、get_member(idOrKey) | set_value(text/number/null)、add(schemaIdOrName,typedValue,key?)、add(typedValue,key?) |

成员 get_member 每次下降一层，重复同名必须使用 ID；add 要求目标声明可重复，Object 子值必须匹配已有 Schema。set_value 不接受 Object，结构内容通过 Class.set_markdown 按原 Schema 解析。默认类不能删除；当前门面没有通用 rename/create_class/set_schema 接口。

绑定 Function 限制为绑定路径内 add，拒绝 set_value/set_markdown/delete，Class 引用不扩权；Tool 的 readOnlyHint=true 禁止门面写入。事务范围见 [Tool](tools.md#一次执行的修改事务)。

## JS / Python Function

新 Function 使用 apiVersion=2、executionMode=void，入口 transform(self,input)，必须提供实例及 bindingPath。input 读取原始类型快照，写入委托绑定成员门面；返回值忽略。

~~~js
function transform(self, input) {
  // 绑定一个 Object，其 children 中已有 repeatable 的 Text 声明。
  const child = input.schema().children.find(s => s.key === '注释');
  if (!child || !child.repeatable || child.valueType !== 'Text') {
    throw new Error('需要可重复的 Text 注释声明');
  }
  input.add(child.id, values.text('新增注释'));
}
~~~

values 提供 text/content/integer/decimal/date/null/object/from 和 JS class（Python reference）构造器，参数是 TypedValue。Object 用 members 数组保留重复键，推荐 schemaId；Class 用 classId/entityId，动态 Class 键仍需合法内部实例链接。完整示例和类型约束见 [Function](functions.md#统一-add-接口)。Python 使用相同入口与日志桥，需桌面 Python 3。

runFunctionValue(fn,input,world?,context?,signal?,job?) 为内部调用入口；新 void 模式无 bindingPath 拒绝执行。Graph 的 Function 卡片目前未补此路径，不能照旧返回式示例调用新 void 函数写世界。

## JS / HTTP Tool

JS 入口 execute(params)，params 经 object 根 inputSchema 校验，返回 JSON 可传输值。下面的 Tool 需要在 inputSchema 声明 classId/entityId/fieldId/text 四个 string 字段，并以 readOnlyHint=false 运行：

~~~js
async function execute({classId, entityId, fieldId, text}) {
  const entity = world.get_class(classId).get_instance(entityId);
  const field = entity.get_member(fieldId);
  field.set_value(text);
  return {id: entity.id, value: field.value()};
}
~~~

返回通过传输校验后才提交本次草稿。当前 AppRoot 使用 autoSave:false，app.storage.save() 只记录会话请求，不自行导出；内存更新后由自动 JSON 存档写盘。HTTP Tool 的 GET 无 body，POST bodyMode=input 发送 {input:params}，raw 发送 params。调用名、Schema 与 MCP 风格描述见 [Tool](tools.md)，官方调用名见 [工具目录](official-tools.md)。

## 前端存储服务

| 入口 | 当前职责 |
| --- | --- |
| loadWorkspace() | 读取 JSON、后台规范化，并单独加载/迁移 Skill 包；不导入世界 MD/Schema/视图/函数导出 |
| checkpointWorkspace(workspace) | 串行保存变更 Skill 包，剥离内存 skills，后台编码完整 archiveVersion=2 JSON |
| saveWorkspace(workspace,_replacementKeys?,scope?) | 显式导出；scope=CreationFile、preferences 或省略，保留的第二参数不启用磁盘合并 |
| reloadCreationFile(workspace,scope,options?) | 桌面显式读取目标正文/视图导入分支；不导入 Schema；浏览器提示选择 MD |
| publishImportedDocument(before,parsed,worldId,options?) | 已校验文档逐实例发布，onProgress 负责实际更新 |
| applyImportProgress(current,progress) | 按稳定身份合并，保留独立编辑、拒绝重叠冲突 |
| readDocumentMarkdown(worldId,fileName) | 只读取预览基线，不更新对象；浏览器仅返回本会话导出缓存 |
| reloadPreferences(workspace) | 重读 JSON 配置及 Skill 包，保留当前 worlds/activeWorldId；不读取外部函数源码 |
| applySyncResult(submitted,current,result) | 内存三方合并，保留异步期间编辑；不是磁盘文件合并 |

CreationFile={worldId,kind:'document'/'view'/'chat'/'world',id}；ImportOptions={preserveFunctionOrigin?,signal?,onProgress?}。函数签名见 [storage.ts](../../src/services/storage.ts)，操作入口实际范围见 [保存与刷新](persistence.md)。视图画布刷新按钮会定位源类，不能把服务层 view 分支当作现成的 UI 配置导入入口。

## 模型 HTTP 与 SSE

| 操作 | 默认接口 | 覆盖与返回 |
| --- | --- | --- |
| 模型目录 | GET baseUrl/models | modelsUrl；返回数组或 data/models 数组 |
| 非流式生成 | POST baseUrl/chat/completions | chatUrl；assistant message、可选 usage |
| 流式生成 | POST 同一接口 | stream:true、stream_options.include_usage:true；SSE 结束要求 [DONE] |

基础 URL 需包含服务要求的 /v1。apiEndpoint 会移除尾部已存在的 models 或 chat/completions 再拼接，并清除 query/hash。apiKey 使用 Bearer；URL 必须为 HTTP(S)，不允许在 URL 中带用户名/密码。

modelRequest({url,method?,apiKey?,body?,timeoutSeconds?,signal?}) 返回解析 JSON；modelStream(request,onData) 输出已解析 SSE data 字符串，llm 层累积并校验消息。modelImage 返回 data URL。完整参数、能力过滤、用量与取消差异见 [模型](models.md) 和 [聊天传输](chat.md#http-sse-与传输边界)。

## ComfyUI 接口

| 操作 | 接口 | 请求与用途 |
| --- | --- | --- |
| 节点目录 | GET /object_info | 实际安装节点、端口、枚举与默认值 |
| 提交图 | POST /prompt | {prompt,client_id}；返回 prompt_id |
| 结果轮询 | GET /history/{prompt_id} | 查询状态与 outputs |
| 取图 | GET /view?filename=…&subfolder=…&type=… | 读取图片 |
| 执行观察 | WebSocket /ws?clientId=… | 按 prompt_id 过滤 |

默认服务 http://127.0.0.1:8188；只支持 API 图导入，不支持完整前端布局。取消不调用全局 interrupt。完整流程和本地图片保存见 [ComfyUI](comfyui.md)。

## Tauri 命令

这些是内部 invoke 桥。参数采用前端 camelCase，对应 Rust snake_case；以 [lib.rs](../../src-tauri/src/lib.rs) 注册列表及各模块为准。

| 命令 | 主要参数 | 结果 |
| --- | --- | --- |
| load_workspace | 无 | JSON 原文 string |
| checkpoint_workspace | text:string | 校验并写权威 JSON |
| export_workspace | workspace、files:{worldId:{fileName:text}} | 只写导出文件 |
| read_document_files | requests:{worldId:fileName[]} | {worldId:{fileName:string/null}} |
| run_function | language/code/input、world/context/contract、api/runtimeApi、bridge 等可选参数 | 结果或操作日志 JSON string；前端 Python 走此桥 |
| model_http | url/method/apiKey/body/timeoutSeconds、asImage? | {status,text} |
| model_stream | url/apiKey/body/timeoutSeconds/requestId/channel | Channel ready/chunk/complete/error |
| cancel_model_stream | requestId | 取消该窗口拥有的请求 |
| watch_workflow_events / stop_workflow_events | url/clientId/apiKey；停止只需 clientId | ComfyUI 事件桥 |
| reveal_file | components:string[] | 定位 user 范围内已有路径 |
| save_workflow_image | filename、data（base64 image data URL） | 新文件写入 user/images，拒绝覆盖 |
| skill_packages | 无 | SkillDisk[] |
| change_skill_package | change:{previousDirectory,expectedRevision,directory,files} | SkillDisk 或删除时 null |

磁盘原子性仅限单文件；包修改和批量导出均无跨文件回滚。命令存在不意味着真实供应商、GPU 或桌面完整验收通过，验证方法见 [开发指南](../development.md)。
