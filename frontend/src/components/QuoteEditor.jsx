import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { apiUrl, eventsUrl, getConfig } from '../utils/config'
import { formatRelativeShortEs } from '../utils/time'
import { createSSE, flashElement } from '../utils/sse'
import { formatAmount, formatNumberDot, formatRate } from '../utils/number'

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
    title: '',
    selectedTitleItemId: '',
    specs: [], // [{type:'text', value:string} | {type:'link', url:string}]
    conditions: '',
    validDays: 7,
    total: 0
  }
  const [quote, setQuote] = useState(initial || empty)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    if (isTestEnv) return
    loadEmpresas()
    loadQuotes()
    loadCurrencyRates()
  }, [])

  // SSE subscription to refresh list in real-time
  // Evitar efectos con estado en entorno de test para no disparar warnings de act(...)
  const isTestEnv = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE === 'test')

  useEffect(() => {
    if (isTestEnv) return
    let debounceTimer
    const triggerReload = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        await loadQuotes()
        flashElement(listContainerRef.current, 'flash', 500)
      }, 250)
    }
    const closeable = createSSE(eventsUrl(), {
      'quote.created': triggerReload,
      'quote.updated': triggerReload,
      'quote.deleted': triggerReload,
      'quote.approved': triggerReload,
      'quote.rejected': triggerReload,
      'quote.needsReview': triggerReload,
      'quote.pdfReady': triggerReload,
    }, { onError: () => {/* noop */}, retryDelay: 4000 })
    return () => {
      try { clearTimeout(debounceTimer) } catch (e) { /* ignore */ }
      closeable && closeable.close && closeable.close()
    }
  }, [])

  useEffect(() => {
    if (isTestEnv) return
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

  // Utilidad para sanear el título (recorta, colapsa espacios, limita longitud)
  function sanitizeTitle(str) {
    const s = String(str || '')
      .replace(/\s+/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
    // Pequeño filtrado de palabras muy comunes al inicio
    const filtered = s.replace(/^((el|la|los|las|un|una|unos|unas|de|del|para|por)\s+)+/i, '')
    // Limitar a 80 chars para UI/email
    return filtered.length > 80 ? filtered.slice(0, 77) + '…' : filtered
  }

  // Heurística: si no hay selección explícita, elegir el primer ítem con desc no vacía
  useEffect(() => {
    if (!quote) return
    if (quote.selectedTitleItemId) {
      const it = (quote.items || []).find(i => String(i.id) === String(quote.selectedTitleItemId))
      if (it) {
        const newTitle = sanitizeTitle(it.desc)
        if (newTitle !== quote.title) setQuote(prev => ({ ...prev, title: newTitle }))
        return
      }
    }
    // Sin selección: estimar
    const candidate = (quote.items || []).find(i => (i && (i.desc || '').trim().length > 0))
    const fallback = candidate ? sanitizeTitle(candidate.desc) : ''
    if ((quote.title || '') === '' && fallback) {
      setQuote(prev => ({ ...prev, title: fallback }))
    }
  }, [quote.items, quote.selectedTitleItemId])

  async function loadEmpresas() {
    try {
      const res = await axios.get(apiUrl('/api/empresa'))
      setEmpresas(res.data)
      // Auto-select first company or AYSAFI SPA if available
      if (res.data.length > 0) {
        const defaultCompany = res.data.find(emp => (emp.name || '').includes('AYSAFI')) || res.data[0]
        setQuote(prev => ({ ...prev, companyId: defaultCompany.id }))
      }
    } catch (e) {
      console.error('Error loading empresas:', e)
    }
  }

  async function loadQuotes() {
    try {
      const res = await axios.get(apiUrl('/api/quotes'))
      const sorted = [...res.data].sort((a, b) => {
        const da = new Date(a.created_at || a.saved_at || 0).getTime()
        const db = new Date(b.created_at || b.saved_at || 0).getTime()
        if (db !== da) return db - da
        const ca = (a.client || '').localeCompare(b.client || '')
        return ca
      })
      setQuotes(sorted)
    } catch (e) {
      console.error('Error loading quotes:', e)
    }
  }

  async function loadCurrencyRates() {
    try {
      const { RATES_SOURCE } = getConfig()
      if (RATES_SOURCE === 'direct') {
        const [ufRes, usdRes] = await Promise.all([
          axios.get('https://mindicador.cl/api/uf'),
          axios.get('https://mindicador.cl/api/dolar')
        ])
        const uf = (ufRes && ufRes.data && ufRes.data.serie && ufRes.data.serie[0] && ufRes.data.serie[0].valor) || 0
        const usd = (usdRes && usdRes.data && usdRes.data.serie && usdRes.data.serie[0] && usdRes.data.serie[0].valor) || 0
        setCurrencyRates({ UF: Number(uf) || 0, USD: Number(usd) || 0 })
      } else {
        // Default: backend proxy to avoid CSP and CORS issues
        const res = await axios.get(apiUrl('/api/rates'))
        const data = res && res.data ? res.data : {}
        setCurrencyRates({ UF: Number(data.UF) || 0, USD: Number(data.USD) || 0 })
      }
    } catch (e) {
      console.error('Error loading currency rates:', e)
    }
  }

  function updateItem(i, field, val){
    const items = quote.items.map((it,idx)=> idx===i ? {...it,[field]:val} : it)
    recompute(items)
    // Si el ítem seleccionado como título cambia su desc, actualizar título
    const changed = items[i]
    if (field === 'desc' && quote.selectedTitleItemId && String(changed.id) === String(quote.selectedTitleItemId)) {
      const newTitle = sanitizeTitle(val)
      if (newTitle !== quote.title) setQuote(prev => ({ ...prev, title: newTitle }))
    }
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
    const newId = String(Math.max.apply(null, quote.items.map(function(i){ return Number(i.id || 0) })) + 1)
    recompute([...quote.items, {id: newId, desc: 'Item', qty: 1, discount: 0, price: 0}])
  }

  function removeItem(i){
    const items = quote.items.filter((_,idx)=>idx!==i)
    recompute(items)
  }

  // ----- Especificaciones (texto enriquecido con interpretación de link + miniatura) -----
  const [specDraft, setSpecDraft] = useState('')
  const [specPreview, setSpecPreview] = useState({ hasUrl:false, url:'', isImage:false })
  function firstUrlIn(text){
    const m = String(text||'').match(/https?:\/\/[^\s]+/i);
    return m ? m[0] : ''
  }
  function updateSpecDraft(v){
    setSpecDraft(v)
    const url = firstUrlIn(v)
    if(url){
      const isImg = /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url)
      setSpecPreview({ hasUrl: true, url, isImage: isImg })
    } else {
      setSpecPreview({ hasUrl:false, url:'', isImage:false })
    }
  }
  function addSpecFromDraft(){
    const raw = (specDraft||'').trim(); if(!raw) return
    const url = firstUrlIn(raw)
    const textOnly = raw.replace(url,'').trim()
    setQuote(prev => {
      const next = { ...(prev||{}), specs: [...(prev.specs||[])] }
      if(textOnly){ next.specs.push({ type:'text', value: textOnly }) }
      if(url){ next.specs.push({ type:'link', url }) }
      return next
    })
    setSpecDraft('')
    setSpecPreview({ hasUrl:false, url:'', isImage:false })
  }
  function removeSpec(idx){
    setQuote(prev => ({ ...prev, specs: (prev.specs||[]).filter((_,i)=>i!==idx) }))
  }
  function isImageUrl(u){ return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(u||'') }

  // ----- Condiciones (texto enriquecido simple, múltiples ítems) -----
  const [condDraft, setCondDraft] = useState('')
  function addCondition(){
    const v = (condDraft||'').trim(); if(!v) return
    setQuote(prev => ({ ...prev, conditionsList: [...(prev.conditionsList||[]), v] }))
    setCondDraft('')
  }
  function removeCondition(idx){
    setQuote(prev => ({ ...prev, conditionsList: (prev.conditionsList||[]).filter((_,i)=>i!==idx) }))
  }

  async function editQuote(quoteData) {
    try {
      // Siempre recuperar el detalle completo para obtener specs/conditions/etc.
      const file = quoteData.file;
      const full = file ? (await axios.get(apiUrl(`/api/quotes/${file}`))).data : quoteData;
      const items = full.items && full.items.length > 0 ? full.items : [{ id: '1', desc: 'Item', qty: 1, discount: 0, price: 0 }];
      const { net, tax, total } = computeTotals(items);
      setQuote({
        ...full,
        items,
        specs: Array.isArray(full.specs) ? full.specs : [],
        conditionsList: Array.isArray(full.conditionsList)
          ? full.conditionsList
          : (full.conditions ? String(full.conditions).split(/\r?\n/).filter(Boolean) : []),
        validDays: Number(full.validDays || 7),
        isRequiredPrepayment: !!full.isRequiredPrepayment,
        prepaymentValue: Number(full.prepaymentValue || 0),
        net,
        tax,
        total
      });
      setEditingId((file && file.replace('.json', '')) || null);
    } catch (e) {
      console.error('Error loading quote detail for edit:', e);
      alert('No se pudo cargar el detalle de la cotización.');
    }
  }

  async function copyQuote(quoteData) {
    try {
      const file = quoteData.file;
      const full = file ? (await axios.get(apiUrl(`/api/quotes/${file}`))).data : quoteData;
      const { quoteNumber: _quoteNumber, token: _token, approvedAt: _approvedAt, approvedBy: _approvedBy, isApproved: _isApproved, approved: _approved, rejected: _rejected, rejectedReason: _rejectedReason, needsReview: _needsReview, file: _file, saved_at: _saved_at, ...rest } = full;
      const items = (full.items && full.items.length > 0) ? full.items : [{ id: '1', desc: 'Item', qty: 1, discount: 0, price: 0 }];
      const { net, tax, total } = computeTotals(items);
      const copy = {
        ...rest,
        specs: Array.isArray(rest.specs) ? rest.specs : [],
        conditionsList: Array.isArray(rest.conditionsList)
          ? rest.conditionsList
          : (rest.conditions ? String(rest.conditions).split(/\r?\n/).filter(Boolean) : []),
        validDays: Number(rest.validDays || 7),
        isRequiredPrepayment: !!rest.isRequiredPrepayment,
        prepaymentValue: Number(rest.prepaymentValue || 0),
        client: `${full.client} (Copia)`,
        isApproved: false,
        approvedBy: '',
        approvedAt: '',
        items,
        net,
        tax,
        total
      };
      setQuote(copy);
      setEditingId(null);
    } catch (e) {
      console.error('Error loading quote detail for copy:', e);
      alert('No se pudo cargar el detalle de la cotización para copiar.');
    }
  }

  async function deleteQuote(filename) {
    if (!confirm('¿Estás seguro de eliminar esta cotización?')) return

    try {
      await axios.delete(apiUrl(`/api/quotes/${filename}`))
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
      const url = editingId ? apiUrl(`/api/quotes/${editingId}.json`) : apiUrl('/api/quotes')
      const method = editingId ? 'put' : 'post'

      // Empaquetar condiciones: si hay lista, generar string también (compatibilidad)
      const toSend = { ...quote }
      if (Array.isArray(toSend.conditionsList) && toSend.conditionsList.length > 0) {
        toSend.conditions = toSend.conditionsList.join('\n')
      }

      const resp = await axios[method](url, toSend)
      const data = resp.data || {}
      setFeedback({ ok:true, file: data.file || data.filename || data.name, token: data.token || data.jwt })
      resetForm()
      loadQuotes()
      onSaved && onSaved()
    }catch(e){
      setFeedback({ ok:false, error: e.response && e.response.data ? e.response.data : e.message })
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
      {/* Barra móvil: botón para abrir lista a pantalla completa */}
      <div className="d-md-none mb-2 d-flex justify-content-end">
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          data-bs-toggle="offcanvas"
          data-bs-target="#quotesOffcanvas"
          aria-controls="quotesOffcanvas"
        >
          Ver lista ({quotes.length})
        </button>
      </div>
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
                      src={apiUrl(`/outputs/logos/${getSelectedCompany().logo}`)}
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
              <input type="text" placeholder="ej: a@b.com, c@d.com; e@f.com" className="form-control" value={quote.clientEmail||''} onChange={e=>setQuote({...quote,clientEmail:e.target.value})} />
              <div className="form-text">Puedes ingresar múltiples correos separados por coma, punto y coma o espacios.</div>
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
                  inputMode="decimal"
                  step="any"
                  className="form-control"
                  value={(quote.prepaymentValue===undefined||quote.prepaymentValue===null)?0:quote.prepaymentValue}
                  onFocus={e=>{ if(String(e.target.value)==='0') e.target.select() }}
                  onBlur={e=>{ if(e.target.value==='' || isNaN(Number(e.target.value))) { e.target.value = '0'; setQuote(function(prev){ return Object.assign({}, prev, { prepaymentValue: 0 }) }) } }}
                  onChange={e=>setQuote(Object.assign({}, quote, { prepaymentValue: Number(e.target.value) }))}
                />
              </div>
            )}
          </div>

          <table className="table">
            <thead>
              <tr>
                <th style={{width:40}} title="Usar como Título">Tít</th>
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
                  <td className="text-center align-middle">
                    <input
                      type="radio"
                      name="quoteTitleItem"
                      className="form-check-input"
                      checked={String(quote.selectedTitleItemId || '') === String(it.id)}
                      onChange={() => setQuote(prev => ({ ...prev, selectedTitleItemId: it.id, title: sanitizeTitle(it.desc) }))}
                      title="Usar este ítem como título de la cotización"
                    />
                  </td>
                  <td><input className="form-control" value={it.desc||''} onChange={e=>updateItem(i,'desc',e.target.value)} /></td>
                  <td style={{maxWidth:90}}>
                    <input
                      className="form-control"
                      type="number"
                      inputMode="numeric"
                      step="1"
                      value={(it.qty===undefined||it.qty===null)?0:it.qty}
                      onFocus={e=>{ if(String(e.target.value)==='0') e.target.select() }}
                      onBlur={e=>{ if(e.target.value==='' || isNaN(Number(e.target.value))) { e.target.value = '0'; updateItem(i,'qty',0) } }}
                      onChange={e=>updateItem(i,'qty', Number(e.target.value))}
                    />
                  </td>
                  <td style={{maxWidth:110}}>
                    <input
                      className="form-control"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={(it.discount===undefined||it.discount===null)?0:it.discount}
                      onFocus={e=>{ if(String(e.target.value)==='0') e.target.select() }}
                      onBlur={e=>{ if(e.target.value==='' || isNaN(Number(e.target.value))) { e.target.value = '0'; updateItem(i,'discount',0) } }}
                      onChange={e=>updateItem(i,'discount', Number(e.target.value))}
                    />
                  </td>
                  <td style={{maxWidth:130}}>
                    <input
                      className="form-control"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={(it.price===undefined||it.price===null)?0:it.price}
                      onFocus={e=>{ if(String(e.target.value)==='0') e.target.select() }}
                      onBlur={e=>{ if(e.target.value==='' || isNaN(Number(e.target.value))) { e.target.value = '0'; updateItem(i,'price',0) } }}
                      onChange={e=>updateItem(i,'price', Number(e.target.value))}
                    />
                  </td>
                  <td className="text-end align-middle">
                    {(() => {
                      const subtotal = Math.round((Number(it.qty||0) * Number(it.price||0) * (1 - (Number(it.discount||0)/100))) * 100)/100
                      return <span>{formatAmount(subtotal, quote.currency)}</span>
                    })()}
                  </td>
                  <td><button className="btn btn-sm btn-danger" onClick={()=>removeItem(i)}>Eliminar</button></td>
                </tr>
              ))}
              <tr>
                <td colSpan={7}>
                  <button className="btn btn-primary" onClick={addItem}>Agregar Producto/Servicio</button>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Vista del título actual */}
          <div className="mb-3">
            <label className="form-label">Título de la cotización</label>
            <input
              className="form-control"
              value={quote.title || ''}
              onChange={e => setQuote(prev => ({ ...prev, title: sanitizeTitle(e.target.value) }))}
              placeholder="Selecciona un ítem o escribe un título"
            />
            <div className="form-text">Se usará en PDF/Email más adelante. Por ahora solo se guarda con la cotización.</div>
          </div>

          <div className="mb-3">
            <strong>Neto: {formatAmount(quote.net || 0, quote.currency)}</strong> <br/>
            <strong>IVA (19%): {formatAmount(quote.tax || 0, quote.currency)}</strong> <br/>
            <strong>Total: {formatAmount(quote.total || 0, quote.currency)}</strong>
            {quote.currency !== 'CLP' && (
              <div>
                <strong>Total en CLP: {formatNumberDot(getTotalInCLP(), 0)} CLP</strong>
                <small className="text-muted"> (Tipo de cambio: {formatRate(currencyRates[quote.currency] || 0)})</small>
              </div>
            )}
          </div>

          {/* Vigencia y Condiciones */}
          <div className="row mb-3">
            <div className="col-md-4">
              <label className="form-label">Vigencia (días hábiles)</label>
              <input
                type="number"
                className="form-control"
                min={1}
                value={quote.validDays || 7}
                onChange={e=> setQuote(prev => ({ ...prev, validDays: Math.max(1, Number(e.target.value||7)) }))}
              />
            </div>
            <div className="col-md-8">
              <label className="form-label">Condiciones (ítems)</label>
              <div className="mb-2">
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Escribe una condición y agrégala como ítem"
                  value={condDraft}
                  onChange={e=> setCondDraft(e.target.value)}
                />
                <div className="d-flex mt-2 gap-2">
                  <button className="btn btn-outline-secondary" type="button" onClick={addCondition}>Agregar condición</button>
                  <small className="text-muted align-self-center">No reconoce links; puedes usar saltos de línea.</small>
                </div>
              </div>
              {(quote.conditionsList||[]).length === 0 ? (
                <div className="text-muted">Sin condiciones</div>
              ) : (
                <div className="list-group">
                  {(quote.conditionsList||[]).map((c, idx) => (
                    <div key={idx} className="list-group-item d-flex align-items-start justify-content-between">
                      <div style={{whiteSpace:'pre-wrap'}}>{c}</div>
                      <button className="btn btn-sm btn-outline-danger ms-2" onClick={()=>removeCondition(idx)}>Quitar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Especificaciones */}
          <div className="mb-3">
            <label className="form-label">Especificaciones</label>
            {/* Preview sobre el campo cuando hay link en el borrador */}
            {specPreview.hasUrl && (
              <div className="mb-2 p-2 border rounded" style={{background:'#fafafa'}}>
                {specPreview.isImage ? (
                  <img src={specPreview.url} alt="preview" style={{maxHeight:120}} onError={e=>{ e.currentTarget.style.display='none' }} />
                ) : (
                  <a href={specPreview.url} target="_blank" rel="noreferrer">{specPreview.url}</a>
                )}
              </div>
            )}
            <div className="mb-2">
              <textarea
                className="form-control"
                rows={3}
                placeholder="Escribe tu especificación; si incluyes un link, lo interpretaremos y previsualizaremos arriba"
                value={specDraft}
                onChange={e=>updateSpecDraft(e.target.value)}
              />
              <div className="d-flex mt-2 gap-2">
                <button className="btn btn-outline-primary" type="button" onClick={addSpecFromDraft}>Agregar especificación</button>
                <button className="btn btn-outline-secondary" type="button" onClick={()=>{ setSpecDraft(''); setSpecPreview({hasUrl:false,url:'',isImage:false}) }}>Limpiar</button>
              </div>
            </div>
            {(quote.specs||[]).length === 0 ? (
              <div className="text-muted">Sin especificaciones</div>
            ) : (
              <div className="list-group">
                {(quote.specs||[]).map((sp, idx) => (
                  <div key={idx} className="list-group-item d-flex align-items-center justify-content-between">
                    <div className="me-2">
                      {sp.type === 'text' ? (
                        <div>{sp.value}</div>
                      ) : (
                        <div>
                          <a href={sp.url} target="_blank" rel="noreferrer">{sp.url}</a>
                          {isImageUrl(sp.url) && (
                            <div className="mt-1"><img src={sp.url} alt="preview" style={{maxHeight: 80}} onError={e=> e.currentTarget.style.display='none'} /></div>
                          )}
                        </div>
                      )}
                    </div>
                    <button className="btn btn-sm btn-outline-danger" onClick={()=>removeSpec(idx)}>Quitar</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-3" ref={leftButtonsRef}>
            <button className="btn btn-success me-2" onClick={save} disabled={!quote.client || !quote.companyId}>
              {editingId ? 'Actualizar' : 'Generar'} Cotización
            </button>
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
                    <a className="btn btn-sm btn-outline-primary me-2" href={apiUrl(`/api/quotes/${(feedback.file||'')}/pdf`)} target="_blank" rel="noreferrer">Ver PDF</a>
                    <a className="btn btn-sm btn-outline-secondary" href={`/accept?file=${feedback.file}&token=${feedback.token}`}>Ir a aceptación</a>
                  </div>
                </div>
              ) : (
                <pre>{JSON.stringify(feedback.error,null,2)}</pre>
              )}
            </div>
          )}
        </div>

        <div className="col-md-4 d-none d-md-block">
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
                [...quotes].filter(q => {
                  const term = searchTerm.toLowerCase()
                  const inClient = (q.client || '').toLowerCase().includes(term)
                  const inCode = (q.quoteNumber || '').toLowerCase().includes(term)
                  const inItems = Array.isArray(q.items) && q.items.some(it => (it && (it.desc || '')).toLowerCase().includes(term))
                  return inClient || inCode || inItems
                }).sort((a, b) => {
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
                      <small className="text-muted">Total: {formatAmount(quote.total, quote.currency)}</small>
                    </div>
                    <div className="d-flex flex-column align-items-end">
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" onClick={() => editQuote(quote)} title="Editar">✏️</button>
                        <button className="btn btn-outline-secondary" onClick={() => copyQuote(quote)} title="Copiar">📋</button>
                        <button className="btn btn-outline-danger" onClick={() => deleteQuote(quote.file)} title="Eliminar">🗑️</button>
                        <a className="btn btn-outline-success" href={apiUrl(`/api/quotes/${quote.file}/pdf`)} target="_blank" rel="noreferrer" title="Descargar PDF">📄</a>
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
                        {quote.processingPDF ? (
                          <span className="badge bg-warning text-dark">Generando PDF…</span>
                        ) : quote.approvedAt ? (
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

      {/* Offcanvas móvil a pantalla completa con la lista */}
      <div
        className="offcanvas offcanvas-start"
        tabIndex="-1"
        id="quotesOffcanvas"
        aria-labelledby="quotesOffcanvasLabel"
        style={{ width: '100%' }}
      >
        <div className="offcanvas-header">
          <h5 className="offcanvas-title" id="quotesOffcanvasLabel">Cotizaciones</h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body">
          <div className="mb-2">
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="Buscar por cliente, ID o descripción..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onInput={e => setSearchTerm(e.target.value)}
            />
          </div>
          {quotes.length === 0 ? (
            <p className="text-muted">No hay cotizaciones</p>
          ) : (
            <div className="list-group">
              {(searchTerm ?
                [...quotes].filter(q => {
                  const term = searchTerm.toLowerCase()
                  const inClient = (q.client || '').toLowerCase().includes(term)
                  const inCode = (q.quoteNumber || '').toLowerCase().includes(term)
                  const inItems = Array.isArray(q.items) && q.items.some(it => (it && (it.desc || '')).toLowerCase().includes(term))
                  return inClient || inCode || inItems
                }).sort((a, b) => {
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
                        {(quote.client || '').length > 24
                          ? (quote.client || '').slice(0,24) + '…'
                          : (quote.client || '')}
                      </small>
                      <small className="text-muted">Total: {formatAmount(quote.total, quote.currency)}</small>
                    </div>
                    <div className="d-flex flex-column align-items-end">
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" data-bs-dismiss="offcanvas" onClick={() => editQuote(quote)} title="Editar">✏️</button>
                        <button className="btn btn-outline-secondary" data-bs-dismiss="offcanvas" onClick={() => copyQuote(quote)} title="Copiar">📋</button>
                        <button className="btn btn-outline-danger" data-bs-dismiss="offcanvas" onClick={() => deleteQuote(quote.file)} title="Eliminar">🗑️</button>
                        <a className="btn btn-outline-success" href={apiUrl(`/api/quotes/${quote.file}/pdf`)} target="_blank" rel="noreferrer" title="Descargar PDF">📄</a>
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
                        {quote.processingPDF ? (
                          <span className="badge bg-warning text-dark">Generando PDF…</span>
                        ) : quote.approvedAt ? (
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
