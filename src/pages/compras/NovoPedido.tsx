import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatarMoeda, normalizar } from '../../lib/formatos'
import { Alternador, Botao, Campo, Janela, Mensagem, Selecao, cx, mensagemErro } from '../../components/ui'
import { useCategoriasCompras, useFornecedores, useProdutos, useUnidades } from './dados'

type Avulso = { descricao: string; quantidade: string; unidade: string }

/** Monta uma lista de pedidos a partir do catálogo: escolhe a categoria e digita só as quantidades. */
export default function NovoPedido({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: () => void }) {
  const categorias = useCategoriasCompras()
  const unidades = useUnidades()
  const produtos = useProdutos()
  const fornecedores = useFornecedores()
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [necessario, setNecessario] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [observacao, setObservacao] = useState('')
  const [busca, setBusca] = useState('')
  const [qtds, setQtds] = useState<Record<string, string>>({})
  const [avulsos, setAvulsos] = useState<Avulso[]>([])

  const lista = useMemo(() => {
    const termo = normalizar(busca)
    return (produtos.data ?? []).filter((p) => p.ativo && (!categoria || p.categoria === categoria) && (!termo || normalizar(p.nome).includes(termo)))
  }, [produtos.data, categoria, busca])

  const escolhidos = (produtos.data ?? []).filter((p) => Number((qtds[p.id] ?? '').replace(',', '.')) > 0)
  const estimado = escolhidos.reduce((s, p) => s + Number(p.preco_referencia ?? 0) * Number(qtds[p.id].replace(',', '.')), 0)

  const salvar = useMutation({
    mutationFn: async () => {
      const itens = [
        ...escolhidos.map((p) => ({
          produto_id: p.id,
          descricao: p.nome,
          quantidade: Number(qtds[p.id].replace(',', '.')),
          unidade: p.unidade,
          preco_estimado: p.preco_referencia,
        })),
        ...avulsos
          .filter((a) => a.descricao.trim() && Number(a.quantidade.replace(',', '.')) > 0)
          .map((a) => ({ produto_id: null, descricao: a.descricao.trim(), quantidade: Number(a.quantidade.replace(',', '.')), unidade: a.unidade, preco_estimado: null })),
      ]
      if (!itens.length) throw new Error('Coloque a quantidade de pelo menos um item.')
      const { data: pedido, error } = await supabase
        .from('pedidos')
        .insert({
          titulo: titulo.trim() || `Lista de ${categoria || 'compras'}`,
          categoria: categoria || null,
          prioridade: urgente ? 'urgente' : 'normal',
          necessario_em: necessario || null,
          fornecedor_id: fornecedorId || null,
          observacao: observacao.trim() || null,
        })
        .select('id')
        .single()
      if (error) throw error
      const { error: e2 } = await supabase.from('pedido_itens').insert(itens.map((i) => ({ ...i, pedido_id: pedido.id })))
      if (e2) throw e2
    },
    onSuccess: aoSalvar,
  })

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Nova lista de pedidos"
      largura="max-w-3xl"
      rodape={
        <>
          <span className="mr-auto self-center text-sm text-slate-600">
            {escolhidos.length + avulsos.filter((a) => a.descricao.trim()).length} item(ns){estimado ? ` · estimado ${formatarMoeda(estimado)}` : ''}
          </span>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>Enviar pedido</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome da lista" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={`Ex.: Lista de ${categoria || 'frios'} da semana`} />
          <Selecao rotulo="Fornecedor (opcional)" value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} vazio="—" opcoes={(fornecedores.data ?? []).filter((f) => f.ativo).map((f) => ({ valor: f.id, rotulo: f.nome }))} />
          <Campo rotulo="Precisa até" type="date" value={necessario} onChange={(e) => setNecessario(e.target.value)} />
          <div className="self-end">
            <Alternador rotulo="Urgente" ligado={urgente} aoMudar={setUrgente} />
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold text-acqua-titulo">Categoria</p>
          <div className="flex flex-wrap gap-1.5">
            {['', ...categorias].map((c) => (
              <button
                key={c || 'todas'}
                type="button"
                onClick={() => setCategoria(c)}
                className={cx(
                  'rounded-lg border px-2.5 py-1 text-sm font-semibold',
                  categoria === c ? 'border-acqua-petroleo bg-acqua-titulo text-white' : 'border-[#C4D3E8] bg-white text-acqua-titulo hover:bg-acqua-suave',
                )}
              >
                {c || 'Todas'}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Campo rotulo="Procurar no catálogo" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do produto" />
          <Search className="pointer-events-none absolute right-3 top-[34px] h-4 w-4 text-slate-400" />
        </div>

        {lista.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum produto {categoria && `em ${categoria}`} no catálogo. Cadastre na aba Catálogo ou use “Item fora do catálogo”.</p>
        ) : (
          <ul className="max-h-72 divide-y divide-acqua-suave overflow-y-auto rounded-xl border border-acqua-suave">
            {lista.map((p) => (
              <li key={p.id} className={cx('flex items-center gap-3 px-3 py-2', Number((qtds[p.id] ?? '').replace(',', '.')) > 0 && 'bg-acqua-gelo')}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-acqua-titulo">{p.nome}</p>
                  <p className="text-xs text-slate-500">{p.categoria}{p.preco_referencia ? ` · ref. ${formatarMoeda(p.preco_referencia)}/${p.unidade}` : ''}</p>
                </div>
                <input
                  aria-label={`Quantidade de ${p.nome}`}
                  inputMode="decimal"
                  value={qtds[p.id] ?? ''}
                  onChange={(e) => setQtds({ ...qtds, [p.id]: e.target.value })}
                  placeholder="0"
                  className="h-10 w-20 rounded-lg border border-[#C4D3E8] px-2 text-right text-sm focus:border-acqua-petroleo focus:outline-none focus:ring-2 focus:ring-acqua/40"
                />
                <span className="w-10 text-xs text-slate-500">{p.unidade}</span>
              </li>
            ))}
          </ul>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold text-acqua-titulo">Itens fora do catálogo</p>
            <Botao variante="fantasma" icone={<Plus className="h-4 w-4" />} onClick={() => setAvulsos([...avulsos, { descricao: '', quantidade: '1', unidade: 'un' }])}>
              Item
            </Botao>
          </div>
          {avulsos.map((a, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr,80px,90px,auto] items-end gap-2">
              <Campo rotulo={i === 0 ? 'Produto' : ' '} value={a.descricao} onChange={(e) => setAvulsos(avulsos.map((x, k) => (k === i ? { ...x, descricao: e.target.value } : x)))} />
              <Campo rotulo={i === 0 ? 'Qtd' : ' '} inputMode="decimal" value={a.quantidade} onChange={(e) => setAvulsos(avulsos.map((x, k) => (k === i ? { ...x, quantidade: e.target.value } : x)))} />
              <Selecao rotulo={i === 0 ? 'Unid.' : ' '} value={a.unidade} onChange={(e) => setAvulsos(avulsos.map((x, k) => (k === i ? { ...x, unidade: e.target.value } : x)))} opcoes={unidades.map((u) => ({ valor: u, rotulo: u }))} />
              <Botao variante="fantasma" aria-label="Remover" onClick={() => setAvulsos(avulsos.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Botao>
            </div>
          ))}
        </div>

        <Campo rotulo="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        {salvar.error && <Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem>}
      </div>
    </Janela>
  )
}
