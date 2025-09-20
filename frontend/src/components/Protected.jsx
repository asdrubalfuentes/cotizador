import React from 'react'
import { Navigate } from 'react-router-dom'

export default function Protected({ children }){
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
  if(!token){
    return <Navigate to="/admin/login" replace />
  }
  return children
}


