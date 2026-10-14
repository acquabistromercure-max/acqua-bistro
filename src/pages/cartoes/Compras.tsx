import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, Download, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarData, formatarMoeda, hojeISO, lerMoeda } from '../../lib/formatos'
import { baixarCSV } from '../../lib/exportar'
import { parcelas } from '../../lib/cartao'
import { AreaTexto, Botao, Campo, Carregando, Janela, Mensagem, Selecao, Tabela, Vazio, mensagemErro } from '../../components/ui'
import { BotaoExcluir, JanelaCancelar, SeloSituacao } from '../../components/registros'
import { useCategoriasContas, useFornecedores } from '../compras/dados'
import { rotuloCartao, useCartoes, useComprasCartao, type CompraCartao } from './dados'

const mesAno = (c: string) => `${c.slice(5, 7)}/${c.slice(0, 4)}`

/** Compras no cartão: o que foi comprado, onde, quem comprou e em quantas parcelas. */
export default function ComprasCartao() {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const cartoes = useCartoes()
  const compras = useComprasCartao()
  const [cartaoId, setCartaoId] = useState('')
  const [nova, setNova] = useState(false)
  const [aberta, setAberta] = useState<CompraCartao | null>(null)
  const cartao = (id: string) => cartoes.data?.find((c) => c.id === id)
  const lista = (compras.data ?? []).filter((c) => !cartaoId || c.cartao_id === cartaoId)
  const semComprovante = lista.filter((c) => c.situacao !== 'cancelado' && !c.comprovante_ok).length

  const comprovante = useMutation({
    mutationFn: async (c: CompraCartao) => {
      const { error } = await supabase.from('compras_cartao').update({ comprovante_ok: !c.comprovante_ok }).eq('id', c.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compras_cartao'] }),
  })

  const exportar = () =>
    baixarCSV('compras-cartao', lista, [
      { titulo: 'Data', valor: (c) => formatarData(c.data) },
      { titulo: 'Cartão', valor: (c) => (cartao(c.cartao_id) ? rotuloCartao(cartao(c.cartao_id)!) : '') },
      { titulo: 'Estabelecimento', valor: (c) => c.estabelecimento },
      { titulo: 'Itens', valor: (c) => c.itens },
      { titulo: 'Categoria', valor: (c) => c.categoria },
      { titulo: 'Valor', valor: (c) => Number(c.valor_total) },
      { titulo: 'Parcelas', valor: (c) => c.parcelas },
      { titulo: 'Responsável', valor: (c) => c.responsavel },
      { titulo: 'Situação', valor: (c) => c.situacao },
    ])

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Selecao rotulo="Cartão" className="w-64" value={cartaoId} onChange={(e) => setCartaoId(e.target.value)} vazio="Todos" opcoes={(cartoes.data ?? []).map((c) => ({ valor: c.id, rotulo: rotuloCartao(c) }))} />
        {semComprovante > 0 && <p className="mb-2 text-sm text-amber-800">{semComprovante} compra(s) sem comprovante conferido</p>}
        <div className="ml-auto flex gap-2">
          {pode('cartoes', 'exportar') && <Botao variante="secundario" icone={<Download className="h-4 w-4" />} onClick={exportar}>Exportar</Botao>}
          {pode('cartoes', 'criar') && <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setNova(true)} disabled={!cartoes.data?.length}>Nova compra</Botao>}
        </div>
      </div>
      {!cartoes.isLoading && !cartoes.data?.length && <div className="mb-4"><Vazio>Cadastre o cartão na aba Cartões para lançar as compras.</Vazio></div>}
      {compras.isLoading ? (
        <Carregando />
      ) : (
        <Tabela
          linhas={lista}
          chave={(c) => c.id}
          aoClicar={setAberta}
          vazio="Nenhuma compra no cartão."
          colunas={[
            { titulo: 'Data', celula: (c) => formatarData(c.data) },
            {
              titulo: 'Compra',
              celula: (c) => (
                <span>
                  <span className="font-semibold">{c.estabelecimento}</span>
                  <span className="block max-w-xs truncate text-xs text-slate-500">{c.itens}</span>
                </span>
              ),
            },
            { titulo: 'Cartão', celula: (c) => cartao(c.cartao_id)?.apelido ?? '—' },
            { titulo: 'Valor', celula: (c) => (c.situacao === 'cancelado' ? <SeloSituacao situacao="cancelado" /> : <b className="tabular-nums">{formatarMoeda(c.valor_total)}</b>) },
            { titulo: 'Parcelas', celula: (c) => (c.parcelas > 1 ? `${c.parcelas}× ${formatarMoeda(c.valor_total / c.parcelas)}` : 'À vista') },
            {
              titulo: 'Comprovante',
              celula: (c) =>
                c.situacao === 'cancelado' ? null : (
                  <button
                    type="button"
                    disabled={!pode('cartoes', 'editar')}
                    onClick={(e) => {
                      e.stopPropagation()
                      comprovante.mutate(c)
                    }}
                    className="rounded p-1"
                    title={c.comprovante_ok ? 'Comprovante conferido' : 'Marcar comprovante como conferido'}
                  >
                    {c.comprovante_ok ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-slate-300" />}
                  </button>
                ),
            },
          ]}
        />
      )}
      {nova && <NovaCompra aoFechar={() => setNova(false)} aoSalvar={() => { setNova(false); qc.invalidateQueries({ queryKey: ['compras_cartao'] }) }} />}
      {aberta && <JanelaCompra compra={aberta} aoFechar={() => setAberta(null)} />}
    </>
  )
}

function NovaCompra({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: () => void }) {
  const { perfil } = usePermissoes()
  const cartoes = useCartoes()
  const fornecedores = useFornecedores()
  const categorias = useCategoriasContas()
  const ativos = (cartoes.data ?? []).filter((c) => c.ativo)
  const [cartaoId, setCartaoId] = useState(ativos[0]?.id ?? '')
  const [data, setData] = useState(hojeISO())
  const [estabelecimento, setEstabelecimento] = useState('')
  const [itens, setItens] = useState('')
  const [categoria, setCategoria] = useState('Insumos')
  const [valor, setValor] = useState('')
  const [nParcelas, setNParcelas] = useState('1')
  const [responsavel, setResponsavel] = useState(perfil?.nome ?? '')
  const [observacao, setObservacao] = useState('')
  const c = ativos.find((x) => x.id === cartaoId)
  const v = lerMoeda(valor)
  const n = Math.max(1, Math.min(24, Number(nParcelas) || 1))
  const previa = c && v ? parcelas(data, v, n, c) : []

  const salvar = useMutation({
    mutationFn: async () => {
      if (!cartaoId) throw new Error('Escolha o cartão.')
      if (!v || v <= 0) throw new Error('Informe o valor.')
      const f = fornecedores.data?.find((x) => x.nome.toLowerCase() === estabelecimento.trim().toLowerCase())
      const { error } = await supabase.from('compras_cartao').insert({
        cartao_id: cartaoId,
        data,
        estabelecimento: estabelecimento.trim(),
        fornecedor_id: f?.id ?? null,
        itens: itens.trim(),
        categoria,
        valor_total: v,
        parcelas: n,
        responsavel: responsavel.trim(),
        observacao: observacao.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: aoSalvar,
  })

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Compra no cartão"
      largura="max-w-2xl"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-compra-cartao" carregando={salvar.isPending}>Salvar</Botao>
        </>
      }
    >
      <form id="form-compra-cartao" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar.mutate() }}>
        <Selecao rotulo="Cartão" value={cartaoId} onChange={(e) => setCartaoId(e.target.value)} opcoes={ativos.map((x) => ({ valor: x.id, rotulo: rotuloCartao(x) }))} />
        <Campo rotulo="Data da compra" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        <div>
          <Campo rotulo="Onde comprou" value={estabelecimento} onChange={(e) => setEstabelecimento(e.target.value)} list="fornecedores-cartao" required autoFocus />
          <datalist id="fornecedores-cartao">{(fornecedores.data ?? []).map((f) => <option key={f.id} value={f.nome} />)}</datalist>
        </div>
        <Selecao rotulo="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} opcoes={categorias.map((x) => ({ valor: x, rotulo: x }))} />
        <AreaTexto rotulo="Itens comprados" className="sm:col-span-2" value={itens} onChange={(e) => setItens(e.target.value)} required placeholder="Ex.: 10 kg de frango, 2 refrigerantes 2L" />
        <Campo rotulo="Valor total (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required />
        <Campo rotulo="Parcelas" type="number" min={1} max={24} value={nParcelas} onChange={(e) => setNParcelas(e.target.value)} />
        <Campo rotulo="Quem comprou" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} required />
        <Campo rotulo="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        {previa.length > 0 && (
          <div className="rounded-xl bg-acqua-gelo p-3 text-sm sm:col-span-2">
            <p className="mb-1 font-semibold text-acqua-titulo">Vai para as faturas:</p>
            <p className="text-slate-600">{previa.map((p) => `${mesAno(p.competencia)}: ${formatarMoeda(p.valor)}`).join(' · ')}</p>
          </div>
        )}
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}

function JanelaCompra({ compra, aoFechar }: { compra: CompraCartao; aoFechar: () => void }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const cartoes = useCartoes()
  const [cancelando, setCancelando] = useState(false)
  const c = cartoes.data?.find((x) => x.id === compra.cartao_id)
  const lista = c ? parcelas(compra.data, Number(compra.valor_total), compra.parcelas, c) : []
  const atualizar = () => qc.invalidateQueries({ queryKey: ['compras_cartao'] })
  const cancelar = useMutation({
    mutationFn: async (motivo: string) => {
      const { error } = await supabase.from('compras_cartao').update({ situacao: 'cancelado', motivo_cancelamento: motivo }).eq('id', compra.id)
      if (error) throw error
    },
    onSuccess: () => {
      atualizar()
      aoFechar()
    },
  })
  return (
    <>
      <Janela
        aberta={!cancelando}
        aoFechar={aoFechar}
        titulo={`${compra.estabelecimento} · ${formatarMoeda(compra.valor_total)}`}
        rodape={
          <>
            <BotaoExcluir modulo="cartoes" tabela="compras_cartao" id={compra.id} descricao={`a compra em ${compra.estabelecimento}`} aoExcluir={() => { atualizar(); aoFechar() }} />
            {compra.situacao !== 'cancelado' && pode('cartoes', 'cancelar') && <Botao variante="perigo" onClick={() => setCancelando(true)}>Cancelar (estorno)</Botao>}
            <Botao variante="secundario" onClick={aoFechar}>Fechar</Botao>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <p>{formatarData(compra.data)} · {c ? rotuloCartao(c) : ''} · {compra.categoria}</p>
          <p className="whitespace-pre-line rounded-lg bg-acqua-gelo p-3">{compra.itens}</p>
          <p className="text-slate-600">Comprado por {compra.responsavel} · lançado por {nome(compra.criado_por)}</p>
          {compra.observacao && <p>{compra.observacao}</p>}
          {lista.length > 0 && (
            <ul className="divide-y divide-acqua-suave rounded-lg border border-acqua-suave">
              {lista.map((p) => (
                <li key={p.numero} className="flex justify-between px-3 py-1.5">
                  <span>Parcela {p.numero}/{p.de} · fatura {mesAno(p.competencia)}</span>
                  <span className="tabular-nums">{formatarMoeda(p.valor)}</span>
                </li>
              ))}
            </ul>
          )}
          {compra.motivo_cancelamento && <p className="text-slate-500">Cancelada: {compra.motivo_cancelamento}</p>}
        </div>
      </Janela>
      <JanelaCancelar aberta={cancelando} titulo="Cancelar compra no cartão" carregando={cancelar.isPending} erro={cancelar.error} aoFechar={() => setCancelando(false)} aoConfirmar={(m) => cancelar.mutate(m)} />
    </>
  )
}
