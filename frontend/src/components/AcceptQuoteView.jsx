import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { apiUrl, eventsUrl } from '../utils/config'
import { useSearchParams } from 'react-router-dom'
import { formatRelativeShortEs } from '../utils/time'
import { createSSE, flashElement } from '../utils/sse'
import { formatAmount, formatNumberDot, formatRate } from '../utils/number'

export default function AcceptQuoteView(){
  const [params] = useSearchParams()
  const file = params.get('file')
  const token = params.get('token')
  const [quote, setQuote] = useState(null)
  const [prepago, setPrepago] = useState(0)
  const [refPago, setRefPago] = useState('')
  const [nombre, setNombre] = useState('')
  const [motivo, setMotivo] = useState('')
  const [rejectMode, setRejectMode] = useState(false)
  const [message, setMessage] = useState('')
  const isTestEnv = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE === 'test')

  useEffect(()=>{
    if(!file) return
    axios.get(apiUrl(`/api/quotes/${file}`)).then(r=>{
      setQuote(r.data)
    }).catch(()=>setMessage('No se encontró la cotización'))
  },[file])

  // SSE subscription: refresh this view when the same quote changes
  useEffect(() => {
    if (isTestEnv) return
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
  const closeable = createSSE(eventsUrl(), {
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
  const r = await axios.get(apiUrl(`/api/quotes/${file}`))
      setQuote(r.data)
    } catch (_e) { /* noop */ }
  }

  function submitAccept(){
    if(!token){ setMessage('Falta token de seguridad. Use el enlace del email.'); return }
    const isExpired = !!(quote?.validDays && quote?.expires_at && new Date() > new Date(quote.expires_at))
    if (isExpired) { setMessage('La cotización ha vencido. Solicite una nueva versión.'); return }
    // Validaciones de prepago
    if (quote?.isRequiredPrepayment) {
      if (Number(prepago) !== Number(quote?.prepaymentValue)) {
        setMessage('El prepago debe coincidir con el monto solicitado.');
        return;
      }
      if (!refPago || String(refPago).trim() === '') {
        setMessage('Ingrese la referencia del pago (ej. número de comprobante).');
        return;
      }
    }
    const code6 = token.slice(-6)
    axios.post(apiUrl(`/api/quotes/${file}/approve`), { code6, approverName: nombre, prepayment: prepago, prepaymentRef: refPago }).then(r=>{
      if (r.data && r.data.needsReview) {
        setMessage('Solicitud enviada para revisión por la empresa proveedora.')
      } else {
        setMessage('Cotización aceptada. Gracias.')
      }
      reloadQuote()
    }).catch(e=> {
      const err = e.response?.data?.error
      if (err === 'expired') setMessage('La cotización ha vencido. Solicite una nueva versión.')
      else if (err === 'invalid prepayment') setMessage('El prepago no coincide con lo solicitado.')
      else if (err === 'missing prepayment_ref') setMessage('Falta la referencia del pago.')
      else if (err === 'invalid code') setMessage('Token inválido. Use el enlace del email.')
      else setMessage('Error al procesar')
    })
  }

  function submitReject(){
    if (quote?.rejected) return; // si ya está rechazada, no permit
    if (!rejectMode) { setRejectMode(true); return }
    if(!motivo){ setMessage('Indique el motivo'); return }
    if(!token){ setMessage('Falta token de seguridad. Use el enlace del email.'); return }
    const code6 = token.slice(-6)
    axios.post(apiUrl(`/api/quotes/${file}/approve`), { code6, reject:true, reason: motivo || 'Rechazo vía web', approverName: nombre })
      .then(()=> { setMessage('Se registró el rechazo'); setRejectMode(false); setMotivo(''); reloadQuote() })
      .catch(_e=> setMessage('Error'))
  }

  function formatCLP(n){ return `${formatNumberDot(n, 0)} CLP` }

  const code = quote?.quoteNumber || (file ? String(file).replace('.json','') : '')
  const pdfUrl = file ? apiUrl(`/api/quotes/${file}/pdf`) : null
  const pdfInlineUrl = file ? apiUrl(`/api/quotes/${file}/pdf?inline=1`) : null

  return (
    <div className="container py-4">
      <h3 className="mb-2">{code ? `Cotización ${code}` : 'Aceptar Cotización'}</h3>
      {(pdfUrl || pdfInlineUrl) && (
        <div className="mb-3">
          <div className="d-none d-lg-block">
            <iframe title="Cotización PDF" src={pdfInlineUrl || pdfUrl} style={{width:'100%', height: '70vh', border:'1px solid #e5e5e5'}} />
          </div>
          <div className="d-lg-none">
            <a className="btn btn-sm btn-outline-secondary" href={pdfUrl} target="_blank" rel="noreferrer">Ver PDF de la cotización</a>
          </div>
        </div>
      )}
      <h4 className="mb-3">Aceptar Cotización</h4>
      {message && <div className="alert alert-info">{message}</div>}
      {!quote ? (
        <div>Buscando cotización...</div>
      ) : (
        <div className="card p-3">
          <h5>{quote.reference || 'Cotización'}</h5>
          <div className="text-muted mb-1"><small>Actualizada {formatRelativeShortEs(quote.saved_at || quote.created_at)}</small></div>
          {quote.validDays && (
            <div className="text-muted mb-1"><small>Vigencia: {quote.validDays} días hábiles{quote.expires_at ? ` (vence el ${new Date(quote.expires_at).toLocaleDateString('es-CL')})` : ''}</small></div>
          )}
          {quote.validDays && quote.expires_at && new Date() > new Date(quote.expires_at) && (
            <div className="alert alert-warning py-2">Esta cotización ha vencido. Solicite una nueva versión.</div>
          )}
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
            <strong>Total:</strong> {formatAmount(quote.total, quote.currency || 'CLP')}
            {quote.currency && quote.currency !== 'CLP' && (quote.totalInCLP || quote.currencyRate) && (
              <div className="text-muted">
                <small>≈ {formatCLP(quote.totalInCLP || (Number(quote.total||0) * Number(quote.currencyRate||0)))} (factor: {quote.currencyRate ? formatRate(quote.currencyRate) : '-'})</small>
              </div>
            )}
          </div>
          <hr />

          <div className="mb-2">
            <label>Código de seguridad</label>
            <input className="form-control" value={(token||'').slice(-6)} disabled readOnly />
            <div className="form-text">Se valida automáticamente desde el enlace del correo.</div>
          </div>
          <div className="mb-2">
            <label>Su nombre</label>
            <input className="form-control" value={nombre} onChange={e=>setNombre(e.target.value)} />
          </div>

          <div className="mb-2">
            <label>Monto Pagado como Anticipo {quote.isRequiredPrepayment ? '(requerido)' : '(opcional)'}</label>
            <input
              type="number"
              className="form-control"
              value={prepago}
              onChange={e=>setPrepago(Number(e.target.value))}
              disabled={!quote.isRequiredPrepayment}
              placeholder={quote.isRequiredPrepayment && Number(quote.prepaymentValue) > 0 ? String(quote.prepaymentValue) : ''}
            />
            {quote.isRequiredPrepayment && (
              <div className="mt-2">
                <label>Referencia del pago</label>
                <input
                  type="text"
                  className="form-control"
                  value={refPago}
                  onChange={e=>setRefPago(e.target.value)}
                  placeholder="Número de comprobante / referencia bancaria"
                />
              </div>
            )}
            {Number(quote.prepaymentValue) > 0 && (
              <div className="text-muted mt-1">
                <small>
                  Monto solicitado mínimo: {formatAmount(quote.prepaymentValue, quote.currency || 'CLP')}
                  {quote.currency && quote.currency !== 'CLP' && (quote.currencyRate) && (
                    <> — ≈ {formatCLP(Number(quote.prepaymentValue||0) * Number(quote.currencyRate||0))} (factor: {formatRate(quote.currencyRate)})</>
                  )}
                </small>
              </div>
            )}
          </div>

          <div className="d-flex gap-2">
            <button className="btn btn-success" onClick={submitAccept} disabled={!!quote.approvedAt || (!!quote.validDays && !!quote.expires_at && new Date() > new Date(quote.expires_at))}>Aceptar cotización</button>
            {!rejectMode ? (
              <button className="btn btn-danger" onClick={submitReject} disabled={!!quote.approvedAt || !!quote.rejected || (!!quote.validDays && !!quote.expires_at && new Date() > new Date(quote.expires_at))}>Rechazar</button>
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
