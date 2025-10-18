import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const AuthCtx = createContext(null)

export function AuthProvider({ children }){
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Admin only (token sin user)
    const adminToken = localStorage.getItem('admin_token')
    if (adminToken) {
      setUser({ role:'admin', name:'Admin' })
      setToken(adminToken)
      // No return: permitimos además chequear credenciales de usuario si existen
    }
    const t = localStorage.getItem('auth_token')
    const u = localStorage.getItem('auth_user')
    if (t && u) {
      setToken(t)
      try { setUser(JSON.parse(u)) } catch { /* ignore parse error */ }
    }
    setHydrated(true)
  }, [])

  const value = useMemo(() => ({ user, token, setUser, setToken, hydrated }), [user, token, hydrated])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(){
  return useContext(AuthCtx)
}
