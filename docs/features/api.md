# API 使用方法

这里记录项目当前代码中的脚本接口、内部服务与外部协议；没有新增对外 REST/MCP 服务。数据声明见 [世界对象](../data/world.md)、[工作流值](../data/workflow.md)。

## 世界对象门面

hostWorldApi.ts 按稳定 ID 按需解析世界/类/实例/成员，复用现有转换。schema 返回副本，不提供直接改写 React 原对象的可变引用。ID 优先，名称必须唯一。

| 对象 | 读取 | 修改 |
| --- | --- | --- |
| world / app.world | id/name、classes()、get_class() | 通过下级门面 |
| Class | schema()、markdown()、instances()、get_instance() | set_markdown(text)、delete() |
| 实例 | id/name/classId、schema()、markdown()、members()、get_member()、to_value() | delete() |
| 成员 | id/name/type、schema()、value()、to_value()、markdown()、members()、get_member() | set_value(value)、add(schemaIdOrName,value,key?) / add(value,key?) |

上述通用改写入口服务于 Tool 与无绑定上下文的兼容调用。绑定 Function 的会话禁止 set_value/set_markdown/delete，仅允许在绑定属性范围内以统一 add 添加符合 Schema 的可重复值；返回值忽略，生成内容按普通成员显示，上方以“函数名 →”提示来源，详见 [追加契约](functions.md#写入作用域和事务)。

set_value 接受文本、数字或 null，经原解析器验证；Object 结构通过类 set_markdown 修改。删除类清理相应树节点与以该类为父的视图，默认类禁止删除。接口不存在的操作不伪装为已支持的通用对象修改。

```js
async function execute({text}) {
  const item = world.get_class('类ID').get_instance('实例ID');
  item.get_member('成员ID').set_value(text);
  await app.storage.save();
  return {name: item.name, text: item.get_member('成员ID').value()};
}
```

## Function 与 Tool 入口

绑定 Function 定义 `transform(self, input)`；self 是实例门面，input 是绑定成员的原始输入包装，返回 void。`input.add(schemaIdOrName, values.text("内容"), key?)` 添加声明的可重复成员；完整类型、Class/Object 参数和作用域见 [Function](functions.md#统一-add-接口)。

JS Tool 定义 `execute(params)`，params 先经 inputSchema 验证，返回字符串或 JSON 可传输值；配置 readOnlyHint 时门面写入被拒绝。例子中的 app.storage.save() 在当前手动模式不会写盘，成功执行先提交内存，之后由用户保存。官方模型调用名与参数见 [九项工具契约](official-tools.md#九项调用契约)。

## 模型 HTTP 与 SSE

| 操作 | 方法与默认路径 | 使用方式 |
| --- | --- | --- |
| 模型目录 | GET `{baseUrl}/models` | 可用 modelsUrl 覆盖；返回 data/models 数组中的模型 ID |
| 非流式生成 | POST `{baseUrl}/chat/completions` | 可用 chatUrl 覆盖；body 含 model、messages、stream:false |
| 聊天流式生成 | POST 同一 chat 路径 | stream:true；累计 SSE data，收到 [DONE] 后校验完整响应 |

基础 URL 需要自行包含服务所需 `/v1`。密钥以 Bearer 传输，兼容性由服务决定。可选参数及工具/子 Agent 的显式接入见 [模型连接](models-and-agents.md#llm-连接与请求)。协议 Messages 使用 role/content/tool_calls/tool_call_id，见 [Messages](../data/workflow.md#messages)。内部入口为 [modelRequest/modelStream](../../src/services/modelHttp.ts)，浏览器使用 fetch，桌面通过 Tauri HTTP/Channel 桥。

## ComfyUI 接口

| 操作 | 接口 | 程序用途 |
| --- | --- | --- |
| 节点目录 | GET /object_info | 获取实际 class_type、端口及默认值 |
| 提交图 | POST /prompt | 主程序先求值前处理，再提交原生 API 图 |
| 查询结果 | GET /history/{prompt_id} | 轮询完成/错误和 outputs |
| 读取图片 | GET /view | 按 filename/subfolder/type 读取结果 |
| 执行观察 | WebSocket /ws | 按 clientId 连接、prompt_id 过滤事件 |

服务默认 localhost:8188；需要外部 ComfyUI/GPU。这里只支持 API 图，普通前端布局 JSON 尚不支持；取消等待不调用全局 interrupt。详见 [SD 工作流](models-and-agents.md#stable-diffusion--comfyui)。

## 持久化服务与桌面桥

| 前端入口 | 参数/结果与职责 |
| --- | --- |
| loadWorkspace() | 读取配置、函数脚本及注册正文，返回 Workspace |
| saveWorkspace(workspace, replacementKeys?, writeScope?) | 写提交快照；scope 为 CreationFile、preferences 或省略 |
| reloadCreationFile(workspace, scope) | 明确读取目标文件，用完整世界目录解析引用，返回新 Workspace |
| reloadPreferences(workspace) | 重读配置和函数脚本，保留创作草稿 |
| applySyncResult(submitted, current, result) | 协调异步等待期间的新编辑，不做磁盘合并 |

声明见 [storage.ts](../../src/services/storage.ts) 与 [CreationFile](../../src/model/manualSave.ts)。replacementKeys 是保留兼容参数，当前 saveWorkspace 不以它触发磁盘合并。Tauri `load_workspace`、`read_document_files({requests})`、`save_workspace({workspace,files})`、`run_function`、`model_http`、`model_stream`、`cancel_model_stream`、`watch_workflow_events`、`stop_workflow_events`、`reveal_file({components})`、`save_workflow_image({filename,data})` 只用于前端与桌面桥通信，见 [lib.rs](../../src-tauri/src/lib.rs)。读写范围和失败语义见 [持久化功能](persistence.md)。
