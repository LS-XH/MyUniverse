import type {WorkflowNode,WorkflowKind,FlowNodeType} from './types'

const descriptions:Record<WorkflowKind,string>={
 loop:'从 initial 开始，每轮计算 next 与 continue；至少运行一次，结束后从 result 输出。',condition:'只计算 Boolean 条件选中的真/假分支，输出选中的值。',agent:'调用一个 Agents 对象，传入 JSON 参数文本并返回结果文本。',
 input:'输出本次运行的输入文字。',return:'返回 value；after 仅用于等待保存或其他前置操作完成。',
 constant:'输出配置的固定文字或 JSON 值。',world:'读取所选世界对象，以配置的 Markdown、原始值或类型对象输出。',
 add:'输出 a + b，不修改输入。',subtract:'输出 a − b，不修改输入。',multiply:'输出 a × b，不修改输入。',divide:'输出 a ÷ b；除数为零时失败。',concat:'使用配置的分隔文字连接 a 与 b，输出新文本。',
 function:'调用所选 Function，按其固定数据契约传入并返回结果。',
 llmBasic:'输入完整 Messages 上下文和可选 Tools、Agents；仅输出本次 assistant 响应，不追加历史、不执行调用。请显式合并响应。',
 toolCalls:'从 Messages 查找未返回的请求，使用接入的 Tools、Agents 执行；仅输出 role=tool 结果片段，请显式合并到上下文。',
 llm:'兼容自动工具调用：输入提示词、上下文及 Tools，自动执行工具轮次，输出回答文本与交流 Messages。',
 sd:'把提示词传给所选绘画工作流，返回生成的图片结果。',tool:'使用 Tools 中的工具或所选注册工具，输入参数 JSON 文本，返回结果文本。',
 getVariable:'兼容旧变量读取节点；after 控制读取顺序，输出保存值。建议改用严格类型变量。',
 setVariable:'兼容旧变量写入节点；保存输入 value 后输出该值。建议改用严格类型变量。',
 context:'兼容上下文节点：裁剪历史并添加本次用户提示词，输出新的上下文。',appendContext:'兼容上下文节点：合并历史、用户输入和助手回复，输出新上下文。',
 comfy:'将输入传给对应 ComfyUI 节点，由服务器执行并输出对应端口结果。',
 variable:'未接入 value 时读取绑定变量；接入 value 时保存并输出。after 控制顺序，同名声明类型必须一致。',
 valueMethod:'根据 self 和参数产生结果；只有显式输出绑定或写入变量才保存。',valueProperty:'读取 self 的属性并输出属性值，不修改或保存 self。',
}
const members:Record<string,string>={
 'Agents:get':'根据注册项获取新的 Agents 集合，不沿用或修改 self；需要保留已有 Agent 时请使用合并 Agent。',
 'Agents:merge':'将 self 与 arg 的 Agent 合并去重，输出新的 Agents。',
 'Agents:execute':'调用 self 中唯一的 Agent，arg 为参数 JSON，输出返回结果文本，不改变 Agents。',
 'Tools:get':'根据注册项获取新的 Tools 集合，不沿用或修改 self；需要保留已有工具时请使用合并 Tool。',
 'Tools:merge':'将 self 与 arg 的工具合并并去重，输出新的 Tools。',
 'Tools:execute':'使用 self 中的工具执行 arg 参数 JSON，输出结果文本，不改变 Tools。',
 'Image:fromUrl':'根据 arg 地址创建新的 Image；输入 self 不参与创建，不自动替换原图片。',
 'Image:fromSD':'从 arg 绘画结果按配置索引创建 Image；输入 self 不参与创建。',
 'Image:save':'将 self 图片保存为 arg 指定文件名，输出同一图片值。',
 'Image:display':'显示 self 图片并输出同一图片值。',
 'Messages:merge':'将 arg 消息追加到 self，输出完整的新上下文，校验工具请求与返回配对。',
 'Messages:trim':'保留最近 arg 个用户轮次及系统词，不拆分工具请求和返回。',
 'Messages:clear':'输出空 Messages 上下文；显式写回变量后才清除保存值。',
 'Messages:toolCall':'将 arg 的工具请求 JSON 添加为 assistant 消息；此卡片不执行工具。',
 'Messages:toolResult':'添加 role=tool 消息；callId 必须匹配上下文中尚未返回的请求。',
}
export function workflowNodeDescription(node:WorkflowNode):string {
 const key=`${node.settings.variableType}:${node.settings.member}`
 if(node.kind==='valueMethod')return `${members[key]||'根据 self 和参数生成新的值，输入与结果具有同一主体语义。'} 仅显式写回或输出引用才保存变量。`
 return descriptions[node.kind]
}
export const flowDescriptions:Record<FlowNodeType,string>={input:'读取 Function 的固定 input；类型接口还可在代码中访问 self 和 values。',return:'返回 value，运行结果按 Function 的数据类型契约封装。',constant:'输出配置的固定文字。',add:'将 a 与 b 转为有效数字并相加。',subtract:'将 a 与 b 转为有效数字并相减。',multiply:'将 a 与 b 转为有效数字并相乘。',divide:'将 a 与 b 转为有效数字并相除，拒绝零除数。',code:'使用 inputs 和 world 执行代码，必须显式返回结果。',entityMarkdown:'读取所选实例的完整 Markdown。',memberMarkdown:'读取所选成员的 Markdown 或原始值。'}
