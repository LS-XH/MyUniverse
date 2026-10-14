# JSON 存储结构

类型定义见 [types.ts](../../src/model/types.ts)，导出见 [exportFiles](../../src/model/markdown.ts)，磁盘桥见 [lib.rs](../../src-tauri/src/lib.rs)。

所有对象交互自动存档至 workspace.json；Markdown 仅显式导入/导出。操作、进度与取消见 [JSON 存档与导入导出](../features/persistence.md)。

## 存储职责与文件布局

```text
user/
  workspace.json                         # 唯一权威存档，archiveVersion=2
  workspace.before-json-primary.json     # 旧存档首次升级时的一次性备份
  functions/<id>.js | .py | .flow          # 显式导出的函数源码
  images/<filename>                      # 图片输出
  worlds/<world-id>/
    <class-file>.md                      # 类内容导出/导入
    <class-file>.schema.json              # 结构导出
    <view-id>.view.json                   # 视图导出/显式导入
    world-index.json                     # 组织导出清单
    聊天框配置.json                       # 聊天导出
```

桌面 release 使用 exe 同路径 user，debug 使用工作目录 user；浏览器使用 localStorage 的 myuniverse-workspace-v1。世界目录按 ID 隔离，集合为逻辑层级，不移动磁盘文件。

workspace.json 保存完整 Workspace：类结构、实例内容、递归字段 ID、functionOrigin/functionRuns、标签、视图布局、聊天协议、Agent 记忆及模型/工具/函数/主题配置。启动只加载此存档并规范化，不读取 Markdown、Schema、视图或外部函数脚本来替换它。schema.json 不自动加载；正文导入使用存档声明。

JSON 自动保存使用完整当前状态；Markdown 导出使用明确的目标投影，两者的命令与提交队列分离，不让单文件导出投影覆盖完整存档。archiveVersion 为版本标志，历史缺失时兼容；首次升级前在桌面保留原 JSON 备份。

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

Object 成员的 value 为空文本，实际子结构保存为 children；重复成员共享 schemaId，使用各自 id。functionOrigin/functionRuns 仅作为内部 JSON 元数据；标签也不写入正文。Markdown 展示示例和按配置填入规则见 [Markdown 格式](markdown.md)。

## 非持久状态与敏感配置

选择、视角、个人网络布局、撤销历史和无效源码草稿属于页面会话；运行变量暂存和观察值属于执行上下文。成功 Agent memory 可保存，执行观察不写进图定义。模型密钥当前在本地 JSON 中保存，隐藏输入框不代表加密。浏览器 localStorage 保存整个 Workspace，不建立桌面分文件布局。

## 读写与版本

JSON 自动存档、导入导出范围、快照基线及单文件原子写入见 [保存与刷新](../features/persistence.md)。不得把导出文件的存在描述为自动热加载能力。
