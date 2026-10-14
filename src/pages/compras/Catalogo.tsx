import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarMoeda, lerMoeda, normalizar } from '../../lib/formatos'
import { Botao, Campo, Carregando, Janela, Mensagem, Selecao, Selo, Tabela, cx, mensagemErro } from '../../components/ui'
import { BotaoExcluir } from '../../components/registros'
import { useCategoriasCompras, useFornecedores, useProdutos, useUnidades, type Produto } from './dados'

/** Catálogo de produtos por categoria (Limpeza, Frios, Secos…), usado para montar as listas de pedidos. */
export default function Catalogo() {
  const { pode } = usePermissoes()
  const produtos = useProdutos()
  const fornecedores = useFornecedores()
  const categorias = useCategoriasCompras()
  const [categoria, setCategoria] = useState('')
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<Produto | 'novo' | null>(null)

  const lista = useMemo(() => {
    const termo = normalizar(busca)
    return (produtos.data ?? []).filter((p) => (!categoria || p.categoria === categoria) && (!termo || normalizar(p.nome).includes(termo)))
  }, [produtos.data, categoria, busca])
  const nomeFornecedor = (id: string | null) => fornecedores.data?.find((f) => f.id === id)?.nome ?? '—'

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap gap-1.5">
          {['', ...categorias].map((c) => (
            <button
              key={c || 'todas'}
              type="button"
              onClick={() => setCategoria(c)}
              className={cx(
                'rounded-full border px-3 py-1 text-xs font-semibold',
                categoria === c ? 'border-acqua-petroleo bg-acqua-titulo text-white' : 'border-[#C4D3E8] bg-white text-acqua-titulo hover:bg-acqua-suave',
              )}
            >
              {c || 'Todas'} <span className="opacity-70">{(produtos.data ?? []).filter((p) => !c || p.categoria === c).length}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:ml-auto sm:w-60">
          <Campo rotulo="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <Search className="pointer-events-none absolute right-3 top-[34px] h-4 w-4 text-slate-400" />
        </div>
        {pode('compras', 'criar') && <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setEditando('novo')}>Produto</Botao>}
      </div>
      {produtos.isLoading ? (
        <Carregando />
      ) : (
        <Tabela
          linhas={lista}
          chave={(p) => p.id}
          aoClicar={(p) => setEditando(p)}
          vazio="Nenhum produto. Cadastre os itens que o Rômulo costuma pedir."
          colunas={[
            { titulo: 'Produto', celula: (p) => <span className={cx('font-semibold', !p.ativo && 'text-slate-400 line-through')}>{p.nome}</span> },
            { titulo: 'Categoria', celula: (p) => p.categoria },
            { titulo: 'Unidade', celula: (p) => p.unidade },
            { titulo: 'Preço ref.', celula: (p) => (p.preco_referencia != null ? formatarMoeda(p.preco_referencia) : '—') },
            { titulo: 'Fornecedor', celula: (p) => nomeFornecedor(p.fornecedor_id) },
            { titulo: '', celula: (p) => (!p.ativo ? <Selo>Inativo</Selo> : null) },
          ]}
        />
      )}
      {editando && <FormProduto produto={editando === 'novo' ? null : editando} categoriaInicial={categoria} aoFechar={() => setEditando(null)} />}
    </>
  )
}

function FormProduto({ produto, categoriaInicial, aoFechar }: { produto: Produto | null; categoriaInicial: string; aoFechar: () => void }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const categorias = useCategoriasCompras()
  const unidades = useUnidades()
  const fornecedores = useFornecedores()
  const [nome, setNome] = useState(produto?.nome ?? '')
  const [categoria, setCategoria] = useState(produto?.categoria ?? (categoriaInicial || categorias[0] || 'Secos'))
  const [unidade, setUnidade] = useState(produto?.unidade ?? 'un')
  const [preco, setPreco] = useState(produto?.preco_referencia != null ? String(produto.preco_referencia).replace('.', ',') : '')
  const [fornecedorId, setFornecedorId] = useState(produto?.fornecedor_id ?? '')
  const [ativo, setAtivo] = useState(produto?.ativo ?? true)
  const podeSalvar = produto ? pode('compras', 'editar') : pode('compras', 'criar')

  const salvar = useMutation({
    mutationFn: async () => {
      const dados = { nome: nome.trim(), categoria, unidade, preco_referencia: lerMoeda(preco), fornecedor_id: fornecedorId || null, ativo }
      const { error } = produto ? await supabase.from('produtos').update(dados).eq('id', produto.id) : await supabase.from('produtos').insert(dados)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produtos'] })
      aoFechar()
    },
  })

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={produto ? produto.nome : 'Novo produto'}
      rodape={
        <>
          {produto && <BotaoExcluir modulo="compras" tabela="produtos" id={produto.id} descricao={`o produto ${produto.nome}`} aoExcluir={() => { qc.invalidateQueries({ queryKey: ['produtos'] }); aoFechar() }} />}
          <Botao variante="secundario" onClick={aoFechar}>Fechar</Botao>
          {podeSalvar && <Botao type="submit" form="form-produto" carregando={salvar.isPending}>Salvar</Botao>}
        </>
      }
    >
      <form id="form-produto" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar.mutate() }}>
        <Campo rotulo="Nome" className="sm:col-span-2" value={nome} disabled={!podeSalvar} onChange={(e) => setNome(e.target.value)} required autoFocus />
        <Selecao rotulo="Categoria" value={categoria} disabled={!podeSalvar} onChange={(e) => setCategoria(e.target.value)} opcoes={categorias.map((c) => ({ valor: c, rotulo: c }))} />
        <Selecao rotulo="Unidade" value={unidade} disabled={!podeSalvar} onChange={(e) => setUnidade(e.target.value)} opcoes={unidades.map((u) => ({ valor: u, rotulo: u }))} />
        <Campo rotulo="Preço de referência (R$)" inputMode="decimal" value={preco} disabled={!podeSalvar} onChange={(e) => setPreco(e.target.value)} />
        <Selecao rotulo="Fornecedor habitual" value={fornecedorId} disabled={!podeSalvar} onChange={(e) => setFornecedorId(e.target.value)} vazio="—" opcoes={(fornecedores.data ?? []).map((f) => ({ valor: f.id, rotulo: f.nome }))} />
        {produto && (
          <Selecao rotulo="Situação" value={ativo ? 'ativo' : 'inativo'} disabled={!podeSalvar} onChange={(e) => setAtivo(e.target.value === 'ativo')} opcoes={[{ valor: 'ativo', rotulo: 'Ativo' }, { valor: 'inativo', rotulo: 'Inativo (não aparece nas listas)' }]} />
        )}
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}
