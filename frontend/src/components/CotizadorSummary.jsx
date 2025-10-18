import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { apiUrl } from '../utils/config'
import { useAuth } from './AuthProvider'

export default function CotizadorSummary(){
  const { user } = useAuth() || {}
  const [data, setData] = useState([])
  const [q, setQ] = useState('')
  useEffect(()=>{ axios.get(apiUrl('/api/quotes')).then(r=>setData(r.data||[])) }, [])

  const filtered = useMemo(()=>{
    return data.filter(x => (x.client||'').toLowerCase().includes(q.toLowerCase()))
  }, [data, q])

  const stats = useMemo(()=>{
    const s = { accepted:0, rejected:0, needsReview:0, inProcess:0 }
    filtered.forEach(j => {
      if (j.rejected) s.rejected++
      else if (j.needsReview) s.needsReview++
      else if (j.isApproved) s.accepted++
      else s.inProcess++
    })
    return s
  }, [filtered])

  return (
    <div className="d-flex flex-column gap-3">
      <div className="card p-3">
        <div className="d-flex gap-2 align-items-center">
          <strong>Resumen</strong>
          <div className="ms-auto">
            <input className="form-control" placeholder="Buscar por cliente" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
        </div>
        <div className="mt-2 small text-muted">Aceptadas: {stats.accepted} · Rechazadas: {stats.rejected} · En revisión: {stats.needsReview} · En proceso: {stats.inProcess}</div>
      </div>
      <div className="card p-3">
        <h6>Todas las cotizaciones</h6>
        <div className="table-responsive">
          <table className="table table-sm">
            <thead><tr><th>N°</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {filtered.map(j => (
                <tr key={j.file}>
                  <td>{j.quoteNumber}</td>
                  <td>{j.client}</td>
                  <td>{j.total} {j.currency}</td>
                  <td>{j.rejected? 'Rechazada' : j.needsReview? 'Revisión' : j.isApproved? 'Aceptada':'Proceso'}</td>
                  <td className="d-flex gap-2">
                    <a className="btn btn-sm btn-primary" href={`/accept?file=${encodeURIComponent(j.file)}&token=${encodeURIComponent(j.token)}`} target="_blank" rel="noreferrer">Abrir visor</a>
                    {user?.role==='admin' && (
                      <a className="btn btn-sm btn-outline-secondary" href={`/outputs/${j.file}`} target="_blank" rel="noreferrer">JSON</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
