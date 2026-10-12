/** Only workflow definitions/variable memory use this migration, never world content. */
export function migrateWorkflowTypes<T>(value:T):T {
 if(Array.isArray(value))return value.map(migrateWorkflowTypes) as T
 if(value&&typeof value==='object'){
  const next:any=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,(key==='type'||key==='variableType')&&item==='Tool'?'Tools':key==='type'&&item==='TOOL'?'TOOLS':migrateWorkflowTypes(item)]))
  if(['llmBasic','llm','toolCalls'].includes(next.kind)&&Array.isArray(next.inputs)&&!next.inputs.some((p:any)=>p.name==='agents'))next.inputs.push({name:'agents',type:'AGENTS'})
  // Old automatic pairing must not overwrite a context with a response fragment.
  const separate=next.kind==='llmBasic'||next.kind==='toolCalls'||next.kind==='valueMethod'&&(['Tools','Agents'].includes(next.settings?.variableType)&&next.settings.member==='get'||next.settings?.variableType==='Image'&&['fromUrl','fromSD'].includes(next.settings.member))
  if(separate&&next.bindings)for(const [key,binding] of Object.entries<any>(next.bindings))if(key.startsWith('in:')&&binding.output){const {output,...inputOnly}=binding;next.bindings[key]=inputOnly}
  if(Array.isArray(next.inputs)&&next.settings)for(const port of next.inputs.filter((p:any)=>['TOOLS','AGENTS'].includes(p.type))){const key=`port:${port.name}`;if(typeof next.settings[key]==='string')try{next.settings[key]=JSON.stringify(migrateWorkflowTypes(JSON.parse(next.settings[key])))}catch{/* Invalid literal remains visible for normal runtime diagnostics. */}}
  return next as T
 }
 return value
}
