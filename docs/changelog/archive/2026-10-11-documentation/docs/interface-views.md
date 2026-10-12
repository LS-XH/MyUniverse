# 人物关系网与地图投影

## 视图定义

界面操作类型投影已有世界对象，不拥有第二份实例内容。地图创建时选择父文件类型 parentClassId，并通过 bindings 映射显示元素。关系网只对应内置人物类 people，创建及配置不提供父文件类型或显示元素绑定；程序按当前人物 Schema 生成内部路径。

集合组织 parentId 与数据父类 parentClassId 分开。同一父类可有多个独立视图，布局和配置各自保存，源对象共享。地图可投影任意父类；关系网使用人物、关系和势力的定制结构。

```ts
interface InterfaceView {
  version: 1; id: string; name: string;
  kind: 'graph' | 'map'; parentClassId: string; fileName: string;
  bindings: Record<string, ViewBinding>;
  graph: GraphConfig;
  map: { image: string; legend: string;
    positions: Record<string,{x:number;y:number}> };
}
```

World.views 按视图 ID 保存配置，TreeNode 指向界面入口；配置名为 <id>.view.json。聊天仍使用 World.chat 的专用配置，不伪装为当前 graph/map 的 InterfaceView。

<a id="对象绑定"></a>

## 对象绑定与内部路径

```ts
interface ViewBinding {
  scope: 'current' | 'fixed';
  source: 'name' | 'instance' | 'member';
  mode: 'markdown' | 'content';
  path: string[];
  classId?: string; entityId?: string;
  part?: 'key' | 'value';
}
```

### 当前实例与固定对象

current 以当前父类实例为根，path 使用 Schema ID；重复成员可以得到多项。fixed 显式指定类/实例，path 使用具体成员 ID，定位一个实际对象。两种路径不能混用，以名称猜路径会在重复键或改名后失效。

source=name 取实例名，instance 取完整实例，member 取路径成员。mode=markdown 保留标题和序列化形式；content 取显示内容，引用可转换名称、Object 可递归展开，part 区分 Key/Value。成员为空、路径失效应明确为空或提示，不自动猜另一字段。

### 原值与显示值

bindingText 为显示文字，可解析引用、派生来源、名称和正文；bindingRaw 保留真实引用/数值文本。边目标与分组身份依赖原引用，不能用显示名代替身份；渲染“某人物”不意味着可以按该显示名连接任意同名对象。

地图的 ViewBindingPicker 共用层级选择，固定对象选择器自然换行，配置控件应用主题。bindingFields/schemaAtPath/concreteField 统一解析；字段树和显示转换不在每个视图重写。

## 关系网

### 元素与关系上下文

| 绑定槽 | 职责 |
| --- | --- |
| title、avatar、subtitle | 节点标题、头像/字符、副标题 |
| domain、domainLabel | 分组实例引用、分组显示名 |
| edges | 可重复关系成员集合 |
| target | 相对单条关系成员的目标 Class Key/Value |
| edgeLabel | 相对关系成员的标签/关系类型；汇总所有匹配的可重复值 |

关系网由 personGraphView 读取人物类当前 Schema：人物关系 Object → Class-人物重复项 → 关系 Object → 可重复 Class-关系键 / Null 值；目标为人物重复项的 Class 键。关系标签和取色身份读取关系列表子项的 Class 键，不读取其 Null 正文；旧直接 Class-关系 Value 仍兼容，按 Schema 的键/值类型区分，不靠显示文字猜身份。姓名与首字头像来自人物实例名称，势力名称和地位来自人物势力成员。路径使用现有 Schema ID，不改写用户 Schema。旧保存的自定义 graph 父类/绑定不再参与显示；布局、样式、开关和文件身份保留，保存时规范为人物配置。地图仍可配置当前/固定绑定。

edgeLabel 使用关系列表的子项路径及 part=key，读取同一路径下所有匹配成员，按原顺序以多行 SVG 文字显示，不只取首值；多个值不创建多条重叠连线。连线样式按首个可见关系值映射，文字始终显示该关系项中指向目标人物的全部关系名称，即使只有一个值也不被旧 labelSource 覆盖；关系样式不再提供标签来源选择。

“显示函数生成关系”默认开启，独立于关系文字开关。关闭后，投影跳过带 functionOrigin 的关系成员及其祖先生成的子树；手动关系内仅过滤函数生成的标签值，保留手动标签。原先有标签且过滤后没有标签的关系不绘制，无标签的手动空关系仍可显示。此开关不删除字段、不改变函数绑定，也不隐藏人物卡片；详情编辑仍定位完整源关系，避免保存可见子集导致隐含删除。

可新增关系要求人物关系列表具有可重复 Class-人物键结构。写入通过已有 Schema 创建缺失路径和子成员，保留字段身份；不符合人物结构时不开放新增连线，不退回自定义绑定或从显示文字猜目标。

### 源数据编辑

节点详情直接编辑人物实例。新增节点创建人物实例；新连线添加源实例的关系成员，箭头目标由引用决定，不自动反向写。删除连线删除对应源字段。多选仅批量修改唯一存在的共同成员，保留每个对象自己的 ID 与其他值。

源成员修改走统一世界与 Markdown 保存，视图不单独维护人物/关系数据。人物内容或 Schema 改变后的显示实时更新，不因缓存保留旧值。

### 独立布局与样式

graph 保存 positions、lineStyles、domainStyles、showDomains、showLabels、showFunctionRelations。showFunctionRelations 缺省按 true 兼容旧项目，保存于各视图配置而非全局主题。布局以实例 ID 为键，关系/分组样式按实际类型实例映射。缺省位置仅为展示，拖动后保存视图覆盖。

线条支持 ARGB 填充/边框、发光、线型、线宽、边框宽、字号与标签来源；背景支持填充/边框、发光及纯色、点阵、斜线、虚线、网格。选择器为程序 ARGB，8×8 色板保留透明度。

长/短划线与划线点线使用不同参数，线、外框和箭头有独立正确几何范围。双实线为配置选项，但当前渲染仍需完善，不能视为所有线型完成。交互尺寸与选择见 [页面 UI](ui-interactions.md#关系网)。

## 地图

父类实例生成标记，title/description/x/y/image 由绑定得到。源坐标需为有限数值文本；没有可用坐标时使用默认布局。view.map.positions 优先覆盖源坐标，拖动只修改该视图布局，不写源字段。

背景取 image 绑定（当前模式以首个父实例解析，固定模式用固定对象），缺省 view.map.image；legend 为视图配置。支持平移、光标缩放、标记选择/拖动、适应视图和双击打开父类实例。地图是图片坐标投影，尚无 GIS 经度纬度、地图服务或坐标反写契约。

## 配置、保存与兼容

视图 JSON 保存绑定和布局，世界文件保持平铺；创建不为集合建立实体目录。world-index 保存单世界组织清单，workspace.json 保存应用和组织状态。视图 JSON 参与外部读取、校验、三方合并和 Rust 写前检查，损坏/删除不直接覆盖。

旧 graph/map 配置和图节点通过 normalizeViews 转为默认父类与绑定，保留原布局/样式，不移动用户文件。改视图名同步树名称；删视图删逻辑定义，旧未引用磁盘文件尚未主动清理。地图改父类或删除来源后应面对失效引用，不凭旧名称猜对象。关系网父类固定为人物，旧自定义来源不再生效。

## 布局与性能

实际页面容器链必须 flex 填满剩余区、min-height:0，不能仅在独立组件中看似有画布；配置标题固定，正文独立滚动、居中。绑定控件和新建窗口统一主题。

documents 快照建立引用索引，投影/分组缓存不随平移、缩放或本地节点拖动重算。关系网本地预览位置，释放只提交一次布局，避免每帧触发全工作区保存及 Function 检查；绑定源数据修改仍实时重算。

## 实现与验收

model/interfaceViews.ts：绑定、规范化、写回及配置解码；App.tsx：关系网；MapPage：地图；InterfaceConfigPage/ViewBindingPicker/CreateInterfaceDialog：配置；storage.ts/markdown.ts：保存。

验收当前/固定路径、重复成员、Markdown/内容、原引用身份、地图任意父类、人物专用关系网、关系写回、布局隔离、旧项目兼容、JSON 冲突、真实页面高度和大型关系网视角性能。历史测量数字保存在 [修改日志](changelog/README.md)，不当作每次运行的性能保证。

### 人物个人关系网与格式可见性

双击人物卡片进入个人关系网。中心人物居中，直接关联的人物（包括入向与出向关系）环形排列，仅绘制与中心人物相连的边。没有关系时仅显示中心人物。返回按钮或 Esc 恢复完整关系网的视角、缩放、选择及详情栏状态；个人布局属于页面会话状态，拖动和缩放不会覆盖完整关系网的持久化位置。

关系格式的 `lineStyles[关系实例ID].visible` 控制该关系类型的显示，缺省为 true。重复关系逐值过滤，文字显示剩余全部关系，首个可见关系决定颜色与线条格式；全部关闭时隐藏连线。此过滤与函数生成关系开关共同生效，不修改人物原始成员。关系格式与背景块格式分组首次进入默认收起，可通过标题展开；添加映射会自动展开对应分组。
