import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useSearchParams } from 'react-router-dom'

export default function AcceptQuoteView(){
  const [params] = useSearchParams()
  const file = params.get('file')
  const token = params.get('token')
  const [quote, setQuote] = useState(null)
  const [code, setCode] = useState('')
  const [prepago, setPrepago] = useState(0)
  const [message, setMessage] = useState('')

  useEffect(()=>{
    if(!file) return
    axios.get(`/api/quotes/${file}`).then(r=>{
      setQuote(r.data)
      if(r.data && r.data.token){
        const c = r.data.token.slice(-6)
        setCode(c)
      }
    }).catch(()=>setMessage('No se encontró la cotización'))
  },[file])

  function submitAccept(){
    if(!token && code.length!==6){ setMessage('Se requiere token o código de 6 dígitos'); return }
    const code6 = token ? token.slice(-6) : code
    axios.post(`/api/quotes/${file}/approve`, { code6, approverName: 'Cliente web', prepayment: prepago }).then(r=>{
      setMessage('Cotización aceptada. Gracias.');
    }).catch(e=> setMessage(e.response?.data?.error || 'Error al procesar'))
  }

  function submitReject(){
    const code6 = token ? token.slice(-6) : code
    axios.post(`/api/quotes/${file}/approve`, { code6, reject:true, reason:'Rechazo vía web' }).then(()=> setMessage('Se registró el rechazo')).catch(e=> setMessage('Error'))
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
          <div><strong>Cliente:</strong> {quote.client}</div>
          <div><strong>Total:</strong> {quote.total}</div>
          <hr />
          <div className="mb-2">
            <label>Código de seguridad (6 dígitos)</label>
            <input className="form-control" value={code} onChange={e=>setCode(e.target.value)} />
          </div>
          <div className="mb-2">
            <label>Prepago (opcional)</label>
            <input type="number" className="form-control" value={prepago} onChange={e=>setPrepago(Number(e.target.value))} />
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-success" onClick={submitAccept}>Aceptar cotización</button>
            <button className="btn btn-danger" onClick={submitReject}>Rechazar</button>
          </div>
        </div>
      )}
    </div>
  )
}
