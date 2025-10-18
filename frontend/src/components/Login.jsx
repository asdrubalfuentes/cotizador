import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { apiUrl } from '../utils/config'
import { useAuth } from './AuthProvider'

export default function Login(){
  const nav = useNavigate()
  const loc = useLocation()
  const { setToken, setUser } = useAuth() || {}
  const params = new URLSearchParams(loc.search)
  const expectedRole = params.get('role') || 'cliente'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { setError('') }, [email, password])

  async function onSubmit(e){
    e.preventDefault()
    setError('')
    try {
      const r = await axios.post(apiUrl('/api/auth/login'), { email, password })
      const { user, token } = r.data
      if (expectedRole && user.role !== expectedRole) {
        setError('Tu usuario no tiene el rol esperado para este acceso.')
        return
      }
  localStorage.setItem('auth_token', token)
  localStorage.setItem('auth_user', JSON.stringify(user))
  // Actualizar contexto inmediatamente para evitar recarga
  try { if (setToken) setToken(token) } catch (e) { /* ignore */ }
  try { if (setUser) setUser(user) } catch (e) { /* ignore */ }
      // Defer navegación para dar tiempo a React de propagar el contexto
      setTimeout(() => {
        if (user.role === 'cotizador') nav('/cotizador', { replace:true })
        else nav('/cliente', { replace:true })
      }, 0)
    } catch (e) {
      setError(e?.response?.data?.error || 'Error de autenticación')
    }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-md-6">
        <div className="card p-3">
          <h5>Ingreso ({expectedRole})</h5>
          {error && <div className="alert alert-danger small">{String(error)}</div>}
          <form onSubmit={onSubmit}>
            <div className="mb-2">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label">Contraseña</label>
              <input className="form-control" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit">Ingresar</button>
            <a className="btn btn-link" href="/ingreso">Volver</a>
          </form>
        </div>
      </div>
    </div>
  )
}
