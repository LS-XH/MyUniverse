import {memo} from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Render protocol text as display content without changing stored messages. */
export default memo(function ChatMarkdown({children,className=''}:{children:string;className?:string}) {
 return <div className={`chat-markdown ${className}`}><Markdown skipHtml remarkPlugins={[remarkGfm]} components={{
  pre:({children})=><pre className="ui-surface ui-value ui-value--chat-code ui-surface--bordered">{children}</pre>,
  table:({children})=><div className="chat-markdown-table" role="region" aria-label="Markdown 表格"><table>{children}</table></div>,
  a:({href,children,title})=><a href={href} title={title} target={href?.startsWith('#')?undefined:'_blank'} rel="noopener noreferrer">{children}</a>,
  img:({src,alt,title})=><img src={src} alt={alt||''} title={title} loading="lazy"/>,
 }}>{children}</Markdown></div>
})
