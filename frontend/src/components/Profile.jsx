import React, { useState } from 'react'
import axios from 'axios'
import { useAuth } from './AuthProvider'
import { apiUrl } from '../utils/config'

export default function Profile(){
  const { user, token, setUser } = useAuth() || {}
  const [name, setName] = useState(user?.name || '')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  async function onSubmit(e){
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      const r = await axios.put(apiUrl('/api/auth/me'), { name, password: password || undefined }, { headers: { Authorization: `Bearer ${token}` }})
      if (r.data?.ok && r.data.user) {
        setUser(r.data.user)
        localStorage.setItem('auth_user', JSON.stringify(r.data.user))
        setMsg({ type:'success', text:'Perfil actualizado' })
        setPassword('')
      } else {
        setMsg({ type:'danger', text:'No se pudo actualizar' })
      }
    } catch (e) {
      setMsg({ type:'danger', text: e?.response?.data?.error || 'Error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title">Perfil</h5>
        <form onSubmit={onSubmit} className="vstack gap-3">
          <div>
            <label className="form-label">Correo</label>
            <input className="form-control" value={user?.email || ''} disabled autoComplete="email" />
          </div>
          <div>
            <label className="form-label">Nombre</label>
            <input className="form-control" value={name} onChange={e=>setName(e.target.value)} autoComplete="name" />
          </div>
          <div>
            <label className="form-label">Nueva contraseña (opcional)</label>
            <input type="password" className="form-control" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="d-flex gap-2 align-items-center">
            <button className="btn btn-primary" disabled={saving}>Guardar</button>
            {msg && <span className={`small text-${msg.type==='success'?'success':'danger'}`}>{msg.text}</span>}
          </div>
        </form>
      </div>
    </div>
  )
}
