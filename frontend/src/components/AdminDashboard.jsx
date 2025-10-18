import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { apiUrl } from '../utils/config'

function UsersManager(){
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ email:'', password:'', role:'cotizador', name:'', status:'active' })

  async function load(){
    const r = await axios.get(apiUrl('/api/admin/users'), { headers: authH() })
    setUsers(r.data.users || [])
  }
  useEffect(()=>{ load() }, [])

  function authH(){
    const t = localStorage.getItem('admin_token')
    return t ? { Authorization: `Bearer ${t}` } : {}
  }

  async function create(e){
    e.preventDefault()
    await axios.post(apiUrl('/api/admin/users'), form, { headers: authH() })
    setForm({ email:'', password:'', role:'cotizador', name:'', status:'active' })
    load()
  }
  async function update(id, patch){
    await axios.put(apiUrl('/api/admin/users/'+id), patch, { headers: authH() })
    load()
  }
  async function remove(id){
    await axios.delete(apiUrl('/api/admin/users/'+id), { headers: authH() })
    load()
  }

  return (
    <div className="card p-3 mb-3">
      <h6>Gestor de usuarios</h6>
      <form className="row g-2" onSubmit={create}>
        <div className="col-md-3"><input className="form-control" placeholder="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required/></div>
        <div className="col-md-2"><input className="form-control" placeholder="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} required/></div>
        <div className="col-md-2"><input className="form-control" placeholder="nombre" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></div>
        <div className="col-md-2">
          <select className="form-select" value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
            <option value="cotizador">cotizador</option>
            <option value="cliente">cliente</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div className="col-md-2">
          <select className="form-select" value={form.status} onChange={e=>setForm({...form, status:e.target.value})}>
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
        </div>
        <div className="col-md-1"><button className="btn btn-primary w-100" type="submit">Crear</button></div>
      </form>
      <div className="table-responsive mt-3">
        <table className="table table-sm">
          <thead><tr><th>Email</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Último login</th><th></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name}</td>
                <td>
                  <select className="form-select form-select-sm" value={u.role} onChange={e=>update(u.id, { role:e.target.value })}>
                    <option>admin</option>
                    <option>cotizador</option>
                    <option>cliente</option>
                  </select>
                </td>
                <td>
                  <select className="form-select form-select-sm" value={u.status||'active'} onChange={e=>update(u.id, { status:e.target.value })}>
                    <option>active</option>
                    <option>disabled</option>
                  </select>
                </td>
                <td className="small text-muted">{u.lastLoginAt || '-'}</td>
                <td><button className="btn btn-sm btn-outline-danger" onClick={()=>remove(u.id)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AdminDashboard(){
  return (
    <div className="d-flex flex-column gap-3">
      <div className="card p-3">
        <h5>Dashboard Administrador</h5>
        <div className="d-flex gap-2 flex-wrap">
          <a className="btn btn-outline-secondary" href="/admin/company">Mantenedor de empresas</a>
          <a className="btn btn-outline-secondary" href="/admin/livelog">Incidencias (LiveLog)</a>
          <a className="btn btn-outline-secondary" href="/">Editor / Cotizaciones</a>
        </div>
      </div>
      <UsersManager/>
    </div>
  )
}
