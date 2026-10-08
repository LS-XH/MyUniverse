export type ValueType = 'Object' | 'Class' | 'Data' | 'Text' | 'Content' | 'Integer' | 'Decimal' | 'Null'
export type KeyType = 'Text' | 'Const' | 'Class'
export interface FieldSchema { id: string; keyType: KeyType; key: string; valueType: ValueType; classId?: string; placeholder?: string; children?: FieldSchema[]; repeatable?: boolean }
export interface FieldValue { id: string; schemaId: string; key: string; value: string; children: FieldValue[] }
export interface Entity { id: string; name: string; fields: FieldValue[] }
export interface ClassDocument { id: string; name: string; fileName: string; schema: FieldSchema[]; entities: Entity[]; protected?: boolean }
export type TreeNodeType = 'collection' | 'file' | 'view'
export interface TreeNode { id: string; name: string; type: TreeNodeType; parentId: string | null; classId?: string; viewType?: 'graph' | 'map' | 'chat'; protected?: boolean }
export interface GraphStyle { fill: string; stroke: string; glow: number; pattern?: string; lineType?: string; fontSize?: number; lineWidth?: number }
export interface GraphConfig { positions: Record<string, {x:number;y:number}>; lineStyles: Record<string, GraphStyle>; domainStyles: Record<string, GraphStyle>; showDomains: boolean }
export interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; createdAt: number }
export interface Conversation { id: string; title: string; messages: ChatMessage[]; createdAt: number }
export interface World { id: string; name: string; nodes: TreeNode[]; documents: ClassDocument[]; graph: GraphConfig; map: { image: string; legend: string }; chat: { agent: string; files: string[]; skills: string[]; conversations: Conversation[]; activeConversationId: string | null; modelId?: string | null } }
export interface ThemeColors { rail: string; sidebar: string; surface: string; canvas: string; panel: string; input: string; border: string; text: string; muted: string; accent: string; accentText: string; hover: string; active: string; navItem: string; button: string; buttonText: string; treeItem: string; treeSelected: string; graphNode: string; chatMessage: string; composer: string; mapPin: string; markdownHighlight: string }
export interface Theme { id: string; name: string; colors: ThemeColors; builtin?: boolean }
export interface ModelConnection { id: string; name: string; model: string; baseUrl: string; apiKey: string; enabled: boolean }
export interface Workspace { worlds: World[]; activeWorldId: string | null; themeId?: string; themes?: Theme[]; models?: ModelConnection[] }
export const uid = () => crypto.randomUUID()

