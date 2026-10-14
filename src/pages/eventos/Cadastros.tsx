import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarMoeda, lerMoeda } from '../../lib/formatos'
import { formatarTelefone } from '../../lib/documentos-br'
import type { ItemModelo } from '../../lib/eventos'
import { AreaTexto, Botao, Campo, Carregando, Janela, Mensagem, Selecao, Selo, Tabela, mensagemErro } from '../../components/ui'
import { BotaoExcluir } from '../../components/registros'
import { useClientes, useModelos, useProdutosEvento, type Cliente, type Modelo, type ProdutoEvento } from './dados'

/** Modelos de coffee break reutilizáveis: preço por pessoa e itens com quantidade por pessoa. */
export function Modelos() {
  const { pode } = usePermissoes()
  const modelos = useModelos()
  const [editando, setEditando] = useState<Modelo | 'novo' | null>(null)
  return (
    <>
      <div className="mb-4 flex justify-end">
        {pode('eventos', 'editar') && <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setEditando('novo')}>Modelo</Botao>}
      </div>
      {modelos.isLoading ? (
        <Carregando />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(modelos.data ?? []).map((m) => (
            <button key={m.id} type="button" onClick={() => setEditando(m)} className="rounded-2xl border border-acqua-suave bg-white p-4 text-left shadow-sm hover:border-acqua">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-acqua-titulo">{m.nome}</p>
                {!m.ativo && <Selo>Inativo</Selo>}
              </div>
              <p className="text-lg font-semibold text-acqua-petroleo">{formatarMoeda(m.preco_por_pessoa)}<span className="text-xs font-normal text-slate-500"> /pessoa</span></p>
              {m.descricao && <p className="mt-1 text-sm text-slate-600">{m.descricao}</p>}
              <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                {m.itens.slice(0, 8).map((i) => <li key={i.nome}>• {i.nome} ({String(i.por_pessoa).replace('.', ',')} {i.unidade}/pessoa)</li>)}
                {m.itens.length > 8 && <li>e mais {m.itens.length - 8}…</li>}
              </ul>
            </button>
          ))}
          {!modelos.data?.length && <p className="text-sm text-slate-500">Nenhum modelo. Crie os coffee breaks que vocês já servem.</p>}
        </div>
      )}
      {editando && <FormModelo modelo={editando === 'novo' ? null : editando} aoFechar={() => setEditando(null)} />}
    </>
  )
}

function FormModelo({ modelo, aoFechar }: { modelo: Modelo | null; aoFechar: () => void }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const [nome, setNome] = useState(modelo?.nome ?? '')
  const [descricao, setDescricao] = useState(modelo?.descricao ?? '')
  const [preco, setPreco] = useState(modelo ? String(modelo.preco_por_pessoa).replace('.', ',') : '')
  const [ativo, setAtivo] = useState(modelo?.ativo ?? true)
  const [itens, setItens] = useState<{ nome: string; unidade: string; por_pessoa: string }[]>(
    (modelo?.itens ?? []).map((i) => ({ nome: i.nome, unidade: i.unidade, por_pessoa: String(i.por_pessoa).replace('.', ',') })),
  )
  const podeSalvar = pode('eventos', 'editar')
  const salvar = useMutation({
    mutationFn: async () => {
      const lista: ItemModelo[] = itens
        .filter((i) => i.nome.trim())
        .map((i) => ({ nome: i.nome.trim(), unidade: i.unidade.trim() || 'un', por_pessoa: Number(i.por_pessoa.replace(',', '.')) || 0 }))
      const dados = { nome: nome.trim(), descricao: descricao.trim() || null, preco_por_pessoa: lerMoeda(preco) ?? 0, itens: lista, ativo }
      const { error } = modelo ? await supabase.from('evento_modelos').update(dados).eq('id', modelo.id) : await supabase.from('evento_modelos').insert(dados)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evento_modelos'] })
      aoFechar()
    },
  })
  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={modelo ? modelo.nome : 'Novo modelo de coffee break'}
      largura="max-w-2xl"
      rodape={
        <>
          {modelo && <BotaoExcluir modulo="eventos" tabela="evento_modelos" id={modelo.id} descricao={`o modelo ${modelo.nome}`} aoExcluir={() => { qc.invalidateQueries({ queryKey: ['evento_modelos'] }); aoFechar() }} />}
          <Botao variante="secundario" onClick={aoFechar}>Fechar</Botao>
          {podeSalvar && <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Botao>}
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome" value={nome} disabled={!podeSalvar} onChange={(e) => setNome(e.target.value)} required autoFocus placeholder="Ex.: Coffee break completo" />
        <Campo rotulo="Preço por pessoa (R$)" inputMode="decimal" value={preco} disabled={!podeSalvar} onChange={(e) => setPreco(e.target.value)} />
        <AreaTexto rotulo="Descrição" className="sm:col-span-2" value={descricao} disabled={!podeSalvar} onChange={(e) => setDescricao(e.target.value)} />
        <div className="sm:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold text-acqua-titulo">Itens (quantidade por pessoa)</p>
            {podeSalvar && <Botao variante="fantasma" icone={<Plus className="h-4 w-4" />} onClick={() => setItens([...itens, { nome: '', unidade: 'un', por_pessoa: '1' }])}>Item</Botao>}
          </div>
          {itens.map((i, n) => (
            <div key={n} className="mb-2 grid grid-cols-[1fr,90px,80px,auto] items-end gap-2">
              <Campo rotulo={n === 0 ? 'Item' : ' '} value={i.nome} disabled={!podeSalvar} onChange={(e) => setItens(itens.map((x, k) => (k === n ? { ...x, nome: e.target.value } : x)))} />
              <Campo rotulo={n === 0 ? 'Por pessoa' : ' '} inputMode="decimal" value={i.por_pessoa} disabled={!podeSalvar} onChange={(e) => setItens(itens.map((x, k) => (k === n ? { ...x, por_pessoa: e.target.value } : x)))} />
              <Campo rotulo={n === 0 ? 'Unid.' : ' '} value={i.unidade} disabled={!podeSalvar} onChange={(e) => setItens(itens.map((x, k) => (k === n ? { ...x, unidade: e.target.value } : x)))} />
              {podeSalvar && <Botao variante="fantasma" aria-label="Remover" onClick={() => setItens(itens.filter((_, k) => k !== n))}><Trash2 className="h-4 w-4" /></Botao>}
            </div>
          ))}
        </div>
        {modelo && (
          <Selecao rotulo="Situação" value={ativo ? 'sim' : 'nao'} disabled={!podeSalvar} onChange={(e) => setAtivo(e.target.value === 'sim')} opcoes={[{ valor: 'sim', rotulo: 'Ativo' }, { valor: 'nao', rotulo: 'Inativo' }]} />
        )}
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </div>
    </Janela>
  )
}

/** Produtos avulsos com preço, para lançar com um toque durante o evento. */
export function ProdutosAvulsos() {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const produtos = useProdutosEvento()
  const [editando, setEditando] = useState<ProdutoEvento | 'novo' | null>(null)
  const [nome, setNome] = useState('')
  const [unidade, setUnidade] = useState('un')
  const [preco, setPreco] = useState('')
  const [ativo, setAtivo] = useState(true)
  const abrir = (p: ProdutoEvento | 'novo') => {
    setEditando(p)
    setNome(p === 'novo' ? '' : p.nome)
    setUnidade(p === 'novo' ? 'un' : p.unidade)
    setPreco(p === 'novo' ? '' : String(p.preco).replace('.', ','))
    setAtivo(p === 'novo' ? true : p.ativo)
  }
  const salvar = useMutation({
    mutationFn: async () => {
      const dados = { nome: nome.trim(), unidade: unidade.trim() || 'un', preco: lerMoeda(preco) ?? 0, ativo }
      const { error } = editando && editando !== 'novo' ? await supabase.from('evento_produtos').update(dados).eq('id', editando.id) : await supabase.from('evento_produtos').insert(dados)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evento_produtos'] })
      setEditando(null)
    },
  })
  return (
    <>
      <div className="mb-4 flex justify-end">{pode('eventos', 'editar') && <Botao icone={<Plus className="h-4 w-4" />} onClick={() => abrir('novo')}>Produto</Botao>}</div>
      {produtos.isLoading ? (
        <Carregando />
      ) : (
        <Tabela
          linhas={produtos.data ?? []}
          chave={(p) => p.id}
          aoClicar={abrir}
          vazio="Nenhum produto avulso. Ex.: garrafa térmica de café, suco 1,5L, água."
          colunas={[
            { titulo: 'Produto', celula: (p) => <b>{p.nome}</b> },
            { titulo: 'Unidade', celula: (p) => p.unidade },
            { titulo: 'Preço', celula: (p) => formatarMoeda(p.preco) },
            { titulo: '', celula: (p) => (!p.ativo ? <Selo>Inativo</Selo> : null) },
          ]}
        />
      )}
      {editando && (
        <Janela
          aberta
          aoFechar={() => setEditando(null)}
          titulo={editando === 'novo' ? 'Novo produto avulso' : editando.nome}
          rodape={
            <>
              {editando !== 'novo' && <BotaoExcluir modulo="eventos" tabela="evento_produtos" id={editando.id} descricao={`o produto ${editando.nome}`} aoExcluir={() => { qc.invalidateQueries({ queryKey: ['evento_produtos'] }); setEditando(null) }} />}
              <Botao variante="secundario" onClick={() => setEditando(null)}>Fechar</Botao>
              {pode('eventos', 'editar') && <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Botao>}
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Nome" className="sm:col-span-3" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            <Campo rotulo="Unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} />
            <Campo rotulo="Preço (R$)" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />
            {editando !== 'novo' && <Selecao rotulo="Situação" value={ativo ? 'sim' : 'nao'} onChange={(e) => setAtivo(e.target.value === 'sim')} opcoes={[{ valor: 'sim', rotulo: 'Ativo' }, { valor: 'nao', rotulo: 'Inativo' }]} />}
            {salvar.error && <div className="sm:col-span-3"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
          </div>
        </Janela>
      )}
    </>
  )
}

/** Clientes / contratantes de eventos. */
export function Clientes() {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const clientes = useClientes()
  const [editando, setEditando] = useState<Cliente | 'novo' | null>(null)
  const [f, setF] = useState({ nome: '', documento: '', contato: '', telefone: '', email: '', observacao: '' })
  const abrir = (c: Cliente | 'novo') => {
    setEditando(c)
    setF(c === 'novo' ? { nome: '', documento: '', contato: '', telefone: '', email: '', observacao: '' } : { nome: c.nome, documento: c.documento ?? '', contato: c.contato ?? '', telefone: c.telefone ?? '', email: c.email ?? '', observacao: c.observacao ?? '' })
  }
  const salvar = useMutation({
    mutationFn: async () => {
      const dados = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null]))
      const { error } = editando && editando !== 'novo' ? await supabase.from('clientes').update(dados).eq('id', editando.id) : await supabase.from('clientes').insert(dados)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      setEditando(null)
    },
  })
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) })
  return (
    <>
      <div className="mb-4 flex justify-end">{pode('eventos', 'criar') && <Botao icone={<Plus className="h-4 w-4" />} onClick={() => abrir('novo')}>Cliente</Botao>}</div>
      {clientes.isLoading ? (
        <Carregando />
      ) : (
        <Tabela
          linhas={clientes.data ?? []}
          chave={(c) => c.id}
          aoClicar={abrir}
          vazio="Nenhum cliente cadastrado."
          colunas={[
            { titulo: 'Cliente', celula: (c) => <b>{c.nome}</b> },
            { titulo: 'Contato', celula: (c) => [c.contato, formatarTelefone(c.telefone)].filter(Boolean).join(' · ') || '—' },
            { titulo: 'E-mail', celula: (c) => c.email || '—' },
          ]}
        />
      )}
      {editando && (
        <Janela
          aberta
          aoFechar={() => setEditando(null)}
          titulo={editando === 'novo' ? 'Novo cliente' : editando.nome}
          rodape={
            <>
              {editando !== 'novo' && <BotaoExcluir modulo="eventos" tabela="clientes" id={editando.id} descricao={`o cliente ${editando.nome}`} aoExcluir={() => { qc.invalidateQueries({ queryKey: ['clientes'] }); setEditando(null) }} />}
              <Botao variante="secundario" onClick={() => setEditando(null)}>Fechar</Botao>
              <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Botao>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome / razão social" className="sm:col-span-2" {...campo('nome')} autoFocus />
            <Campo rotulo="CNPJ / CPF" {...campo('documento')} />
            <Campo rotulo="Contato" {...campo('contato')} />
            <Campo rotulo="Telefone" {...campo('telefone')} />
            <Campo rotulo="E-mail" {...campo('email')} />
            <AreaTexto rotulo="Observação" className="sm:col-span-2" {...campo('observacao')} />
            {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
          </div>
        </Janela>
      )}
    </>
  )
}
