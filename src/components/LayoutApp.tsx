import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import logo from '../assets/logo.png'
import { supabase } from '../lib/supabase'
import { MENU, type ItemMenu } from '../lib/modulos'
import { rotuloPapel, usePermissoes } from '../lib/permissoes'
import { cx } from './ui'

const GRUPOS: ItemMenu['grupo'][] = ['Operação', 'Pessoas', 'Financeiro', 'Administração']

function MenuLateral({ aoNavegar }: { aoNavegar?: () => void }) {
  const { pode } = usePermissoes()
  const itens = MENU.filter((i) => pode(i.modulo))
  return (
    <nav aria-label="Menu principal" className="flex-1 overflow-y-auto px-3 pb-4">
      {GRUPOS.map((grupo) => {
        const doGrupo = itens.filter((i) => i.grupo === grupo)
        if (doGrupo.length === 0) return null
        return (
          <div key={grupo} className="mt-5">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-acqua-petroleo">{grupo}</p>
            <ul className="space-y-0.5">
              {doGrupo.map((item) => (
                <li key={item.rota}>
                  <NavLink
                    to={item.rota}
                    end={item.rota === '/'}
                    onClick={aoNavegar}
                    className={({ isActive }) =>
                      cx(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                        isActive
                          ? 'bg-acqua-titulo text-white shadow-sm'
                          : 'text-acqua-titulo hover:bg-acqua-suave',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icone className={cx('h-[18px] w-[18px] shrink-0', isActive ? 'text-acqua-dourado' : 'text-acqua-icone')} />
                        <span className="flex-1">{item.rotulo}</span>
                        {item.emBreve && (
                          <span className={cx('text-[10px] font-semibold uppercase', isActive ? 'text-white/70' : 'text-slate-400')}>em breve</span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

function Usuario() {
  const { perfil } = usePermissoes()
  return (
    <div className="border-t border-acqua-suave p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-acqua-suave font-semibold text-acqua-titulo">
          {(perfil?.nome || perfil?.email || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-acqua-titulo">{perfil?.nome || perfil?.email}</p>
          <p className="text-xs text-slate-500">{rotuloPapel(perfil?.papel)}</p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-lg p-2 text-acqua-icone hover:bg-acqua-suave hover:text-acqua-titulo"
          aria-label="Sair"
          title="Sair"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

export default function LayoutApp() {
  const [menuAberto, setMenuAberto] = useState(false)
  const local = useLocation()
  const atual = MENU.find((i) => (i.rota === '/' ? local.pathname === '/' : local.pathname.startsWith(i.rota)))

  useEffect(() => setMenuAberto(false), [local.pathname])

  return (
    <div className="min-h-screen bg-acqua-gelo lg:flex">
      {/* Menu fixo no computador */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-acqua-suave bg-white lg:flex">
        <div className="px-6 pb-2 pt-5">
          <img src={logo} alt="Acqua Bistrô" className="h-16" />
          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-acqua-titulo">Sistema administrativo</p>
          <span className="mt-2 block h-px w-12 bg-acqua-dourado" />
        </div>
        <MenuLateral />
        <Usuario />
      </aside>

      {/* Menu deslizante no celular */}
      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-acqua-titulo/40" onClick={() => setMenuAberto(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 pt-4">
              <img src={logo} alt="Acqua Bistrô" className="h-12" />
              <button onClick={() => setMenuAberto(false)} className="rounded p-2 text-acqua-titulo hover:bg-acqua-suave" aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <MenuLateral aoNavegar={() => setMenuAberto(false)} />
            <Usuario />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topo */}
        <header
          className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-acqua-suave bg-white/90 px-4 backdrop-blur sm:px-6"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <button onClick={() => setMenuAberto(true)} className="rounded-lg p-2 text-acqua-titulo hover:bg-acqua-suave lg:hidden" aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          <img src={logo} alt="" className="h-8 lg:hidden" />
          <p className="hidden text-sm font-semibold text-acqua-titulo lg:block">{atual?.rotulo}</p>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[10px] uppercase tracking-[0.3em] text-acqua-titulo sm:inline">Acqua Bistrô</span>
            <span className="hidden h-px w-10 bg-acqua-dourado sm:inline-block" />
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
