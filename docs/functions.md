# Function 函数

更新日期：2026-10-09。

## 类型接口（版本 2）

新建函数默认使用 `transform(self, input)`。脚本接收只读数据快照，返回值不会直接修改调用实例。函数设置中的“返回类型”是约束，而不是依靠 JS/Python 原生类型猜测：Text 和 Content、Integer 和 Decimal、日期和普通文字始终区分。

```js
// 返回类型选择 Object；返回类规范可留空，或选择一个已有类。
function transform(self, input) {
  return values.object({
    名称: values.text(self.name),
    原值: input.to_value(),
    说明: values.content(input.markdown())
  });
}
```

```python
def transform(self, input):
    return values.object({
        '名称': values.text(self.name),
        '原值': input.to_value()
    })
```

### self 与 input

- `self.type` 为 Class；`self.id / name / classId` 标识调用函数的实例。`self.schema()` 读取类属性规范；`self.members()`、`self.get_member(属性ID或名称)`、`self.markdown()` 读取实例。成员的 `to_value()` 返回带类型的值；成员 `value()` 保留旧世界接口的原始文本行为。`self.to_value()` 返回当前实例的 Class 引用。
- `input.type` 为绑定值的实际类型。`input.value()` 对 Text / Content / Data 返回文字，对 Integer / Decimal 返回数值，对 Null 返回空值，对 Class 返回 `{classId, entityId}`，对 Object 返回属性条目列表。
- `input.to_value()` 返回可直接返回的类型对象。`input.members()` / `input.get_member(属性值ID、schemaId 或键名)` 读取 Object 子成员；重名使用 ID。`input.instance()` 读取 Class 引用的实例。`input.markdown()` 返回内容文本。
- 未填写的数值、日期、Class 输入为 Null；空 Text / Content 仍为对应文字类型。Class 选择函数派生值时，input 使用派生结果的实际类型；旧字符串结果封装为 Text。
- 属性值、实例名、类规范或函数返回规范改变后重新计算；函数派生结果不计入原始世界修订，避免自身结果触发无限重算。执行完成时丢弃过期快照。

### 返回表示与构造器

| 项目类型 | JS / Python 构造器 | 规范表示 |
| --- | --- | --- |
| Text | `values.text("文本")` | `{type:"Text",value:"文本"}` |
| Content | `values.content("正文")` | `{type:"Content",value:"正文"}` |
| Integer | `values.integer(12)` | `{type:"Integer",value:12}` |
| Decimal | `values.decimal(1.5)` | `{type:"Decimal",value:1.5}` |
| Data | `values.date("20261009")` | `{type:"Data",value:"20261009"}` |
| Null | `values.null()` | `{type:"Null",value:null}` |
| Class | JS `values.class(classId, entityId)`；Python `values.reference(classId, entityId)` | `{type:"Class",classId,entityId}` |
| Object | `values.object({键:类型值}, classId可选)` | `{type:"Object",members:[{key, value:类型值}],classId可选}` |

Python 表示中的 `null` 对应 `None`。允许直接返回同样结构的字典/对象；不允许直接返回字符串、数字或未经标记的原生对象。JS `values.from(result)` 用已声明类型封装 Flow 原生结果，不猜测类型，之后仍执行完整校验。

Object 可用条目数组代替键值映射，支持重复键和动态键：`values.object([{schemaId:"属性配置ID",key:"实际键名",value:values.text("值")}], "类ID")`。选择“返回类规范”后，按该类 schema 校验成员类型、固定键、Class 键引用、重复项与嵌套属性；动态 Text / Class 键须提供 schemaId。Class 返回校验实例存在且属于声明类。返回的结构对象是派生值，不会创建新的类实例。

Integer 必须为 JS 安全整数，Decimal 必须为有限数值；Data 必须是有效 YYYYMMDD 日期。错误会指出属性路径。输出最多 1 MB，结构最多嵌套 32 层。

### 保存与兼容

返回值仍显示在原属性下，并保留 `typedValue`。Markdown 展示内容后附带 `function-value` 注释，保存 URI 编码的类型结构和上下文键，读取时恢复结构。外部修改展示文本使其与元数据不一致时，丢弃类型缓存并重新计算；原 Value 保留。

新函数默认 `apiVersion:2`，返回规范保存在 Function 配置。现有未声明版本的函数、导入 JS/Python/Flow 文件使用旧字符串模式，避免改写旧脚本。切换接口不会自动转换用户代码；请同时修改入口与返回语句。函数调用助手可插入 Markdown 文字返回或类型值返回，并补全 self、input、values 接口。

## 创建和测试

进入 **插件 → 函数**，新建 JavaScript、Python 或 Flow 函数，或导入 `.js`、`.py`、`.flow` 文件。新建函数默认提供 `transform(self, input)` 类型接口，返回值必须与函数设置中的返回类型一致。测试时选择世界、调用实例和绑定属性，input 的类型 JSON 可编辑；属性绑定自动提供所属实例和 Value。旧函数及导入脚本默认使用字符串兼容模式，可以在“接口”中切换并自行改写入口。下列两个字符串示例仅用于兼容模式。

```js
function transform(input) {
  return input.trim();
}
```

```python
def transform(input: str) -> str:
    return input.strip()
```

桌面版调用系统 PATH 中的 Node.js 或 Python 3；Python 会尝试 `python`、`python3`、`py -3`。运行环境未随 exe 打包。JS 桌面脚本可使用 CommonJS `require`，浏览器 JS 在独立 Worker 中运行，不支持 Node 模块；Python 仅在桌面运行。脚本以当前用户权限执行，并非权限隔离的沙箱。每次执行限时 5 秒，脚本和输入最多 1 MB，输出限制 1 MB；日志不混入返回值。

## 属性绑定与输入

Flow 与脚本共用属性绑定、自动运行和返回值引用。

在任意属性配置条的 Value 类型后使用“绑定函数”，可绑定多个函数；点击函数标签解除绑定。Function 是 Value 类型的附加行为，不替代 Text、Content、Class、Object、数字、日期或 Null。

新接口详见上方“类型接口”。以下输入规则仅适用于旧字符串兼容模式：

- 普通值以原始字符串输入；Null 输入为空字符串。
- Object 输入为子属性的 JSON 数组字符串，包含 `key`、`value`、`children`，不包含函数结果。
- Class 值选择函数返回值时，以该返回字符串作为下一级绑定函数的输入；选择原值时保留对象引用。

原值仍由用户编辑，返回值以子属性形式展示“函数名 → 对应值”。原值或代码变更后自动计算，约 500ms 防抖。错误显示在返回值区域，不覆盖原值，也不将错误当作成功结果写入 Markdown。同一次失败不会反复执行，修改输入或代码后重试。执行完成时再次检查字段、绑定、代码与输入，丢弃已过期的结果。Class 函数返回值的循环引用会报告错误。

## Markdown 双向表示

```md
### 描述

  原始内容

#### [去除空格](../../functions/<函数ID>.js)

原始内容
```

函数结果的标题比所属属性深一级，即使所属属性不是 Object。解析器识别指向 `.js` / `.py` / `.flow` 的子标题，将其恢复为 `functionResults`，不会混入原值或普通 Object 子属性。导入可恢复函数结果和绑定标识；对应脚本未注册时可以显示已保存结果，但需在属性配置中绑定已注册函数才能继续计算。正文中的标题按原有转义规则保存。

右侧 Markdown 可编辑原值和返回值；只编辑返回值时会保留这一修改，下一次原值或脚本变化会重新计算。

## 引用返回值与 UI 复用

对象引用选择器在所选实例存在绑定函数的属性时，显示第二个菜单。“使用原值”保持普通 Class 引用，其他选项按“属性路径 / 函数名”选择返回值。

引用保留原对象链接，并追加函数链接与字段 ID，例如：

```md
[实例](文件.md#实例) [函数](../../functions/<函数ID>.js)@<字段ID>
```

`DerivedReferenceSelect` 共用于 Class 键、Class 值及关系网格式的实例选择。关系网格式中选择返回值用于关系标签或背景域标题；映射仍关联原实例，以保持颜色格式、关系目标和势力成员稳定。人物关系选择函数返回值时，连线保留目标实例，并显示对应返回文字。

## 保存位置

函数注册信息和代码缓存位于 `user/workspace.json`，脚本文件位于 `user/functions/<函数ID>.js` 、`.py` 或 `.flow`。世界 Markdown 通过相对链接关联脚本；属性 schema JSON 保存 `functionIds`。启动时读取注册脚本文件的代码，因此关闭软件后可用外部编辑器修改脚本，再重新启动。运行中脚本编辑以应用内编辑器为准，外部脚本变更没有实时监听。

删除函数会解除所有世界的绑定、移除其结果，并将使用其返回值的 Class 引用恢复为原值；保存后删除对应注册脚本文件。技能和工具页面仍为占位，未实现插件安装或 Agent 调用。

## 插件文件夹与树视图

插件 → 函数支持嵌套文件夹，可从侧栏行内按钮或主操作区新建。新建、导入函数归入当前文件夹，编辑页可修改所属文件夹。文件夹支持重命名；删除文件夹将其函数及子文件夹移到上一级。分类、层级和归属保存到工作区 JSON，脚本仍位于 user/functions/<函数ID>.js、py或flow，现有 Markdown 链接保持有效。技能与工具也提供同样的文件夹组织功能，其文件编辑尚未实现。

## Flow：卡片与代码组合

Flow 文件为 `user/functions/<函数ID>.flow`，保存版本化 JSON 图结构。右侧树提供相加、相减、相乘、相除、常量、代码块、获取实例内容和获取实例对象。点击或拖入卡片，点击输出端口再点击输入端口连线；双击输入端口断开。未连线的输入使用卡片中的默认值。算术使用数值转换，空值、无效数值和除零会报告错误。

新接口的 input 是绑定 Value 对象，代码块可以读取 self、world 和 values；return 保留带 type 的值对象，算术输出可按函数声明构造 Integer / Decimal。直接传递 input 时保留原类型。旧接口的 input / return 仍为字符串，其他数据在最终输出时转为 JSON。获取实例内容卡片选择 Class 和实例，返回完整 Markdown；获取实例对象继续逐级选择成员，默认返回该成员 Markdown，也可选择原始值用于运算。

代码块使用 JavaScript，可自定义命名输入，通过 `inputs.a` 读取输入，支持循环、条件、`await` 与 `world` 对象调用；使用 `return` 输出。展开代码块可以使用对象调用助手。图不允许循环连线，循环逻辑放在代码块内。执行仅计算连接到 return 的卡片，每张卡片每次运行计算一次。可预览生成的 JavaScript；暂不支持把任意脚本文本逆向还原为图。

拖动标题移动卡片，拖动空白处平移，滚轮围绕光标缩放。工具栏可适配全部卡片、删除所选卡片或线，以及展开为整个操作区画布。

## 脚本中的世界对象 API

JS/Python 编辑器右侧提供同一套对象选择器，可选择 Class、实例及嵌套成员，将调用或返回语句插入光标处。生成调用使用稳定 ID，改名后仍可定位。编辑器提供接口方法提示与 Tab 缩进，并非完整语言服务器。

```js
function transform(input, world) {
  const people = world.get_class("人物").instances();
  return people.map(person => person.markdown()).join("\n\n");
}
```

```python
def transform(input, world):
    return world.get_class("人物").get_instance("人物名").get_member("人物性格").markdown()
```

`world.classes()` 枚举 Class；`get_class(ID或名称)` 获取 Class。Class 提供 `instances()`、`get_instance()`、`schema()`、`markdown()`；实例和成员提供 `members()`、`get_member()`、`markdown()`，成员另有 `value()`。对象具有 `id`、`name`。名称重复或对象不存在时报告错误，推荐使用助手生成的 ID 调用。

API 是当前世界的只读快照，可在代码中自由组合，不能通过它修改创作数据。读取时排除本函数自身的旧返回值，避免结果不断嵌套。原始实例内容或 schema 变化会重新计算使用 world 的函数；仅移动卡片、改变主题或生成函数结果不会触发这种刷新。执行结束再次核对快照版本。

Flow 在浏览器与桌面均编译为 JS 执行；Python 仍仅限桌面。`.flow` 结果链接、绑定与 Markdown 双向解析与 `.js`、`.py` 相同。启动时从对应 `.flow` 文件加载图，运行中外部文件变更没有实时监听。

### 函数页面与执行异常

函数页面使用独立固定标题和内容滚动区域，标题与内容共享居中宽度，统一配置、代码、测试区域间距。执行失败展示可复制的完整异常：JS 堆栈、Python Traceback、进程退出码及失败日志、运行环境启动错误。异常面板出现时自动滚动到该面板。支持 transform(input) 中直接访问 world，不强制增加第二个参数。

### 桌面 JavaScript 模块兼容
桌面执行器使用独立的 runner.cjs，确保 CommonJS 的 require 不受上级 package.json 中 type: module 影响；用户函数仍保存为 JS 脚本。已增加 ES 模块项目目录下运行脚本的回归测试。

### Function 返回值只读成员视图
函数成功结果根据 typedValue 渲染，与普通成员共享 field、object-body、text-reference、reference-trigger 等界面样式。Object 递归展示子成员；Text、Integer、Decimal、Data 使用只读输入框，Content 使用只读多行框；Class 值及 Class 引用键使用禁用的对象选择按钮，显示类名和实例名，不打开菜单。返回类规范存在时复用其成员键类型，动态文本键也使用只读输入框。Null 显示无内容，空 Object 显示无子成员。结果不提供增删或编辑操作，文本可复制；旧字符串结果显示在只读多行框。错误和等待状态保留，Markdown 序列化与结构元数据不变。

## 类型结果的界面语义与布局

绑定属性的 Value 类型与 Function 声明的返回类型各自承担独立约束：前者决定输入如何封装，后者决定输出如何校验。不能仅根据绑定位置是 Object 推断返回规范也为 Object。调用上下文仍由 self 和 input 表达，结构化值使用项目类型封装，详细理念见 [设计原则第 9 节](design-principles.md)。

返回结果是所属成员卡片中的派生区域，与 Key 和原始 Value 一起展示；结果不替换原值。Object 递归渲染成员，Class 使用禁用选择按钮，文字和数字/日期使用只读输入，Content 使用只读多行框。结果支持复制，但不提供编辑、添加或删除。错误及等待保持独立状态，不能把错误字符串当成正常类型值。

对象引用旁的使用原值/函数返回值菜单是当前引用的来源参数，与 Value 同行展示；紧凑宽度和换行规则见 [设计原则第 5 节](design-principles.md)。此布局复用不改变调用、结果缓存、过期任务丢弃或 Markdown 类型元数据。卡片悬停是纯展示反馈，不触发函数重算。

## 在模型工作流中复用

Agent 与 SD 图中的 Function 节点调用同一脚本执行器，不复制一套脚本类型规则。Agent 可选择 self 实例，传入 TypedValue 或转换后的 Text；SD 的 Function 在本程序中求值，作为 ComfyUI 原生节点的字面输入。图运行使用发起时的世界快照与稳定对象 ID；缺失对象、脚本异常、返回类型错误按节点名反馈。模型、变量、上下文与绘图编排见 [模型与智能体](models-and-agents.md)。

## 编辑工作区优先（2026-10-09）

文件夹/集合列表使用完整 page-heading 与 heading-actions 展示集合名称及新建入口。进入具体绘画工作流、Agent 或 Function 后，不再重复占据大块空间的标题、说明和创建按钮。顶部使用 48px 紧凑工具栏标识当前对象，导入/导出等操作为辅助；主区域无居中宽度限制和外围留白，画布或源码编辑器填满剩余高度与宽度。

配置、初始变量、接口规范及测试输入/结果通过“配置”和“运行/测试”打开右侧覆盖面板，默认关闭，不挤压画布。两个面板互斥，运行结果/异常可查看；辅助面板可独立滚动。对象调用助手和节点库保留在编辑区边侧。文件夹列表保留新建功能，具体编辑页提供精简动作，右键菜单继续复用当前真实工具栏。

这个规则强调当前任务的主操作载体：用户进入工作流是为了编排节点，进入函数是为了写代码，标题和说明应让位给这些操作；无需将所有页面统一套用列表页的标题布局。

## Function Flow 共享画布编辑（2026-10-09）

Function Flow 复用工作流的框选、多选、组拖动、剪贴板、图编辑历史、输入端口起笔和快捷键；不改变 JS/Python Function 的 self/input 与 TypedValue 返回规范。Agent/SD 的 String/Number/Boolean/Messages/Image 变量对象属于工作流运行层，仍通过现有 Function 节点显式桥接函数契约。详见 [workflow-types.md](workflow-types.md)。
