import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, Download, Paperclip, Pencil, Plus, Wrench } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarData, formatarMoeda, hojeISO, normalizar, somarDias } from '../../lib/formatos'
import { baixarCSV } from '../../lib/exportar'
import { qtd } from '../../lib/inventario'
import { Botao, Campo, Cartao, Carregando, Janela, Mensagem, Pagina, Selecao, Selo, Tabela, cx, mensagemErro } from '../../components/ui'
import { BotaoExcluir, JanelaCancelar } from '../../components/registros'
import { BarrasHorizontais } from '../../components/graficos'
import { useFornecedores } from '../compras/dados'
import { rotuloCartao, useCartoes } from '../cartoes/dados'
import { CHAVES_INVENTARIO, useItens, type Item } from '../inventario/dados'
import FormGasto from './FormGasto'
import { FORMAS_PAGO, TITULO, useCategoriasGastos, useGastos, type Gasto, type TipoGasto } from './dados'

const total = (l: Gasto[]) => l.reduce((s, g) => s + Number(g.valor), 0)

/** Obra, Manutenção ou Investimentos: mesma tela, com o que é próprio de cada um. */
export default function Gastos({ tipo }: { tipo: TipoGasto }) {
  const { pode } = usePermissoes()
  const gastos = useGastos(tipo)
  const fornecedores = useFornecedores()
  const cartoes = useCartoes()
  const itens = useItens()
  const categorias = useCategoriasGastos(tipo)
  const hoje = hojeISO()
  const [inicio, setInicio] = useState(tipo === 'obra' ? '' : `${hoje.slice(0, 4)}-01-01`)
  const [fim, setFim] = useState('')
  const [projeto, setProjeto] = useState('')
  const [categoria, setCategoria] = useState('')
  const [equipamento, setEquipamento] = useState('')
  const [busca, setBusca] = useState('')
  const [cancelados, setCancelados] = useState(false)
  const [novo, setNovo] = useState<{ item?: string } | null>(null)
  const [aberto, setAberto] = useState<Gasto | null>(null)

  const todos = gastos.data ?? []
  const nomeF = (id: string | null) => fornecedores.data?.find((f) => f.id === id)?.nome ?? ''
  const porItem = useMemo(() => new Map((itens.data ?? []).map((i) => [i.id, i])), [itens.data])
  const projetos = useMemo(() => [...new Set(todos.map((g) => g.projeto).filter(Boolean) as string[])].sort(), [todos])

  const lista = todos.filter((g) => {
    const b = normalizar(busca)
    return (
      (cancelados || g.situacao === 'registrado') &&
      (!inicio || g.data >= inicio) &&
      (!fim || g.data <= fim) &&
      (!projeto || g.projeto === projeto) &&
      (!categoria || g.categoria === categoria) &&
      (!equipamento || g.item_id === equipamento) &&
      (!b || normalizar(`${g.descricao} ${g.prestador ?? ''} ${nomeF(g.fornecedor_id)} ${g.projeto ?? ''}`).includes(b))
    )
  })
  const validos = lista.filter((g) => g.situacao === 'registrado')
  const agrupar = (chave: (g: Gasto) => string) => {
    const m = new Map<string, number>()
    validos.forEach((g) => m.set(chave(g), (m.get(chave(g)) ?? 0) + Number(g.valor)))
    return [...m.entries()].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor)
  }

  const comoPagou = (g: Gasto) => {
    switch (g.pagamento) {
      case 'pago':
        return `Pago · ${FORMAS_PAGO.find((f) => f.valor === g.forma)?.rotulo ?? g.forma ?? ''}`
      case 'caixa':
        return 'Dinheiro do caixa'
      case 'fundo':
        return 'Fundo de despesas'
      case 'cartao': {
        const c = cartoes.data?.find((x) => x.id === g.cartao_id)
        return `${c ? rotuloCartao(c) : 'Cartão'}${g.parcelas > 1 ? ` · ${g.parcelas}×` : ''}`
      }
      default:
        return `A pagar · ${formatarData(g.vencimento)}${g.parcelas > 1 ? ` · ${g.parcelas}×` : ''}`
    }
  }

  const exportar = () =>
    baixarCSV(`${tipo}-${hoje}`, lista, [
      { titulo: 'Data', valor: (g) => formatarData(g.data) },
      ...(tipo === 'obra' ? [{ titulo: 'Obra', valor: (g: Gasto) => g.projeto }] : []),
      ...(tipo !== 'obra' ? [{ titulo: tipo === 'manutencao' ? 'Equipamento' : 'Item', valor: (g: Gasto) => (g.item_id ? porItem.get(g.item_id)?.nome : '') }] : []),
      { titulo: 'Descrição', valor: (g) => g.descricao },
      { titulo: 'Categoria', valor: (g) => g.categoria },
      { titulo: 'Fornecedor/prestador', valor: (g) => nomeF(g.fornecedor_id) || g.prestador },
      ...(tipo === 'investimento' ? [{ titulo: 'Quantidade', valor: (g: Gasto) => (g.quantidade != null ? Number(g.quantidade) : '') }] : []),
      ...(tipo === 'manutencao' ? [{ titulo: 'Próxima manutenção', valor: (g: Gasto) => formatarData(g.proxima_manutencao) }] : []),
      { titulo: 'Pagamento', valor: comoPagou },
      { titulo: 'Valor', valor: (g) => Number(g.valor) },
      { titulo: 'Situação', valor: (g) => g.situacao },
    ])

  const t = TITULO[tipo]
  return (
    <Pagina
      titulo={t.titulo}
      descricao={t.descricao}
      acoes={
        <>
          {pode('gastos', 'exportar') && <Botao variante="secundario" icone={<Download className="h-4 w-4" />} onClick={exportar} disabled={!lista.length}>Exportar</Botao>}
          {pode('gastos', 'criar') && <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setNovo({})}>{t.novo}</Botao>}
        </>
      }
    >
      {tipo === 'manutencao' && <ProximasManutencoes gastos={todos} itens={itens.data ?? []} aoLancar={(item) => setNovo({ item })} podeLancar={pode('gastos', 'criar')} />}

      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-acqua-suave bg-white p-4">
          <p className="text-xs text-slate-500">{projeto ? `Total da obra “${projeto}”` : 'Total no período'}</p>
          <p className="text-2xl font-semibold tabular-nums text-acqua-titulo">{formatarMoeda(total(validos))}</p>
          <p className="text-xs text-slate-500">{validos.length} lançamento(s)</p>
          {tipo === 'investimento' && (
            <p className="mt-2 text-xs text-slate-500">
              {qtd(validos.filter((g) => g.item_id).reduce((s, g) => s + Number(g.quantidade ?? 0), 0))} unidade(s) entraram no inventário
            </p>
          )}
          {validos.some((g) => g.pagamento === 'a_pagar') && (
            <p className="mt-2 text-xs text-slate-500">{formatarMoeda(total(validos.filter((g) => g.pagamento === 'a_pagar')))} em contas a pagar</p>
          )}
        </div>
        <Cartao titulo="Por categoria" className="lg:col-span-1">
          <BarrasHorizontais itens={agrupar((g) => g.categoria)} formatar={formatarMoeda} />
        </Cartao>
        <Cartao titulo={tipo === 'obra' ? 'Por obra' : tipo === 'manutencao' ? 'Por equipamento' : 'Por fornecedor'}>
          <BarrasHorizontais
            itens={agrupar((g) =>
              tipo === 'obra' ? g.projeto || 'Sem obra definida' : tipo === 'manutencao' ? porItem.get(g.item_id ?? '')?.nome ?? '—' : nomeF(g.fornecedor_id) || g.prestador || 'Não informado',
            ).slice(0, 8)}
            formatar={formatarMoeda}
          />
        </Cartao>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Campo rotulo="Buscar" className="w-full sm:w-56" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Campo rotulo="De" type="date" className="w-40" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        <Campo rotulo="Até" type="date" className="w-40" value={fim} onChange={(e) => setFim(e.target.value)} />
        {tipo === 'obra' && <Selecao rotulo="Obra" className="w-52" value={projeto} onChange={(e) => setProjeto(e.target.value)} vazio="Todas" opcoes={projetos.map((p) => ({ valor: p, rotulo: p }))} />}
        {tipo === 'manutencao' && (
          <Selecao
            rotulo="Equipamento"
            className="w-52"
            value={equipamento}
            onChange={(e) => setEquipamento(e.target.value)}
            vazio="Todos"
            opcoes={[...new Set(todos.map((g) => g.item_id).filter(Boolean) as string[])].map((id) => ({ valor: id, rotulo: porItem.get(id)?.nome ?? '…' }))}
          />
        )}
        <Selecao rotulo="Categoria" className="w-44" value={categoria} onChange={(e) => setCategoria(e.target.value)} vazio="Todas" opcoes={categorias.map((c) => ({ valor: c, rotulo: c }))} />
        <label className="mb-2 flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={cancelados} onChange={(e) => setCancelados(e.target.checked)} /> Mostrar cancelados
        </label>
      </div>

      {gastos.isLoading ? (
        <Carregando />
      ) : gastos.error ? (
        <Mensagem tipo="erro">{mensagemErro(gastos.error)}</Mensagem>
      ) : (
        <Tabela
          linhas={lista}
          chave={(g) => g.id}
          aoClicar={setAberto}
          vazio={todos.length ? 'Nada com esses filtros.' : t.vazio}
          colunas={[
            { titulo: 'Data', celula: (g) => formatarData(g.data) },
            {
              titulo: tipo === 'manutencao' ? 'Equipamento / serviço' : 'Gasto',
              celula: (g) => (
                <span className={cx(g.situacao === 'cancelado' && 'text-slate-400 line-through')}>
                  <span className="font-semibold">
                    {tipo === 'manutencao' && g.item_id ? `${porItem.get(g.item_id)?.nome ?? '…'} — ` : ''}
                    {g.descricao}
                  </span>
                  {g.anexo && <Paperclip className="ml-1 inline h-3.5 w-3.5 text-slate-400" aria-label="Com nota anexada" />}
                  <span className="block text-xs text-slate-500">
                    {[
                      g.projeto,
                      g.categoria,
                      nomeF(g.fornecedor_id) || g.prestador,
                      tipo === 'investimento' && g.item_id && `${qtd(g.quantidade)} × ${porItem.get(g.item_id)?.nome ?? 'item'} no inventário`,
                      tipo === 'manutencao' && g.proxima_manutencao && `próxima: ${formatarData(g.proxima_manutencao)}`,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </span>
              ),
            },
            { titulo: 'Pagamento', celula: (g) => <span className="text-xs">{comoPagou(g)}</span> },
            {
              titulo: 'Valor',
              className: 'text-right',
              celula: (g) => (g.situacao === 'cancelado' ? <Selo cor="cinza">Cancelado</Selo> : <span className="font-semibold tabular-nums">{formatarMoeda(g.valor)}</span>),
            },
          ]}
        />
      )}

      {novo && <FormGasto tipo={tipo} projetos={projetos} itemInicial={novo.item} aoFechar={() => setNovo(null)} />}
      {aberto && (
        <JanelaGasto
          gasto={todos.find((g) => g.id === aberto.id) ?? aberto}
          projetos={projetos}
          comoPagou={comoPagou}
          nomeFornecedor={nomeF(aberto.fornecedor_id)}
          item={aberto.item_id ? porItem.get(aberto.item_id) : undefined}
          aoFechar={() => setAberto(null)}
        />
      )}
    </Pagina>
  )
}

/** Manutenção: a próxima de cada equipamento (a da última manutenção feita), com aviso de vencida/chegando. */
function ProximasManutencoes({ gastos, itens, aoLancar, podeLancar }: { gastos: Gasto[]; itens: Item[]; aoLancar: (item: string) => void; podeLancar: boolean }) {
  const hoje = hojeISO()
  const ultima = new Map<string, Gasto>()
  gastos
    .filter((g) => g.situacao === 'registrado' && g.item_id)
    .forEach((g) => {
      const atual = ultima.get(g.item_id!)
      if (!atual || g.data > atual.data) ultima.set(g.item_id!, g)
    })
  const proximas = [...ultima.values()]
    .filter((g) => g.proxima_manutencao)
    .sort((a, b) => a.proxima_manutencao!.localeCompare(b.proxima_manutencao!))
  const semRegistro = itens.filter((i) => i.ativo && i.equipamento && !ultima.has(i.id))
  if (!proximas.length && !semRegistro.length) return null
  const nome = (id: string) => itens.find((i) => i.id === id)?.nome ?? '…'
  return (
    <Cartao titulo={<span className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-acqua-dourado" /> Próximas manutenções</span>} className="mb-4">
      <ul className="divide-y divide-acqua-suave text-sm">
        {proximas.map((g) => {
          const vencida = g.proxima_manutencao! < hoje
          const chegando = !vencida && g.proxima_manutencao! <= somarDias(hoje, 15)
          return (
            <li key={g.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="flex-1">
                <b>{nome(g.item_id!)}</b>
                <span className="block text-xs text-slate-500">Última: {formatarData(g.data)} · {g.descricao}</span>
              </span>
              <Selo cor={vencida ? 'vermelho' : chegando ? 'amarelo' : 'azul'}>
                {vencida && <AlertTriangle className="mr-1 h-3 w-3" />}
                {vencida ? 'Vencida' : 'Próxima'}: {formatarData(g.proxima_manutencao)}
              </Selo>
              {podeLancar && (vencida || chegando) && (
                <Botao variante="secundario" icone={<Wrench className="h-4 w-4" />} onClick={() => aoLancar(g.item_id!)}>Lançar</Botao>
              )}
            </li>
          )
        })}
        {semRegistro.length > 0 && (
          <li className="py-2 text-xs text-slate-500">Sem manutenção registrada: {semRegistro.map((i) => i.nome).join(', ')}.</li>
        )}
      </ul>
    </Cartao>
  )
}

function JanelaGasto({
  gasto: g,
  projetos,
  comoPagou,
  nomeFornecedor,
  item,
  aoFechar,
}: {
  gasto: Gasto
  projetos: string[]
  comoPagou: (g: Gasto) => string
  nomeFornecedor: string
  item?: Item
  aoFechar: () => void
}) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const [editando, setEditando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['gastos'] })
    qc.invalidateQueries({ queryKey: ['painel-financeiro'] })
    CHAVES_INVENTARIO.forEach((queryKey) => qc.invalidateQueries({ queryKey }))
  }

  const cancelar = useMutation({
    mutationFn: async (motivo: string) => {
      const { error } = await supabase.from('gastos').update({ situacao: 'cancelado', motivo_cancelamento: motivo }).eq('id', g.id)
      if (error) throw error
    },
    onSuccess: () => {
      atualizar()
      setCancelando(false)
      aoFechar()
    },
  })
  const baixar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.storage.from('gastos').createSignedUrl(g.anexo!, 120)
      if (error) throw error
      window.open(data.signedUrl, '_blank')
    },
  })

  if (editando) return <FormGasto tipo={g.tipo} gasto={g} projetos={projetos} aoFechar={() => { setEditando(false); aoFechar() }} />

  const destino: Record<Gasto['pagamento'], string> = {
    pago: 'Pago direto: entra no painel financeiro como despesa.',
    caixa: 'Lançado como saída no caixa do dia.',
    fundo: 'Lançado como saída no fundo de despesas.',
    cartao: 'Lançado como compra no cartão (parcelas nas faturas).',
    a_pagar: 'Lançado em Contas a pagar.',
  }
  return (
    <>
      <Janela
        aberta={!cancelando}
        aoFechar={aoFechar}
        titulo={g.descricao}
        largura="max-w-xl"
        rodape={
          <>
            <BotaoExcluir
              modulo="gastos"
              tabela="gastos"
              id={g.id}
              descricao={`o gasto “${g.descricao}” e o que ele gerou (caixa, cartão, contas, inventário)`}
              aoExcluir={() => { atualizar(); aoFechar() }}
            />
            {g.situacao === 'registrado' && pode('gastos', 'cancelar') && <Botao variante="perigo" onClick={() => setCancelando(true)}>Cancelar</Botao>}
            {g.situacao === 'registrado' && pode('gastos', 'editar') && (
              <Botao variante="secundario" icone={<Pencil className="h-4 w-4" />} onClick={() => setEditando(true)}>Corrigir</Botao>
            )}
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
            <dt className="text-slate-500">Valor</dt><dd className="font-semibold">{formatarMoeda(g.valor)}</dd>
            <dt className="text-slate-500">Data</dt><dd>{formatarData(g.data)}</dd>
            {g.projeto && (<><dt className="text-slate-500">Obra</dt><dd>{g.projeto}</dd></>)}
            <dt className="text-slate-500">Categoria</dt><dd>{g.categoria}</dd>
            {(nomeFornecedor || g.prestador) && (<><dt className="text-slate-500">{nomeFornecedor ? 'Fornecedor' : 'Prestador'}</dt><dd>{nomeFornecedor || g.prestador}</dd></>)}
            {item && (<><dt className="text-slate-500">{g.tipo === 'manutencao' ? 'Equipamento' : 'Item'}</dt><dd>{item.nome}{g.quantidade ? ` · ${qtd(g.quantidade)} ${item.unidade} no inventário` : ''}</dd></>)}
            {g.proxima_manutencao && (<><dt className="text-slate-500">Próxima manutenção</dt><dd>{formatarData(g.proxima_manutencao)}</dd></>)}
            <dt className="text-slate-500">Pagamento</dt><dd>{comoPagou(g)}{g.responsavel ? ` · por ${g.responsavel}` : ''}</dd>
            {g.observacao && (<><dt className="text-slate-500">Obs.</dt><dd>{g.observacao}</dd></>)}
            <dt className="text-slate-500">Lançado por</dt><dd>{nome(g.criado_por)}</dd>
            {g.motivo_cancelamento && (<><dt className="text-slate-500">Cancelado</dt><dd>{g.motivo_cancelamento}</dd></>)}
          </dl>
          <p className="rounded-lg bg-acqua-gelo p-2 text-xs text-slate-600">{destino[g.pagamento]}</p>
          {g.anexo && (
            <Botao variante="secundario" icone={<Paperclip className="h-4 w-4" />} carregando={baixar.isPending} onClick={() => baixar.mutate()}>Ver nota/foto</Botao>
          )}
          {baixar.error && <Mensagem tipo="erro">{mensagemErro(baixar.error)}</Mensagem>}
        </div>
      </Janela>
      <JanelaCancelar
        aberta={cancelando}
        titulo="Cancelar gasto"
        aviso="O que este gasto gerou (saída do caixa, compra no cartão, contas em aberto e entrada no inventário) também é cancelado."
        carregando={cancelar.isPending}
        erro={cancelar.error}
        aoFechar={() => setCancelando(false)}
        aoConfirmar={(m) => cancelar.mutate(m)}
      />
    </>
  )
}
