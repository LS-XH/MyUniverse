# 视图配置与对象绑定

声明入口为 [types.ts](../../src/model/types.ts)，解析入口为 [interfaceViews.ts](../../src/model/interfaceViews.ts)。人物关系网与地图的操作见 [视图功能](../features/interface-views.md)。

## 视图定义

界面操作类型投影已有世界对象，不拥有第二份实例内容。地图创建时选择父文件类型 parentClassId，并通过 bindings 映射显示元素。人物关系网只对应内置人物类 people，创建及配置不提供父文件类型或显示元素绑定；程序按当前人物 Schema 生成内部路径。

逻辑树 parentId 与数据父类 parentClassId 分开：数据视图节点的 parentId 指向对应源类的文件节点 ID；配置是同级虚拟导航入口，使用该视图 ID 加 config 状态，不另建内容节点。同一父类可有多个独立视图，布局和配置各自保存，源对象共享。地图可投影任意父类；人物关系网使用人物、关系和势力的定制结构。

```ts
interface InterfaceView {
  version: 1; id: string; name: string;
  kind: 'graph' | 'relationGraph' | 'map'; parentClassId: string; fileName: string;
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

## 关系样式可见性

`GraphStyle.visible?: boolean` 在关系连线格式中控制关系类型是否参与显示，未设置视为 true。该状态保存在视图 JSON 的 `graph.lineStyles`，不会改变人物 Markdown 或结构类型。人物关系的每个可见重复值独立生成连线，各自引用用于样式选择；详细投影契约见 [个人关系网与格式可见性](../features/interface-views.md#人物个人关系网与格式可见性)。个人网络布局与返回快照保存在页面会话中，不写入全图 `graph.positions`。

## 布局与样式对象

`GraphConfig` 保存 positions、lineStyles、domainStyles、showDomains、showLabels、showFunctionRelations；位置以人物实例 ID 为键，样式以关系/势力实例 ID 为键。`GraphStyle` 保存 visible、fill、stroke、glow、pattern、lineType、fontSize、lineWidth、borderWidth；旧 labelSource 仅为兼容字段，当前关系文字由关系成员决定。地图保存 image、legend 与实例 ID 对应的 positions。个人关系网的临时布局和返回快照属于页面会话，不写入全图位置。

## 文件对应

创建视图只增加 World.nodes 与 World.views，不改 ClassDocument 的 Schema、实例或 Markdown。在视图配置页保存当前文件导出 world-index.json 和视图 JSON；关系网操作画布的当前文件指向源类正文；树结构也随工作区 JSON 保存。规范化旧项目时将视图移到源文件下，保留 ID、文件名、布局和格式。地图变更父类时同步变更树中的源文件归属；拖动只允许视图在同一源文件下排序。

`World.views[view.id]` 与同 ID 的 TreeNode 对应，每份配置输出到 `<view-id>.view.json`。组织目录不改变文件物理位置；旧 World.graph/map 为兼容数据。详见 [JSON 文件职责](json-storage.md)。

## 关系类型网结构

`kind='relationGraph'`、`parentClassId='relations'`；`graphView` 分派至 `relationGraphView`，按当前 Schema 构造 title/name、subtitle/关系描述、edges/关系推理重复项、target/Value 与 edgeLabel/Key 路径。位置以关系实例 ID 为键，连线样式仍以 Key 引用的关系实例 ID 为键；实例正文不复制到视图 JSON。

`importPersonGraphConfig` 创建独立样式副本，保留目标布局和身份；详见 [导入规则](../features/interface-views.md#从人物关系网配置导入)。`World.relationGraphInstalled` 记录已完成默认界面安装，防止用户删除后重复补入。人物关系网仍使用 `kind='graph'`，保留旧 ID、文件名和序列化兼容性。

人物连线的运行时投影包含 id（外层成员 ID 与关系值 ID 的组合）、sourceClassId、field（完整外层成员）、relationField（选中原值）、readOnly、relationName 和 relationRaw。这些投影不写入视图 JSON；选择、曲线路由和局部编辑使用独立连线 ID，源结构与 Markdown 格式保持不变。
