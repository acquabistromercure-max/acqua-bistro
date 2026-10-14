import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarData, formatarMoeda } from '../../lib/formatos'
import { Botao, Carregando, Mensagem, Selo, Tabela, cx, mensagemErro } from '../../components/ui'
import { SeloSituacao } from '../../components/registros'
import NovoPedido from './NovoPedido'
import PedidoJanela from './PedidoJanela'
import { ETAPAS, totalItens, type Pedido } from './dados'

const FILTROS = [
  { valor: 'abertos', rotulo: 'Em andamento' },
  ...ETAPAS,
  { valor: 'cancelado', rotulo: 'Cancelados' },
  { valor: 'todos', rotulo: 'Todos' },
]

export default function Pedidos() {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const [params, setParams] = useSearchParams()
  const [filtro, setFiltro] = useState('abertos')
  const [novo, setNovo] = useState(false)
  const [aberto, setAberto] = useState<Pedido | null>(null)

  useEffect(() => {
    if (params.get('novo')) setNovo(true)
  }, [params])

  const lista = useQuery({
    queryKey: ['pedidos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pedidos').select('*, pedido_itens(*)').order('criado_em', { ascending: false }).limit(300)
      if (error) throw error
      return data as Pedido[]
    },
  })

  const contagem = (f: string) =>
    (lista.data ?? []).filter((p) => (f === 'todos' ? true : f === 'abertos' ? !['concluido', 'cancelado'].includes(p.situacao) : p.situacao === f)).length
  const filtrados = (lista.data ?? []).filter((p) =>
    filtro === 'todos' ? true : filtro === 'abertos' ? !['concluido', 'cancelado'].includes(p.situacao) : p.situacao === filtro,
  )
  const atual = aberto ? lista.data?.find((p) => p.id === aberto.id) ?? aberto : null

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setFiltro(f.valor)}
              className={cx(
                'rounded-full border px-3 py-1 text-xs font-semibold',
                filtro === f.valor ? 'border-acqua-petroleo bg-acqua-titulo text-white' : 'border-[#C4D3E8] bg-white text-acqua-titulo hover:bg-acqua-suave',
              )}
            >
              {f.rotulo} <span className="opacity-70">{contagem(f.valor)}</span>
            </button>
          ))}
        </div>
        {pode('compras', 'criar') && (
          <Botao className="ml-auto" icone={<Plus className="h-4 w-4" />} onClick={() => setNovo(true)}>Nova lista de pedidos</Botao>
        )}
      </div>
      {lista.error && <Mensagem tipo="erro">{mensagemErro(lista.error)}</Mensagem>}
      {lista.isLoading ? (
        <Carregando />
      ) : (
        <Tabela
          linhas={filtrados}
          chave={(p) => p.id}
          aoClicar={setAberto}
          vazio="Nenhum pedido aqui."
          colunas={[
            { titulo: 'Nº', celula: (p) => <b>#{p.numero}</b> },
            {
              titulo: 'Lista',
              celula: (p) => (
                <span>
                  <span className="font-semibold">{p.titulo}</span>
                  {p.prioridade === 'urgente' && <span className="ml-2"><Selo cor="vermelho">Urgente</Selo></span>}
                  <span className="block text-xs text-slate-500">{[p.categoria, `${p.pedido_itens?.length ?? 0} item(ns)`].filter(Boolean).join(' · ')}</span>
                </span>
              ),
            },
            { titulo: 'Pedido por', celula: (p) => `${nome(p.criado_por)} · ${formatarData(p.criado_em)}` },
            { titulo: 'Precisa até', celula: (p) => formatarData(p.necessario_em) || '—' },
            { titulo: 'Estimado', celula: (p) => formatarMoeda(totalItens(p.pedido_itens ?? [])) },
            { titulo: 'Situação', celula: (p) => <SeloSituacao situacao={p.situacao} /> },
          ]}
        />
      )}
      {novo && (
        <NovoPedido
          aoFechar={() => {
            setNovo(false)
            if (params.get('novo')) setParams({}, { replace: true })
          }}
          aoSalvar={() => {
            setNovo(false)
            if (params.get('novo')) setParams({}, { replace: true })
            qc.invalidateQueries({ queryKey: ['pedidos'] })
          }}
        />
      )}
      {atual && <PedidoJanela pedido={atual} aoFechar={() => setAberto(null)} />}
    </>
  )
}
