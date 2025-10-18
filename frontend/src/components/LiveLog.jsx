import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { apiUrl, wsUrl } from '../utils/config'
import { connectWS } from '../utils/ws'
import { useAuth } from './AuthProvider'

export default function LiveLog(){
  const [events, setEvents] = useState([])
  const [files, setFiles] = useState([])
  const [status, setStatus] = useState('connecting')
  // niveles habilitados (toggles)
  const [enabledLevels, setEnabledLevels] = useState({ info: true, warn: true, error: true })
  const [filterType, setFilterType] = useState('all')
  const [onlyHttp, setOnlyHttp] = useState(false)
  const [enabledMethods, setEnabledMethods] = useState({ GET:true, POST:true, PUT:true, PATCH:true, DELETE:true })
  const [enabledStatus, setEnabledStatus] = useState({ '2xx': true, '3xx': true, '4xx': true, '5xx': true })
  const boxRef = useRef(null)
  const { user, token, hydrated } = useAuth() || {}
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const q = () => setIsMobile(typeof window !== 'undefined' ? window.matchMedia('(max-width: 576px)').matches : false)
    q()
    window.addEventListener('resize', q)
    return () => window.removeEventListener('resize', q)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!token || !(user && user.role === 'admin')) return
    let closed = false
    let closer = null
    function connect(){
      const url = wsUrl('/ws')
      closer = connectWS(url, {
        token,
        onOpen: () => setStatus('open'),
        onClose: () => { setStatus('closed'); if(!closed) setTimeout(connect, 3000) },
        onError: () => setStatus('error'),
        onMessage: (evt) => {
          setEvents(prev => {
            const next = [...prev, evt]
            return next.slice(-50) // limitar memoria a últimos 50
          })
          // scroll al fondo
          try { const el = boxRef.current; if (el) el.scrollTop = el.scrollHeight } catch (e) { /* noop */ }
        }
      })
    }
    connect()
    return () => { closed = true; closer && closer.close() }
  }, [hydrated, token, user])

  useEffect(() => {
    if (!hydrated) return
    if (!token || !(user && user.role === 'admin')) return
    refreshFiles()
    // bootstrap inicial desde el log más reciente (persistencia en recarga)
    ;(async () => {
      try {
        const ff = await axios.get(apiUrl('/api/admin/livelog/files'), { headers: { Authorization: `Bearer ${token}` } })
        const first = (ff.data.files || [])[0]
        const day = (first && (first.match(/livelog-(\d{8})/)||[])[1]) || null
        if (day) {
          const res = await axios.get(apiUrl(`/api/admin/livelog/file/${day}`), { headers: { Authorization: `Bearer ${token}` }, responseType: 'text' })
          const lines = String(res.data||'').split(/\r?\n/).filter(Boolean)
          const parsed = []
          for (let i=Math.max(0, lines.length-120); i<lines.length; i++) {
            try { parsed.push(JSON.parse(lines[i])) } catch { /* skip */ }
          }
          setEvents(parsed.slice(-50))
          // scroll al fondo
          try { const el = boxRef.current; if (el) el.scrollTop = el.scrollHeight } catch (e) { /* noop */ }
        }
      } catch { /* ignore bootstrap errors */ }
    })()
  }, [hydrated, token, user])

  function refreshFiles(){
    axios.get(apiUrl('/api/admin/livelog/files'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setFiles(r.data.files || []))
      .catch(()=>{})
  }

  function download(day){
    const url = apiUrl(`/api/admin/livelog/file/${day}`)
    const a = document.createElement('a')
    a.href = url
    a.download = `livelog-${day}.ndjson`
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function remove(day){
    if (!confirm(`¿Eliminar log ${day}?`)) return
    axios.delete(apiUrl(`/api/admin/livelog/file/${day}`), { headers: { Authorization: `Bearer ${token}` } })
      .then(() => refreshFiles())
      .catch(()=>{})
  }

  const filtered = useMemo(() => {
    const anyMethodOn = Object.values(enabledMethods).some(Boolean)
    const anyStatusOn = Object.values(enabledStatus).some(Boolean)
    const statusToGroup = (s) => {
      if (typeof s !== 'number') return 'oth'
      const h = Math.floor(s/100)
      return `${h}xx`
    }
    return events.filter(e => {
      if (!(enabledLevels[String(e.level||'info')] === true)) return false
      if (!(filterType==='all' || e.type===filterType)) return false
      if (onlyHttp && !e.http) return false
      if (e.http) {
        const m = String(e.http.method||'').toUpperCase()
        if (anyMethodOn && enabledMethods[m] === false) return false
        const g = statusToGroup(e.http.status)
        if (anyStatusOn && enabledStatus[g] === false) return false
      }
      return true
    })
  }, [events, enabledLevels, filterType, onlyHttp, enabledMethods, enabledStatus])

  const copyJson = (obj) => {
    try { navigator.clipboard.writeText(JSON.stringify(obj, null, 2)) } catch (e) { /* noop */ }
  }

  const pretty = useMemo(() => {
    const statusBadge = (code) => {
      if (typeof code !== 'number') return null
      const c = Number(code)
      const cls = c >= 500 ? 'bg-danger' : c >= 400 ? 'bg-warning text-dark' : c >= 300 ? 'bg-info' : c >= 200 ? 'bg-success' : 'bg-secondary'
      return <span className={`badge ${cls}`}>{c}</span>
    }
    const methodBadge = (m) => m ? <span className="badge bg-secondary">{m}</span> : null
    const summarize = (e) => {
      const time = e.ts ? new Date(e.ts).toLocaleTimeString('es-CL', { hour12: false }) : ''
      if (e.http) {
        if (isMobile) {
          return (
            <span className="d-flex align-items-center gap-1">
              <code className="text-muted">{time}</code>
              {methodBadge(e.http.method)}
              <code className="text-muted" style={{maxWidth: '40vw', overflow:'hidden', textOverflow:'ellipsis'}}>{e.http.url}</code>
              <span>→</span>
              {statusBadge(e.http.status)}
            </span>
          )
        }
        return (
          <span className="d-flex align-items-center gap-1">
            <code className="text-muted">{time}</code>
            {methodBadge(e.http.method)}
            <code className="text-muted">{e.http.url}</code>
            <span>→</span>
            {statusBadge(e.http.status)}
            {typeof e.http.responseTimeMs === 'number' && <span className="ms-1">({Math.round(e.http.responseTimeMs)} ms)</span>}
          </span>
        )
      }
      if (e.msg) return (
        <span className="d-flex align-items-center gap-1">
          <code className="text-muted">{time}</code>
          <span>{e.type || 'event'} · {String(e.msg).slice(0, isMobile? 60:140)}</span>
        </span>
      )
      return <span className="d-flex align-items-center gap-1"><code className="text-muted">{time}</code><span>{e.type || 'event'}</span></span>
    }

    return filtered.map((e, idx) => {
      const levelClass = e.level==='error'?'bg-danger':(e.level==='warn'?'bg-warning text-dark':'bg-secondary')
      const marker = e.level==='error'?'🔴':(e.level==='warn'?'🟡':'⚪')
      return (
        <details key={idx} className="small border rounded p-2 mb-2 bg-white">
          <summary className="d-flex align-items-center gap-2">
            <span style={{fontSize:'14px'}}>{marker}</span>
            <span className={`badge ${levelClass}`}>{e.level||'info'}</span>
            <span className="ms-1">{summarize(e)}</span>
            <button type="button" className="btn btn-sm btn-outline-secondary ms-auto" onClick={(ev)=>{ ev.preventDefault(); copyJson(e) }}>Copiar</button>
          </summary>
          <pre className="mt-2 mb-0 small" style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(e, null, 2)}</pre>
        </details>
      )
    })
  }, [filtered])

  return (
    <div className="row g-3">
      <div className="col-12">
        <h5>Live Log <small className="text-muted">({status})</small></h5>
        <div className="d-flex flex-wrap gap-2 mb-2 align-items-center">
          <div className="btn-group btn-group-sm" role="group" aria-label="levels">
            <button type="button" className={`btn ${enabledLevels.info?'btn-primary':'btn-outline-primary'}`} onClick={()=>setEnabledLevels(s=>({...s, info: !s.info}))}>info</button>
            <button type="button" className={`btn ${enabledLevels.warn?'btn-warning':'btn-outline-warning'}`} onClick={()=>setEnabledLevels(s=>({...s, warn: !s.warn}))}>warn</button>
            <button type="button" className={`btn ${enabledLevels.error?'btn-danger':'btn-outline-danger'}`} onClick={()=>setEnabledLevels(s=>({...s, error: !s.error}))}>error</button>
          </div>
          <div className="btn-group btn-group-sm" role="group" aria-label="only-http">
            <button type="button" className={`btn ${onlyHttp?'btn-dark':'btn-outline-dark'}`} onClick={()=>setOnlyHttp(v=>!v)}>HTTP</button>
          </div>
          <div className="btn-group btn-group-sm" role="group" aria-label="methods">
            {['GET','POST','PUT','PATCH','DELETE'].map(m => (
              <button key={m} type="button" className={`btn ${enabledMethods[m]?'btn-secondary':'btn-outline-secondary'}`} onClick={()=>setEnabledMethods(s=>({...s, [m]: !s[m]}))}>{m}</button>
            ))}
          </div>
          <div className="btn-group btn-group-sm" role="group" aria-label="status">
            {['2xx','3xx','4xx','5xx'].map(g => (
              <button key={g} type="button" className={`btn ${enabledStatus[g]?'btn-info':'btn-outline-info'}`} onClick={()=>setEnabledStatus(s=>({...s, [g]: !s[g]}))}>{g}</button>
            ))}
          </div>
          <input className="form-control form-control-sm w-auto" placeholder="type (exact)" value={filterType==='all'?'':filterType} onChange={e=>setFilterType(e.target.value.trim()===''?'all':e.target.value.trim())} />
        </div>
        <div ref={boxRef} style={{height:'360px', overflow:'auto'}} className="border rounded p-2 bg-light">
          {pretty.length>0 ? pretty : <div className="text-muted small">{status==='open'?'No hay eventos aún. Interactúa con la app para ver actividad…':'Conectando al LiveLog…'}</div>}
        </div>
      </div>
      <div className="col-12">
        <h6>Archivos (NDJSON)</h6>
        <div className="d-flex flex-wrap gap-2">
          {files.map(f => {
            const day = (f.match(/livelog-(\d{8})/)||[])[1]
            return (
              <div key={f} className="btn-group" role="group" aria-label={`Log ${day}`}>
                <button className="btn btn-sm btn-outline-primary" onClick={()=>download(day)}>
                  Descargar {day}
                </button>
                <button className="btn btn-sm btn-outline-danger" onClick={()=>remove(day)}>
                  Borrar
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
