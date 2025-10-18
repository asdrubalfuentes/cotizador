import React, { useState } from 'react'
import axios from 'axios'
import { apiUrl } from '../utils/config'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export default function AdminLogin(){
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { setUser, setToken } = useAuth() || {}

  async function submit(e){
    e.preventDefault()
    setError('')
    try{
  const r = await axios.post(apiUrl('/api/admin/login'), { password })
      const token = r.data && r.data.token
      if(token){
        localStorage.setItem('admin_token', token)
        // Actualizar contexto para evitar necesidad de recargar
  try { if (setToken) setToken(token) } catch (e) { /* ignore */ }
  try { if (setUser) setUser({ role: 'admin', name: 'Admin' }) } catch (e) { /* ignore */ }
        setTimeout(() => navigate('/admin/dashboard', { replace:true }), 0)
      } else {
        setError('Respuesta inválida')
      }
    }catch(err){
      setError('Credenciales inválidas')
    }
  }

  return (
    <div className="container py-4" style={{maxWidth:420}}>
      <h3>Login Administrador</h3>
      <form onSubmit={submit}>
        <div className="mb-3">
          <label className="form-label">Password</label>
          <input type="password" className="form-control" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <button className="btn btn-primary" type="submit">Ingresar</button>
      </form>
    </div>
  )
}


