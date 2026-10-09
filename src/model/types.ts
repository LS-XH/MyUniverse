export type ValueType = 'Object' | 'Class' | 'Data' | 'Text' | 'Content' | 'Integer' | 'Decimal' | 'Null'
export type KeyType = 'Text' | 'Const' | 'Class'
export interface FieldSchema { id: string; keyType: KeyType; key: string; valueType: ValueType; classId?: string; placeholder?: string; children?: FieldSchema[]; repeatable?: boolean; functionIds?: string[] }
export type FunctionLanguage = 'js' | 'py' | 'flow'
export type FlowNodeType = 'input' | 'return' | 'add' | 'subtract' | 'multiply' | 'divide' | 'constant' | 'code' | 'entityMarkdown' | 'memberMarkdown'
export interface ObjectSelection { classId:string; entityId:string; path:string[] }
export interface FlowNode { id:string; type:FlowNodeType; x:number; y:number; values:Record<string,string>; ports?:string[]; code?:string; object?:ObjectSelection }
export interface FlowEdge { id:string; from:string; to:string; port:string }
export interface FlowGraph { version:1; nodes:FlowNode[]; edges:FlowEdge[] }
export interface FunctionType { type:ValueType; classId?:string }
export interface TypedValue { type:ValueType; value?:string|number|null; classId?:string; entityId?:string; members?:TypedMember[] }
export interface TypedMember { id?:string; schemaId?:string; key:string; value:TypedValue }
export interface FunctionContext { self:{classId:string;entityId:string}; input:TypedValue }
export interface FunctionScript { id: string; name: string; language: FunctionLanguage; code: string; folderId?: string | null; flow?:FlowGraph; apiVersion?:2; returnType?:FunctionType }
export type PluginSection = 'skills' | 'functions' | 'tools'
export interface PluginFolder { id:string; name:string; section:PluginSection; parentId:string|null }
export interface FunctionResult { functionId: string; name: string; fileName: string; input: string; value: string; source?: string; error?: string; typedValue?:TypedValue; contextKey?:string }
export interface FieldValue { id: string; schemaId: string; key: string; value: string; children: FieldValue[]; functionResults?: FunctionResult[] }
export interface Entity { id: string; name: string; fields: FieldValue[] }
export interface ClassDocument { id: string; name: string; fileName: string; schema: FieldSchema[]; entities: Entity[]; protected?: boolean }
export type TreeNodeType = 'collection' | 'file' | 'view'
export interface TreeNode { id: string; name: string; type: TreeNodeType; parentId: string | null; classId?: string; viewType?: 'graph' | 'map' | 'chat'; protected?: boolean }
export interface GraphStyle { fill: string; stroke: string; glow: number; pattern?: string; lineType?: string; fontSize?: number; lineWidth?: number; borderWidth?: number; labelSource?: string }
export interface GraphConfig { positions: Record<string, {x:number;y:number}>; lineStyles: Record<string, GraphStyle>; domainStyles: Record<string, GraphStyle>; showDomains: boolean; showLabels?: boolean }
export interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; createdAt: number }
export interface Conversation { id: string; title: string; messages: ChatMessage[]; createdAt: number }
export type InterfaceKind = 'graph' | 'map'
/** Current bindings use schema IDs; fixed bindings use concrete field IDs. */
export interface ViewBinding { scope: 'current' | 'fixed'; source: 'name' | 'instance' | 'member'; mode: 'markdown' | 'content'; path: string[]; classId?: string; entityId?: string; part?: 'key' | 'value' }
export interface InterfaceView { version:1; id:string; name:string; kind:InterfaceKind; parentClassId:string; fileName:string; bindings:Record<string,ViewBinding>; graph:GraphConfig; map:{image:string;legend:string;positions:Record<string,{x:number;y:number}>} }
export interface World { id: string; name: string; nodes: TreeNode[]; documents: ClassDocument[]; views?: Record<string,InterfaceView>; graph: GraphConfig; map: { image: string; legend: string }; chat: { agent: string; files: string[]; skills: string[]; conversations: Conversation[]; activeConversationId: string | null; modelId?: string | null } }
export interface ThemeColors { rail: string; sidebar: string; surface: string; canvas: string; panel: string; input: string; border: string; text: string; muted: string; accent: string; accentText: string; hover: string; active: string; navItem: string; button: string; buttonText: string; treeItem: string; treeSelected: string; graphNode: string; chatMessage: string; composer: string; mapPin: string; markdownHighlight: string }
export interface Theme { id: string; name: string; colors: ThemeColors; builtin?: boolean }
export interface ModelConnection { id: string; name: string; model: string; baseUrl: string; apiKey: string; enabled: boolean; modelsUrl?:string; chatUrl?:string; reasoningEffort?:string; temperature?:number; topP?:number; maxTokens?:number; timeoutSeconds?:number; extraBody?:string }
export type ModelSection='llm'|'sd'|'agents'
export type WorkflowKind='input'|'return'|'constant'|'world'|'add'|'subtract'|'multiply'|'divide'|'concat'|'function'|'llm'|'sd'|'tool'|'getVariable'|'setVariable'|'context'|'appendContext'|'comfy'|'variable'|'valueMethod'|'valueProperty'
export interface WorkflowPort {name:string;type:string;options?:unknown[];default?:unknown;required?:boolean}
export interface WorkflowNode {id:string;kind:WorkflowKind;title:string;x:number;y:number;settings:Record<string,string>;inputs:WorkflowPort[];outputs:WorkflowPort[];object?:ObjectSelection;classType?:string;category?:string}
export interface WorkflowLink {id:string;from:string;output:string;to:string;input:string}
export interface WorkflowGraph {version:1;nodes:WorkflowNode[];links:WorkflowLink[]}
export interface SDWorkflow {id:string;name:string;baseUrl:string;apiKey?:string;graph:WorkflowGraph;timeoutSeconds?:number;variables?:Record<string,unknown>}
export interface AgentDefinition {id:string;name:string;graph:WorkflowGraph;variables:Record<string,unknown>;memory?:Record<string,Record<string,unknown>>}
export interface ToolDefinition {id:string;name:string;url:string;method:'GET'|'POST';apiKey:string;bodyMode:'input'|'raw';enabled:boolean;folderId?:string|null}
export interface Workspace { worlds: World[]; activeWorldId: string | null; themeId?: string; themes?: Theme[]; models?: ModelConnection[]; sdWorkflows?:SDWorkflow[]; agents?:AgentDefinition[]; tools?:ToolDefinition[]; functions?: FunctionScript[]; pluginFolders?: PluginFolder[] }
export const uid = () => crypto.randomUUID()

