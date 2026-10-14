import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { usePermissoes } from '../../lib/permissoes'
import { formatarData, hojeISO } from '../../lib/formatos'
import { horaCurta } from '../../lib/ponto'
import { Cartao, Carregando } from '../../components/ui'
import type { FiltroPainel } from '../painel/filtro'
import { nomeCurto, useEscalas, usePessoasEscala, useRegistrosPonto } from './dados'

/** Card do painel: equipe do dia (em turno, folgas, férias/afastamentos) e quem já marcou ponto. */
export default function CardEquipe({ filtro }: { filtro: FiltroPainel }) {
  const { pode } = usePermissoes()
  const dia = filtro.escala === 'dia' ? filtro.data : hojeISO()
  const pessoas = usePessoasEscala()
  const escalas = useEscalas(dia, dia)
  const vePonto = pode('ponto')
  const ponto = useRegistrosPonto(dia, dia, undefined, vePonto)
  const nomes = new Map((pessoas.data ?? []).map((p) => [p.id, nomeCurto(p)]))
  const marcou = new Set((ponto.data ?? []).map((r) => r.colaborador_id))
  const lista = escalas.data ?? []
  const emTurno = lista.filter((e) => e.tipo === 'turno').sort((a, b) => (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))
  const folgas = lista.filter((e) => e.tipo === 'folga').length
  const fora = lista.filter((e) => ['ferias', 'afastamento', 'ausencia'].includes(e.tipo)).length

  return (
    <Cartao
      titulo={<span className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-acqua-dourado" /> Equipe em {formatarData(dia)}</span>}
      acoes={<Link to="/escalas" className="link text-xs">Ver escala</Link>}
    >
      {escalas.isLoading ? (
        <Carregando />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <Numero rotulo="Em turno" valor={emTurno.length} />
            <Numero rotulo="Folga" valor={folgas} />
            <Numero rotulo="Férias/afast." valor={fora} />
          </div>
          {emTurno.length === 0 ? (
            <p className="text-sm text-slate-500">Ninguém escalado em turno neste dia.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {emTurno.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-acqua-titulo">{nomes.get(e.colaborador_id) ?? '…'}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">
                    {horaCurta(e.hora_inicio)}–{horaCurta(e.hora_fim)}
                    {vePonto && dia <= hojeISO() && (
                      <span className={marcou.has(e.colaborador_id) ? 'ml-2 text-emerald-700' : 'ml-2 text-amber-700'}>
                        {marcou.has(e.colaborador_id) ? '✓ ponto' : 'sem ponto'}
                      </span>
                    )}
                  </span>
                </li>
              ))}
              {emTurno.length > 8 && <li className="text-xs text-slate-500">e mais {emTurno.length - 8}…</li>}
            </ul>
          )}
        </>
      )}
    </Cartao>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg bg-acqua-gelo px-2 py-2">
      <p className="text-xl font-semibold text-acqua-titulo">{valor}</p>
      <p className="text-[11px] text-slate-500">{rotulo}</p>
    </div>
  )
}
