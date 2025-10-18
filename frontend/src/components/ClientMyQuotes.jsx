import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { apiUrl } from '../utils/config'

function authH(){
  const t = localStorage.getItem('auth_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function ClientMyQuotes(){
  const [list, setList] = useState([])
  const [msg, setMsg] = useState('')
  async function load(){
    const r = await axios.get(apiUrl('/api/quotes/mine'), { headers: authH() })
    setList(r.data.quotes || [])
  }
  useEffect(()=>{ load() }, [])

  async function reactivate(file){
    await axios.post(apiUrl(`/api/quotes/${file}/reactivate`), {}, { headers: authH() })
    setMsg('Solicitud de reactivación enviada. Te contactaremos pronto.')
  }
  async function repeat(file){
    const r = await axios.post(apiUrl(`/api/quotes/${file}/repeat`), {}, { headers: authH() })
    setMsg('Se creó una nueva cotización basada en la anterior.')
    if (r.data?.file) load()
  }

  return (
    <div className="card p-3">
      <h5>Mis cotizaciones</h5>
      {msg && <div className="alert alert-info small">{msg}</div>}
      <div className="table-responsive">
        <table className="table table-sm">
          <thead><tr><th>N°</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {list.map(j => (
              <tr key={j.file}>
                <td>{j.quoteNumber}</td>
                <td>{j.total} {j.currency}</td>
                <td>{j.rejected? 'Rechazada' : j.needsReview? 'Revisión' : j.approvedAt? 'Aceptada':'Proceso'}</td>
                <td className="d-flex gap-2">
                  <a className="btn btn-sm btn-outline-primary" href={`/accept?file=${encodeURIComponent(j.file)}&token=${encodeURIComponent(j.token)}`}>Abrir</a>
                  <button className="btn btn-sm btn-outline-warning" onClick={()=>reactivate(j.file)}>Reactivar</button>
                  <button className="btn btn-sm btn-outline-success" onClick={()=>repeat(j.file)}>Repetir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
