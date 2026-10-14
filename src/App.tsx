import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, type ReactNode } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { PermissoesProvider, usePermissoes } from './lib/permissoes'
import { MENU } from './lib/modulos'
import { Carregando } from './components/ui'
import LayoutApp from './components/LayoutApp'
import Login from './pages/Login'
import EsqueciSenha from './pages/EsqueciSenha'
import RedefinirSenha from './pages/RedefinirSenha'
import SemAcesso from './pages/SemAcesso'
import EmBreve from './pages/EmBreve'

// Cada área é carregada só quando aberta (site mais leve no celular).
const Painel = lazy(() => import('./pages/painel/Painel'))
const Usuarios = lazy(() => import('./pages/admin/Usuarios'))
const Permissoes = lazy(() => import('./pages/admin/Permissoes'))
const Auditoria = lazy(() => import('./pages/admin/Auditoria'))
const Colaboradores = lazy(() => import('./pages/colaboradores'))
const EscalasPonto = lazy(() => import('./pages/escalas'))
const Cafes = lazy(() => import('./pages/cafes'))
const Caixa = lazy(() => import('./pages/caixa'))
const Compras = lazy(() => import('./pages/compras'))
const CartaoEmpresa = lazy(() => import('./pages/cartoes'))
const Eventos = lazy(() => import('./pages/eventos'))
const Documentos = lazy(() => import('./pages/documentos'))
const PainelFinanceiro = lazy(() => import('./pages/financeiro'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

function TelaCheia() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-acqua-gelo">
      <Carregando />
    </div>
  )
}

/** Exige login e perfil ativo; dentro disso, mostra o layout do sistema. */
function AreaLogada() {
  const { sessao, carregando } = useAuth()
  const { perfil, carregando: carregandoPerfil } = usePermissoes()
  if (carregando || (sessao && carregandoPerfil)) return <TelaCheia />
  if (!sessao) return <Navigate to="/login" replace />
  if (!perfil?.ativo) return <SemAcesso desativado />
  return <LayoutApp />
}

/** Libera a página só para quem tem a permissão "ver" do módulo. */
function Protegido({ modulo, children }: { modulo: string; children: ReactNode }) {
  const { pode } = usePermissoes()
  return pode(modulo) ? <Suspense fallback={<Carregando />}>{children}</Suspense> : <SemAcesso />
}

function SoDeslogado({ children }: { children: ReactNode }) {
  const { sessao, carregando } = useAuth()
  if (carregando) return <TelaCheia />
  return sessao ? <Navigate to="/" replace /> : children
}

const PAGINAS: Record<string, ReactNode> = {
  '/': <Painel />,
  '/usuarios': <Usuarios />,
  '/permissoes': <Permissoes />,
  '/auditoria': <Auditoria />,
  '/colaboradores': <Colaboradores />,
  '/escalas': <EscalasPonto />,
  '/cafes': <Cafes />,
  '/caixa': <Caixa />,
  '/compras': <Compras />,
  '/cartoes': <CartaoEmpresa />,
  '/eventos': <Eventos />,
  '/documentos': <Documentos />,
  '/financeiro': <PainelFinanceiro />,
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PermissoesProvider>
          <HashRouter>
            <Routes>
              <Route path="/login" element={<SoDeslogado><Login /></SoDeslogado>} />
              <Route path="/esqueci-senha" element={<EsqueciSenha />} />
              <Route path="/redefinir-senha" element={<RedefinirSenha />} />
              <Route element={<AreaLogada />}>
                {MENU.map((item) => (
                  <Route
                    key={item.rota}
                    path={item.rota === '/' ? '/' : `${item.rota}/*`}
                    element={<Protegido modulo={item.modulo}>{PAGINAS[item.rota] ?? <EmBreve titulo={item.rotulo} />}</Protegido>}
                  />
                ))}
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
        </PermissoesProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
