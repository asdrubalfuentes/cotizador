import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { apiUrl } from '../utils/config'

function adminH(){
  const t = localStorage.getItem('admin_token') || localStorage.getItem('auth_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function AdminClientLinks(){
  const [data, setData] = useState({})
  const [email, setEmail] = useState('')
  const [form, setForm] = useState({ clientEmails:'', clientNames:'', taxIds:'' })
  const [msg, setMsg] = useState('')

  async function load(){
    const r = await axios.get(apiUrl('/api/admin/client-links'), { headers: adminH() })
    setData(r.data.links || {})
  }
  useEffect(()=>{ load() }, [])

  function editFor(e){
    setEmail(e)
    const item = data[e] || { clientEmails:[], clientNames:[], taxIds:[] }
    setForm({
      clientEmails: (item.clientEmails||[]).join(', '),
      clientNames: (item.clientNames||[]).join(', '),
      taxIds: (item.taxIds||[]).join(', '),
    })
  }

  async function save(){
    const body = {
      clientEmails: form.clientEmails.split(',').map(s=>s.trim()).filter(Boolean),
      clientNames: form.clientNames.split(',').map(s=>s.trim()).filter(Boolean),
      taxIds: form.taxIds.split(',').map(s=>s.trim()).filter(Boolean),
    }
    await axios.put(apiUrl('/api/admin/client-links/'+encodeURIComponent(email)), body, { headers: adminH() })
    setMsg('Guardado')
    load()
  }

  async function addQuick(){
    const patch = {}
    if (form.clientEmails.trim()) patch.clientEmail = form.clientEmails.split(',').map(s=>s.trim())[0]
    if (form.clientNames.trim()) patch.clientName = form.clientNames.split(',').map(s=>s.trim())[0]
    if (form.taxIds.trim()) patch.taxId = form.taxIds.split(',').map(s=>s.trim())[0]
    await axios.post(apiUrl('/api/admin/client-links/'+encodeURIComponent(email)), patch, { headers: adminH() })
    setMsg('Vínculo agregado')
    load()
  }

  async function removeAll(e){
    await axios.delete(apiUrl('/api/admin/client-links/'+encodeURIComponent(e)), { headers: adminH() })
    setMsg('Asociaciones eliminadas')
    load()
  }

  const entries = Object.entries(data)

  return (
    <div className="d-flex flex-column gap-3">
      <div className="card p-3">
        <h5>Asociaciones cliente-usuario</h5>
        {msg && <div className="alert alert-info small">{msg}</div>}
        <div className="row g-2">
          <div className="col-md-4">
            <label className="form-label">Usuario (email)</label>
            <input className="form-control" value={email} onChange={e=>setEmail(e.target.value)} placeholder="usuario@dominio.com" autoComplete="email" />
          </div>
          <div className="col-md-8">
            <label className="form-label">Correos de cliente (coma separada)</label>
            <input className="form-control" value={form.clientEmails} onChange={e=>setForm({...form, clientEmails:e.target.value})} placeholder="cliente@dominio.com, cliente2@dominio.com" autoComplete="email" />
          </div>
          <div className="col-md-6">
            <label className="form-label">Nombres de cliente (coma separada)</label>
            <input className="form-control" value={form.clientNames} onChange={e=>setForm({...form, clientNames:e.target.value})} placeholder="Constructora XYZ, Maestranza ABC" autoComplete="organization" />
          </div>
          <div className="col-md-6">
            <label className="form-label">RUTs/TaxIds (coma separada)</label>
            <input className="form-control" value={form.taxIds} onChange={e=>setForm({...form, taxIds:e.target.value})} placeholder="12.345.678-9, 76.543.210-1" autoComplete="off" />
          </div>
          <div className="col-12 d-flex gap-2">
            <button className="btn btn-primary" onClick={save} disabled={!email}>Guardar</button>
            <button className="btn btn-outline-secondary" onClick={addQuick} disabled={!email}>Agregar rápido (primeros)</button>
          </div>
        </div>
      </div>
      <div className="card p-3">
        <h6>Usuarios vinculados</h6>
        <div className="table-responsive">
          <table className="table table-sm">
            <thead><tr><th>Usuario</th><th>Emails cliente</th><th>Nombres cliente</th><th>RUTs</th><th></th></tr></thead>
            <tbody>
              {entries.map(([k, v]) => (
                <tr key={k}>
                  <td><button className="btn btn-link p-0" onClick={()=>editFor(k)}>{k}</button></td>
                  <td className="small">{(v.clientEmails||[]).join(', ')}</td>
                  <td className="small">{(v.clientNames||[]).join(', ')}</td>
                  <td className="small">{(v.taxIds||[]).join(', ')}</td>
                  <td><button className="btn btn-sm btn-outline-danger" onClick={()=>removeAll(k)}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
