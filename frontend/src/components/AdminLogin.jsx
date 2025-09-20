import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

export default function AdminLogin(){
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function submit(e){
    e.preventDefault()
    setError('')
    try{
      const r = await axios.post('/api/admin/login', { password })
      const token = r.data && r.data.token
      if(token){
        localStorage.setItem('admin_token', token)
        navigate('/admin/company')
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


