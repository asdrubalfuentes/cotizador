import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { formatRelativeShortEs } from '../utils/time'
import { createSSE, flashElement } from '../utils/sse'

export default function QuoteEditor({ initial, onSaved }){
  const [empresas, setEmpresas] = useState([])
  const [quotes, setQuotes] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [listMaxHeight, setListMaxHeight] = useState(null)
  const leftButtonsRef = useRef(null)
  const rightListRef = useRef(null)
  const listContainerRef = useRef(null)
  const [editingId, setEditingId] = useState(null)
  const [currencyRates, setCurrencyRates] = useState({ UF: 0, USD: 0 })

  const empty = {
    companyId: '',
    client: '',
    clientEmail: '',
    clientAddress: '',
    clientPhone: '',
    clientTaxId: '',
    items: [{id: '1', desc: 'Item', qty: 1, discount: 0, price: 0}],
    currency: 'CLP',
    isRequiredPrepayment: false,
    prepaymentValue: 0,
    note1: '',
    note2: '',
    total: 0
  }
  const [quote, setQuote] = useState(initial || empty)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    loadEmpresas()
    loadQuotes()
    loadCurrencyRates()
  }, [])

  // SSE subscription to refresh list in real-time
  useEffect(() => {
    let debounceTimer
    const triggerReload = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        await loadQuotes()
        flashElement(listContainerRef.current, 'flash', 500)
      }, 250)
    }
    const closeable = createSSE('/api/events', {
      'quote.created': triggerReload,
      'quote.updated': triggerReload,
      'quote.deleted': triggerReload,
      'quote.approved': triggerReload,
      'quote.rejected': triggerReload,
      'quote.needsReview': triggerReload,
    }, { onError: () => {/* noop */}, retryDelay: 4000 })
    return () => {
      try { clearTimeout(debounceTimer) } catch (e) { /* ignore */ }
      closeable && closeable.close && closeable.close()
    }
  }, [])

  useEffect(() => {
    function syncHeights() {
      if (!leftButtonsRef.current || !rightListRef.current) return
      const leftBottom = leftButtonsRef.current.getBoundingClientRect().bottom + window.scrollY
      const rightTop = rightListRef.current.getBoundingClientRect().top + window.scrollY
      const h = Math.max(0, Math.floor(leftBottom - rightTop - 8))
      setListMaxHeight(h)
    }
    syncHeights()
    window.addEventListener('resize', syncHeights)
    window.addEventListener('scroll', syncHeights, { passive: true })
    return () => {
      window.removeEventListener('resize', syncHeights)
      window.removeEventListener('scroll', syncHeights)
    }
  }, [])

  useEffect(() => { if(initial) setQuote(initial) }, [initial])

  async function loadEmpresas() {
    try {
      const res = await axios.get('/api/empresa')
      setEmpresas(res.data)
      // Auto-select first company or AYSAFI SPA if available
      if (res.data.length > 0) {
        const defaultCompany = res.data.find(emp => emp.name.includes('AYSAFI')) || res.data[0]
        setQuote(prev => ({ ...prev, companyId: defaultCompany.id }))
      }
    } catch (e) {
      console.error('Error loading empresas:', e)
    }
  }

  async function loadQuotes() {
    try {
      const res = await axios.get('/api/quotes')
      const sorted = [...res.data].sort((a, b) => {
        const da = new Date(a.created_at || a.saved_at || 0).getTime()
        const db = new Date(b.created_at || b.saved_at || 0).getTime()
        if (db !== da) return db - da
        const ca = (a.client || '').localeCompare(b.client || '');
        return ca
      })
      setQuotes(sorted)
    } catch (e) {
      console.error('Error loading quotes:', e)
    }
  }

  async function loadCurrencyRates() {
    try {
      const [ufRes, usdRes] = await Promise.all([
        axios.get('https://mindicador.cl/api/uf'),
        axios.get('https://mindicador.cl/api/dolar')
      ])
      setCurrencyRates({
        UF: ufRes.data.serie[0]?.valor || 0,
        USD: usdRes.data.serie[0]?.valor || 0
      })
    } catch (e) {
      console.error('Error loading currency rates:', e)
    }
  }

  function updateItem(i, field, val){
    const items = quote.items.map((it,idx)=> idx===i ? {...it,[field]:val} : it)
    recompute(items)
  }

  function computeTotals(items){
    const net = items.reduce((s,it)=> s + (Number(it.qty||0) * Number(it.price||0) * (1 - (Number(it.discount||0)/100))), 0)
    const tax = Math.round((net * 0.19) * 100)/100
    const total = Math.round((net + tax) * 100)/100
    return { net, tax, total }
  }

  function recompute(items){
    const { net, tax, total } = computeTotals(items)
    setQuote(prev=>({...prev, items, total, net, tax}))
  }

  function addItem(){
    const newId = String(Math.max(...quote.items.map(i => Number(i.id || 0))) + 1)
    recompute([...quote.items, {id: newId, desc: 'Item', qty: 1, discount: 0, price: 0}])
  }

  function removeItem(i){
    const items = quote.items.filter((_,idx)=>idx!==i);
    recompute(items)
  }

  function editQuote(quoteData) {
    const items = quoteData.items && quoteData.items.length > 0 ? quoteData.items : [{id: '1', desc: 'Item', qty: 1, discount: 0, price: 0}]
    const { net, tax, total } = computeTotals(items)
    setQuote({
      ...quoteData,
      items,
      net,
      tax,
      total
    })
    setEditingId(quoteData.file?.replace('.json', '') || null)
  }

  function copyQuote(quoteData) {
    const { quoteNumber: _quoteNumber, token: _token, approvedAt: _approvedAt, approvedBy: _approvedBy, isApproved: _isApproved, approved: _approved, rejected: _rejected, rejectedReason: _rejectedReason, needsReview: _needsReview, file: _file, saved_at: _saved_at, ...rest } = quoteData
    const items = (quoteData.items && quoteData.items.length > 0) ? quoteData.items : [{id: '1', desc: 'Item', qty: 1, discount: 0, price: 0}]
    const { net, tax, total } = computeTotals(items)
    const copy = {
      ...rest,
      client: `${quoteData.client} (Copia)`,
      isApproved: false,
      approvedBy: '',
      approvedAt: '',
      items,
      net,
      tax,
      total
    }
    setQuote(copy)
    setEditingId(null)
  }

  async function deleteQuote(filename) {
    if (!confirm('¿Estás seguro de eliminar esta cotización?')) return

    try {
      await axios.delete(`/api/quotes/${filename}`)
      loadQuotes()
      alert('Cotización eliminada')
    } catch (e) {
      alert('Error al eliminar')
    }
  }

  function resetForm() {
    setQuote(empty)
    setEditingId(null)
  }

  async function save(){
    try{
      const url = editingId ? `/api/quotes/${editingId}.json` : '/api/quotes'
      const method = editingId ? 'put' : 'post'

      const resp = await axios[method](url, quote)
      const data = resp.data || {}
      setFeedback({ ok:true, file: data.file || data.filename || data.name, token: data.token || data.jwt })
      resetForm()
      loadQuotes()
      onSaved && onSaved()
    }catch(e){
      setFeedback({ ok:false, error: e.response?.data || e.message })
    }
  }

  function getTotalInCLP() {
    if (quote.currency === 'CLP') return quote.total
    const rate = currencyRates[quote.currency] || 0
    return Math.round(quote.total * rate * 100) / 100
  }

  function handleCompanyChange(companyId) {
    setQuote(prev => ({ ...prev, companyId }))
  }

  function getSelectedCompany() {
    return empresas.find(emp => emp.id === quote.companyId) || {}
  }

  return (
    <div className="container py-3">
      <div className="row">
        <div className="col-md-8">
          <h3>{editingId ? 'Editar Cotización' : 'Nueva Cotización'}</h3>

          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">Empresa Proveedor</label>
              <select
                className="form-control"
                value={quote.companyId || ''}
                onChange={e=>handleCompanyChange(e.target.value)}
              >
                <option value="">Seleccionar empresa</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Moneda</label>
              <select
                className="form-control"
                value={quote.currency}
                onChange={e=>setQuote({...quote,currency:e.target.value})}
              >
                <option value="CLP">CLP</option>
                <option value="UF">UF</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {/* Company Info Display */}
          {quote.companyId && (
            <div className="card mb-3">
              <div className="card-header">
                <h6 className="mb-0">Datos del Proveedor</h6>
              </div>
              <div className="card-body">
                <div className="d-flex align-items-center">
                  {getSelectedCompany().logo && (
                    <img
                      src={`/outputs/logos/${getSelectedCompany().logo}`}
                      alt="Logo"
                      style={{width: 60, height: 60, objectFit: 'contain', marginRight: 15}}
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  )}
                  <div>
                    <strong>{getSelectedCompany().name}</strong>
                    {getSelectedCompany().email && <div><small>Email: {getSelectedCompany().email}</small></div>}
                    {getSelectedCompany().address && <div><small>Dirección: {getSelectedCompany().address}</small></div>}
                    {getSelectedCompany().phone && <div><small>Teléfono: {getSelectedCompany().phone}</small></div>}
                    {getSelectedCompany().taxId && <div><small>RUT: {getSelectedCompany().taxId}</small></div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">Cliente *</label>
              <input className="form-control" value={quote.client||''} onChange={e=>setQuote({...quote,client:e.target.value})} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Email Cliente</label>
              <input type="email" className="form-control" value={quote.clientEmail||''} onChange={e=>setQuote({...quote,clientEmail:e.target.value})} />
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">Dirección Cliente</label>
              <input className="form-control" value={quote.clientAddress||''} onChange={e=>setQuote({...quote,clientAddress:e.target.value})} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Teléfono Cliente</label>
              <input className="form-control" value={quote.clientPhone||''} onChange={e=>setQuote({...quote,clientPhone:e.target.value})} />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">RUT Cliente</label>
            <input className="form-control" value={quote.clientTaxId||''} onChange={e=>setQuote({...quote,clientTaxId:e.target.value})} />
          </div>

          <div className="mb-3">
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                checked={!!quote.isRequiredPrepayment}
                onChange={e=>setQuote({...quote,isRequiredPrepayment:e.target.checked})}
              />
              <label className="form-check-label">Se requiere Anticipo</label>
            </div>
            {quote.isRequiredPrepayment && (
              <div className="mt-2">
                <label className="form-label">Monto del Anticipo</label>
                <input
                  type="number"
                  className="form-control"
                  value={quote.prepaymentValue||0}
                  onChange={e=>setQuote({...quote,prepaymentValue:Number(e.target.value)})}
                />
              </div>
            )}
          </div>

          <table className="table">
            <thead>
              <tr>
                <th style={{width:'40%'}}>Descripción</th>
                <th style={{width:80}}>Cant</th>
                <th style={{width:100}}>Desc %</th>
                <th style={{width:120}}>Precio</th>
                <th style={{width:160}}>Subtotal</th>
                <th style={{width:60}}></th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((it,i)=> (
                <tr key={i}>
                  <td><input className="form-control" value={it.desc||''} onChange={e=>updateItem(i,'desc',e.target.value)} /></td>
                  <td style={{maxWidth:90}}><input className="form-control" type="number" value={it.qty||0} onChange={e=>updateItem(i,'qty',Number(e.target.value))} /></td>
                  <td style={{maxWidth:110}}><input className="form-control" type="number" value={it.discount||0} onChange={e=>updateItem(i,'discount',Number(e.target.value))} /></td>
                  <td style={{maxWidth:130}}><input className="form-control" type="number" value={it.price||0} onChange={e=>updateItem(i,'price',Number(e.target.value))} /></td>
                  <td className="text-end align-middle">
                    {(() => {
                      const subtotal = Math.round((Number(it.qty||0) * Number(it.price||0) * (1 - (Number(it.discount||0)/100))) * 100)/100
                      return <span>{subtotal} {quote.currency}</span>
                    })()}
                  </td>
                  <td><button className="btn btn-sm btn-danger" onClick={()=>removeItem(i)}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mb-3">
            <strong>Neto: {quote.net || 0} {quote.currency}</strong> <br/>
            <strong>IVA (19%): {quote.tax || 0} {quote.currency}</strong> <br/>
            <strong>Total: {quote.total || 0} {quote.currency}</strong>
            {quote.currency !== 'CLP' && (
              <div>
                <strong>Total en CLP: {getTotalInCLP()} CLP</strong>
                <small className="text-muted"> (Tipo de cambio: {currencyRates[quote.currency]})</small>
              </div>
            )}
          </div>

          <div className="mb-3" ref={leftButtonsRef}>
            <button className="btn btn-success me-2" onClick={save} disabled={!quote.client || !quote.companyId}>
              {editingId ? 'Actualizar' : 'Generar'} Cotización
            </button>
            <button className="btn btn-primary me-2" onClick={addItem}>Agregar Producto/Servicio</button>
            {editingId && (
              <button className="btn btn-secondary" onClick={resetForm}>Cancelar</button>
            )}
          </div>

          {feedback && (
            <div className={`alert ${feedback.ok ? 'alert-success' : 'alert-danger'}`}>
              {feedback.ok ? (
                <div>
                  <div>Archivo: <strong>{feedback.file}</strong></div>
                  <div>Token: <strong>{feedback.token}</strong></div>
                  <div className="mt-2">
                    <a className="btn btn-sm btn-outline-primary me-2" href={`/outputs/pdfs/${(feedback.file||'').replace('.json','.pdf')}`} target="_blank" rel="noreferrer">Ver PDF</a>
                    <a className="btn btn-sm btn-outline-secondary" href={`/accept?file=${feedback.file}&token=${feedback.token}`}>Ir a aceptación</a>
                  </div>
                </div>
              ) : (
                <pre>{JSON.stringify(feedback.error,null,2)}</pre>
              )}
            </div>
          )}
        </div>

        <div className="col-md-4">
          <h3>Cotizaciones Creadas</h3>
          <div className="mb-2">
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="Buscar por cliente o ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onInput={e => setSearchTerm(e.target.value)}
            />
          </div>
          {quotes.length === 0 ? (
            <p className="text-muted">No hay cotizaciones</p>
          ) : (
            <div className="list-group flash-container" ref={(el)=>{ rightListRef.current = el; listContainerRef.current = el }} style={{ maxHeight: listMaxHeight ? listMaxHeight : 'auto', overflowY: listMaxHeight ? 'auto' : 'visible' }}>
              {(searchTerm ?
                [...quotes].filter(q =>
                  (q.client || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (q.quoteNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
                ).sort((a, b) => {
                  const da = new Date(a.created_at || a.saved_at || 0).getTime()
                  const db = new Date(b.created_at || b.saved_at || 0).getTime()
                  if (db !== da) return db - da
                  return (a.client || '').localeCompare(b.client || '')
                })
                : quotes
              ).map(quote => (
                <div key={quote.file} className="list-group-item py-2">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="me-3">
                      <h6 className="mb-1">{quote.quoteNumber}</h6>
                      <small className="text-muted d-block">
                        {(quote.client || '').length > 20
                          ? (quote.client || '').slice(0,20) + '…'
                          : (quote.client || '')}
                      </small>
                      <small className="text-muted">Total: {quote.currency} {quote.total}</small>
                    </div>
                    <div className="d-flex flex-column align-items-end">
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" onClick={() => editQuote(quote)} title="Editar">✏️</button>
                        <button className="btn btn-outline-secondary" onClick={() => copyQuote(quote)} title="Copiar">📋</button>
                        <button className="btn btn-outline-danger" onClick={() => deleteQuote(quote.file)} title="Eliminar">🗑️</button>
                        <a className="btn btn-outline-success" href={`/outputs/pdfs/${quote.file.replace('.json','.pdf')}`} target="_blank" rel="noreferrer" title="Descargar PDF">📄</a>
                      </div>
                      <div className="mt-1 d-flex w-100 justify-content-end align-items-center gap-2">
                        {(() => {
                          const raw = formatRelativeShortEs(quote.saved_at || quote.created_at)
                          let short = raw ? raw.replace(/^hace\s+/, '') : ''
                          short = short.replace(/\s+dias\b/, ' d').replace(/\s+dia\b/, ' d')
                          return short ? (
                            <span className="fw-bold text-primary">{short}</span>
                          ) : null
                        })()}
                        {quote.approvedAt ? (
                          <span className="badge bg-success">Aprobada</span>
                        ) : quote.needsReview ? (
                          <span className="badge bg-primary">Revisar</span>
                        ) : quote.rejected ? (
                          <span className="badge bg-danger" title={quote.rejectedReason || ''}>Rechazada</span>
                        ) : (
                          <span className="badge bg-secondary">Pendiente</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
