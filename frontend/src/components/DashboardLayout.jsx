import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'

function NavItem({ to, children }){
  const loc = useLocation()
  const active = loc.pathname === to
  return (
    <li className="nav-item">
      <Link className={`nav-link ${active ? 'active' : ''}`} to={to}>{children}</Link>
    </li>
  )
}

export default function DashboardLayout({ children }){
  const nav = useNavigate()
  const { user, setUser, setToken } = useAuth() || {}
  const role = user?.role || 'invitado'
  const name = user?.name || (role === 'admin' ? 'Admin' : 'Usuario')

  const admin = [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/company', label: 'Empresa' },
    { to: '/admin/config', label: 'Config' },
    { to: '/admin/client-links', label: 'Vínculos cliente' },
    { to: '/admin/livelog', label: 'LiveLog' },
    { to: '/docs', label: 'Documentación' },
  ]
  const cotizador = [
    { to: '/cotizador', label: 'Cotizador' },
    { to: '/docs', label: 'Documentación' },
  ]
  const cliente = [
    { to: '/cliente', label: 'Mis Cotizaciones' },
    { to: '/cliente/manual', label: 'Manual' },
  ]
  const common = [
    { to: '/perfil', label: 'Perfil' },
  ]
  const menu = [
    ...(role === 'admin' ? admin : []),
    ...(role === 'cotizador' ? cotizador : []),
    ...(role === 'cliente' ? cliente : []),
    ...common,
  ]

  function handleLogout(){
    try {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    } catch { /* ignore */ }
    if (setUser) setUser(null)
    if (setToken) setToken(null)
    nav('/ingreso', { replace: true })
  }

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      <aside className="border-end bg-white" style={{ width: 260, boxShadow: '0 0 24px rgba(0,0,0,0.06)' }}>
        <div className="p-3 border-bottom" style={{ background: 'rgba(255,255,255,0.9)' }}>
          <div className="fw-bold d-flex align-items-center gap-2">
            <span className="badge bg-primary">C</span>
            <span>Cotizador</span>
          </div>
          <div className="text-muted small">{role}</div>
        </div>
        <ul className="nav flex-column p-2">
          {menu.map(item => (
            <NavItem key={item.to} to={item.to}>{item.label}</NavItem>
          ))}
        </ul>
      </aside>
      <main className="flex-grow-1 d-flex flex-column">
        <header
          className="p-3 d-flex justify-content-between align-items-center"
          style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.9)', zIndex: 10, backdropFilter: 'saturate(1.3) blur(3px)', boxShadow: '0 10px 24px -16px rgba(0,0,0,0.25)' }}
        >
          <div className="h5 m-0">Panel</div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted small">{name}</span>
            <button className="btn btn-sm btn-outline-secondary" onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </header>
        <div className="p-3">
          <div className="row g-3">
            <div className="col-12">
              <div className="shadow-sm rounded-3" style={{ background: 'rgba(255,255,255,0.9)' }}>
                <div className="p-3">{children}</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
