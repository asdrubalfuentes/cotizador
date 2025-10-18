import React, { useState } from 'react'
import axios from 'axios'
import { apiUrl } from '../utils/config'
import { useNavigate } from 'react-router-dom'

export default function Landing(){
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e){
    e.preventDefault()
    setError('')
    try{
      // Login unificado para todos los roles (incluye admin del store)
      const r = await axios.post(apiUrl('/api/auth/login'), { email, password })
      const { user, token } = r.data
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', JSON.stringify(user))
      if (user.role === 'admin') nav('/admin/dashboard', { replace:true })
      else if (user.role === 'cotizador') nav('/cotizador', { replace:true })
      else nav('/cliente', { replace:true })
      return
    }catch(e){
      const apiErr = e?.response?.data?.error
      const msg = apiErr === 'invalid_credentials' ? 'Credenciales inválidas'
        : apiErr || 'No se pudo iniciar sesión'
      setError(msg)
    }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-md-5">
        <div className="card p-3">
          <h5>Ingreso</h5>
          {error && <div className="alert alert-danger small">{error}</div>}
          <form onSubmit={onSubmit}>
            <div className="mb-2">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username" />
            </div>
            <div className="mb-3">
              <label className="form-label">Contraseña</label>
              <input className="form-control" type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <button className="btn btn-primary" type="submit">Ingresar</button>
          </form>
          <div className="small text-muted mt-2">Los permisos y vistas se asignan según tu rol.</div>
        </div>
      </div>
    </div>
  )
}
