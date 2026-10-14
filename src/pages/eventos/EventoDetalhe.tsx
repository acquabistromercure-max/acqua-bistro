import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChefHat, FileText, Pencil, Plus, Printer } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarData, formatarDataHora, formatarMoeda, hojeISO, lerMoeda } from '../../lib/formatos'
import { horaCurta } from '../../lib/ponto'
import { ETAPAS_EVENTO, demonstrativo, producao } from '../../lib/eventos'
import { esc, imprimirDocumento, tabelaHtml } from '../../lib/imprimir'
import { Botao, Campo, Cartao, Carregando, Janela, Mensagem, Pagina, Selecao, Tabela, Vazio, cx, mensagemErro } from '../../components/ui'
import { BotaoExcluir, JanelaCancelar, SeloSituacao } from '../../components/registros'
import { usePessoasEscala } from '../escalas/dados'
import FormEvento from './FormEvento'
import { consumosValidos, useClientes, useModelos, useProdutosEvento, type Consumo, type Evento } from './dados'

type Passo = { para: string; rotulo: string; acao: 'aprovar' | 'editar' | 'criar' }
const PROXIMO: Record<string, Passo | undefined> = {
  orcamento: { para: 'confirmado', rotulo: 'Confirmar evento', acao: 'aprovar' },
  confirmado: { para: 'em_andamento', rotulo: 'Iniciar evento', acao: 'criar' },
  em_andamento: { para: 'encerrado', rotulo: 'Encerrar evento', acao: 'criar' },
  encerrado: { para: 'faturado', rotulo: 'Faturar', acao: 'editar' },
}

export default function EventoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const clientes = useClientes()
  const modelos = useModelos()
  const [editando, setEditando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [recebendo, setRecebendo] = useState(false)

  const ev = useQuery({
    queryKey: ['eventos', 'um', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('eventos').select('*, evento_consumos(*)').eq('id', id!).single()
      if (error) throw error
      return data as Evento
    },
  })
  const atualizar = () => qc.invalidateQueries({ queryKey: ['eventos'] })

  const mudar = useMutation({
    mutationFn: async (dados: Partial<Evento>) => {
      const { error } = await supabase.from('eventos').update(dados).eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      setCancelando(false)
      setRecebendo(false)
      atualizar()
    },
  })

  if (ev.isLoading) return <Carregando />
  if (ev.error || !ev.data) return <Pagina titulo="Evento"><Mensagem tipo="erro">{mensagemErro(ev.error)}</Mensagem></Pagina>
  const e = ev.data
  const consumos = [...(e.evento_consumos ?? [])].sort((a, b) => b.momento.localeCompare(a.momento))
  const d = demonstrativo(e, consumosValidos(e))
  const cliente = clientes.data?.find((c) => c.id === e.cliente_id)
  const modelo = modelos.data?.find((m) => m.id === e.modelo_id)
  const etapa = ETAPAS_EVENTO.findIndex((x) => x.valor === e.situacao)
  const passo = PROXIMO[e.situacao]
  const fechado = ['faturado', 'recebido', 'cancelado'].includes(e.situacao)

  const imprimirOrcamento = () =>
    imprimirDocumento(
      `Evento ${e.titulo}`,
      `<h1>${e.situacao === 'orcamento' ? 'Orçamento' : 'Demonstrativo'} — ${esc(e.titulo)}</h1>
       <div class="campos">
         <div><b>Contratante</b>${esc(cliente?.nome ?? '—')}</div><div><b>Contato</b>${esc([e.contato, e.telefone].filter(Boolean).join(' · ') || '—')}</div>
         <div><b>Data</b>${esc(formatarData(e.data))} ${esc(horaCurta(e.hora_inicio))}${e.hora_fim ? `–${esc(horaCurta(e.hora_fim))}` : ''}</div><div><b>Local</b>${esc(e.local ?? '—')}</div>
         <div><b>Pessoas</b>${e.pessoas}</div><div><b>Pacote</b>${esc(modelo?.nome ?? 'Personalizado')}</div>
       </div>
       ${e.cardapio ? `<h2>Cardápio</h2><p style="white-space:pre-line">${esc(e.cardapio)}</p>` : ''}
       <h2>Valores</h2>
       ${tabelaHtml(
         [{ titulo: 'Descrição' }, { titulo: 'Qtd', num: true }, { titulo: 'Unitário', num: true }, { titulo: 'Total', num: true }],
         [
           ['Coffee break / pacote por pessoa', e.pessoas, formatarMoeda(e.preco_por_pessoa), formatarMoeda(d.pacote)],
           ...(d.adicional ? [['Adicional', '', '', formatarMoeda(d.adicional)]] : []),
           ...consumosValidos(e).map((c) => [`${c.produto} (${formatarDataHora(c.momento)})`, String(c.quantidade).replace('.', ','), formatarMoeda(c.preco_unitario), formatarMoeda(c.total)]),
         ],
       )}
       <p class="total">Total: ${formatarMoeda(d.total)}</p>
       ${d.sinal ? `<p class="total" style="font-weight:400">Sinal: ${formatarMoeda(d.sinal)} · Saldo: ${formatarMoeda(d.saldo)}</p>` : ''}
       <div class="assinaturas"><div>Acqua Bistrô</div><div>${esc(cliente?.nome ?? 'Contratante')}</div></div>`,
      { subtitulo: `Situação: ${ETAPAS_EVENTO.find((x) => x.valor === e.situacao)?.rotulo ?? e.situacao}` },
    )

  const imprimirProducao = () =>
    imprimirDocumento(
      `Produção ${e.titulo}`,
      `<h1>Lista de produção — ${esc(e.titulo)}</h1>
       <p>${esc(formatarData(e.data))} ${esc(horaCurta(e.hora_inicio))} · ${e.pessoas} pessoas · ${esc(e.local ?? '')}</p>
       ${modelo?.itens.length ? tabelaHtml([{ titulo: 'Item' }, { titulo: 'Por pessoa', num: true }, { titulo: 'Total', num: true }, { titulo: 'Unid.' }, { titulo: 'Pronto' }],
         producao(modelo.itens, e.pessoas).map((i) => [i.nome, String(i.por_pessoa).replace('.', ','), String(i.total).replace('.', ','), i.unidade, '☐'])) : ''}
       ${e.cardapio ? `<h2>Cardápio</h2><p style="white-space:pre-line">${esc(e.cardapio)}</p>` : ''}
       ${e.observacao ? `<h2>Observações</h2><p>${esc(e.observacao)}</p>` : ''}`,
    )

  return (
    <Pagina
      titulo={e.titulo}
      descricao={[cliente?.nome, `${formatarData(e.data)} ${horaCurta(e.hora_inicio)}`, `${e.pessoas} pessoas`, e.local].filter(Boolean).join(' · ')}
      acoes={
        <>
          <Botao variante="secundario" icone={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/eventos')}>Voltar</Botao>
          <Botao variante="secundario" icone={<Printer className="h-4 w-4" />} onClick={imprimirOrcamento}>{e.situacao === 'orcamento' ? 'Orçamento' : 'Demonstrativo'}</Botao>
          <Botao variante="secundario" icone={<ChefHat className="h-4 w-4" />} onClick={imprimirProducao}>Produção</Botao>
          {!fechado && (pode('eventos', 'editar') || (e.situacao === 'orcamento' && pode('eventos', 'criar'))) && (
            <Botao icone={<Pencil className="h-4 w-4" />} onClick={() => setEditando(true)}>Editar</Botao>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {e.situacao === 'cancelado' ? (
          <Mensagem tipo="erro">Evento cancelado: {e.motivo_cancelamento}</Mensagem>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <ol className="flex flex-wrap gap-1">
              {ETAPAS_EVENTO.map((x, i) => (
                <li key={x.valor} className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', i <= etapa ? 'bg-acqua-titulo text-white' : 'bg-slate-100 text-slate-500')}>
                  {i + 1}. {x.rotulo}
                </li>
              ))}
            </ol>
            <div className="ml-auto flex flex-wrap gap-2">
              <BotaoExcluir modulo="eventos" tabela="eventos" id={e.id} descricao={`o evento ${e.titulo}`} aoExcluir={() => { atualizar(); navigate('/eventos') }} className="" />
              {!fechado && pode('eventos', 'cancelar') && <Botao variante="perigo" onClick={() => setCancelando(true)}>Cancelar</Botao>}
              {passo && (pode('eventos', passo.acao) || pode('eventos', 'editar')) && (
                <Botao carregando={mudar.isPending} onClick={() => mudar.mutate({ situacao: passo.para })}>{passo.rotulo}</Botao>
              )}
              {e.situacao === 'faturado' && pode('eventos', 'editar') && <Botao onClick={() => setRecebendo(true)}>Registrar recebimento</Botao>}
            </div>
          </div>
        )}
        {mudar.error && <Mensagem tipo="erro">{mensagemErro(mudar.error)}</Mensagem>}

        <div className="grid gap-4 lg:grid-cols-[1fr,1.4fr]">
          <div className="space-y-4">
            <Cartao titulo="Valores">
              <dl className="space-y-1 text-sm tabular-nums">
                <Linha rotulo={`Pacote (${e.pessoas} × ${formatarMoeda(e.preco_por_pessoa)})`} valor={d.pacote} />
                {d.adicional !== 0 && <Linha rotulo="Adicional" valor={d.adicional} />}
                <Linha rotulo="Consumos avulsos" valor={d.extras} />
                <Linha rotulo="Total do evento" valor={d.total} forte />
                <Linha rotulo={`Sinal${e.sinal_pago_em ? ` (${formatarData(e.sinal_pago_em)})` : ''}`} valor={-d.sinal} />
                {e.valor_recebido != null && <Linha rotulo={`Recebido (${formatarData(e.recebido_em)})`} valor={-Number(e.valor_recebido)} />}
                <Linha rotulo="Saldo a receber" valor={d.saldo} forte destaque={d.saldo > 0} />
              </dl>
              {e.faturar_hotel && <p className="mt-2 text-xs text-slate-500">Cobrado na quinzena do hotel.</p>}
            </Cartao>
            <Cartao titulo={<span className="flex items-center gap-2"><FileText className="h-4 w-4 text-acqua-dourado" /> Cardápio</span>}>
              {modelo && <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-acqua-petroleo">{modelo.nome}</p>}
              {e.cardapio ? <p className="whitespace-pre-line text-sm">{e.cardapio}</p> : <p className="text-sm text-slate-500">Sem cardápio definido.</p>}
              {modelo?.itens.length ? (
                <ul className="mt-3 space-y-0.5 text-xs text-slate-600">
                  {producao(modelo.itens, e.pessoas).map((i) => <li key={i.nome}>{i.nome}: <b>{String(i.total).replace('.', ',')} {i.unidade}</b></li>)}
                </ul>
              ) : null}
              {e.observacao && <p className="mt-3 rounded-lg bg-acqua-gelo p-2 text-sm">{e.observacao}</p>}
            </Cartao>
          </div>
          <div className="space-y-4">
            <Consumos evento={e} consumos={consumos} fechado={fechado} />
            <Equipe evento={e} />
          </div>
        </div>
        <p className="text-xs text-slate-500">Criado por {nome(e.criado_por)}.</p>
      </div>

      {editando && <FormEvento evento={e} aoFechar={() => setEditando(false)} aoSalvar={() => { setEditando(false); atualizar() }} />}
      <JanelaCancelar aberta={cancelando} titulo="Cancelar evento" carregando={mudar.isPending} erro={mudar.error} aoFechar={() => setCancelando(false)} aoConfirmar={(m) => mudar.mutate({ situacao: 'cancelado', motivo_cancelamento: m })} />
      {recebendo && <Recebimento saldo={d.saldo} aoFechar={() => setRecebendo(false)} aoConfirmar={(valor, data) => mudar.mutate({ situacao: 'recebido', valor_recebido: valor, recebido_em: data })} carregando={mudar.isPending} />}
    </Pagina>
  )
}

function Linha({ rotulo, valor, forte, destaque }: { rotulo: string; valor: number; forte?: boolean; destaque?: boolean }) {
  return (
    <div className={cx('flex justify-between gap-2', forte && 'border-t border-acqua-suave pt-1 font-semibold text-acqua-titulo', destaque && 'text-amber-700')}>
      <dt>{rotulo}</dt>
      <dd>{formatarMoeda(valor)}</dd>
    </div>
  )
}

function Recebimento({ saldo, aoFechar, aoConfirmar, carregando }: { saldo: number; aoFechar: () => void; aoConfirmar: (v: number, d: string) => void; carregando: boolean }) {
  const [valor, setValor] = useState(String(saldo).replace('.', ','))
  const [data, setData] = useState(hojeISO())
  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Registrar recebimento"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Voltar</Botao>
          <Botao carregando={carregando} onClick={() => aoConfirmar(lerMoeda(valor) ?? saldo, data)}>Confirmar</Botao>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Valor recebido (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
        <Campo rotulo="Recebido em" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </div>
    </Janela>
  )
}

/** Consumos avulsos durante o evento: toque no produto, ajuste a quantidade e lance. */
function Consumos({ evento, consumos, fechado }: { evento: Evento; consumos: Consumo[]; fechado: boolean }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const produtos = useProdutosEvento()
  const [produto, setProduto] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [preco, setPreco] = useState('')
  const [aberto, setAberto] = useState<Consumo | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const atualizar = () => qc.invalidateQueries({ queryKey: ['eventos'] })

  const lancar = useMutation({
    mutationFn: async () => {
      const p = lerMoeda(preco)
      if (!produto.trim()) throw new Error('Escolha o produto.')
      if (p === null) throw new Error('Informe o preço.')
      const { error } = await supabase.from('evento_consumos').insert({
        evento_id: evento.id,
        produto: produto.trim(),
        quantidade: Number(quantidade.replace(',', '.')) || 1,
        preco_unitario: p,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setProduto('')
      setQuantidade('1')
      setPreco('')
      atualizar()
    },
  })
  const cancelar = useMutation({
    mutationFn: async (motivo: string) => {
      const { error } = await supabase.from('evento_consumos').update({ situacao: 'cancelado', motivo_cancelamento: motivo }).eq('id', aberto!.id)
      if (error) throw error
    },
    onSuccess: () => {
      setCancelando(false)
      setAberto(null)
      atualizar()
    },
  })

  return (
    <Cartao titulo="Consumos durante o evento">
      {!fechado && pode('eventos', 'criar') && (
        <form className="mb-4 space-y-2 rounded-xl bg-acqua-gelo p-3" onSubmit={(e) => { e.preventDefault(); lancar.mutate() }}>
          <div className="flex flex-wrap gap-1.5">
            {(produtos.data ?? []).filter((p) => p.ativo).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setProduto(p.nome); setPreco(String(p.preco).replace('.', ',')) }}
                className={cx('rounded-lg border px-2.5 py-1 text-xs font-semibold', produto === p.nome ? 'border-acqua-petroleo bg-acqua-titulo text-white' : 'border-[#C4D3E8] bg-white text-acqua-titulo hover:bg-acqua-suave')}
              >
                {p.nome} · {formatarMoeda(p.preco)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr,80px,110px,auto] items-end gap-2">
            <Campo rotulo="Produto" value={produto} onChange={(e) => setProduto(e.target.value)} />
            <Campo rotulo="Qtd" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            <Campo rotulo="Preço (R$)" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />
            <Botao type="submit" icone={<Plus className="h-4 w-4" />} carregando={lancar.isPending}>Lançar</Botao>
          </div>
          {lancar.error && <Mensagem tipo="erro">{mensagemErro(lancar.error)}</Mensagem>}
        </form>
      )}
      {consumos.length === 0 ? (
        <Vazio>Nenhum consumo avulso lançado.</Vazio>
      ) : (
        <Tabela
          linhas={consumos}
          chave={(c) => c.id}
          aoClicar={setAberto}
          colunas={[
            { titulo: 'Horário', celula: (c) => formatarDataHora(c.momento).slice(-5) },
            { titulo: 'Produto', celula: (c) => <b>{c.produto}</b> },
            { titulo: 'Qtd', celula: (c) => String(c.quantidade).replace('.', ',') },
            { titulo: 'Total', celula: (c) => (c.situacao === 'cancelado' ? <SeloSituacao situacao="cancelado" /> : formatarMoeda(c.total)) },
            { titulo: 'Lançado por', celula: (c) => nome(c.criado_por) },
          ]}
        />
      )}
      {aberto && !cancelando && (
        <Janela
          aberta
          aoFechar={() => setAberto(null)}
          titulo={`${aberto.produto} · ${formatarMoeda(aberto.total)}`}
          rodape={
            !fechado && (
              <>
                <BotaoExcluir modulo="eventos" tabela="evento_consumos" id={aberto.id} descricao={`o consumo de ${aberto.produto}`} aoExcluir={() => { setAberto(null); atualizar() }} />
                {aberto.situacao !== 'cancelado' && pode('eventos', 'cancelar') && <Botao variante="perigo" onClick={() => setCancelando(true)}>Cancelar</Botao>}
              </>
            )
          }
        >
          <p className="text-sm">{String(aberto.quantidade).replace('.', ',')} × {formatarMoeda(aberto.preco_unitario)} · {formatarDataHora(aberto.momento)} · {nome(aberto.criado_por)}</p>
          {aberto.motivo_cancelamento && <p className="mt-2 text-sm text-slate-500">Cancelado: {aberto.motivo_cancelamento}</p>}
        </Janela>
      )}
      <JanelaCancelar aberta={cancelando} titulo="Cancelar consumo" carregando={cancelar.isPending} erro={cancelar.error} aoFechar={() => setCancelando(false)} aoConfirmar={(m) => cancelar.mutate(m)} />
    </Cartao>
  )
}

/** Equipe do evento: diárias de diaristas/extras ligadas ao evento. */
function Equipe({ evento }: { evento: Evento }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const pessoas = usePessoasEscala()
  const [pessoa, setPessoa] = useState('')
  const [valor, setValor] = useState('')
  const diarias = useQuery({
    queryKey: ['diarias', 'evento', evento.id],
    enabled: pode('colaboradores'),
    queryFn: async () => {
      const { data, error } = await supabase.from('diarias').select('*, colaboradores(nome)').eq('evento_id', evento.id).order('data')
      if (error) throw error
      return data as { id: string; valor: number; situacao: string; funcao: string | null; colaboradores: { nome: string } | null }[]
    },
  })
  const convocar = useMutation({
    mutationFn: async () => {
      const v = lerMoeda(valor)
      if (!pessoa) throw new Error('Escolha a pessoa.')
      if (v === null) throw new Error('Informe o valor da diária.')
      const p = pessoas.data?.find((x) => x.id === pessoa)
      const { error } = await supabase.from('diarias').insert({ colaborador_id: pessoa, data: evento.data, valor: v, funcao: p?.funcao ?? null, evento_id: evento.id, observacao: `Evento: ${evento.titulo}` })
      if (error) throw error
    },
    onSuccess: () => {
      setPessoa('')
      setValor('')
      qc.invalidateQueries({ queryKey: ['diarias'] })
    },
  })
  if (!pode('colaboradores')) return null
  const total = (diarias.data ?? []).filter((x) => x.situacao !== 'cancelada').reduce((s, x) => s + Number(x.valor), 0)
  return (
    <Cartao titulo="Equipe extra (diárias)">
      {pode('colaboradores', 'criar') && (
        <div className="mb-3 grid grid-cols-[1fr,120px,auto] items-end gap-2">
          <Selecao rotulo="Pessoa" value={pessoa} onChange={(e) => setPessoa(e.target.value)} vazio="Escolha…" opcoes={(pessoas.data ?? []).filter((p) => p.situacao !== 'desligado').map((p) => ({ valor: p.id, rotulo: `${p.nome}${p.vinculo === 'diarista' ? ' (diarista)' : ''}` }))} />
          <Campo rotulo="Diária (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
          <Botao carregando={convocar.isPending} onClick={() => convocar.mutate()}>Convocar</Botao>
        </div>
      )}
      {convocar.error && <Mensagem tipo="erro">{mensagemErro(convocar.error)}</Mensagem>}
      {(diarias.data ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">Ninguém convocado para este evento.</p>
      ) : (
        <ul className="divide-y divide-acqua-suave text-sm">
          {diarias.data!.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-2 py-1.5">
              <span>{x.colaboradores?.nome}{x.funcao ? ` · ${x.funcao}` : ''}</span>
              <span className="flex items-center gap-2 tabular-nums">{formatarMoeda(x.valor)} <SeloSituacao situacao={x.situacao} /></span>
            </li>
          ))}
          <li className="pt-1.5 text-right font-semibold">Custo da equipe: {formatarMoeda(total)}</li>
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-500">Aprovar e pagar as diárias: Colaboradores → Diárias.</p>
    </Cartao>
  )
}
