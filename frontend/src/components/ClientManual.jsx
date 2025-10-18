import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function ClientManual(){
  const [content, setContent] = React.useState('')
  React.useEffect(() => {
    fetch('/docs/CLIENTE_MANUAL.md').then(r=>r.text()).then(setContent).catch(()=>setContent('# Manual del Cliente\nNo se pudo cargar el documento.'))
  }, [])
  return (
    <div className="card p-3 shadow-sm markdown-body" style={{background:'rgba(255,255,255,0.95)'}}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
