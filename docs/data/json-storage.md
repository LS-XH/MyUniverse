# JSON 存储结构

类型定义见 [types.ts](../../src/model/types.ts)，导出见 [exportFiles](../../src/model/markdown.ts)，磁盘桥见 [lib.rs](../../src-tauri/src/lib.rs)。

属性配置是自动 JSON 持久化的独立范围：目标 Schema 和标签定义保存时保留旧实例正文快照，不把当前实例草稿间接写入磁盘。正文保存及刷新规则见 [持久化](../features/persistence.md#属性配置独立持久化)。

## 存储职责与文件布局

世界实例内容可由 Markdown 恢复，不把 workspace.json 当唯一内容来源。JSON 管理结构、身份、组织和应用配置，Markdown 管理可读内容；读取与写入复用同一模型。

```text
user/
  workspace.json
  functions/<function-id>.js | .py | .flow
  images/<filename>
  worlds/<world-id>/
    <class-file>.md
    <class-file>.schema.json
    <view-id>.view.json
    world-index.json
    人物关系网.json / 地图配置.json / 聊天框配置.json（兼容及聊天配置）
```

桌面 release 基准为 exe 同路径 user；debug 为运行工作目录下 user；世界目录按 worldId 隔离，类/视图文件平铺，集合和插件文件夹不产生物理层级。world-index 是世界组织清单。浏览器使用 localStorage 的 myuniverse-workspace-v1，不读写这些桌面文件。

Function 脚本文件由统一桌面保存导出，路径不因逻辑文件夹或改名改变。模型、SD、Agent、用户 Tool、主题和插件组织存 workspace.json；官方 Tool 由程序注册，不序列化为用户定义。

## 各文件的职责

| 文件 | 保存对象 | 加载角色 |
| --- | --- | --- |
| workspace.json | 完整 Workspace，包括组织、身份、Schema/实例快照、主题、模型、Agent、Tool、标签和函数元数据 | 注册目录及身份/配置来源；实例内容随后由已注册 Markdown 覆盖 |
| `<类>.schema.json` | FieldSchema[] | 启动/刷新读取时作为属性声明，不从正文反推 |
| `<视图ID>.view.json` | 完整 InterfaceView | 启动/刷新读取对应注册视图的配置 |
| world-index.json | version/id/name/nodes、文档及视图身份清单 | 保存的单世界组织导出；当前 load_workspace 不独立用它发现或恢复项目 |
| 聊天框配置.json | World.chat | 世界导出/聊天保存输出；当前运行时聊天从 workspace.json 恢复，不独立热读此文件 |
| 人物关系网.json / 地图配置.json | World.graph / World.map | 兼容导出；现行独立视图由 view JSON 管理 |
| functions/ID.js、.py、.flow | Function 源码或 FlowGraph | 桌面加载用已有脚本覆盖 Workspace 中 code/flow |

workspace.json 当前确实包含实例副本，不能写成“JSON 完全没有内容”。权威方向是读取阶段由 Markdown 恢复内容，编辑阶段操作内存 Workspace，保存阶段从当前提交快照导出 JSON 和正文。旧未引用世界文件不会被目录扫描自动导入，删除类/视图后也未统一清理旧文件。

## 最小对象示例

以下是世界中单个类的结构示例，实际 Workspace 外层及默认世界还包含其他配置。ID 仅为演示。

```json
{
  "id": "notes",
  "name": "笔记",
  "fileName": "笔记.md",
  "schema": [{"id":"s-content","keyType":"Const","key":"正文","valueType":"Content"}],
  "entities": [{
    "id": "e-note", "name": "开场",
    "fields": [{"id":"f-content","schemaId":"s-content","key":"正文","value":"第一幕。","children":[]}]
  }],
  "labels": [{"id":"label-draft","name":"草稿","color":"#8059c48d"}],
  "entityLabels": {"e-note":"label-draft"}
}
```

Object 成员的 value 为空文本，实际子结构保存为 children；重复成员共享 schemaId，使用各自 id。functionOrigin/functionRuns 仅作为内部 JSON 元数据；标签也不写入正文。Markdown 对应示例和来源注释见 [Markdown 格式](markdown.md)。

## 非持久状态与敏感配置

选择、视角、个人网络布局、撤销历史和无效源码草稿属于页面会话；运行变量暂存和观察值属于执行上下文。成功 Agent memory 可保存，执行观察不写进图定义。模型密钥当前在本地 JSON 中保存，隐藏输入框不代表加密。浏览器 localStorage 保存整个 Workspace，不建立桌面分文件布局。

## 读写与版本

显式读取、提交范围、快照基线及单文件原子写入见 [保存与刷新](../features/persistence.md)。不得把导出文件的存在描述为自动热加载能力。
