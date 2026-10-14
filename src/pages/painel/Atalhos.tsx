import { Link } from 'react-router-dom'
import { Coffee, FileText, HandCoins, PartyPopper, ShoppingCart, Wallet } from 'lucide-react'
import { MENU } from '../../lib/modulos'
import { usePermissoes } from '../../lib/permissoes'

const ATALHOS = [
  { rotulo: 'Novo café', rota: '/cafes', modulo: 'cafes', icone: Coffee },
  { rotulo: 'Novo vale', rota: '/caixa', modulo: 'caixa', icone: HandCoins, parametro: 'vale' },
  { rotulo: 'Nova retirada', rota: '/caixa', modulo: 'caixa', icone: Wallet, parametro: 'retirada' },
  { rotulo: 'Nova compra', rota: '/compras', modulo: 'compras', icone: ShoppingCart },
  { rotulo: 'Novo evento', rota: '/eventos', modulo: 'eventos', icone: PartyPopper },
  { rotulo: 'Gerar documento', rota: '/documentos', modulo: 'documentos', icone: FileText },
]

/** Atalhos do briefing. Só aparecem para quem pode criar no módulo e quando o módulo já existe. */
export default function Atalhos() {
  const { pode } = usePermissoes()
  const prontos = new Set(MENU.filter((m) => !m.emBreve).map((m) => m.rota))
  const visiveis = ATALHOS.filter((a) => pode(a.modulo, 'criar') && prontos.has(a.rota))
  if (visiveis.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {visiveis.map((a) => (
        <Link
          key={a.rotulo}
          to={`${a.rota}?novo=${a.parametro ?? '1'}`}
          className="flex items-center gap-2 rounded-xl border border-acqua-suave bg-white px-3 py-3 text-sm font-semibold text-acqua-titulo shadow-sm transition hover:border-acqua hover:bg-acqua-gelo"
        >
          <a.icone className="h-5 w-5 shrink-0 text-acqua-dourado" />
          {a.rotulo}
        </Link>
      ))}
    </div>
  )
}
