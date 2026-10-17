import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatarMoeda, hojeISO, somarDias } from '../../lib/formatos'
import { ROTULO_MOVIMENTO, TIPOS_PERDA, qtd, type TipoMovimento } from '../../lib/inventario'
import { Abas, Campo, Carregando, Mensagem, Pagina, Selecao } from '../../components/ui'
import Itens, { ListaMovimentos } from './Itens'
import Contagens from './Contagens'
import { useItens, useMovimentos } from './dados'

type Aba = 'itens' | 'historico' | 'contagens' | 'diferencas'

export default function Inventario() {
  const [params, setParams] = useSearchParams()
  const abas: { valor: Aba; rotulo: string }[] = [
    { valor: 'itens', rotulo: 'Itens' },
    { valor: 'historico', rotulo: 'Histórico' },
    { valor: 'contagens', rotulo: 'Refazer inventário' },
    { valor: 'diferencas', rotulo: 'Mudou sem ocorrência' },
  ]
  const pedida = params.get('aba') as Aba | null
  const aba: Aba = abas.some((a) => a.valor === pedida) ? pedida! : 'itens'
  return (
    <Pagina titulo="Inventário" descricao="Tudo o que a empresa tem, o que entrou, o que quebrou e o que mudou sem explicação.">
      <Abas abas={abas} ativa={aba} aoMudar={(v) => setParams(v === 'itens' ? {} : { aba: v }, { replace: true })} />
      {aba === 'itens' && <Itens />}
      {aba === 'historico' && <Historico />}
      {aba === 'contagens' && <Contagens />}
      {aba === 'diferencas' && <Historico soDiferencas />}
    </Pagina>
  )
}

/** Histórico geral de movimentos, com filtros; também serve o relatório "mudou sem ocorrência". */
function Historico({ soDiferencas }: { soDiferencas?: boolean }) {
  const itens = useItens()
  const movimentos = useMovimentos()
  const hoje = hojeISO()
  const [inicio, setInicio] = useState(soDiferencas ? '' : somarDias(hoje, -90))
  const [fim, setFim] = useState(hoje)
  const [tipo, setTipo] = useState('')
  const [item, setItem] = useState('')
  const porId = useMemo(() => new Map((itens.data ?? []).map((i) => [i.id, i])), [itens.data])

  const lista = (movimentos.data ?? []).filter(
    (m) =>
      (!inicio || m.data >= inicio) &&
      (!fim || m.data <= fim) &&
      (!item || m.item_id === item) &&
      (soDiferencas ? m.tipo === 'ajuste' && m.situacao === 'registrado' : !tipo || (tipo === 'perdas' ? TIPOS_PERDA.includes(m.tipo) : m.tipo === tipo)),
  )
  const validos = lista.filter((m) => m.situacao === 'registrado')
  const perdas = validos.filter((m) => TIPOS_PERDA.includes(m.tipo))
  const valor = (l: typeof lista) => l.reduce((s, m) => s + Math.abs(Number(m.quantidade)) * Number(porId.get(m.item_id)?.valor_unitario ?? 0), 0)
  const faltou = validos.filter((m) => m.quantidade < 0)
  const sobrou = validos.filter((m) => m.quantidade > 0)

  if (itens.isLoading || movimentos.isLoading) return <Carregando />
  return (
    <div className="space-y-3">
      {soDiferencas ? (
        <Mensagem tipo={validos.length ? 'alerta' : 'info'}>
          Itens que, ao refazer o inventário, estavam com quantidade diferente do esperado <b>sem nenhuma ocorrência registrada</b>.
          {validos.length > 0 &&
            ` Faltaram ${qtd(-faltou.reduce((s, m) => s + Number(m.quantidade), 0))} unidade(s) (${formatarMoeda(valor(faltou))}) e sobraram ${qtd(sobrou.reduce((s, m) => s + Number(m.quantidade), 0))} (${formatarMoeda(valor(sobrou))}).`}
        </Mensagem>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-acqua-suave bg-white p-3">
            <p className="text-xs text-slate-500">Movimentos no período</p>
            <p className="text-lg font-semibold text-acqua-titulo">{validos.length}</p>
          </div>
          <div className="rounded-xl border border-acqua-suave bg-white p-3">
            <p className="text-xs text-slate-500">Quebras e perdas</p>
            <p className="text-lg font-semibold text-acqua-titulo">{qtd(-perdas.reduce((s, m) => s + Number(m.quantidade), 0))} un.</p>
            <p className="text-xs text-slate-500">{formatarMoeda(valor(perdas))}</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Campo rotulo="De" type="date" className="w-40" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        <Campo rotulo="Até" type="date" className="w-40" value={fim} onChange={(e) => setFim(e.target.value)} />
        <Selecao
          rotulo="Item"
          className="w-56"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          vazio="Todos"
          opcoes={(itens.data ?? []).map((i) => ({ valor: i.id, rotulo: i.nome }))}
        />
        {!soDiferencas && (
          <Selecao
            rotulo="Tipo"
            className="w-52"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            vazio="Todos"
            opcoes={[
              { valor: 'perdas', rotulo: 'Quebras e perdas' },
              ...(Object.keys(ROTULO_MOVIMENTO) as TipoMovimento[]).map((t) => ({ valor: t, rotulo: ROTULO_MOVIMENTO[t] })),
            ]}
          />
        )}
      </div>
      <ListaMovimentos lista={lista} nomeItem={(id) => porId.get(id)?.nome ?? '…'} />
    </div>
  )
}
