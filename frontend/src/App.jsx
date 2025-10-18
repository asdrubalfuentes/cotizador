import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { apiUrl, wsUrl } from './utils/config'
import QuoteEditor from './components/QuoteEditor'
import CompanyMaintainer from './components/CompanyMaintainer'
import AdminLogin from './components/AdminLogin'
import Protected from './components/Protected'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AcceptQuoteView from './components/AcceptQuoteView'
import RuntimeConfigViewer from './components/RuntimeConfigViewer'
import LiveLog from './components/LiveLog'
import { AuthProvider, useAuth } from './components/AuthProvider'
import Landing from './components/Landing'
import Login from './components/Login'
import AdminDashboard from './components/AdminDashboard'
import CotizadorSummary from './components/CotizadorSummary'
import ClientMyQuotes from './components/ClientMyQuotes'
import DashboardLayout from './components/DashboardLayout'
import Profile from './components/Profile'
import AdminClientLinks from './components/AdminClientLinks'
import Docs from './components/Docs'
import ClientManual from './components/ClientManual'

function Header() {
  const { user } = useAuth() || {}
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
    setIsAdmin(!!t)
  }, [])
  return (
    <header className="mb-4 d-flex justify-content-between align-items-center">
      <div>
        <h1 className="display-6">Cotizador</h1>
        <p className="lead">Crea y administra cotizaciones</p>
      </div>
      <div className="d-flex gap-2">
        <a className="btn btn-sm btn-outline-secondary" href="/ingreso">Ingreso</a>
        {user?.role === 'admin' && (
          <div className="btn-group">
            <a className="btn btn-sm btn-outline-secondary" href="/admin/config">Config runtime</a>
            <a className="btn btn-sm btn-outline-secondary" href="/admin/livelog">Live Log</a>
          </div>
        )}
        {isAdmin && !user && (
          <div className="btn-group">
            <a className="btn btn-sm btn-outline-secondary" href="/admin/config">Config runtime</a>
            <a className="btn btn-sm btn-outline-secondary" href="/admin/livelog">Live Log</a>
          </div>
        )}
      </div>
    </header>
  )
}

export default function App() {
  const [_empresa, setEmpresa] = useState(null)
  const [alerts, setAlerts] = useState([])

  const isTestEnv = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE === 'test')
  useEffect(() => {
    if (isTestEnv) return
    axios.get(apiUrl('/api/empresa')).then(r => setEmpresa(r.data)).catch(()=>{})
    // Nota: El estado de auth lo gestiona Header vía AuthProvider
  }, [])

  // Public alerts WS (warn/error) with simple toast list
  useEffect(() => {
    if (isTestEnv) return
    // Derivar la URL de WS desde API_BASE (config.js) para producción
    const url = wsUrl('/ws-public')
    const ws = new WebSocket(url)
    ws.addEventListener('message', (ev) => {
      try {
        const evt = JSON.parse(ev.data)
        setAlerts(prev => {
          const next = [...prev, { id: Date.now() + Math.random(), evt }]
          return next.slice(-5)
        })
      } catch (e) { /* noop */ }
    })
    return () => { try { ws.close() } catch (e) { /* intentionally ignore */ } }
  }, [])

  return (
    <AuthProvider>
    <BrowserRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}>

      <div className="container-fluid p-0">
        {/* Toasts minimalistas */}
        <div style={{position:'fixed', right: 8, bottom: 8, zIndex:9999}}>
          {alerts.map((a) => (
            <div key={a.id} className={`alert p-2 mb-2 ${a.evt.level==='error'?'alert-danger':'alert-warning'}`}>
              <div className="small"><strong>{a.evt.level.toUpperCase()}</strong> <span className="text-muted">{a.evt.ts}</span></div>
              <div className="small">{a.evt.msg || a.evt.type}</div>
            </div>
          ))}
        </div>
        <Header/>

        <Routes>
          <Route path="/" element={<Landing/>} />
          <Route path="/ingreso" element={<Landing/>} />
          <Route path="/login" element={<Login/>} />

          <Route path="/accept" element={<AcceptQuoteView/>} />
          <Route path="/admin/login" element={<AdminLogin/>} />

          <Route path="/admin/dashboard" element={<Protected roles={['admin']}><DashboardLayout><AdminDashboard/></DashboardLayout></Protected>} />
          <Route path="/admin/company" element={<Protected roles={['admin']}><DashboardLayout><CompanyMaintainer/></DashboardLayout></Protected>} />
          <Route path="/admin/config" element={<Protected roles={['admin']}><DashboardLayout><RuntimeConfigViewer/></DashboardLayout></Protected>} />
          <Route path="/admin/client-links" element={<Protected roles={['admin']}><DashboardLayout><AdminClientLinks/></DashboardLayout></Protected>} />
          <Route path="/admin/livelog" element={<Protected roles={['admin']}><DashboardLayout><LiveLog/></DashboardLayout></Protected>} />
          <Route path="/docs" element={<Protected roles={['admin','cotizador']}><DashboardLayout><Docs/></DashboardLayout></Protected>} />

          <Route path="/cotizador" element={<Protected roles={['cotizador','admin']}><DashboardLayout>
            <div className="d-flex flex-column gap-3">
              <section className="card p-3">
                <h5>Editor de Cotización</h5>
                <QuoteEditor onSaved={()=>{}} />
              </section>
              <CotizadorSummary/>
            </div>
          </DashboardLayout></Protected>} />

          <Route path="/cliente" element={<Protected roles={['cliente','admin']}><DashboardLayout><ClientMyQuotes/></DashboardLayout></Protected>} />
          <Route path="/cliente/manual" element={<Protected roles={['cliente','admin']}><DashboardLayout><ClientManual/></DashboardLayout></Protected>} />
          <Route path="/perfil" element={<Protected roles={['cliente','cotizador','admin']}><DashboardLayout><Profile/></DashboardLayout></Protected>} />
        </Routes>
      </div>
    </BrowserRouter>
    </AuthProvider>
  )
}
