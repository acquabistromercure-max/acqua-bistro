import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Paperclip } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarMoeda, hojeISO, lerMoeda } from '../../lib/formatos'
import { qtd } from '../../lib/inventario'
import { AreaTexto, Botao, Campo, Janela, Mensagem, Selecao, cx, mensagemErro } from '../../components/ui'
import { FORMAS_CONTA, useFornecedores } from '../compras/dados'
import { rotuloCartao, useCartoes } from '../cartoes/dados'
import { CHAVES_INVENTARIO, useCategoriasInventario, useItens, useLocaisInventario } from '../inventario/dados'
import { FORMAS_PAGO, PAGAMENTOS, TITULO, useCategoriasGastos, type Gasto, type Pagamento, type TipoGasto } from './dados'

export const NOVO_ITEM = '__novo__'

/** Envia a nota/foto para o bucket privado e grava o caminho no gasto. */
export async function anexarArquivo(gasto: Pick<Gasto, 'id' | 'tipo'>, arquivo: File) {
  if (arquivo.size > 10 * 1024 * 1024) throw new Error('Arquivo maior que 10 MB.')
  const ext = (arquivo.name.split('.').pop() || 'pdf').toLowerCase()
  const caminho = `${gasto.tipo}/${gasto.id}.${ext}`
  const { error } = await supabase.storage.from('gastos').upload(caminho, arquivo, { upsert: true, contentType: arquivo.type })
  if (error) throw error
  const { error: e2 } = await supabase.from('gastos').update({ anexo: caminho }).eq('id', gasto.id)
  if (e2) throw e2
}

/**
 * Lançar ou corrigir um gasto. Ao lançar, a forma de pagamento decide onde ele aparece (caixa, fundo, cartão, contas a
 * pagar); depois de lançado, só dá para corrigir descrição, valor, data e detalhes — trocar a forma é excluir e lançar.
 */
export default function FormGasto({
  tipo,
  gasto,
  projetos = [],
  itemInicial,
  aoFechar,
}: {
  tipo: TipoGasto
  gasto?: Gasto
  projetos?: string[]
  itemInicial?: string
  aoFechar: () => void
}) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const categorias = useCategoriasGastos(tipo)
  const fornecedores = useFornecedores()
  const cartoes = useCartoes()
  const itens = useItens()
  const catInventario = useCategoriasInventario()
  const locais = useLocaisInventario()
  const editando = !!gasto

  const [data, setData] = useState(gasto?.data ?? hojeISO())
  const [descricao, setDescricao] = useState(gasto?.descricao ?? '')
  const [projeto, setProjeto] = useState(gasto?.projeto ?? projetos[0] ?? '')
  const [categoria, setCategoria] = useState(gasto?.categoria ?? categorias[0] ?? 'Outros')
  const [fornecedorId, setFornecedorId] = useState(gasto?.fornecedor_id ?? '')
  const [prestador, setPrestador] = useState(gasto?.prestador ?? '')
  const [valor, setValor] = useState(gasto ? String(gasto.valor).replace('.', ',') : '')
  const [pagamento, setPagamento] = useState<Pagamento>(gasto?.pagamento ?? 'pago')
  const [forma, setForma] = useState(gasto?.forma ?? 'pix')
  const [cartaoId, setCartaoId] = useState(gasto?.cartao_id ?? '')
  const [parcelas, setParcelas] = useState(String(gasto?.parcelas ?? 1))
  const [vencimento, setVencimento] = useState(gasto?.vencimento ?? hojeISO())
  const [responsavel, setResponsavel] = useState(gasto?.responsavel ?? '')
  const [itemId, setItemId] = useState(gasto?.item_id ?? itemInicial ?? '')
  const [quantidade, setQuantidade] = useState(gasto?.quantidade != null ? qtd(gasto.quantidade) : tipo === 'investimento' ? '1' : '')
  const [novoNome, setNovoNome] = useState('')
  const [novaCategoria, setNovaCategoria] = useState(catInventario[0] ?? 'Outros')
  const [novoLocal, setNovoLocal] = useState('')
  const [proxima, setProxima] = useState(gasto?.proxima_manutencao ?? '')
  const [observacao, setObservacao] = useState(gasto?.observacao ?? '')
  const [arquivo, setArquivo] = useState<File | null>(null)

  const n = Math.max(1, Math.min(pagamento === 'cartao' ? 24 : 48, Number(parcelas) || 1))
  const v = lerMoeda(valor) ?? 0
  const q = lerMoeda(quantidade) ?? 0
  const equipamentos = (itens.data ?? []).filter((i) => i.ativo).sort((a, b) => Number(b.equipamento) - Number(a.equipamento) || a.nome.localeCompare(b.nome))

  const salvar = useMutation({
    mutationFn: async () => {
      if (!(v > 0)) throw new Error('Informe o valor.')
      if (tipo === 'manutencao' && !itemId) throw new Error('Escolha o equipamento.')
      let item = itemId === NOVO_ITEM ? '' : itemId
      // Investimento com item novo: cadastra o item antes (a quantidade entra pela compra).
      if (itemId === NOVO_ITEM) {
        if (!novoNome.trim()) throw new Error('Informe o nome do item novo.')
        const { data: criado, error } = await supabase
          .from('inventario_itens')
          .insert({
            nome: novoNome.trim(),
            categoria: novaCategoria,
            local: novoLocal || null,
            equipamento: categoria === 'Equipamento',
            valor_unitario: q > 0 ? Math.round((v / q) * 100) / 100 : null,
          })
          .select('id')
          .single()
        if (error) throw new Error(`Não foi possível cadastrar o item: ${mensagemErro(error)}`)
        item = criado.id
      }
      const comum = {
        data,
        descricao: descricao.trim(),
        projeto: tipo === 'obra' ? projeto.trim() || null : null,
        categoria,
        fornecedor_id: fornecedorId || null,
        prestador: prestador.trim() || null,
        valor: v,
        responsavel: responsavel.trim() || null,
        item_id: item || null,
        quantidade: tipo === 'investimento' && item ? q || null : null,
        proxima_manutencao: tipo === 'manutencao' ? proxima || null : null,
        observacao: observacao.trim() || null,
      }
      let salvo: Pick<Gasto, 'id' | 'tipo'>
      if (gasto) {
        const { error } = await supabase.from('gastos').update(comum).eq('id', gasto.id)
        if (error) throw error
        salvo = gasto
      } else {
        const { data: criado, error } = await supabase
          .from('gastos')
          .insert({
            ...comum,
            tipo,
            pagamento,
            forma: pagamento === 'pago' || pagamento === 'a_pagar' ? forma : null,
            cartao_id: pagamento === 'cartao' ? cartaoId || null : null,
            parcelas: pagamento === 'cartao' || pagamento === 'a_pagar' ? n : 1,
            vencimento: pagamento === 'a_pagar' ? vencimento : null,
          })
          .select('id, tipo')
          .single()
        if (error) throw error
        salvo = criado as Pick<Gasto, 'id' | 'tipo'>
      }
      if (arquivo) {
        try {
          await anexarArquivo(salvo, arquivo)
        } catch (e) {
          throw new Error(`Gasto salvo, mas a nota/foto não subiu: ${mensagemErro(e)}`)
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gastos'] })
      qc.invalidateQueries({ queryKey: ['painel-financeiro'] })
      qc.invalidateQueries({ queryKey: ['contas_pagar'] })
      qc.invalidateQueries({ queryKey: ['compras_cartao'] })
      qc.invalidateQueries({ queryKey: ['caixa'] })
      CHAVES_INVENTARIO.forEach((queryKey) => qc.invalidateQueries({ queryKey }))
      aoFechar()
    },
  })

  const ajuda = PAGAMENTOS.find((p) => p.valor === pagamento)?.ajuda
  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={gasto ? `Corrigir: ${gasto.descricao}` : TITULO[tipo].novo}
      largura="max-w-2xl"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-gasto" carregando={salvar.isPending}>Salvar</Botao>
        </>
      }
    >
      <form id="form-gasto" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar.mutate() }}>
        {tipo === 'manutencao' && (
          <Selecao
            rotulo="Equipamento"
            className="sm:col-span-2"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            required
            vazio={equipamentos.length ? 'Escolha o equipamento…' : 'Cadastre o equipamento no Inventário primeiro'}
            opcoes={equipamentos.map((i) => ({ valor: i.id, rotulo: `${i.nome}${i.local ? ` · ${i.local}` : ''}${i.patrimonio ? ` · Pat. ${i.patrimonio}` : ''}` }))}
          />
        )}
        <Campo
          rotulo={tipo === 'manutencao' ? 'O que foi feito' : 'Descrição'}
          className="sm:col-span-2"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          required
          autoFocus={tipo !== 'manutencao'}
          placeholder={
            tipo === 'obra' ? 'Ex.: pintura das paredes do salão' : tipo === 'manutencao' ? 'Ex.: troca do compressor, limpeza do condensador' : 'Ex.: 2 panelas industriais 20 L'
          }
        />
        {tipo === 'obra' && (
          <div>
            <Campo rotulo="Obra" value={projeto} onChange={(e) => setProjeto(e.target.value)} list="projetos-obra" placeholder="Ex.: Reforma do salão" ajuda="Agrupa os gastos de cada reforma." />
            <datalist id="projetos-obra">{projetos.map((p) => <option key={p} value={p} />)}</datalist>
          </div>
        )}
        <Selecao rotulo="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} opcoes={categorias.map((c) => ({ valor: c, rotulo: c }))} />
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        <Campo rotulo="Valor total (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required />
        <Selecao
          rotulo="Fornecedor"
          value={fornecedorId}
          onChange={(e) => setFornecedorId(e.target.value)}
          vazio="— (não cadastrado)"
          opcoes={(fornecedores.data ?? []).map((f) => ({ valor: f.id, rotulo: f.nome }))}
        />
        {!fornecedorId && <Campo rotulo={tipo === 'investimento' ? 'Loja / quem vendeu' : 'Prestador / quem fez'} value={prestador} onChange={(e) => setPrestador(e.target.value)} placeholder="Opcional" />}

        {tipo === 'investimento' && (
          <fieldset className="grid gap-3 rounded-xl border border-acqua-suave p-3 sm:col-span-2 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold text-acqua-titulo">Entra no inventário</legend>
            <Selecao
              rotulo="Item"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              vazio="Não entra no inventário"
              opcoes={[
                ...(pode('inventario', 'criar') && !editando ? [{ valor: NOVO_ITEM, rotulo: '+ Cadastrar item novo' }] : []),
                ...(itens.data ?? []).filter((i) => i.ativo).map((i) => ({ valor: i.id, rotulo: `${i.nome} (tem ${qtd(i.quantidade)})` })),
              ]}
            />
            {itemId && <Campo rotulo="Quantidade comprada" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} required />}
            {itemId === NOVO_ITEM && (
              <>
                <Campo rotulo="Nome do item" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} required placeholder="Ex.: Panela industrial 20 L" />
                <Selecao rotulo="Categoria no inventário" value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)} opcoes={catInventario.map((c) => ({ valor: c, rotulo: c }))} />
                <Selecao rotulo="Local" value={novoLocal} onChange={(e) => setNovoLocal(e.target.value)} vazio="—" opcoes={locais.map((c) => ({ valor: c, rotulo: c }))} />
              </>
            )}
            {itemId && q > 0 && v > 0 && <p className="text-xs text-slate-500 sm:col-span-2">Custo por unidade: {formatarMoeda(v / q)}</p>}
          </fieldset>
        )}

        {tipo === 'manutencao' && (
          <Campo rotulo="Próxima manutenção" type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} ajuda="O sistema avisa quando estiver chegando." />
        )}

        <fieldset className="grid gap-3 rounded-xl border border-acqua-suave p-3 sm:col-span-2 sm:grid-cols-2" disabled={editando}>
          <legend className="px-1 text-sm font-semibold text-acqua-titulo">Como foi pago</legend>
          <div className="flex flex-wrap gap-1.5 sm:col-span-2">
            {PAGAMENTOS.map((p) => (
              <button
                key={p.valor}
                type="button"
                aria-pressed={pagamento === p.valor}
                onClick={() => setPagamento(p.valor)}
                className={cx(
                  'rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60',
                  pagamento === p.valor ? 'border-acqua-petroleo bg-acqua-titulo text-white' : 'border-[#C4D3E8] bg-white text-acqua-titulo hover:bg-acqua-suave',
                )}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
          {ajuda && <p className="text-xs text-slate-500 sm:col-span-2">{editando ? 'A forma de pagamento não muda depois de lançada (exclua e lance de novo).' : ajuda}</p>}
          {pagamento === 'pago' && <Selecao rotulo="Forma" value={forma} onChange={(e) => setForma(e.target.value)} opcoes={FORMAS_PAGO} />}
          {pagamento === 'cartao' && (
            <Selecao
              rotulo="Cartão"
              value={cartaoId}
              onChange={(e) => setCartaoId(e.target.value)}
              required
              vazio={cartoes.data?.length ? 'Escolha…' : 'Nenhum cartão disponível'}
              opcoes={(cartoes.data ?? []).filter((c) => c.ativo).map((c) => ({ valor: c.id, rotulo: rotuloCartao(c) }))}
            />
          )}
          {pagamento === 'a_pagar' && (
            <>
              <Campo rotulo={n > 1 ? '1º vencimento' : 'Vencimento'} type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} required />
              <Selecao rotulo="Forma" value={forma} onChange={(e) => setForma(e.target.value)} opcoes={FORMAS_CONTA} />
            </>
          )}
          {(pagamento === 'cartao' || pagamento === 'a_pagar') && (
            <Campo
              rotulo="Parcelas"
              type="number"
              min={1}
              max={pagamento === 'cartao' ? 24 : 48}
              value={parcelas}
              onChange={(e) => setParcelas(e.target.value)}
              ajuda={n > 1 && v ? `${n}× de ~${formatarMoeda(v / n)}` : undefined}
            />
          )}
          {['caixa', 'fundo', 'cartao'].includes(pagamento) && (
            <Campo rotulo="Quem pagou / retirou" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} required />
          )}
        </fieldset>

        <AreaTexto rotulo="Observação" className="sm:col-span-2" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-acqua-titulo sm:col-span-2">
          <Paperclip className="h-4 w-4" />
          <span>{arquivo ? arquivo.name : gasto?.anexo ? 'Trocar nota/foto anexada' : 'Anexar nota fiscal, recibo ou foto (opcional)'}</span>
          <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        </label>
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}
