# Function：类型化添加程序

## 当前契约

Function 服务于文件对象的内容扩展。绑定函数的入口为 `transform(self, input)`，执行结果为 **void**，通过统一 `add` 接口添加实际世界成员。函数不需要 return；即使脚本返回文字或任意对象，也不会把它写进世界、显示为额外成员或进行返回类型推断。

self 标识当前实例；input 是绑定属性的类型化原始输入快照。Class 引用仅表示被引用实例的身份，不能隐式替换为函数返回。世界 FieldValue、Function TypedValue 与工作流变量是不同层次，不混用原生 JS/Python 对象猜类型。

## 统一 add 接口

| 调用 | 作用 |
| --- | --- |
| input.add(schemaIdOrName, typedValue, key?) | 向当前 Object 添加一个可重复子成员，推荐 Schema ID，名称须唯一 |
| input.add(typedValue, key?) | 为当前属性添加同级重复值；当前 Schema 必须可重复 |
| input.get_member(fieldIdOrName).add(...) | 对现有子成员继续深入，并向其添加可重复内容；重复名称使用具体 FieldValue ID |
| self.get_member(...).add(...) | 使用同一添加门面，目标仍必须位于绑定属性及子对象范围 |
| input.schema() | 返回绑定 FieldSchema 副本，供检查子成员 ID、键类型和 ValueType |
| input.to_value() / value() / members() / markdown() | 读取绑定输入；input 保持原始快照，读取不授予修改既有对象的权限 |

添加接口严格检查已有 Schema，不能反推或扩展属性配置。每一次 add 的对象必须符合对应类型：Text/Content 为文字、Integer 为安全整数、Decimal 为有限数、Data 为有效 YYYYMMDD、Class 为存在且符合类约束的实例身份、Object 为匹配子属性结构的成员列表、Null 为 null。

Const 键固定；Text 键通过 key 指定；Class 键通过 key 传入该类实例 Markdown 引用。Object 中可用 schemaId 匹配动态键；非重复子属性必须且只能出现一次，可重复子属性可为空；未知属性、重复的非重复属性或错误类型均拒绝。新 Object 的必需子字段属于新对象初始化，不允许借此替换既有字段。

```js
function transform(self, input) {
  input.add("注释的Schema ID", values.text("新增内容"));
  input.get_member("已有子对象的成员ID")
       .add("数值的Schema ID", values.integer(42));
}
```

```py
def transform(self, input):
    input.add("注释的Schema ID", values.text("新增内容"))
    input.get_member("已有子对象的成员ID").add("数值的Schema ID", values.integer(42))
```

values 提供 text/content/integer/decimal/date/null/object 和 Class 构造器（JS values.class、Python values.reference），构造的是 **add 的参数**，不是返回声明。Object 参数可写 `values.object([{schemaId:"字段ID", key:"字段键", value:values.text("内容")}])`。旧 append_repeatable/append_self 作为兼容别名仍走相同验证，新代码、补全和速查统一使用 add。

## 写入作用域和事务

绑定函数只能在绑定属性及任意深度子对象中添加 Schema 已标记 repeatable 的值，不能修改、重命名、删除、替换任何已有值或更改 Schema、实例、类。Class 引用不授予其它实例的写权限。新 void Function 必须提供具体绑定路径，不能进行无作用域写入。

每次调用使用草稿。add 结构验证失败、脚本异常、取消或并发冲突时，撤销本次全部添加；成功后新增成员与执行状态原子提交到内存草稿；用户保存时复用统一保存。JS add 返回新成员门面，可继续在该新对象上 add；Python 仍按快照和操作日志执行，add 不返回新成员门面，复杂新增结构可一次以 values.object 提供。

<a id="绑定调度与结果身份"></a>

### 绑定、调度与执行状态

input 是本次原始值快照，不因 add 改变。原始输入排除函数生成字段，任务扫描跳过生成字段及其子树，避免自身添加引发递归执行。创作区不自动调度绑定函数；输入、脚本、绑定、改名、切页和布局变化都只修改草稿。刷新先重新读取当前文件，再强制扫描该文件全部有效绑定，已有 functionRuns 不跳过本次显式执行；人物关系网等视图刷新计算父类文件的绑定，项目刷新计算该世界的绑定。明确脚本测试运行仍可执行。源修订与输入检查负责执行期间的一致性，而不是编辑后自动执行。

刷新继续遵守 void/add 的追加契约：函数代码不能修改用户原值；运行事务先移除当前函数＋当前绑定拥有的旧生成成员，成功后提交重新计算的追加对象。同键同结构的生成成员复用 JSON 身份，其他绑定不受影响；失败回滚整个事务并保留旧有效内容。执行结果留在内存并标记未保存，需 Ctrl+S 或保存全部持久化。解绑、换绑及删除函数的来源清理仍由模型维护，也属于未保存更改。

## 显示、来源和绑定生命周期

函数添加结果是实际 **FieldValue**，显示、引用和嵌套方式复用普通成员控件，但键、值及生成子树由程序维护。每个生成成员上方显示一行加粗的“函数名 →”，表示下方内容由该函数添加；没有函数名成员、只读专用返回容器或返回值类型配置。函数本身仍不可修改既有值，用户不能修改生成字段的键、值、子成员或直接删除它们；文本控件只读、引用选择器禁用、添加和删除入口隐藏，关系详情与批量编辑遵守同一限制。

每个生成成员在工作区 JSON 中保存内部 `functionOrigin={functionId,name,bindingFieldId}`，新 Object 的初始化子字段继承来源。成员卡片显示函数名提示，Markdown 标题旁只写 `<!-- 函数名 -->`；来源 ID、绑定 ID、执行状态和过程索引均不写入正文。读取先根据当前 Schema 和正文恢复内容，再用 JSON 记录匹配身份；没有 JSON 记录时按名称与绑定作用域重建，歧义报错。界面源码编辑与导入保留只读比较，磁盘重读允许正文覆盖旧 JSON 内容与来源标记。旧带 <!> 标记及来源索引兼容读取，保存迁移为简洁注释。标记不声明新 Schema，也不是防篡改沙箱。

解绑或换绑时删除 **原绑定实例＋原函数** 所有的生成字段，包含深层子对象；保留其它函数生成字段及用户原有字段。删除函数也清理其所有生成字段。程序按具体 FieldValue 的绑定 ID 与函数 ID 判断，不按函数名、键名或文本比对。用户修改生成值不被接受；解绑仍会删除该对象；生成父对象被删除时其内部子内容一同删除。复制实例会同时重映射成员 ID 和来源中的 bindingFieldId。

`FieldValue.functionRuns` 仅保存内部调度状态（函数 ID/名、原输入、source/contextKey、error），不保存结果值，不导出 Markdown 成员。成功运行没有额外显示项，失败只显示执行错误提示。旧 functionResults 作为历史兼容数据可读取，工作区规范化时清除，不再写回函数结果标题。用户原始值保留，来源仅保存在 JSON 和可读函数名注释中。

## 执行环境、Flow 和编辑

JS/Flow 在主程序 WebView/浏览器中执行，复用按稳定 ID 读取的对象门面，不需 Node/Worker，不提供 CommonJS require。Python 仅桌面可用，需要 Python 3；其 add 日志由主程序相同接口重放、校验、提交，不另写 Markdown 或磁盘存储。

Flow 保留 input/运算/代码块/世界对象卡片；结束节点只保证依赖执行，计算值不作为世界写入依据。代码块通过输入对象或 world 成员门面调用 add，允许无返回值。普通中间值仍可连接其它节点作运算。

编辑器显示源码/画布、绑定上下文和测试状态，提供 add 补全和接口速查，取消返回类型选项及插入返回语句入口。JS 模板无 return，Python 模板以 pass 起步。测试必须选择具体成员上下文；成功会提交 add 修改。测试不自动建立 Schema 绑定，若生成来源没有有效绑定，后续绑定协调会清理它。

旧未声明 executionMode 的独立接口仍支持历史类型化返回以兼容已存 Agent/消费节点；所有文件成员绑定调用强制使用 void，不据返回值写入世界。新建 Function 明确 executionMode=void。当前 Agent/SD 通用 Function 节点没有提供具体 bindingPath，因此不能直接运行新 void Function 来修改世界；需要补充绑定上下文适配。旧独立返回调用不受这一新模式替代。

异步 JS 等待最多 5 秒，同步主线程代码不能强制中断；外部副作用不属于草稿回滚。详见 [脚本与 Tool](tools.md)。

## 存储与代码入口

脚本存 user/functions/<id>.js/.py/.flow，组织文件夹或改名不移动实际文件。文件布局见 [JSON 存储](../data/json-storage.md)，来源注释见 [Markdown](../data/markdown.md#function-生成成员与来源元数据)，提交与刷新见 [持久化功能](persistence.md)。

model/functionAppend.ts：结构构建、来源与解绑清理；model/functionValues.ts：TypedValue/输入包装；model/functions.ts：模板/输入修订；services/functions.ts：void 运行、调度状态；services/scriptHost.ts/hostWorldApi.ts：事务和 add 门面；src-tauri/src/functions.rs/function_values.py：Python 日志桥；FieldEditor/FunctionCodeEditor/FunctionsPage：普通成员控件及生成内容只读呈现。
