import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './pages/Login'
import EsqueciSenha from './pages/EsqueciSenha'
import RedefinirSenha from './pages/RedefinirSenha'
import Inicio from './pages/Inicio'

function SoLogado({ children }: { children: ReactNode }) {
  const { sessao, carregando } = useAuth()
  if (carregando) return <Carregando />
  return sessao ? children : <Navigate to="/login" replace />
}

function SoDeslogado({ children }: { children: ReactNode }) {
  const { sessao, carregando } = useAuth()
  if (carregando) return <Carregando />
  return sessao ? <Navigate to="/" replace /> : children
}

function Carregando() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-acqua-gelo text-acqua-profundo" role="status">
      Carregando…
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<SoDeslogado><Login /></SoDeslogado>} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          <Route path="/" element={<SoLogado><Inicio /></SoLogado>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
