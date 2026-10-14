import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

type EstadoAuth = {
  sessao: Session | null
  carregando: boolean
}

const AuthContext = createContext<EstadoAuth>({ sessao: null, carregando: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoAuth>({ sessao: null, carregando: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEstado({ sessao: data.session, carregando: false })
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setEstado({ sessao, carregando: false })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={estado}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
