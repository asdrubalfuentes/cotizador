import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { getConfig, apiUrl } from '../utils/config'

export default function RuntimeConfigViewer(){
  const [winCfg, setWinCfg] = useState({})
  const [apiCfg, setApiCfg] = useState(null)
  const [err, setErr] = useState('')

  useEffect(()=>{
    setWinCfg(getConfig())
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
  axios.get(apiUrl('/api/config'), { headers }).then(r=>setApiCfg(r.data)).catch(_e=>setErr('No se pudo leer /api/config (¿token/admin?)'))
  }, [])

  return (
    <div className="card p-3">
      <h5>Configuración en Runtime</h5>
      <p className="text-muted">Valores que el frontend ve en window.__APP_CONFIG__ y lo que reporta el backend en /api/config.</p>
      <div className="row">
        <div className="col-md-6">
          <h6>Frontend (window.__APP_CONFIG__)</h6>
          <pre className="bg-light p-2 small" style={{minHeight:120}}>{JSON.stringify(winCfg, null, 2)}</pre>
        </div>
        <div className="col-md-6">
          <h6>Backend (/api/config)</h6>
          {apiCfg ? (
            <pre className="bg-light p-2 small" style={{minHeight:120}}>{JSON.stringify(apiCfg, null, 2)}</pre>
          ) : (
            <div className="text-muted small">{err || 'Cargando...'}</div>
          )}
        </div>
      </div>
      <div className="mt-2">
        <a className="btn btn-sm btn-outline-secondary me-2" href={apiUrl('/api/config')} target="_blank" rel="noreferrer">Abrir /api/config</a>
        <button className="btn btn-sm btn-outline-primary" onClick={()=>window.location.reload()}>Recargar página</button>
      </div>
    </div>
  )
}
