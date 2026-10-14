import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Download, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarData, formatarMoeda, hojeISO, lerMoeda, somarDias } from '../../lib/formatos'
import { baixarCSV } from '../../lib/exportar'
import { AreaTexto, Botao, Campo, Carregando, Janela, Mensagem, Selecao, Selo, Tabela, cx, mensagemErro } from '../../components/ui'
import { BotaoExcluir, JanelaCancelar } from '../../components/registros'
import { FORMAS_CONTA, useCategoriasContas, useFornecedores, type ContaPagar } from './dados'

type Filtro = 'abertas' | 'vencidas' | 'semana' | 'pagas' | 'canceladas' | 'todas'

export function situacaoConta(c: Pick<ContaPagar, 'situacao' | 'vencimento'>, hoje = hojeISO()) {
  if (c.situacao !== 'aberta') return c.situacao
  if (c.vencimento < hoje) return 'vencida'
  if (c.vencimento === hoje) return 'vence hoje'
  return 'aberta'
}

/** Contas a pagar: boletos e contas mensais com vencimento, pagamento e parcelamento. */
export default function ContasPagar() {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const fornecedores = useFornecedores()
  const hoje = hojeISO()
  const [filtro, setFiltro] = useState<Filtro>('abertas')
  const [nova, setNova] = useState(false)
  const [aberta, setAberta] = useState<ContaPagar | null>(null)

  const contas = useQuery({
    queryKey: ['contas_pagar'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contas_pagar').select('*').order('vencimento').limit(1000)
      if (error) throw error
      return data as ContaPagar[]
    },
  })
  const nomeF = (id: string | null) => fornecedores.data?.find((f) => f.id === id)?.nome ?? ''
  const todas = contas.data ?? []
  const abertas = todas.filter((c) => c.situacao === 'aberta')
  const soma = (l: ContaPagar[]) => l.reduce((s, c) => s + Number(c.valor), 0)
  const vencidas = abertas.filter((c) => c.vencimento < hoje)
  const hojeL = abertas.filter((c) => c.vencimento === hoje)
  const semana = abertas.filter((c) => c.vencimento > hoje && c.vencimento <= somarDias(hoje, 7))
  const pagasMes = todas.filter((c) => c.situacao === 'paga' && (c.pago_em ?? '').slice(0, 7) === hoje.slice(0, 7))

  const filtradas = useMemo(() => {
    switch (filtro) {
      case 'abertas':
        return abertas
      case 'vencidas':
        return vencidas
      case 'semana':
        return [...hojeL, ...semana]
      case 'pagas':
        return todas.filter((c) => c.situacao === 'paga').sort((a, b) => (b.pago_em ?? '').localeCompare(a.pago_em ?? ''))
      case 'canceladas':
        return todas.filter((c) => c.situacao === 'cancelada')
      default:
        return todas
    }
  }, [filtro, todas, abertas, vencidas, hojeL, semana])

  const exportar = () =>
    baixarCSV('contas-a-pagar', filtradas, [
      { titulo: 'Vencimento', valor: (c) => formatarData(c.vencimento) },
      { titulo: 'Descrição', valor: (c) => c.descricao },
      { titulo: 'Fornecedor', valor: (c) => nomeF(c.fornecedor_id) },
      { titulo: 'Categoria', valor: (c) => c.categoria },
      { titulo: 'Parcela', valor: (c) => c.parcela },
      { titulo: 'Valor', valor: (c) => Number(c.valor) },
      { titulo: 'Situação', valor: (c) => situacaoConta(c, hoje) },
      { titulo: 'Pago em', valor: (c) => formatarData(c.pago_em) },
      { titulo: 'Valor pago', valor: (c) => (c.valor_pago != null ? Number(c.valor_pago) : '') },
    ])

  const cards: { f: Filtro; rotulo: string; valor: number; qtd: number; cor: string }[] = [
    { f: 'vencidas', rotulo: 'Vencidas', valor: soma(vencidas), qtd: vencidas.length, cor: vencidas.length ? 'border-red-300 bg-red-50' : '' },
    { f: 'semana', rotulo: 'Hoje e próximos 7 dias', valor: soma([...hojeL, ...semana]), qtd: hojeL.length + semana.length, cor: hojeL.length ? 'border-amber-300 bg-amber-50' : '' },
    { f: 'abertas', rotulo: 'Total em aberto', valor: soma(abertas), qtd: abertas.length, cor: '' },
    { f: 'pagas', rotulo: 'Pago neste mês', valor: pagasMes.reduce((s, c) => s + Number(c.valor_pago ?? c.valor), 0), qtd: pagasMes.length, cor: '' },
  ]

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.f}
            type="button"
            onClick={() => setFiltro(c.f)}
            className={cx('rounded-xl border border-acqua-suave bg-white p-3 text-left transition hover:border-acqua', c.cor, filtro === c.f && 'ring-2 ring-acqua')}
          >
            <p className="text-xs text-slate-500">{c.rotulo}</p>
            <p className="text-lg font-semibold tabular-nums text-acqua-titulo">{formatarMoeda(c.valor)}</p>
            <p className="text-xs text-slate-500">{c.qtd} conta(s)</p>
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Selecao
          rotulo="Mostrar"
          className="w-56"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as Filtro)}
          opcoes={[
            { valor: 'abertas', rotulo: 'Em aberto' },
            { valor: 'vencidas', rotulo: 'Vencidas' },
            { valor: 'semana', rotulo: 'Hoje e próximos 7 dias' },
            { valor: 'pagas', rotulo: 'Pagas' },
            { valor: 'canceladas', rotulo: 'Canceladas' },
            { valor: 'todas', rotulo: 'Todas' },
          ]}
        />
        <div className="ml-auto flex gap-2 self-end">
          {pode('financeiro', 'exportar') && <Botao variante="secundario" icone={<Download className="h-4 w-4" />} onClick={exportar}>Exportar</Botao>}
          {(pode('financeiro', 'criar') || pode('compras', 'editar')) && <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setNova(true)}>Nova conta</Botao>}
        </div>
      </div>
      {contas.isLoading ? (
        <Carregando />
      ) : (
        <Tabela
          linhas={filtradas}
          chave={(c) => c.id}
          aoClicar={setAberta}
          vazio="Nenhuma conta aqui."
          colunas={[
            {
              titulo: 'Vencimento',
              celula: (c) => (
                <span className={cx('font-semibold', situacaoConta(c, hoje) === 'vencida' && 'text-red-700', situacaoConta(c, hoje) === 'vence hoje' && 'text-amber-700')}>
                  {formatarData(c.vencimento)}
                </span>
              ),
            },
            {
              titulo: 'Conta',
              celula: (c) => (
                <span>
                  <span className="font-semibold">{c.descricao}</span>
                  <span className="block text-xs text-slate-500">{[nomeF(c.fornecedor_id), c.categoria, c.parcela && `parcela ${c.parcela}`].filter(Boolean).join(' · ')}</span>
                </span>
              ),
            },
            { titulo: 'Valor', celula: (c) => <span className="font-semibold tabular-nums">{formatarMoeda(c.valor)}</span> },
            { titulo: 'Situação', celula: (c) => <SeloConta situacao={situacaoConta(c, hoje)} /> },
          ]}
        />
      )}
      {nova && <NovaConta aoFechar={() => setNova(false)} aoSalvar={() => { setNova(false); qc.invalidateQueries({ queryKey: ['contas_pagar'] }) }} />}
      {aberta && <JanelaConta conta={aberta} nomeFornecedor={nomeF(aberta.fornecedor_id)} aoFechar={() => setAberta(null)} />}
    </>
  )
}

export function SeloConta({ situacao }: { situacao: string }) {
  const cores: Record<string, 'vermelho' | 'amarelo' | 'azul' | 'verde' | 'cinza'> = {
    vencida: 'vermelho',
    'vence hoje': 'amarelo',
    aberta: 'azul',
    paga: 'verde',
    cancelada: 'cinza',
  }
  const cor = cores[situacao] ?? 'cinza'
  return (
    <Selo cor={cor}>
      {situacao === 'vencida' && <AlertTriangle className="mr-1 h-3 w-3" />}
      {situacao === 'paga' && <CheckCircle2 className="mr-1 h-3 w-3" />}
      {situacao.charAt(0).toUpperCase() + situacao.slice(1)}
    </Selo>
  )
}

function NovaConta({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: () => void }) {
  const fornecedores = useFornecedores()
  const categorias = useCategoriasContas()
  const [descricao, setDescricao] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [categoria, setCategoria] = useState('Insumos')
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState(hojeISO())
  const [forma, setForma] = useState('boleto')
  const [parcelas, setParcelas] = useState('1')
  const [observacao, setObservacao] = useState('')
  const n = Math.max(1, Math.min(48, Number(parcelas) || 1))

  const salvar = useMutation({
    mutationFn: async () => {
      const v = lerMoeda(valor)
      if (!v || v <= 0) throw new Error('Informe o valor.')
      // Parcelas mensais com o mesmo dia de vencimento; centavos de diferença ficam na primeira.
      const parcela = Math.floor((v / n) * 100) / 100
      const primeira = Math.round((v - parcela * (n - 1)) * 100) / 100
      const linhas = Array.from({ length: n }, (_, i) => {
        const d = new Date(`${vencimento}T12:00:00Z`)
        d.setUTCMonth(d.getUTCMonth() + i)
        return {
          descricao: descricao.trim(),
          fornecedor_id: fornecedorId || null,
          categoria,
          valor: i === 0 ? primeira : parcela,
          data_compra: hojeISO(),
          vencimento: d.toISOString().slice(0, 10),
          forma,
          parcela: n > 1 ? `${i + 1}/${n}` : null,
          observacao: observacao.trim() || null,
        }
      })
      const { error } = await supabase.from('contas_pagar').insert(linhas)
      if (error) throw error
    },
    onSuccess: aoSalvar,
  })

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Nova conta a pagar"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-conta" carregando={salvar.isPending}>Salvar</Botao>
        </>
      }
    >
      <form id="form-conta" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar.mutate() }}>
        <Campo rotulo="Descrição" className="sm:col-span-2" value={descricao} onChange={(e) => setDescricao(e.target.value)} required autoFocus placeholder="Ex.: Boleto queijos, conta de luz, sindicato" />
        <Selecao rotulo="Fornecedor" value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} vazio="—" opcoes={(fornecedores.data ?? []).map((f) => ({ valor: f.id, rotulo: f.nome }))} />
        <Selecao rotulo="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} opcoes={categorias.map((c) => ({ valor: c, rotulo: c }))} />
        <Campo rotulo="Valor total (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required />
        <Campo rotulo={n > 1 ? '1º vencimento' : 'Vencimento'} type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} required />
        <Selecao rotulo="Forma de pagamento" value={forma} onChange={(e) => setForma(e.target.value)} opcoes={FORMAS_CONTA} />
        <Campo rotulo="Parcelas" type="number" min={1} max={48} value={parcelas} onChange={(e) => setParcelas(e.target.value)} ajuda={n > 1 && lerMoeda(valor) ? `${n}× de ~${formatarMoeda((lerMoeda(valor) ?? 0) / n)}, todo mês` : undefined} />
        <AreaTexto rotulo="Observação" className="sm:col-span-2" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}

function JanelaConta({ conta, nomeFornecedor, aoFechar }: { conta: ContaPagar; nomeFornecedor: string; aoFechar: () => void }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const [pagoEm, setPagoEm] = useState(conta.pago_em ?? hojeISO())
  const [valorPago, setValorPago] = useState(String(conta.valor_pago ?? conta.valor).replace('.', ','))
  const [cancelando, setCancelando] = useState(false)
  const atualizar = () => qc.invalidateQueries({ queryKey: ['contas_pagar'] })

  const mudar = useMutation({
    mutationFn: async (dados: Partial<ContaPagar>) => {
      const { error } = await supabase.from('contas_pagar').update(dados).eq('id', conta.id)
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
        titulo={conta.descricao}
        rodape={
          <>
            <BotaoExcluir modulo="financeiro" tabela="contas_pagar" id={conta.id} descricao={`a conta “${conta.descricao}”`} aoExcluir={() => { atualizar(); aoFechar() }} />
            {conta.situacao === 'aberta' && pode('financeiro', 'cancelar') && <Botao variante="perigo" onClick={() => setCancelando(true)}>Cancelar</Botao>}
            {conta.situacao === 'paga' && pode('financeiro', 'editar') && (
              <Botao variante="secundario" carregando={mudar.isPending} onClick={() => mudar.mutate({ situacao: 'aberta', pago_em: null, valor_pago: null })}>Desfazer pagamento</Botao>
            )}
            {conta.situacao === 'aberta' && pode('financeiro', 'editar') && (
              <Botao icone={<CheckCircle2 className="h-4 w-4" />} carregando={mudar.isPending} onClick={() => mudar.mutate({ situacao: 'paga', pago_em: pagoEm, valor_pago: lerMoeda(valorPago) ?? conta.valor })}>
                Marcar como paga
              </Botao>
            )}
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
            <dt className="text-slate-500">Valor</dt><dd className="font-semibold">{formatarMoeda(conta.valor)}{conta.parcela && ` · parcela ${conta.parcela}`}</dd>
            <dt className="text-slate-500">Vencimento</dt><dd>{formatarData(conta.vencimento)} · <SeloConta situacao={situacaoConta(conta)} /></dd>
            {nomeFornecedor && (<><dt className="text-slate-500">Fornecedor</dt><dd>{nomeFornecedor}</dd></>)}
            <dt className="text-slate-500">Categoria</dt><dd>{conta.categoria}</dd>
            {conta.forma && (<><dt className="text-slate-500">Forma</dt><dd>{FORMAS_CONTA.find((f) => f.valor === conta.forma)?.rotulo}</dd></>)}
            {conta.observacao && (<><dt className="text-slate-500">Obs.</dt><dd>{conta.observacao}</dd></>)}
            <dt className="text-slate-500">Lançada por</dt><dd>{nome(conta.criado_por)}</dd>
            {conta.situacao === 'paga' && (<><dt className="text-slate-500">Paga</dt><dd>{formatarData(conta.pago_em)} · {formatarMoeda(conta.valor_pago)} por {nome(conta.pago_por)}</dd></>)}
            {conta.motivo_cancelamento && (<><dt className="text-slate-500">Cancelada</dt><dd>{conta.motivo_cancelamento}</dd></>)}
          </dl>
          {conta.situacao === 'aberta' && pode('financeiro', 'editar') && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-acqua-gelo p-3">
              <Campo rotulo="Pago em" type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} />
              <Campo rotulo="Valor pago (R$)" inputMode="decimal" value={valorPago} onChange={(e) => setValorPago(e.target.value)} ajuda="Com juros ou desconto, se houver." />
            </div>
          )}
          {mudar.error && <Mensagem tipo="erro">{mensagemErro(mudar.error)}</Mensagem>}
        </div>
      </Janela>
      <JanelaCancelar
        aberta={cancelando}
        titulo="Cancelar conta"
        carregando={mudar.isPending}
        erro={mudar.error}
        aoFechar={() => setCancelando(false)}
        aoConfirmar={(motivo) => mudar.mutate({ situacao: 'cancelada', motivo_cancelamento: motivo })}
      />
    </>
  )
}
