import React, { useEffect, useMemo, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export default function Protected({ roles, children }){
  const { user, hydrated, setUser, setToken } = useAuth() || {}
  const hasAnyToken = useMemo(() => {
    if (typeof window === 'undefined') return false
    const adminT = localStorage.getItem('admin_token')
    const userT = localStorage.getItem('auth_token')
    return !!(adminT || userT)
  }, [])
  const triedRef = useRef(false)
  // Si hay token pero user es null, intenta rehidratar desde localStorage una vez
  useEffect(() => {
    if (!hydrated) return
    if (user) return
    if (!hasAnyToken) return
    if (triedRef.current) return
    triedRef.current = true
    try {
      const adminT = localStorage.getItem('admin_token')
      if (adminT) {
        try { setToken && setToken(adminT) } catch (e) { /* noop */ }
        try { setUser && setUser({ role:'admin', name:'Admin' }) } catch (e) { /* noop */ }
        return
      }
      const t = localStorage.getItem('auth_token')
      const u = localStorage.getItem('auth_user')
      if (t && u) {
        try { setToken && setToken(t) } catch (e) { /* noop */ }
        try { setUser && setUser(JSON.parse(u)) } catch (e) { /* noop */ }
      }
    } catch (e) { /* noop */ }
  }, [hydrated, user, hasAnyToken, setToken, setUser])
  if (!hydrated) return <div className="p-3 text-muted">Cargando…</div>
  // Evitar rebote: si hay token en storage pero todavía no se hidrata user, esperar
  if (!user && hasAnyToken) return <div className="p-3 text-muted">Cargando…</div>
  if (!user) return <Navigate to="/ingreso" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/ingreso" replace />
  return children
}


