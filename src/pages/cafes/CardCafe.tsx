import { Link } from 'react-router-dom'
import { Coffee } from 'lucide-react'
import { formatarMoeda } from '../../lib/formatos'
import { descreverPeriodo } from '../../lib/periodos'
import { resumirQuinzena } from '../../lib/cafe'
import { Cartao, Carregando } from '../../components/ui'
import type { FiltroPainel } from '../painel/filtro'
import { ROTULO_FORMA, useTabelaPeriodo, type Ajuste, type CafeDia, type ConsumoQuarto, type Venda } from './dados'

/** Card do painel: cafés do período (hotel, tickets, por fora, borderô) e recebimentos por forma de pagamento. */
export default function CardCafe({ filtro }: { filtro: FiltroPainel }) {
  const dias = useTabelaPeriodo<CafeDia>('cafe_dias', filtro.inicio, filtro.fim)
  const ajustes = useTabelaPeriodo<Ajuste>('cafe_ajustes', filtro.inicio, filtro.fim, { coluna: 'situacao', valor: 'registrado' })
  const bordero = useTabelaPeriodo<ConsumoQuarto>('consumos_quarto', filtro.inicio, filtro.fim, { coluna: 'situacao', valor: 'registrado' })
  const vendas = useTabelaPeriodo<Venda>('cafe_vendas', filtro.inicio, filtro.fim, { coluna: 'situacao', valor: 'registrado' })
  const r = resumirQuinzena(dias.data ?? [], ajustes.data ?? [], bordero.data ?? [])
  const pagas = (vendas.data ?? []).filter((v) => v.pago)
  const porForma = pagas.reduce<Record<string, number>>((m, v) => ({ ...m, [v.forma ?? 'outro']: (m[v.forma ?? 'outro'] ?? 0) + Number(v.valor_total) }), {})
  const aReceber = (vendas.data ?? []).filter((v) => !v.pago).reduce((s, v) => s + Number(v.valor_total), 0)

  return (
    <Cartao
      titulo={<span className="flex items-center gap-2"><Coffee className="h-5 w-5 text-acqua-dourado" /> Café · {descreverPeriodo(filtro.escala, filtro.data)}</span>}
      acoes={<Link to="/cafes" className="link text-xs">Abrir</Link>}
    >
      {dias.isLoading || vendas.isLoading ? (
        <Carregando />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <Numero rotulo="Servidos (hotel)" valor={String(r.servidos)} />
            <Numero rotulo="Tickets" valor={String(r.tickets)} />
            <Numero rotulo="Pagos na hora" valor={String(pagas.reduce((s, v) => s + v.quantidade, 0))} />
          </div>
          <dl className="space-y-1 text-sm">
            <Linha rotulo="A cobrar do hotel" valor={formatarMoeda(r.total)} forte />
            <Linha rotulo="· por fora da lista" valor={formatarMoeda(r.ajustes)} />
            <Linha rotulo="· borderô" valor={formatarMoeda(r.bordero)} />
            {Object.entries(porForma).map(([f, v]) => (
              <Linha key={f} rotulo={`Recebido em ${ROTULO_FORMA[f]?.toLowerCase()}`} valor={formatarMoeda(v)} />
            ))}
            {aReceber > 0 && <Linha rotulo="A receber de mensalistas" valor={formatarMoeda(aReceber)} />}
          </dl>
        </>
      )}
    </Cartao>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg bg-acqua-gelo px-2 py-2">
      <p className="text-xl font-semibold text-acqua-titulo">{valor}</p>
      <p className="text-[11px] text-slate-500">{rotulo}</p>
    </div>
  )
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className={forte ? 'font-semibold text-acqua-titulo' : 'text-slate-600'}>{rotulo}</dt>
      <dd className={forte ? 'font-semibold tabular-nums text-acqua-titulo' : 'tabular-nums'}>{valor}</dd>
    </div>
  )
}
