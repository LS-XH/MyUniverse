# 界面操作类型：对象投影视图

更新日期：2026-10-09。

## 核心思想

文件操作类型定义数据；界面操作类型定义如何观察和操作这些数据。界面像透视表一样，以一个父文件类型的实例作为数据行，将成员变量映射成卡片、连线、分组、地图标记等显示元素。多个视图可以观察同一份 Markdown 对象，它们共享源数据，各自拥有绑定、样式和布局。

界面不拥有第二份实例数据。修改详情或建立关系，修改的是父文件类型的原对象；移动卡片，修改的是该视图的布局。增加视图种类时，扩展渲染器与绑定槽位，不重建用户数据目录。

目前可新建的界面种类是 `graph`（关系网）和 `map`（地图）。历史聊天框保留为独立会话界面，不在本次对象投影视图的新建类型列表中。

## 数据结构

```ts
interface InterfaceView {
  version: 1;
  id: string;                 // 与导航 TreeNode.id 相同
  name: string;
  kind: 'graph' | 'map';
  parentClassId: string;       // 必须是当前 world 中存在的 ClassDocument.id
  fileName: string;            // <view-id>.view.json，稳定且平铺
  bindings: Record<string, ViewBinding>;
  graph: GraphConfig;          // 独立位置、关系样式、分组样式、文字开关
  map: { image: string; legend: string; positions: Record<string, Point> };
}
interface ViewBinding {
  scope: 'current' | 'fixed';
  source: 'name' | 'instance' | 'member';
  mode: 'markdown' | 'content';
  path: string[];
  classId?: string;
  entityId?: string;
  part?: 'key' | 'value';
}
```

`World.views` 按视图 ID 索引定义。导航节点保存 `viewType` 和 `classId`，分别对应种类与父数据类型。`TreeNode.parentId` 仅表示集合组织关系，`InterfaceView.parentClassId` 表示数据来源关系；这两种父关系不能混用。

### 绑定的身份与上下文

- `current`：对每个父类型实例应用同一条 schema 路径，`path` 保存 schema ID；改字段名称不会改变绑定，重复成员会依次产生多个结果。
- `fixed`：选择当前 world 的明确 Class、实例和成员，`path` 保存具体 FieldValue ID；每张卡片都引用同一个固定对象。
- `name`：读取实例名称；Markdown 模式产生实例标题。
- `instance`：读取整个实例；Markdown 模式复用实体序列化器，内容模式组合成员内容。
- `member`：读取指定成员的键或值。内容模式组合值及子成员内容，将 Class 引用展示为实例名称；Markdown 模式复用 `fieldMarkdown`，保留标题、嵌套、正文与函数结果。Markdown 值是序列化文本，不把它当作 HTML 执行。
- 未绑定的成员返回空值，不自动把整个实例塞进显示元素。路径失效不按名称猜测其他属性，配置页提示重新选择。

显示文本和结构身份分别读取：文字采用选定的 mode；连线目标、分组对象采用原始 Class 引用，坐标采用原始有限数值，不能拿显示名称或 Markdown 标题当 ID。

### 关系网槽位与写回

| 槽位 | 上下文与用途 |
| --- | --- |
| title / avatar / subtitle | 当前父实例的卡片名称、图标文本、副标题 |
| domain | 当前父实例的分组 Class 引用 |
| domainLabel | 被引用的分组实例的显示名称，可再绑定其成员 |
| edges | 当前父实例中可重复的关系成员对象，保存 schema 路径 |
| target | 相对于一条关系成员；空路径表示读取成员自身的 Class 键/值，非空路径读取其子成员 |
| edgeLabel | 相对于一条关系成员；可以绑定子成员或固定对象，支持两种取值方式 |

每条线的主语是持有该关系对象的父实例，目标是同一父类型中被 Class 引用的实例，箭头从主语指向目标。背景域按 domain 引用分组。关系/分组样式映射的候选类型从绑定的 Class schema 推导，不再写死 relations、factions。

连线写入要求 edges 是可重复的成员，并且 target 的 Class 指向父类型。缺少这个结构时允许查看卡片，但禁用新增连线。创建时沿 schema 路径补齐缺少的容器，新增目标成员；修改、删除关系按具体 FieldValue ID 递归写回，保留无关属性与嵌套结构。已有批量详情编辑继续使用父文件类型的 schema。

### 地图槽位与布局

父实例产生地点标记。title、description 决定文本；x、y 绑定数值作为初始位置；image 绑定图片来源。未绑定数值时采用排列默认位置。拖动后的位置保存到本视图的 map.positions，优先于数据坐标；拖动不隐式改写源成员。双击地点打开父文件列表并定位实例。平移与缩放用页面状态缓存，切页返回保留。

图片背景优先使用 image 绑定值，否则使用 map.image；当前实例背景绑定使用父类型的首个实例，也可绑定固定对象。图片来源应为可访问的图片 URL/data URL。图例单独保存。

## 文件组织与迁移约束

继续采用当前目录：

```text
user/
  workspace.json
  worlds/<world-id>/
    人物列表.md
    人物列表.schema.json
    其他文件类型.md
    其他文件类型.schema.json
    <view-id>.view.json
    world-index.json
    关系网.json
    地图配置.json
    聊天框配置.json
```

所有 world 文件平铺。UI 文件夹是 JSON 中的虚拟集合，改名、移动、添加集合不会移动磁盘文件。`workspace.json` 保存当前工作区与导航组织状态；`world-index.json` 是随保存输出的单 world 组织清单，包含版本、world 身份、nodes、文档索引和视图文件索引，便于备份与后续迁移工具读取。当前启动仍从 workspace.json 枚举 world，不自动扫描目录导入遗留文件。

视图名称不作为文件身份，重命名仍使用同一个 `<view-id>.view.json`。视图 JSON 启动及保存前重新读取，经过身份、父类型、绑定和布局校验，使用三方合并保留独立外部改动；冲突或损坏阻止覆盖。桌面写入前再比较文件内容，检测读取与写入之间的竞态。Markdown 同步继续使用既有机制。

旧项目没有 views 时，按已有 graph/map 节点生成定义：默认关系网绑定人物及其关系、势力、地位 schema ID，默认地图绑定地点；原 world.graph/world.map 复制为该视图的独立配置。已有文件名、实例身份、字段身份与导航层级保留。旧 JSON 继续输出作为兼容快照，本版视图以各自定义为准，无需改造旧 user 目录。

删除视图删除 JSON 组织引用，源类型与实例保留；删除父文件类型同时移除绑定它的视图。磁盘上的旧未引用文件暂不自动清理，避免破坏外部备份或扩展文件；它们不会因目录扫描重新出现在树上。

## 使用与验证

集合右上角“新建界面”，或文件操作页面的同名按钮，进入种类、父类型和名称选择，创建后打开配置。配置页通过复用的对象选择器设置绑定；图/地图操作继续占据整个画布区。配置与画布都提供删除界面，右上角可定位独立配置文件。

自动测试覆盖旧结构迁移、schema/FieldValue 身份绑定、Markdown 与内容取值、嵌套关系写回、多视图布局隔离、平铺文件输出、外部配置合并与冲突保护。独立内存浏览器页验证任意“物件”父类型的卡片/关系线、切换 Markdown 取值、地图渲染及新增第二个地图。测试不创建用户持久化项目。

本次验收：82 项前端测试、15 项 Rust release 测试通过，前端生产构建及桌面编译成功。独立内存浏览器页另验证了自定义父类型的新建连线写回。当前 exe 被占用时，打包脚本启动隐藏更新等待，最多等待两小时，文件释放后覆盖同名程序并更新根目录快捷方式；状态写入 .desktop-update-status.json，不强制结束用户程序。

## 2026-10-09 布局回归修复

界面画布容器必须沿 main-area → page-session → interface-workspace → graph-layout/full-map 的完整父子链传递可用高度，使用 flex:1 与 min-height:0，不能依靠普通块容器的百分比高度。集成验收应包含该外层，单独挂载 GraphPage 无法发现画布高度塌陷。

新增绑定选择器、父文件类型与新建界面窗口使用主题的 input/text/border/muted/accent 颜色，统一控件高度、焦点反馈和禁用状态。固定对象选择器按行排布，较窄空间允许自然换行；配置正文居中且独立滚动，标题保持在正文上方，滚动位置由 PageSession 保存。嵌入关系格式配置复用已有 graph-config-page 布局。

### 关系网投影性能（2026-10-09）

绑定扩展曾在每次视角变化重复投影全部对象，引用解析又在每个引用上遍历世界并调用内部查找实例的 classLink，造成嵌套扫描。引用索引按不可变 documents 快照缓存（WeakMap），文档编辑、改名或删除产生新快照时重新建立，布局变化复用。标题/头像/副标题/关系投影按 documents 与 bindings 缓存；分组成员一次归类，连线端点通过实例索引取位置。未变更的连线使用 React memo，保持悬停状态与动画。

拖动位置属于交互预览，组件本地实时更新，松开、取消或窗口失焦时提交最终位置，避免每个 pointermove 触发整份工作区保存、函数检查与菜单重绘。视角平移与缩放只更新页面状态。数据属性编辑仍走原实时保存路径。

内存浏览器场景包含100个实例、300条线，拖动一次只提交一次。单独引用查询基准（3万次）：旧查询744ms，索引查询4.01ms；该数据仅衡量查询，不能当作画布帧率。新增索引改名/删除失效验证，83项测试通过。
