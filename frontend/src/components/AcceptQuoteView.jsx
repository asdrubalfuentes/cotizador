import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useSearchParams } from 'react-router-dom'
import { formatRelativeShortEs } from '../utils/time'
import { createSSE, flashElement } from '../utils/sse'

export default function AcceptQuoteView(){
  const [params] = useSearchParams()
  const file = params.get('file')
  const token = params.get('token')
  const [quote, setQuote] = useState(null)
  const [code, setCode] = useState('')
  const [prepago, setPrepago] = useState(0)
  const [nombre, setNombre] = useState('')
  const [motivo, setMotivo] = useState('')
  const [rejectMode, setRejectMode] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(()=>{
    if(!file) return
    axios.get(`/api/quotes/${file}`).then(r=>{
      setQuote(r.data)
    }).catch(()=>setMessage('No se encontró la cotización'))
  },[file])

  // SSE subscription: refresh this view when the same quote changes
  useEffect(() => {
    const handler = async (ev) => {
      try {
        const data = JSON.parse(ev.data || '{}')
        if (data && data.quoteNumber && quote && data.quoteNumber === quote.quoteNumber) {
          await reloadQuote()
          const card = document.querySelector('.card.p-3')
          flashElement(card, 'flash', 500)
        }
      } catch (_) { /* ignore */ }
    }
    const closeable = createSSE('/api/events', {
      'quote.updated': handler,
      'quote.approved': handler,
      'quote.rejected': handler,
      'quote.needsReview': handler,
      'quote.deleted': handler,
    }, { retryDelay: 4000 })
    return () => { closeable && closeable.close && closeable.close() }
  }, [quote?.quoteNumber])

  async function reloadQuote(){
    if(!file) return
    try {
      const r = await axios.get(`/api/quotes/${file}`)
      setQuote(r.data)
    } catch (_e) { /* noop */ }
  }

  function submitAccept(){
    if(!token && code.length!==6){ setMessage('Se requiere token o código de 6 dígitos'); return }
    const code6 = token ? token.slice(-6) : code
    axios.post(`/api/quotes/${file}/approve`, { code6, approverName: nombre, prepayment: prepago }).then(r=>{
      if (r.data && r.data.needsReview) {
        setMessage('Solicitud enviada para revisión por la empresa proveedora.')
      } else {
        setMessage('Cotización aceptada. Gracias.')
      }
      reloadQuote()
    }).catch(e=> setMessage(e.response?.data?.error || 'Error al procesar'))
  }

  function submitReject(){
    if (quote?.rejected) return; // si ya está rechazada, no permitir
    if (!rejectMode) { setRejectMode(true); return }
    if(!motivo){ setMessage('Indique el motivo'); return }
    const code6 = token ? token.slice(-6) : code
    axios.post(`/api/quotes/${file}/approve`, { code6, reject:true, reason: motivo || 'Rechazo vía web', approverName: nombre })
      .then(()=> { setMessage('Se registró el rechazo'); setRejectMode(false); setMotivo(''); reloadQuote() })
      .catch(_e=> setMessage('Error'))
  }

  function formatCLP(n){
    try{ return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n||0)) }catch{ return `${n} CLP` }
  }

  return (
    <div className="container py-4">
      <h3>Aceptar Cotización</h3>
      {message && <div className="alert alert-info">{message}</div>}
      {!quote ? (
        <div>Buscando cotización...</div>
      ) : (
        <div className="card p-3">
          <h5>{quote.reference || 'Cotización'}</h5>
          <div className="text-muted mb-1"><small>Actualizada {formatRelativeShortEs(quote.saved_at || quote.created_at)}</small></div>
          <div className="text-muted mb-2"><small>Elaborada: {quote.created_at ? new Date(quote.created_at).toLocaleString('es-CL') : '-'}</small></div>
          {quote.rejected && (
            <div className="text-danger mb-2">
              <small>Previamente rechazada{quote.rejectedAt ? ` el ${new Date(quote.rejectedAt).toLocaleString('es-CL')}` : ''}{quote.rejectedReason ? ` — Motivo: ${quote.rejectedReason}` : ''}</small>
            </div>
          )}
          <div className="mb-2">
            {quote.approvedAt ? (
              <span className="badge bg-success">Aprobada</span>
            ) : quote.needsReview ? (
              <span className="badge bg-primary">Revisar</span>
            ) : quote.rejected ? (
              <span className="badge bg-danger">Rechazada</span>
            ) : (
              <span className="badge bg-secondary">Pendiente</span>
            )}
          </div>

          <div><strong>Cliente:</strong> {quote.client}</div>
          <div className="mt-1">
            <strong>Total:</strong> {quote.total} {quote.currency || 'CLP'}
            {quote.currency && quote.currency !== 'CLP' && (quote.totalInCLP || quote.currencyRate) && (
              <div className="text-muted">
                <small>≈ {formatCLP(quote.totalInCLP || (Number(quote.total||0) * Number(quote.currencyRate||0)))} (factor: {quote.currencyRate || '-'})</small>
              </div>
            )}
          </div>
          <hr />

          <div className="mb-2">
            <label>Código de seguridad (6 dígitos)</label>
            <input className="form-control" value={code} onChange={e=>setCode(e.target.value)} />
          </div>
          <div className="mb-2">
            <label>Su nombre</label>
            <input className="form-control" value={nombre} onChange={e=>setNombre(e.target.value)} />
          </div>

          <div className="mb-2">
            <label>Prepago {quote.isRequiredPrepayment ? '(requerido)' : '(opcional)'}</label>
            <input
              type="number"
              className="form-control"
              value={prepago}
              onChange={e=>setPrepago(Number(e.target.value))}
              disabled={!quote.isRequiredPrepayment}
              placeholder={quote.isRequiredPrepayment && Number(quote.prepaymentValue) > 0 ? String(quote.prepaymentValue) : ''}
            />
            {Number(quote.prepaymentValue) > 0 && (
              <div className="text-muted mt-1">
                <small>
                  Esperado: {quote.prepaymentValue} {quote.currency || 'CLP'}
                  {quote.currency && quote.currency !== 'CLP' && (quote.currencyRate) && (
                    <> — ≈ {formatCLP(Number(quote.prepaymentValue||0) * Number(quote.currencyRate||0))} (factor: {quote.currencyRate})</>
                  )}
                </small>
              </div>
            )}
          </div>

          <div className="d-flex gap-2">
            <button className="btn btn-success" onClick={submitAccept} disabled={!!quote.approvedAt}>Aceptar cotización</button>
            {!rejectMode ? (
              <button className="btn btn-danger" onClick={submitReject} disabled={!!quote.approvedAt || !!quote.rejected}>Rechazar</button>
            ) : (
              <button className="btn btn-secondary" onClick={()=>{ setRejectMode(false); setMotivo('') }}>Cancelar</button>
            )}
          </div>

          {rejectMode && (
            <div className="mt-3">
              <div className="alert alert-warning py-2">Indique el motivo</div>
              <label className="form-label">Motivo del rechazo</label>
              <div className="input-group">
                <input type="text" className="form-control" value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Describa por qué rechaza la cotización" />
                <button className="btn btn-danger" type="button" onClick={submitReject} disabled={!motivo}>Enviar rechazo</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
