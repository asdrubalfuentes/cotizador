import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { apiUrl } from '../utils/config'
import { formatNumberDot } from '../utils/number'

export default function ItemsManager(){
  const [items, setItems] = useState([])

  useEffect(()=>{ refresh() }, [])
  function refresh(){ axios.get(apiUrl('/api/items')).then(r=>setItems(r.data)).catch(()=>setItems([])) }

  function add(){
    const it = { description: 'Nuevo Item', cantidad:1, descuento:0, precio:0 }
  axios.post(apiUrl('/api/items'), it).then(()=>refresh())
  }

  function remove(id){ axios.delete(apiUrl('/api/items/'+id)).then(()=>refresh()) }

  function clone(it){ const copy = {...it}; delete copy.id; axios.post(apiUrl('/api/items'), copy).then(()=>refresh()) }

  return (
    <div className="container py-3">
      <h3>Items (CRUD)</h3>
      <button className="btn btn-sm btn-success mb-2" onClick={add}>Agregar Item</button>
      <div className="list-group">
        {items.map(it=> (
          <div key={it.id} className="list-group-item d-flex justify-content-between align-items-center">
            <div>
              <strong>{it.description}</strong>
              <div className="small text-muted">{formatNumberDot(it.cantidad)} x {formatNumberDot(it.precio)} - {formatNumberDot(it.descuento)}%</div>
            </div>
            <div>
              <button className="btn btn-sm btn-outline-primary me-1" onClick={()=>clone(it)}>Clonar</button>
              <button className="btn btn-sm btn-outline-danger" onClick={()=>remove(it.id)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
