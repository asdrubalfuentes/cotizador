import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function QuotesList({ onEdit }){
  const [quotes, setQuotes] = useState([])
  useEffect(()=> refresh(), [])
  function refresh(){ axios.get('/api/quotes').then(r=>setQuotes(r.data)).catch(()=>setQuotes([])) }

  function download(q){ window.open(`/outputs/pdfs/${q.file.replace('.json','.pdf')}`, '_blank') }
  function remove(_q){ if(confirm('Marcar como no viewable?')){ /* TODO: API call to mark */ alert('Marcado (no implementado)') } }
  function copy(q){ axios.get(`/api/quotes/${q.file}`).then(r=> onEdit && onEdit({...r.data, quoteNumber: ''})).catch(()=>{}) }

  return (
    <div className="container py-3">
      <h3>Cotizaciones</h3>
      <div className="accordion" id="quotesAccordion">
        {quotes.map((q, idx)=> {
          const statusBadge = q.approvedAt
            ? <span className="badge bg-success ms-2">Aprobada</span>
            : q.rejected
              ? <span className="badge bg-danger ms-2" title={q.rejectedReason || ''}>Rechazada</span>
              : <span className="badge bg-secondary ms-2">Pendiente</span>;
          return (
            <div key={q.file} className="accordion-item">
              <h2 className="accordion-header">
                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target={`#c${idx}`}>
                  {q.quoteNumber} — {q.client || ''} — {q.currency || ''} {q.total || ''} {statusBadge}
                </button>
              </h2>
              <div id={`c${idx}`} className="accordion-collapse collapse">
                <div className="accordion-body">
                  {q.approvedAt && <div className="alert alert-success">ACEPTADA por {q.approvedBy} el {q.approvedAt}</div>}
                  {q.rejected && <div className="alert alert-danger">RECHAZADA por {q.rejectedBy || 'Web'} el {q.rejectedAt || ''}{q.rejectedReason ? ` — Motivo: ${q.rejectedReason}` : ''}</div>}
                  <div className="mb-2"><small className="text-muted">Token: {(q.token||'').slice(0,12)}...</small></div>
                  <button className="btn btn-sm btn-primary me-1" onClick={()=>download(q)}>Descargar PDF</button>
                  <button className="btn btn-sm btn-secondary me-1" onClick={()=>axios.get(`/api/quotes/${q.file}`).then(r=>onEdit && onEdit(r.data))}>Editar</button>
                  <button className="btn btn-sm btn-info me-1" onClick={()=>copy(q)}>Copiar</button>
                  <button className="btn btn-sm btn-danger" onClick={()=>remove(q)}>Borrar</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
