import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Banknote, ChevronLeft, ChevronRight, Coffee, Download, Info, Landmark, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarMoeda, hojeISO, somarDias } from '../../lib/formatos'
import { baixarCSV } from '../../lib/exportar'
import { quinzena } from '../../lib/cafe'
import { agrupar, dentro, periodoAnterior, periodoDe, periodoSeguinte, somaNoPeriodo, ultimasQuinzenas, type EscalaPeriodo, type Periodo } from '../../lib/financeiro'
import { Abas, Cartao, Carregando, Mensagem, Pagina, Botao, cx, mensagemErro } from '../../components/ui'
import { BarrasAgrupadas, BarrasHorizontais, COR_SERIE, Indicador } from '../../components/graficos'
import { useRegrasCaixa } from '../caixa/dados'
import { ROTULO_FONTE, useDadosFinanceiros, type Despesa, type Fonte, type Receita } from './dados'

const moedaCurta = (v: number) =>
  Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : formatarMoeda(v)

function resumo(receitas: Receita[], despesas: Despesa[], p: Pick<Periodo, 'inicio' | 'fim'>) {
  const r = receitas.filter((x) => dentro(x.data, p))
  const bruto = r.reduce((s, x) => s + x.valor, 0)
  const taxas = r.reduce((s, x) => s + x.taxa, 0)
  const desp = somaNoPeriodo(despesas, p)
  const liquido = bruto - taxas
  return { bruto, taxas, liquido, despesas: desp, resultado: liquido - desp, margem: bruto ? ((liquido - desp) / bruto) * 100 : 0 }
}

/** Painel financeiro: receitas, despesas, resultado, comparação de quinzenas, café, previsões e alertas. */
export default function PainelFinanceiro() {
  const { pode } = usePermissoes()
  const hoje = hojeISO()
  const [escala, setEscala] = useState<EscalaPeriodo>('quinzena')
  const [ref, setRef] = useState(hoje)
  const periodo = periodoDe(escala, ref)
  const anterior = periodoAnterior(escala, periodo)
  const quinzenas = ultimasQuinzenas(periodo.fim, 6)
  const { taxas } = useRegrasCaixa()
  const inicio = [anterior.inicio, quinzenas[0].inicio].sort()[0]
  const fim = [periodo.fim, somarDias(hoje, 31)].sort().reverse()[0]
  const dados = useDadosFinanceiros(inicio, fim, taxas)

  const receitas = dados.data?.receitas ?? []
  const despesas = dados.data?.despesas ?? []
  const atual = resumo(receitas, despesas, periodo)
  const ant = resumo(receitas, despesas, anterior)

  const porFonte = useMemo(
    () => agrupar(receitas.filter((r) => dentro(r.data, periodo)).map((r) => ({ chave: r.fonte, valor: r.valor }))).map((x) => ({ rotulo: ROTULO_FONTE[x.chave as Fonte], valor: x.valor })),
    [receitas, periodo],
  )
  const porCategoria = useMemo(
    () => agrupar(despesas.filter((d) => dentro(d.data, periodo)).map((d) => ({ chave: d.categoria, valor: d.valor }))).map((x) => ({ rotulo: x.chave, valor: x.valor })),
    [despesas, periodo],
  )
  const fornecedores = useMemo(
    () => agrupar(despesas.filter((d) => dentro(d.data, periodo) && d.origem !== 'Diárias').map((d) => ({ chave: d.quem, valor: d.valor }))).slice(0, 6).map((x) => ({ rotulo: x.chave, valor: x.valor })),
    [despesas, periodo],
  )

  const cafes = (dados.data?.cafes ?? []).filter((c) => dentro(c.data, periodo))
  const cafesAnt = (dados.data?.cafes ?? []).filter((c) => dentro(c.data, anterior))
  const hosp = cafes.reduce((s, c) => s + c.hospedes, 0)
  const serv = cafes.reduce((s, c) => s + c.servidos, 0)
  const tick = cafes.reduce((s, c) => s + c.tickets, 0)
  const servAnt = cafesAnt.reduce((s, c) => s + c.servidos, 0)
  const adiantamentos = somaNoPeriodo(dados.data?.adiantamentos ?? [], periodo)

  const aPagar30 = despesas.filter((d) => d.data > hoje && d.data <= somarDias(hoje, 30) && d.origem !== 'Diárias').reduce((s, d) => s + d.valor, 0)

  const mover = (n: 1 | -1) => setRef(n === 1 ? periodoSeguinte(escala, periodo).inicio : anterior.inicio)

  const exportar = () =>
    baixarCSV(`painel-financeiro-${periodo.inicio}-a-${periodo.fim}`, [
      ...porFonte.map((f) => ({ tipo: 'Receita', item: f.rotulo, valor: f.valor })),
      ...porCategoria.map((c) => ({ tipo: 'Despesa', item: c.rotulo, valor: c.valor })),
      { tipo: 'Resumo', item: 'Receita bruta', valor: atual.bruto },
      { tipo: 'Resumo', item: 'Taxas de cartão', valor: atual.taxas },
      { tipo: 'Resumo', item: 'Despesas', valor: atual.despesas },
      { tipo: 'Resumo', item: 'Resultado', valor: atual.resultado },
    ], [
      { titulo: 'Tipo', valor: (l) => l.tipo },
      { titulo: 'Item', valor: (l) => l.item },
      { titulo: 'Valor', valor: (l) => Math.round(l.valor * 100) / 100 },
    ])

  return (
    <Pagina
      titulo="Painel financeiro"
      descricao="Quanto entrou, quanto saiu, o que sobrou e para onde vai — comparado com o período anterior."
      acoes={
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-60">
            <Abas abas={[{ valor: 'quinzena', rotulo: 'Quinzena' }, { valor: 'mes', rotulo: 'Mês' }, { valor: 'ano', rotulo: 'Ano' }]} ativa={escala} aoMudar={setEscala} />
          </div>
          <div className="mb-4 flex items-center gap-1">
            <Botao variante="secundario" aria-label="Período anterior" onClick={() => mover(-1)}><ChevronLeft className="h-4 w-4" /></Botao>
            <span className="min-w-28 text-center text-sm font-semibold text-acqua-titulo">{periodo.rotulo}</span>
            <Botao variante="secundario" aria-label="Próximo período" onClick={() => mover(1)}><ChevronRight className="h-4 w-4" /></Botao>
            {!dentro(hoje, periodo) && <Botao variante="fantasma" onClick={() => setRef(hoje)}>Atual</Botao>}
            <Botao variante="secundario" icone={<Download className="h-4 w-4" />} onClick={exportar}>Exportar</Botao>
          </div>
        </div>
      }
    >
      {dados.error && <Mensagem tipo="erro">{mensagemErro(dados.error)}</Mensagem>}
      {dados.isLoading ? (
        <Carregando texto="Juntando caixa, cafés, eventos, contas e cartão…" />
      ) : (
        <div className="space-y-5">
          <Alertas />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador rotulo="Receita bruta" icone={<TrendingUp className="h-3.5 w-3.5" />} valor={atual.bruto} anterior={ant.bruto} formatar={formatarMoeda} detalhe={`Taxas de cartão: ${formatarMoeda(atual.taxas)}`} />
            <Indicador rotulo="Despesas" icone={<TrendingDown className="h-3.5 w-3.5" />} valor={atual.despesas} anterior={ant.despesas} formatar={formatarMoeda} subirEhBom={false} detalhe="Contas, cartão, compras do caixa e diárias" />
            <Indicador rotulo="Resultado" icone={<Landmark className="h-3.5 w-3.5" />} valor={atual.resultado} anterior={ant.resultado} formatar={formatarMoeda} detalhe={`Margem ${atual.margem.toFixed(1).replace('.', ',')}% da receita`} />
            <Indicador rotulo="Cafés servidos (hotel)" icone={<Coffee className="h-3.5 w-3.5" />} valor={serv} anterior={servAnt} formatar={(v) => String(Math.round(v))} detalhe={`${hosp} hóspedes · aproveitamento ${hosp ? Math.round((serv / hosp) * 100) : 0}% · ${tick} tickets`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.6fr,1fr]">
            <Cartao titulo="Quinzenas: receita × despesa">
              <BarrasAgrupadas
                rotulo="Receita e despesa nas últimas 6 quinzenas"
                categorias={quinzenas.map((q) => q.rotulo)}
                series={[
                  { nome: 'Receita bruta', cor: COR_SERIE[0], valores: quinzenas.map((q) => resumo(receitas, despesas, q).bruto) },
                  { nome: 'Despesas', cor: COR_SERIE[1], valores: quinzenas.map((q) => resumo(receitas, despesas, q).despesas) },
                ]}
                formatar={moedaCurta}
              />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-right text-xs tabular-nums">
                  <thead className="text-acqua-petroleo">
                    <tr>
                      <th className="py-1 text-left font-semibold">Quinzena</th>
                      <th className="py-1 font-semibold">Receita</th>
                      <th className="py-1 font-semibold">Despesas</th>
                      <th className="py-1 font-semibold">Resultado</th>
                      <th className="py-1 font-semibold">vs. anterior</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-acqua-suave">
                    {quinzenas.map((q, i) => {
                      const r = resumo(receitas, despesas, q)
                      const a = i > 0 ? resumo(receitas, despesas, quinzenas[i - 1]) : null
                      const v = a && a.bruto ? ((r.bruto - a.bruto) / a.bruto) * 100 : null
                      return (
                        <tr key={q.inicio} className={cx(q.inicio === quinzena(periodo.fim).inicio && 'font-semibold text-acqua-titulo')}>
                          <td className="py-1 text-left">{q.rotulo}</td>
                          <td className="py-1">{formatarMoeda(r.bruto)}</td>
                          <td className="py-1">{formatarMoeda(r.despesas)}</td>
                          <td className={cx('py-1', r.resultado < 0 && 'text-red-700')}>{formatarMoeda(r.resultado)}</td>
                          <td className={cx('py-1', v !== null && v < 0 && 'text-red-700', v !== null && v > 0 && 'text-emerald-700')}>
                            {v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Cartao>
            <Cartao titulo="De onde veio a receita">
              <BarrasHorizontais itens={porFonte} formatar={formatarMoeda} />
            </Cartao>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Cartao titulo="Para onde foi o dinheiro">
              <BarrasHorizontais itens={porCategoria} formatar={formatarMoeda} cor={COR_SERIE[1]} vazio="Nenhuma despesa lançada no período." />
            </Cartao>
            <Cartao titulo="Maiores fornecedores">
              <BarrasHorizontais itens={fornecedores} formatar={formatarMoeda} cor={COR_SERIE[1]} vazio="Sem compras no período." />
            </Cartao>
            <Cartao titulo="Próximos 30 dias">
              <dl className="space-y-3 text-sm">
                <Previsao icone={<Receipt className="h-4 w-4 text-[#eb6834]" />} rotulo="A pagar (contas e cartão)" valor={aPagar30} link={pode('contas') ? '/compras?aba=contas' : undefined} />
                <Previsao icone={<Wallet className="h-4 w-4 text-[#2a78d6]" />} rotulo="A receber das maquininhas e conta assinada" valor={null} link="/caixa?aba=recebimentos" />
                <Previsao icone={<Banknote className="h-4 w-4 text-slate-500" />} rotulo="Vales e adiantamentos dados no período" valor={adiantamentos} link="/colaboradores" />
              </dl>
              <p className="mt-4 flex items-start gap-1.5 text-xs text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Para não contar duas vezes: boleto pago pelo caixa deve ser lançado só em Contas a pagar; diária paga pelo caixa entra pela
                própria diária.
              </p>
            </Cartao>
          </div>
        </div>
      )}
    </Pagina>
  )
}

function Previsao({ icone, rotulo, valor, link }: { icone: ReactNode; rotulo: string; valor: number | null; link?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-2 text-slate-600">{icone}{link ? <Link to={link} className="link font-normal">{rotulo}</Link> : rotulo}</dt>
      <dd className="font-semibold tabular-nums text-acqua-titulo">{valor === null ? '→' : formatarMoeda(valor)}</dd>
    </div>
  )
}

/** Pendências que pedem ação: contas vencidas, caixas sem fechar, quinzena do hotel, eventos a receber, pedidos urgentes. */
function Alertas() {
  const hoje = hojeISO()
  const q = quinzena(hoje)
  const anteriorQ = quinzena(somarDias(q.inicio, -1))
  const dados = useQuery({
    queryKey: ['alertas-financeiro', hoje],
    staleTime: 60_000,
    queryFn: async () => {
      const [vencidas, caixas, enviadas, eventos, urgentes] = await Promise.all([
        supabase.from('contas_pagar').select('valor').eq('situacao', 'aberta').lt('vencimento', hoje),
        supabase.from('caixa_dias').select('data, fechado, diferenca').gte('data', somarDias(hoje, -7)).lt('data', hoje),
        supabase.from('quinzenas_hotel').select('id').eq('inicio', anteriorQ.inicio).neq('situacao', 'reaberta'),
        supabase.from('eventos').select('id').in('situacao', ['encerrado', 'faturado']),
        supabase.from('pedidos').select('id').eq('prioridade', 'urgente').in('situacao', ['solicitado', 'aprovado']),
      ])
      const lista: { texto: string; link: string; grave?: boolean }[] = []
      const v = vencidas.data ?? []
      if (!vencidas.error && v.length) lista.push({ texto: `${v.length} conta(s) vencida(s) · ${formatarMoeda(v.reduce((s, x) => s + Number(x.valor), 0))}`, link: '/compras?aba=contas', grave: true })
      const abertos = (caixas.data ?? []).filter((c) => !c.fechado)
      if (!caixas.error && abertos.length) lista.push({ texto: `${abertos.length} caixa(s) dos últimos dias sem fechar`, link: '/caixa' })
      const difer = (caixas.data ?? []).filter((c) => c.diferenca && Number(c.diferenca) !== 0)
      if (difer.length) lista.push({ texto: `${difer.length} fechamento(s) de caixa com diferença na última semana`, link: '/caixa?aba=mes', grave: true })
      if (!enviadas.error && !(enviadas.data ?? []).length) lista.push({ texto: `Quinzena do hotel ${anteriorQ.rotulo} ainda não foi enviada`, link: '/cafes?aba=quinzena' })
      if (!eventos.error && (eventos.data ?? []).length) lista.push({ texto: `${eventos.data!.length} evento(s) encerrado(s)/faturado(s) aguardando recebimento`, link: '/eventos' })
      if (!urgentes.error && (urgentes.data ?? []).length) lista.push({ texto: `${urgentes.data!.length} pedido(s) urgente(s) em aberto`, link: '/compras' })
      return lista
    },
  })
  if (!dados.data?.length) return null
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {dados.data.map((a) => (
        <Link
          key={a.texto}
          to={a.link}
          className={cx('flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition hover:shadow', a.grave ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900')}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" /> {a.texto}
        </Link>
      ))}
    </div>
  )
}
