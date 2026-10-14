import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, Clock, MapPin, Plus, Users } from 'lucide-react'
import { usePermissoes } from '../../lib/permissoes'
import { formatarData, formatarMoeda, hojeISO, somarDias } from '../../lib/formatos'
import { NOMES_DIAS, diaDaSemana, horaCurta } from '../../lib/ponto'
import { ETAPAS_EVENTO, demonstrativo } from '../../lib/eventos'
import { Botao, Carregando, Mensagem, Vazio, cx, mensagemErro } from '../../components/ui'
import { SeloSituacao } from '../../components/registros'
import FormEvento from './FormEvento'
import { consumosValidos, useClientes, useEventos } from './dados'

type Filtro = 'proximos' | 'mes' | 'passados' | 'a_receber' | 'todos'

/** Agenda de eventos com valores e situação. */
export default function Agenda() {
  const navigate = useNavigate()
  const { pode } = usePermissoes()
  const [params, setParams] = useSearchParams()
  const hoje = hojeISO()
  const [filtro, setFiltro] = useState<Filtro>('proximos')
  const [novo, setNovo] = useState(false)
  const eventos = useEventos(somarDias(hoje, -400), somarDias(hoje, 400))
  const clientes = useClientes()

  useEffect(() => {
    if (params.get('novo')) setNovo(true)
  }, [params])

  const lista = useMemo(() => {
    const todos = eventos.data ?? []
    switch (filtro) {
      case 'proximos':
        return todos.filter((e) => e.data >= hoje && e.situacao !== 'cancelado')
      case 'mes':
        return todos.filter((e) => e.data.slice(0, 7) === hoje.slice(0, 7))
      case 'passados':
        return todos.filter((e) => e.data < hoje).reverse()
      case 'a_receber':
        return todos.filter((e) => ['encerrado', 'faturado'].includes(e.situacao))
      default:
        return todos
    }
  }, [eventos.data, filtro, hoje])

  const porData = useMemo(() => {
    const m = new Map<string, typeof lista>()
    for (const e of lista) m.set(e.data, [...(m.get(e.data) ?? []), e])
    return [...m]
  }, [lista])

  const totalAReceber = (eventos.data ?? [])
    .filter((e) => ['encerrado', 'faturado'].includes(e.situacao))
    .reduce((s, e) => s + demonstrativo(e, consumosValidos(e)).saldo, 0)
  const nomeCliente = (id: string | null) => clientes.data?.find((c) => c.id === id)?.nome

  const filtros: { valor: Filtro; rotulo: string }[] = [
    { valor: 'proximos', rotulo: 'Próximos' },
    { valor: 'mes', rotulo: 'Este mês' },
    { valor: 'a_receber', rotulo: `A receber${totalAReceber ? ` · ${formatarMoeda(totalAReceber)}` : ''}` },
    { valor: 'passados', rotulo: 'Passados' },
    { valor: 'todos', rotulo: 'Todos' },
  ]

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {filtros.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setFiltro(f.valor)}
              className={cx(
                'rounded-full border px-3 py-1 text-xs font-semibold',
                filtro === f.valor ? 'border-acqua-petroleo bg-acqua-titulo text-white' : 'border-[#C4D3E8] bg-white text-acqua-titulo hover:bg-acqua-suave',
              )}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
        {pode('eventos', 'criar') && <Botao className="ml-auto" icone={<Plus className="h-4 w-4" />} onClick={() => setNovo(true)}>Novo evento</Botao>}
      </div>
      {eventos.error && <Mensagem tipo="erro">{mensagemErro(eventos.error)}</Mensagem>}
      {eventos.isLoading ? (
        <Carregando />
      ) : porData.length === 0 ? (
        <Vazio>Nenhum evento aqui.</Vazio>
      ) : (
        <div className="space-y-5">
          {porData.map(([data, lista]) => (
            <section key={data}>
              <h3 className={cx('mb-2 flex items-center gap-2 text-sm font-semibold', data === hoje ? 'text-acqua-dourado' : 'text-acqua-petroleo')}>
                <CalendarDays className="h-4 w-4" /> {data === hoje ? 'Hoje · ' : ''}{NOMES_DIAS[diaDaSemana(data)]}, {formatarData(data)}
              </h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {lista.map((e) => {
                  const d = demonstrativo(e, consumosValidos(e))
                  const etapa = ETAPAS_EVENTO.findIndex((x) => x.valor === e.situacao)
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => navigate(`/eventos/${e.id}`)}
                      className="rounded-2xl border border-acqua-suave bg-white p-4 text-left shadow-sm transition hover:border-acqua hover:shadow"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-acqua-titulo">{e.titulo}</p>
                        <SeloSituacao situacao={e.situacao} />
                      </div>
                      {nomeCliente(e.cliente_id) && <p className="text-sm text-slate-600">{nomeCliente(e.cliente_id)}</p>}
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        {e.hora_inicio && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{horaCurta(e.hora_inicio)}{e.hora_fim && `–${horaCurta(e.hora_fim)}`}</span>}
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{e.pessoas} pessoas</span>
                        {e.local && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{e.local}</span>}
                      </div>
                      <div className="mt-3 flex items-end justify-between">
                        <div className="flex gap-0.5">
                          {ETAPAS_EVENTO.map((x, i) => (
                            <span key={x.valor} className={cx('h-1.5 w-5 rounded-full', e.situacao !== 'cancelado' && i <= etapa ? 'bg-acqua-petroleo' : 'bg-slate-200')} />
                          ))}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums text-acqua-titulo">{formatarMoeda(d.total)}</p>
                          {d.saldo > 0 && e.situacao !== 'cancelado' && e.situacao !== 'orcamento' && <p className="text-xs text-amber-700">a receber {formatarMoeda(d.saldo)}</p>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {novo && (
        <FormEvento
          aoFechar={() => {
            setNovo(false)
            if (params.get('novo')) setParams({}, { replace: true })
          }}
          aoSalvar={(id) => navigate(`/eventos/${id}`)}
        />
      )}
    </>
  )
}
