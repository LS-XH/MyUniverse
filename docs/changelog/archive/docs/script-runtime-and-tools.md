# 主程序脚本接口与 Tool

更新日期：2026-10-10。

## 设计意图

世界对象、Markdown 转换和磁盘同步应只有一套实现。JavaScript Function 与 Tool 在主程序的 WebView/浏览器环境中执行，通过共同接口访问 React 所维护的世界；不再逐次生成整个世界的 Markdown 快照、传入 Node 或 Worker，再重复实现读取逻辑。

Function 服务于对象属性：入口固定为 `transform(self, input)`，输入封装为项目类型，返回值必须满足设置中的 TypedValue 返回规范，随后显示为只读派生成员。Tool 服务于模型：入口为 `execute(params)`，参数由 JSON Schema 自由描述，返回普通 JSON 可传输值或字符串，不要求项目 TypedValue，也不套用 Function 的返回类型和 1 MB 限制。

## 共用对象与保存接口

`src/model/hostWorldApi.ts` 按稳定 ID 创建轻量对象门面，读取时才解析对应对象和 Markdown，复用 `model/markdown.ts`。没有向脚本暴露可随意修改的 React 原始对象引用。

| 对象 | 接口 |
| --- | --- |
| world / app.world | id、name、classes()、get_class(ID或名称) |
| Class | schema()、markdown()、instances()、get_instance()、set_markdown(text)、delete() |
| 实例 | markdown()、members()、get_member()、to_value()、delete() |
| 属性成员 | value()、to_value()、markdown()、members()、get_member()、set_value(value) |

名称重复时请使用 ID。set_value 支持原始文本、数字和 null；Object 结构通过类文档 set_markdown 修改。写入复用现有 Markdown 解析校验及身份恢复规则，删除类同步清理关联节点与视图，受保护的默认类禁止删除。

```js
async function execute({text}) {
  const item = world.get_class("类ID").get_instance("实例ID");
  item.get_member("属性ID").set_value(text);
  return {name: item.name, text: item.get_member("属性ID").value()};
}
```

```js
function transform(self, input) {
  return values.content(self.markdown());
}
```

`services/scriptHost.ts` 将主程序 get/update/save 包装为一次执行会话。接口修改暂存在该会话的不可变世界草稿中，执行成功并通过返回值校验后，以现有 mergeThreeWay 合并运行期间的主程序编辑；冲突时拒绝提交。自动 Function 的世界修改与派生结果在同一次状态更新提交，并使用修改后的源修订，避免仅因自身写入反复运行。

随后调用原有 `saveWorkspace()`，继续使用存储队列、内外部三方合并及 Rust 写前检查；不增加另一套磁盘读写实现。`await app.storage.save()` 是本次成功提交后的保存请求，不会在脚本中途持久化草稿。脚本异常、类型/Schema 错误、取消或合并冲突丢弃草稿；若内存已经提交而磁盘保存失败，保留本地修改并显示原有同步错误，不宣称磁盘成功，也不会回滚其他用户编辑。

## 运行边界与兼容

JS 与 Flow 复用主程序执行服务及有限编译缓存，桌面 JS 不再需要 Node，不提供旧 CommonJS require 环境。它们是用户信任的主程序代码，不是权限沙箱。异步等待最多 5 秒，停止等待后会话接口失效；主线程同步死循环不能靠计时器强行终止。脚本自行使用全局对象、fetch 等造成的外部效果不在草稿回滚范围内。

Python 继续使用桌面 Python 3 子进程，保留硬超时及类型契约。它接收只读数据快照，并返回 set_value / set_markdown / delete 操作日志，主程序通过同一门面校验并提交，不在 Python 重新实现 Markdown 或磁盘保存。Python 执行期间的结构/Markdown 读取仍是快照；日志修改后的完整结构须在下次执行读取。Function 的脚本文件及旧字符串接口保持兼容，但依赖 require 的旧 JS 需要改写为浏览器接口。

## Tool 配置和模型桥梁

工具页提供 JS/HTTP、调用名称、description、inputSchema、annotations、启停、代码与世界参数测试。Schema 根类型为 object，参数属性及 required 可自由编写；使用 Ajv 的 JSON Schema 2020-12 校验，不加载外部引用。annotations 提供 title、readOnlyHint、destructiveHint、idempotentHint、openWorldHint；只读声明同时限制共用世界接口写入，其余属性供模型理解，不代表独立权限沙箱。

工具代码、Schema 和配置保存于 workspace.json；Function 的 js/py/flow 文件路径不变。已有 HTTP Tool 默认继续使用 HTTP，保留 URL、密钥、请求体及工作流调用；未声明 Schema 的旧 HTTP Tool 保留旧参数兼容性。

模型配置通过 toolIds 明确选择启用的注册 Tool。聊天及工作流 LLM 调用发送标准工具描述，解析模型的 arguments JSON，验证 Schema，串行执行 Tool，再通过原 tool_call_id 回传结果并继续请求，最多 16 轮。工具错误作为对应工具结果交给模型，取消请求则终止等待。工作流 Messages 输出保留本次完整 assistant/tool 交流，聊天界面显示最终回复。没有配置注册工具时保留原有单次请求及显式工具编排。

`toolSpec` 与 `mcpToolResult` 提供 MCP 风格描述及 text/structuredContent 结果，模型适配器将其转换为 Chat Completions 的标准 function 工具格式；annotations 说明进入描述，不发送服务不识别的额外字段。这是注册工具与模型之间的调用桥梁，目前没有对外 MCP 服务器、MCP 网络传输或远程服务器连接。

协议参考：[MCP schema](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-06-18/schema.mdx)、[Tool annotations](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/)、[模型工具调用](https://developers.openai.com/api/docs/guides/function-calling)。

## 验证范围

自动测试覆盖共用对象读取与懒转换、写入/删除、Schema/类型失败回滚、并发合并与冲突、取消后接口失效、自动 Function 原子提交、模型工具参数与调用 ID 配对，以及 Python 操作日志。独立内存页面验证真实工具编辑器修改世界和统一保存，不写入用户项目。模型桥梁使用模拟响应验收；真实供应商调用需要实际服务支持工具协议。

本次验收：95 项前端测试和 16 项 Rust release 测试通过；前端生产构建、桌面构建通过，同名 `src-tauri/target/release/my-universe.exe` 和项目根目录快捷方式已更新。页面测试确认 Tool 修改属性并调用保存一次、错误参数不修改对象、模型可勾选 Tool，以及 Function 读取同一修改后的属性并返回 Text 类型。


## Tool 编辑布局修正（2026-10-10）

Tool 编辑页与 Function 共享紧凑工具栏、全高代码编辑器和对象调用助手。顶部“配置”打开右侧悬浮面板，容纳名称、执行方式、Schema、description、全部 MCP annotations、世界上下文及删除操作；“测试”打开独立测试面板，两面板互斥且默认关闭，不挤压源码区域。补齐 annotations、上下文选择和测试控件的主题样式。工具集合改用卡片导航，HTTP Tool 的请求配置也在同一配置面板内。


## 官方只读 Tool 与聊天修改建议（2026-10-10）

新增八个由程序维护的官方模板；统一注册、固定 ID、只读配置及专门处理器，为后续程序适配提供入口。第八项按用户确认接收类名、实例名和修改后 Markdown，仅触发建议事件，在聊天中比较并由用户选择保存或拒绝；保存前检查过期变化，复用 Markdown 与统一存储。完整参数、边界与实现见 [官方 Tool](official-tools.md)。
