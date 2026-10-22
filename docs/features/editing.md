# 世界、类结构与实例编辑

界面位置、手势和外观见 [创作页面](../ui/pages.md)，类型和身份见 [世界对象](../data/world.md)。此文件维护对象操作后的实际数据变化。

## 世界与集合

createWorld 为每个世界生成独立成员和 Schema 身份，使用 people/relations/factions/places/events 等世界内类 ID。集合是 TreeNode 虚拟组织，类文档由 file 节点指向；创建界面只增加节点与视图定义，不改正文。

删除普通集合时子项提升到上级，删除普通类同时清理对应树节点及以它为父的视图；默认类受保护。导航移动保留内容与 ID，树限制同世界或同分类、禁止自身及后代循环。原磁盘导出不是实时对象，删除逻辑对象不保证清理所有旧导出文件。

## Schema 与成员同步

SchemaEditor 定义键类型、值类型、引用类、children、repeatable、placeholder 和 functionIds。实例字段以 schemaId 对应声明，结构修改通过 syncFields 适配实例；同一父对象排序同步声明和实例顺序，子项不跨父对象。成员内容不反推 Schema，Markdown 导入也不增改声明。

固定成员保留唯一项，可重复成员使用独立 FieldValue.id；改实例名保留字段对象。Text/Content 中的 # 补全插入世界实例链接，Class 控件按声明类选择。生成来源子树保持只读；解绑或函数失效的清理由 [Function](functions.md#显示来源和绑定生命周期) 负责。

## 查找与局部呈现

名称搜索与属性筛选叠加。属性选项按实际 Key/原始 Value 汇集，引用名称只用于显示；不选 value 表示所有值，空字符串单独匹配空值。“当前类实例”按名称匹配。匹配结果为成员 ID 集合，保留祖先、匹配项及子树；渲染过滤不裁剪源字段，编辑始终作用于原树。

隐藏生成值先排除来源子树再筛选；显隐、查询、展开均是页面会话状态，不改变正文。ReferencePicker 使用文档快照索引，搜索完整索引并分批显示，不将可见前 100 项作为全部数据。

## 复制、剪切、排序与批量修改

实例复制重建实例和所有递归成员 ID，保留 schemaId，并重映射 functionOrigin.bindingFieldId。副本按原顺序插入最后选中项之后，无选择时追加；剪贴板按类身份使用，同类标签可复制。删除实例清理其标签关联。

选中组按原顺序整体排序，一次释放形成一次操作。批量字段只接受各实例中恰好一个匹配成员的共同 Schema 路径；重复项歧义或生成来源跳过，混合值明确呈现，不按实例顺序猜目标。patchCommonFields 仅修改选中字段，隐藏及未选分支保留。

## 标签与历史

ClassDocument.labels 保存有序标签，entityLabels 为实例 ID → 单一标签 ID；删除标签解除关联。标签只影响卡片/引用颜色，保存在 JSON，不输出正文。关系格式颜色独立于实例标签色。

实例、关系图和工作流各有页面级撤销/重做。useEditHistory 默认保留 50 步，按 before/after 反向三方合并，尽量保留其他页面的无关改动；当前实现不会单独提示所有撤销合并冲突。页面导航前进/后退是另一份路由历史（最多 200 项），不复制对象或回滚外部副作用。重启后不恢复这些内存历史。

## 保存与函数执行

编辑后自动存档完整 JSON；发光圆点比较本会话初始或最近导出基线，不代表 JSON 未存档。导入、刷新与重新计算均为显式动作，详见 [保存与刷新](persistence.md)。跨实例任务逐项提交，取消保留已完成项；普通编辑不自动执行函数。

实现入口：[App.tsx](../../src/ui/App.tsx)、[SchemaEditor](../../src/ui/SchemaEditor.tsx)、[instanceEditing.ts](../../src/model/instanceEditing.ts)、[bulkEdit.ts](../../src/model/bulkEdit.ts)、[attributeFilter.ts](../../src/model/attributeFilter.ts)、[treeMoves.ts](../../src/model/treeMoves.ts)、[useEditHistory](../../src/ui/useEditHistory.ts)。
