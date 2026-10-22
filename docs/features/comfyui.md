# Stable Diffusion 与 ComfyUI

SDWorkflow 由连接与 WorkflowGraph 组成，结构见 [模型与插件数据](../data/integrations.md)，画布操作见 [工作流 UI](../ui/workflow-editor.md)。

## 连接与执行环境

每个 SDWorkflow 保存 ComfyUI URL、可选密钥、超时和图。默认 localhost:8188；用户需运行外部 Python/GPU 服务，主程序不内置 GPU 执行环境。

### 节点目录与前处理

从 /object_info 读取服务实际安装的官方/自定义节点，按 category 建树。输入必选/可选、枚举、数字默认值及原生输出由目录定义；可生成基础文生图模板，用户选择 checkpoint。

本地主程序节点（输入、常量、世界、算术、拼接、Function、严格变量/成员）先求值为字面值，写入 Comfy 原生输入；原生节点间保持 [节点 ID,输出索引]。主程序不把自己的节点伪装为服务 class_type。模型和 Tool 编排应在 Agent 完成，不将它们任意塞进 SD 图。

### 导入、执行与取图

支持 MyUniverse 图导入/导出及 ComfyUI **API 格式 JSON**，API 导入先加载节点目录，缺节点报错。普通 ComfyUI 含 nodes 的前端布局 JSON 和嵌入官方前端尚未实现。API 导出先求值前处理。

提交 /prompt，轮询 /history/{id}，通过 /view 展示图片，需 SaveImage 等产生图片结果。服务错误、缺必填、超时、完成却无图明确反馈。停止等待不调用全局 interrupt，以免影响同服务其他任务；已提交任务可能继续执行。

WebSocket 执行事件按 prompt_id 过滤，桌面通过 Tauri 事件桥并支持 Bearer。服务不公开全部 Tensor 值时仅展示服务端类型，事件失败提示并继续 HTTP 查询。宿主值正常观察，详见 [工作流编辑器](../ui/workflow-editor.md#执行观察)。

## 图片值与文件

工作流返回 ImageResult 数组，Image.fromSD 选取其中一项，Image.display 透传图片值供运行面板从轨迹渲染，本身不另发显示事件。Image.save 读取图片为 data URL，桌面通过桥保存到 user/images，浏览器触发下载。文件名必须是单个合法组件，桌面已存在文件拒绝覆盖；这与 ComfyUI 服务端 SaveImage 输出是两个位置。Image 类型不提供像素编辑。接口见 [ComfyUI API](api.md#comfyui-接口)，源码入口为 [workflows.ts](../../src/services/workflows.ts)、[workflowImages.ts](../../src/services/workflowImages.ts) 和 [workflow_ws.rs](../../src-tauri/src/workflow_ws.rs)。
