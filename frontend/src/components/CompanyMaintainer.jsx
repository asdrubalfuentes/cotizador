import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { apiUrl } from '../utils/config'

export default function CompanyMaintainer(){
  const [empresas, setEmpresas] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    address: '',
    phone: '',
    taxId: '',
    logo: '',
    paymentDetails: '',
    terms: ''
  })

  useEffect(() => {
    loadEmpresas()
  }, [])

  function loadEmpresas() {
    axios.get(apiUrl('/api/empresa')).then(r => setEmpresas(r.data)).catch(() => {})
  }

  function getAuthHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('logo', file)

    axios.post(apiUrl('/api/upload/logo'), formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    .then(response => {
      if (response.data && response.data.filename) {
        setFormData(prev => ({ ...prev, logo: response.data.filename }))
      }
    })
    .catch(() => alert('Error al subir el logo'))
  }

  function save() {
    const url = editingId ? apiUrl(`/api/empresa/${editingId}`) : apiUrl('/api/empresa')
    const method = editingId ? 'put' : 'post'

    axios[method](url, formData, { headers: getAuthHeaders() })
      .then(() => {
        alert(editingId ? 'Empresa actualizada' : 'Empresa creada')
        resetForm()
        loadEmpresas()
      })
      .catch(() => alert('Error'))
  }

  function edit(empresa) {
    setFormData({
      name: empresa.name || '',
      email: empresa.email || '',
      address: empresa.address || '',
      phone: empresa.phone || '',
      taxId: empresa.taxId || '',
      logo: empresa.logo || '',
      paymentDetails: empresa.paymentDetails || '',
      terms: empresa.terms || ''
    })
    setEditingId(empresa.id)
  }

  function copy(empresa) {
    setFormData({
      name: `${empresa.name} (Copia)`,
      email: empresa.email || '',
      address: empresa.address || '',
      phone: empresa.phone || '',
      taxId: empresa.taxId || '',
      logo: empresa.logo || '',
      paymentDetails: empresa.paymentDetails || '',
      terms: empresa.terms || ''
    })
    setEditingId(null)
  }

  function deleteEmpresa(id) {
    if (!confirm('¿Estás seguro de eliminar esta empresa?')) return

    axios.delete(apiUrl(`/api/empresa/${id}`), { headers: getAuthHeaders() })
      .then(() => {
        alert('Empresa eliminada')
        loadEmpresas()
      })
      .catch(() => alert('Error'))
  }

  function resetForm() {
    setFormData({
      name: '',
      email: '',
      address: '',
      phone: '',
      taxId: '',
      logo: '',
      paymentDetails: '',
      terms: ''
    })
    setEditingId(null)
  }

  return (
    <div className="container py-3">
      <div className="row">
        <div className="col-md-6">
          <h3>{editingId ? 'Editar Empresa' : 'Nueva Empresa'}</h3>

          <div className="mb-3">
            <label className="form-label">Nombre *</label>
            <input className="form-control" value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})} />
          </div>

          <div className="mb-3">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={formData.email} onChange={e=>setFormData({...formData,email:e.target.value})} />
          </div>

          <div className="mb-3">
            <label className="form-label">Dirección</label>
            <textarea className="form-control" rows="2" value={formData.address} onChange={e=>setFormData({...formData,address:e.target.value})} />
          </div>

          <div className="mb-3">
            <label className="form-label">Teléfono</label>
            <input className="form-control" value={formData.phone} onChange={e=>setFormData({...formData,phone:e.target.value})} />
          </div>

          <div className="mb-3">
            <label className="form-label">RUT *</label>
            <input className="form-control" value={formData.taxId} onChange={e=>setFormData({...formData,taxId:e.target.value})} />
          </div>

          <div className="mb-3">
            <label className="form-label">Logo</label>
            <div className="d-flex align-items-center">
              <input
                type="file"
                className="form-control me-2"
                accept="image/*"
                onChange={handleLogoUpload}
                id="logo-upload"
              />
              <label htmlFor="logo-upload" className="btn btn-outline-secondary mb-0">
                Seleccionar
              </label>
            </div>
            {formData.logo && (
              <div className="mt-2">
                <small className="text-muted">Archivo actual: {formData.logo}</small>
                <img
                  src={apiUrl(`/outputs/logos/${formData.logo}`)}
                  alt="Logo preview"
                  style={{width: 50, height: 50, objectFit: 'contain', marginLeft: 10}}
                  onError={(e) => e.target.style.display = 'none'}
                />
              </div>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label">Detalles de Pago</label>
            <textarea className="form-control" rows="3" value={formData.paymentDetails} onChange={e=>setFormData({...formData,paymentDetails:e.target.value})} />
          </div>

          <div className="mb-3">
            <label className="form-label">Términos y Condiciones</label>
            <textarea className="form-control" rows="4" value={formData.terms} onChange={e=>setFormData({...formData,terms:e.target.value})} />
          </div>

          <div className="mb-3">
            <button className="btn btn-primary me-2" onClick={save} disabled={!formData.name || !formData.taxId}>
              {editingId ? 'Actualizar' : 'Crear'} Empresa
            </button>
            {editingId && (
              <button className="btn btn-secondary" onClick={resetForm}>Cancelar</button>
            )}
          </div>
        </div>

        <div className="col-md-6">
          <h3>Empresas Registradas</h3>
          {empresas.length === 0 ? (
            <p className="text-muted">No hay empresas registradas</p>
          ) : (
            <div className="list-group">
              {empresas.map(empresa => (
                <div key={empresa.id} className="list-group-item">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <h6 className="mb-1">{empresa.name}</h6>
                      <small className="text-muted">RUT: {empresa.taxId}</small>
                    </div>
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-outline-primary" onClick={() => edit(empresa)} title="Editar">
                        ✏️
                      </button>
                      <button className="btn btn-outline-secondary" onClick={() => copy(empresa)} title="Copiar">
                        📋
                      </button>
                      <button className="btn btn-outline-danger" onClick={() => deleteEmpresa(empresa.id)} title="Eliminar">
                        🗑️
                      </button>
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
