import React, { useEffect, useState } from 'react'
import axios from 'axios'
import QuoteEditor from './components/QuoteEditor'
import CompanyMaintainer from './components/CompanyMaintainer'
import AdminLogin from './components/AdminLogin'
import Protected from './components/Protected'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AcceptQuoteView from './components/AcceptQuoteView'

export default function App() {
  const [_empresa, setEmpresa] = useState(null)

  useEffect(() => {
    axios.get('/api/empresa').then(r => setEmpresa(r.data)).catch(()=>{})
  }, [])

  return (
    <BrowserRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}>

      <div className="container py-4">
        <header className="mb-4 d-flex justify-content-between align-items-center">
          <div>
            <h1 className="display-6">Cotizador</h1>
            <p className="lead">Crea y administra cotizaciones</p>
          </div>
          <div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={(
            <>
               <section className="card p-3">
                <h5>Editor de Cotización</h5>
                <QuoteEditor onSaved={()=>{ /* refresh list? */ }} />
              </section>
            </>
          )} />

          <Route path="/accept" element={<AcceptQuoteView/>} />
          <Route path="/admin/login" element={<AdminLogin/>} />
          <Route path="/admin/company" element={<Protected><CompanyMaintainer/></Protected>} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
