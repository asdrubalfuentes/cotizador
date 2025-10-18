import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const files = [
  { id: 'README', label: 'README', path: '/docs/README.md' },
  { id: 'USAGE', label: 'USAGE', path: '/docs/USAGE.md' },
  { id: 'DEPLOYMENT', label: 'DEPLOYMENT', path: '/docs/DEPLOYMENT.md' },
  { id: 'SECURITY', label: 'SECURITY', path: '/docs/SECURITY.md' },
  { id: 'CHANGELOG', label: 'CHANGELOG', path: '/docs/CHANGELOG.md' },
]

export default function Docs(){
  const [active, setActive] = useState(files[0].id)
  const [content, setContent] = useState('')

  React.useEffect(() => {
    const f = files.find(x => x.id === active)
    if (!f) return
    fetch(f.path).then(r => r.text()).then(setContent).catch(()=>setContent('# Error\nNo se pudo cargar el documento.'))
  }, [active])

  return (
    <div className="row g-3">
      <div className="col-12 col-md-3">
        <div className="list-group shadow-sm">
          {files.map(f => (
            <button key={f.id} className={`list-group-item list-group-item-action ${active===f.id?'active':''}`} onClick={()=>setActive(f.id)}>{f.label}</button>
          ))}
        </div>
      </div>
      <div className="col-12 col-md-9">
        <div className="card p-3 shadow-sm markdown-body" style={{background:'rgba(255,255,255,0.95)'}}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
