import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowDownUp, Download, PackageMinus, Pencil, Plus, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarData, formatarMoeda, hojeISO, lerMoeda, normalizar } from '../../lib/formatos'
import { baixarCSV } from '../../lib/exportar'
import { ROTULO_MOVIMENTO, comSinal, qtd } from '../../lib/inventario'
import { AreaTexto, Alternador, Botao, Campo, Carregando, Janela, Mensagem, Selecao, Selo, Tabela, cx, mensagemErro } from '../../components/ui'
import { BotaoExcluir, JanelaCancelar } from '../../components/registros'
import { usePessoasEscala } from '../escalas/dados'
import { CHAVES_INVENTARIO, useCategoriasInventario, useItens, useLocaisInventario, useMovimentos, type Item, type Movimento } from './dados'
import JanelaQuebra from './JanelaQuebra'

export function useAtualizarInventario() {
  const qc = useQueryClient()
  return () => CHAVES_INVENTARIO.forEach((queryKey) => qc.invalidateQueries({ queryKey }))
}

/** Lista de tudo o que a empresa tem, com quantidade atual calculada pelos movimentos. */
export default function Itens() {
  const { pode } = usePermissoes()
  const itens = useItens()
  const categorias = useCategoriasInventario()
  const locais = useLocaisInventario()
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [local, setLocal] = useState('')
  const [verInativos, setVerInativos] = useState(false)
  const [novo, setNovo] = useState(false)
  const [quebra, setQuebra] = useState(false)
  const [aberto, setAberto] = useState<Item | null>(null)

  const lista = useMemo(() => {
    const b = normalizar(busca)
    return (itens.data ?? []).filter(
      (i) =>
        (verInativos || i.ativo) &&
        (!categoria || i.categoria === categoria) &&
        (!local || i.local === local) &&
        (!b || normalizar(`${i.nome} ${i.patrimonio ?? ''} ${i.categoria}`).includes(b)),
    )
  }, [itens.data, busca, categoria, local, verInativos])

  const ativos = (itens.data ?? []).filter((i) => i.ativo)
  const abaixo = ativos.filter((i) => i.estoque_minimo != null && Number(i.quantidade) < Number(i.estoque_minimo))
  const valorTotal = ativos.reduce((s, i) => s + Number(i.quantidade) * Number(i.valor_unitario ?? 0), 0)
  const semValor = ativos.filter((i) => !i.valor_unitario).length

  const exportar = () =>
    baixarCSV('inventario', lista, [
      { titulo: 'Item', valor: (i) => i.nome },
      { titulo: 'Categoria', valor: (i) => i.categoria },
      { titulo: 'Local', valor: (i) => i.local },
      { titulo: 'Patrimônio', valor: (i) => i.patrimonio },
      { titulo: 'Quantidade', valor: (i) => Number(i.quantidade) },
      { titulo: 'Unidade', valor: (i) => i.unidade },
      { titulo: 'Mínimo', valor: (i) => (i.estoque_minimo != null ? Number(i.estoque_minimo) : '') },
      { titulo: 'Valor unitário', valor: (i) => (i.valor_unitario != null ? Number(i.valor_unitario) : '') },
      { titulo: 'Valor total', valor: (i) => Number(i.quantidade) * Number(i.valor_unitario ?? 0) },
    ])

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo rotulo="Itens cadastrados" valor={String(ativos.length)} />
        <Resumo rotulo="Unidades no total" valor={qtd(ativos.reduce((s, i) => s + Number(i.quantidade), 0))} />
        <Resumo rotulo="Valor estimado" valor={formatarMoeda(valorTotal)} nota={semValor ? `${semValor} item(ns) sem valor` : undefined} />
        <Resumo rotulo="Abaixo do mínimo" valor={String(abaixo.length)} alerta={abaixo.length > 0} />
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="relative w-full sm:w-64">
          <Campo rotulo="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou patrimônio" />
          <Search className="pointer-events-none absolute right-3 top-9 h-4 w-4 text-slate-400" />
        </div>
        <Selecao rotulo="Categoria" className="w-44" value={categoria} onChange={(e) => setCategoria(e.target.value)} vazio="Todas" opcoes={categorias.map((c) => ({ valor: c, rotulo: c }))} />
        <Selecao rotulo="Local" className="w-40" value={local} onChange={(e) => setLocal(e.target.value)} vazio="Todos" opcoes={locais.map((c) => ({ valor: c, rotulo: c }))} />
        <label className="mb-2 flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={verInativos} onChange={(e) => setVerInativos(e.target.checked)} /> Mostrar desativados
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          {pode('inventario', 'exportar') && <Botao variante="secundario" icone={<Download className="h-4 w-4" />} onClick={exportar}>Exportar</Botao>}
          {pode('inventario', 'aprovar') && (
            <Botao variante="secundario" icone={<PackageMinus className="h-4 w-4" />} onClick={() => setQuebra(true)}>Registrar quebra/perda</Botao>
          )}
          {pode('inventario', 'criar') && <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setNovo(true)}>Novo item</Botao>}
        </div>
      </div>

      {itens.isLoading ? (
        <Carregando />
      ) : itens.error ? (
        <Mensagem tipo="erro">{mensagemErro(itens.error)}</Mensagem>
      ) : (
        <Tabela
          linhas={lista}
          chave={(i) => i.id}
          aoClicar={setAberto}
          vazio={itens.data?.length ? 'Nenhum item com esses filtros.' : 'Nenhum item cadastrado. Comece pelo botão “Novo item”.'}
          colunas={[
            {
              titulo: 'Item',
              celula: (i) => (
                <span>
                  <span className="font-semibold">{i.nome}</span>
                  {!i.ativo && <Selo cor="cinza">Desativado</Selo>}
                  <span className="block text-xs text-slate-500">{[i.categoria, i.local, i.patrimonio && `Pat. ${i.patrimonio}`].filter(Boolean).join(' · ')}</span>
                </span>
              ),
            },
            {
              titulo: 'Quantidade',
              celula: (i) => {
                const baixo = i.estoque_minimo != null && Number(i.quantidade) < Number(i.estoque_minimo)
                return (
                  <span className={cx('font-semibold tabular-nums', baixo && 'text-red-700')}>
                    {baixo && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}
                    {qtd(i.quantidade)} {i.unidade}
                    {i.estoque_minimo != null && <span className="block text-xs font-normal text-slate-500">mínimo {qtd(i.estoque_minimo)}</span>}
                  </span>
                )
              },
            },
            { titulo: 'Valor', className: 'text-right', celula: (i) => (i.valor_unitario ? <span className="tabular-nums">{formatarMoeda(Number(i.quantidade) * Number(i.valor_unitario))}</span> : '—') },
          ]}
        />
      )}

      {novo && <FormItem aoFechar={() => setNovo(false)} />}
      {quebra && <JanelaQuebra aoFechar={() => setQuebra(false)} />}
      {aberto && <JanelaItem item={(itens.data ?? []).find((i) => i.id === aberto.id) ?? aberto} aoFechar={() => setAberto(null)} />}
    </>
  )
}

function Resumo({ rotulo, valor, nota, alerta }: { rotulo: string; valor: string; nota?: string; alerta?: boolean }) {
  return (
    <div className={cx('rounded-xl border border-acqua-suave bg-white p-3', alerta && 'border-red-300 bg-red-50')}>
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="text-lg font-semibold tabular-nums text-acqua-titulo">{valor}</p>
      {nota && <p className="text-xs text-slate-500">{nota}</p>}
    </div>
  )
}

/** Cadastrar ou corrigir um item. No cadastro, a quantidade de agora vira o "saldo inicial". */
function FormItem({ item, aoFechar }: { item?: Item; aoFechar: () => void }) {
  const atualizar = useAtualizarInventario()
  const { pode } = usePermissoes()
  const categorias = useCategoriasInventario()
  const locais = useLocaisInventario()
  const [nome, setNome] = useState(item?.nome ?? '')
  const [categoria, setCategoria] = useState(item?.categoria ?? categorias[0] ?? 'Outros')
  const [local, setLocal] = useState(item?.local ?? '')
  const [unidade, setUnidade] = useState(item?.unidade ?? 'un')
  const [inicial, setInicial] = useState('')
  const [minimo, setMinimo] = useState(item?.estoque_minimo != null ? String(item.estoque_minimo).replace('.', ',') : '')
  const [valor, setValor] = useState(item?.valor_unitario != null ? String(item.valor_unitario).replace('.', ',') : '')
  const [patrimonio, setPatrimonio] = useState(item?.patrimonio ?? '')
  const [equipamento, setEquipamento] = useState(item?.equipamento ?? false)
  const [observacao, setObservacao] = useState(item?.observacao ?? '')

  const salvar = useMutation({
    mutationFn: async () => {
      const dados = {
        nome: nome.trim(),
        categoria,
        local: local || null,
        unidade: unidade.trim() || 'un',
        estoque_minimo: minimo ? lerMoeda(minimo) : null,
        valor_unitario: valor ? lerMoeda(valor) : null,
        patrimonio: patrimonio.trim() || null,
        equipamento,
        observacao: observacao.trim() || null,
      }
      if (item) {
        const { error } = await supabase.from('inventario_itens').update(dados).eq('id', item.id)
        if (error) throw error
        return
      }
      const { data, error } = await supabase.from('inventario_itens').insert(dados).select('id').single()
      if (error) throw error
      const q = lerMoeda(inicial)
      if (q && q > 0) {
        const { error: e2 } = await supabase
          .from('inventario_movimentos')
          .insert({ item_id: data.id, data: hojeISO(), tipo: 'inicial', quantidade: q, motivo: 'Saldo inicial no cadastro' })
        if (e2) throw new Error(`Item criado, mas o saldo inicial não entrou: ${mensagemErro(e2)}`)
      }
    },
    onSuccess: () => {
      atualizar()
      aoFechar()
    },
  })

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={item ? `Editar ${item.nome}` : 'Novo item do inventário'}
      largura="max-w-xl"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-item" carregando={salvar.isPending}>Salvar</Botao>
        </>
      }
    >
      <form id="form-item" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar.mutate() }}>
        <Campo rotulo="Nome do item" className="sm:col-span-2" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus placeholder="Ex.: Prato raso branco 27 cm" />
        <Selecao rotulo="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} opcoes={categorias.map((c) => ({ valor: c, rotulo: c }))} />
        <Selecao rotulo="Local" value={local} onChange={(e) => setLocal(e.target.value)} vazio="—" opcoes={locais.map((c) => ({ valor: c, rotulo: c }))} />
        {!item && (
          <Campo
            rotulo="Quantidade hoje"
            inputMode="decimal"
            value={inicial}
            onChange={(e) => setInicial(e.target.value)}
            disabled={!pode('inventario', 'editar')}
            ajuda="Entra como saldo inicial no histórico."
          />
        )}
        <Campo rotulo="Unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, jogo, cx..." />
        <Campo rotulo="Quantidade mínima" inputMode="decimal" value={minimo} onChange={(e) => setMinimo(e.target.value)} ajuda="Avisa quando ficar abaixo." />
        <Campo rotulo="Valor unitário (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} ajuda="Para saber quanto vale o inventário e cobrar quebras." />
        <Campo rotulo="Nº de patrimônio" value={patrimonio} onChange={(e) => setPatrimonio(e.target.value)} placeholder="Opcional" />
        <div className="sm:col-span-2">
          <Alternador rotulo="É um equipamento" descricao="Aparece na Manutenção (geladeira, forno, máquina de café...)." ligado={equipamento} aoMudar={setEquipamento} />
        </div>
        <AreaTexto rotulo="Observação" className="sm:col-span-2" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        {item && <p className="text-xs text-slate-500 sm:col-span-2">A quantidade não se edita aqui: use entrada/saída, quebra ou a contagem do inventário.</p>}
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}

/** Ficha do item: dados, histórico de movimentos, entrada/saída, quebra, editar, desativar e excluir. */
function JanelaItem({ item, aoFechar }: { item: Item; aoFechar: () => void }) {
  const { pode } = usePermissoes()
  const atualizar = useAtualizarInventario()
  const movimentos = useMovimentos(item.id)
  const [editando, setEditando] = useState(false)
  const [movimentar, setMovimentar] = useState(false)
  const [quebra, setQuebra] = useState(false)

  const ativar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('inventario_itens').update({ ativo: !item.ativo }).eq('id', item.id)
      if (error) throw error
    },
    onSuccess: atualizar,
  })

  if (editando) return <FormItem item={item} aoFechar={() => setEditando(false)} />
  if (movimentar) return <JanelaEntradaSaida item={item} aoFechar={() => setMovimentar(false)} />
  if (quebra) return <JanelaQuebra itemId={item.id} aoFechar={() => setQuebra(false)} />

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={item.nome}
      largura="max-w-2xl"
      rodape={
        <>
          <BotaoExcluir modulo="inventario" tabela="inventario_itens" id={item.id} descricao={`o item “${item.nome}” e todo o histórico dele`} aoExcluir={() => { atualizar(); aoFechar() }} />
          {pode('inventario', 'editar') && (
            <Botao variante="secundario" carregando={ativar.isPending} onClick={() => ativar.mutate()}>{item.ativo ? 'Desativar' : 'Reativar'}</Botao>
          )}
          {pode('inventario', 'editar') && <Botao variante="secundario" icone={<Pencil className="h-4 w-4" />} onClick={() => setEditando(true)}>Editar</Botao>}
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-acqua-gelo p-3">
          <div>
            <p className="text-xs text-slate-500">Quantidade atual</p>
            <p className="text-2xl font-semibold tabular-nums text-acqua-titulo">{qtd(item.quantidade)} {item.unidade}</p>
            <p className="text-xs text-slate-500">
              {[item.categoria, item.local, item.patrimonio && `Pat. ${item.patrimonio}`, item.valor_unitario && `${formatarMoeda(item.valor_unitario)} cada`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pode('inventario', 'editar') && (
              <Botao variante="secundario" icone={<ArrowDownUp className="h-4 w-4" />} onClick={() => setMovimentar(true)}>Entrada/saída</Botao>
            )}
            {pode('inventario', 'aprovar') && (
              <Botao variante="secundario" icone={<PackageMinus className="h-4 w-4" />} onClick={() => setQuebra(true)}>Quebra/perda</Botao>
            )}
          </div>
        </div>
        {item.observacao && <p className="text-slate-600">{item.observacao}</p>}
        {ativar.error && <Mensagem tipo="erro">{mensagemErro(ativar.error)}</Mensagem>}
        <div>
          <h3 className="mb-2 font-semibold text-acqua-titulo">Histórico</h3>
          {movimentos.isLoading ? <Carregando /> : <ListaMovimentos lista={movimentos.data ?? []} />}
        </div>
      </div>
    </Janela>
  )
}

/** Lista de movimentos (usada na ficha do item e no histórico geral). */
export function ListaMovimentos({ lista, nomeItem }: { lista: Movimento[]; nomeItem?: (id: string) => string }) {
  const [aberto, setAberto] = useState<Movimento | null>(null)
  const pessoas = usePessoasEscala()
  const nomePessoa = (id: string | null) => pessoas.data?.find((p) => p.id === id)?.nome ?? ''
  return (
    <>
      <Tabela
        linhas={lista}
        chave={(m) => m.id}
        aoClicar={setAberto}
        vazio="Nenhum movimento ainda."
        colunas={[
          { titulo: 'Data', celula: (m) => formatarData(m.data) },
          ...(nomeItem ? [{ titulo: 'Item', celula: (m: Movimento) => <b>{nomeItem(m.item_id)}</b> }] : []),
          {
            titulo: 'O que foi',
            celula: (m) => (
              <span className={cx(m.situacao === 'cancelado' && 'text-slate-400 line-through')}>
                <span className={cx('font-semibold', m.tipo === 'ajuste' && 'text-red-700')}>
                  {m.tipo === 'ajuste' && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}
                  {ROTULO_MOVIMENTO[m.tipo]}
                </span>
                <span className="block text-xs text-slate-500">
                  {[
                    m.responsavel_tipo === 'colaborador' ? nomePessoa(m.colaborador_id) : m.responsavel_tipo === 'cliente' ? 'Cliente/hóspede' : m.responsavel_tipo ? 'Não identificado' : '',
                    m.motivo,
                  ].filter(Boolean).join(' · ')}
                </span>
              </span>
            ),
          },
          {
            titulo: 'Qtd.',
            className: 'text-right',
            celula: (m) => (
              <span className={cx('font-semibold tabular-nums', m.situacao === 'cancelado' ? 'text-slate-400 line-through' : m.quantidade < 0 ? 'text-red-700' : 'text-emerald-700')}>
                {comSinal(Number(m.quantidade))}
              </span>
            ),
          },
        ]}
      />
      {aberto && <JanelaMovimento movimento={aberto} nomePessoa={nomePessoa} aoFechar={() => setAberto(null)} />}
    </>
  )
}

function JanelaMovimento({ movimento: m, nomePessoa, aoFechar }: { movimento: Movimento; nomePessoa: (id: string | null) => string; aoFechar: () => void }) {
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const atualizar = useAtualizarInventario()
  const [cancelando, setCancelando] = useState(false)
  const cancelar = useMutation({
    mutationFn: async (motivo: string) => {
      const { error } = await supabase.from('inventario_movimentos').update({ situacao: 'cancelado', motivo_cancelamento: motivo }).eq('id', m.id)
      if (error) throw error
    },
    onSuccess: () => {
      atualizar()
      aoFechar()
    },
  })
  // Compra vem do investimento e ajuste vem da contagem: corrige-se lá.
  const daqui = !m.gasto_id && !m.contagem_id
  return (
    <>
      <Janela
        aberta={!cancelando}
        aoFechar={aoFechar}
        titulo={`${ROTULO_MOVIMENTO[m.tipo]} · ${formatarData(m.data)}`}
        rodape={
          daqui ? (
            <>
              <BotaoExcluir modulo="inventario" tabela="inventario_movimentos" id={m.id} descricao="este movimento" aoExcluir={() => { atualizar(); aoFechar() }} />
              {m.situacao === 'registrado' && pode('inventario', 'cancelar') && <Botao variante="perigo" onClick={() => setCancelando(true)}>Cancelar</Botao>}
            </>
          ) : undefined
        }
      >
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Quantidade</dt><dd className="font-semibold">{comSinal(Number(m.quantidade))}</dd>
          {m.motivo && (<><dt className="text-slate-500">Motivo</dt><dd>{m.motivo}</dd></>)}
          {m.responsavel_tipo && (
            <>
              <dt className="text-slate-500">Responsável</dt>
              <dd>{m.responsavel_tipo === 'colaborador' ? nomePessoa(m.colaborador_id) : m.responsavel_tipo === 'cliente' ? 'Cliente / hóspede' : 'Não identificado'}</dd>
            </>
          )}
          {m.ocorrencia_id && (<><dt className="text-slate-500">Ocorrência</dt><dd>Registrada na ficha do colaborador</dd></>)}
          {m.gasto_id && (<><dt className="text-slate-500">Origem</dt><dd>Compra lançada em Investimentos</dd></>)}
          {m.contagem_id && (<><dt className="text-slate-500">Origem</dt><dd>Diferença encontrada na contagem, sem ocorrência registrada</dd></>)}
          <dt className="text-slate-500">Lançado por</dt><dd>{nome(m.criado_por)}</dd>
          {m.motivo_cancelamento && (<><dt className="text-slate-500">Cancelado</dt><dd>{m.motivo_cancelamento}</dd></>)}
        </dl>
        {!daqui && <p className="mt-3 text-xs text-slate-500">{m.gasto_id ? 'Para corrigir, cancele ou exclua a compra em Investimentos.' : 'Para desfazer, reabra a contagem.'}</p>}
      </Janela>
      <JanelaCancelar
        aberta={cancelando}
        titulo="Cancelar movimento"
        aviso={m.ocorrencia_id ? 'A ocorrência na ficha do colaborador também será cancelada.' : undefined}
        carregando={cancelar.isPending}
        erro={cancelar.error}
        aoFechar={() => setCancelando(false)}
        aoConfirmar={(motivo) => cancelar.mutate(motivo)}
      />
    </>
  )
}

/** Entrada ou saída avulsa (doação, transferência, empréstimo devolvido...). Sempre com motivo. */
function JanelaEntradaSaida({ item, aoFechar }: { item: Item; aoFechar: () => void }) {
  const atualizar = useAtualizarInventario()
  const [sentido, setSentido] = useState<'entrada' | 'saida'>('entrada')
  const [quantidade, setQuantidade] = useState('')
  const [data, setData] = useState(hojeISO())
  const [motivo, setMotivo] = useState('')
  const salvar = useMutation({
    mutationFn: async () => {
      const q = lerMoeda(quantidade)
      if (!q || q <= 0) throw new Error('Informe a quantidade.')
      const { error } = await supabase
        .from('inventario_movimentos')
        .insert({ item_id: item.id, data, tipo: sentido, quantidade: sentido === 'entrada' ? q : -q, motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      atualizar()
      aoFechar()
    },
  })
  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={`Entrada ou saída · ${item.nome}`}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-mov" carregando={salvar.isPending}>Salvar</Botao>
        </>
      }
    >
      <form id="form-mov" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar.mutate() }}>
        <Selecao
          rotulo="Tipo"
          value={sentido}
          onChange={(e) => setSentido(e.target.value as 'entrada' | 'saida')}
          opcoes={[{ valor: 'entrada', rotulo: 'Entrada (chegou)' }, { valor: 'saida', rotulo: 'Saída (saiu)' }]}
        />
        <Campo rotulo={`Quantidade (${item.unidade})`} inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} required autoFocus />
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        <AreaTexto rotulo="Motivo" className="sm:col-span-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} required placeholder="Ex.: doação, transferido do hotel, devolvido ao fornecedor" />
        <p className="text-xs text-slate-500 sm:col-span-2">
          Compras entram por Investimentos. Quebras e perdas, pelo botão “Quebra/perda” (ficam na ocorrência).
        </p>
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}
