import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, Lock, Unlock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarData, formatarDataHora, formatarMoeda, hojeISO, somarDias } from '../../lib/formatos'
import { NOMES_DIAS, diaDaSemana } from '../../lib/ponto'
import { FORMAS_CAIXA, arred, avaliarSoma, conferencia, somarValores, totalBruto, totalTaxas, type Categoria, type ChaveVenda, type Valores } from '../../lib/caixa'
import { AreaTexto, Botao, Campo, Cartao, Carregando, Mensagem, Selo, cx, mensagemErro } from '../../components/ui'
import { BotaoExcluir } from '../../components/registros'
import { ListaMovimentos, NovoMovimento } from './Movimentos'
import { totaisMovimentos, useCafesNoCaixa, useCaixaDias, useMovimentos, useRegrasCaixa } from './dados'

const formatarCampo = (n: number | undefined) => (n ? String(n).replace('.', ',') : '')

/** O caixa de um dia: vendas por forma/bandeira, cafés (automático), entradas/saídas e conferência do dinheiro. */
export default function DiaCaixa() {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const [params, setParams] = useSearchParams()
  const hoje = hojeISO()
  const [data, setData] = useState(hoje)
  const { taxas, saldo } = useRegrasCaixa()
  const [novo, setNovo] = useState<{ sentido: 'entrada' | 'saida'; categoria?: Categoria } | null>(null)

  // Atalhos do painel: ?novo=vale / ?novo=retirada
  useEffect(() => {
    const p = params.get('novo')
    if (p === 'vale') setNovo({ sentido: 'saida', categoria: 'vale' })
    else if (p === 'retirada') setNovo({ sentido: 'saida' })
  }, [params])

  const inicioSaldo = saldo.data ?? '2000-01-01'
  const ontem = somarDias(data, -1)
  const dia = useCaixaDias(data, data)
  const movs = useMovimentos(data, data, 'caixa')
  const cafes = useCafesNoCaixa(data, data)
  // Para o saldo anterior: tudo desde o saldo inicial até ontem.
  const diasAntes = useCaixaDias(inicioSaldo, ontem)
  const movsAntes = useMovimentos(inicioSaldo, ontem, 'caixa')
  const cafesAntes = useCafesNoCaixa(inicioSaldo, ontem)

  const registro = dia.data?.[0] ?? null
  const fechado = !!registro?.fechado
  const podeLancar = registro ? pode('caixa', 'criar') || pode('caixa', 'editar') : pode('caixa', 'criar')
  const travado = fechado || !podeLancar

  const [campos, setCampos] = useState<Partial<Record<ChaveVenda, string>>>({})
  const [observacao, setObservacao] = useState('')
  const [contado, setContado] = useState('')
  useEffect(() => {
    setCampos(Object.fromEntries(FORMAS_CAIXA.map((f) => [f.chave, formatarCampo(registro?.vendas[f.chave])])))
    setObservacao(registro?.observacao ?? '')
    setContado(registro?.saldo_contado != null ? String(registro.saldo_contado).replace('.', ',') : '')
  }, [registro, data])

  const digitado: Valores = useMemo(
    () => Object.fromEntries(FORMAS_CAIXA.map((f) => [f.chave, avaliarSoma(campos[f.chave] ?? '') ?? 0]).filter(([, v]) => Number(v) !== 0)),
    [campos],
  )
  const invalidos = FORMAS_CAIXA.filter((f) => avaliarSoma(campos[f.chave] ?? '') === null)
  const doCafe: Valores = cafes.data?.get(data) ?? {}
  const total = somarValores(digitado, doCafe)
  const bruto = totalBruto(total)
  const taxa = totalTaxas(total, taxas)
  const { entradas, saidas } = totaisMovimentos(movs.data ?? [])

  const saldoAnterior = useMemo(() => {
    if (!saldo.data) return null
    const vendasDinheiro = (diasAntes.data ?? []).reduce((s, d) => s + Number(d.vendas.dinheiro ?? 0), 0)
    let cafeDinheiro = 0
    cafesAntes.data?.forEach((v) => (cafeDinheiro += Number(v.dinheiro ?? 0)))
    const t = totaisMovimentos(movsAntes.data ?? [])
    return arred(saldo.caixa + vendasDinheiro + cafeDinheiro + t.entradas - t.saidas)
  }, [saldo, diasAntes.data, cafesAntes.data, movsAntes.data])

  const contadoNumero = contado.trim() === '' ? null : avaliarSoma(contado)
  const conf = conferencia(saldoAnterior ?? 0, Number(total.dinheiro ?? 0), entradas, saidas, contadoNumero)

  const atualizar = () => qc.invalidateQueries({ queryKey: ['caixa_dias'] })
  const salvar = useMutation({
    mutationFn: async (fechar?: boolean) => {
      if (invalidos.length) throw new Error(`Confira: ${invalidos.map((f) => f.rotulo).join(', ')}.`)
      const dados = {
        vendas: digitado,
        observacao: observacao.trim() || null,
        saldo_contado: contadoNumero,
        ...(fechar ? { fechado: true, diferenca: conf.diferenca } : {}),
      }
      const { error } = registro
        ? await supabase.from('caixa_dias').update(dados).eq('id', registro.id)
        : await supabase.from('caixa_dias').insert({ ...dados, data, fechado: false })
      if (error) throw error
      if (fechar && !registro) {
        const { error: e2 } = await supabase.from('caixa_dias').update({ fechado: true, diferenca: conf.diferenca }).eq('data', data)
        if (e2) throw e2
      }
    },
    onSuccess: atualizar,
  })
  const reabrir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('caixa_dias').update({ fechado: false }).eq('id', registro!.id)
      if (error) throw error
    },
    onSuccess: atualizar,
  })

  const carregando = dia.isLoading || movs.isLoading
  const grupos = ['Crédito', 'Débito', 'Outros'] as const

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Botao variante="secundario" aria-label="Dia anterior" onClick={() => setData(somarDias(data, -1))}><ChevronLeft className="h-4 w-4" /></Botao>
        <Campo rotulo="Dia" type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} className="w-40" />
        <Botao variante="secundario" aria-label="Próximo dia" onClick={() => setData(somarDias(data, 1))}><ChevronRight className="h-4 w-4" /></Botao>
        {data !== hoje && <Botao variante="fantasma" onClick={() => setData(hoje)}>Hoje</Botao>}
        <p className="mb-2 ml-1 text-sm text-slate-600">{NOMES_DIAS[diaDaSemana(data)]}, {formatarData(data)}</p>
        <div className="mb-1 ml-auto">
          {fechado ? (
            <Selo cor="verde">Fechado por {nome(registro!.fechado_por)} · {formatarDataHora(registro!.fechado_em)}</Selo>
          ) : registro ? (
            <Selo cor="amarelo">Aberto</Selo>
          ) : (
            <Selo>Sem lançamento</Selo>
          )}
        </div>
      </div>

      {carregando ? (
        <Carregando />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.5fr,1fr]">
            <Cartao titulo="Vendas do dia">
              <p className="mb-3 text-xs text-slate-500">
                Digite o total de cada forma — pode somar como na planilha (ex.: 54+108+54). Os cafés lançados no módulo Café entram sozinhos.
              </p>
              <div className="space-y-4">
                {grupos.map((g) => (
                  <div key={g}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-acqua-petroleo">{g}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {FORMAS_CAIXA.filter((f) => f.grupo === g).map((f) => {
                        const cafe = Number(doCafe[f.chave] ?? 0)
                        const v = avaliarSoma(campos[f.chave] ?? '')
                        return (
                          <Campo
                            key={f.chave}
                            rotulo={g === 'Outros' ? f.rotulo : f.curto}
                            inputMode="decimal"
                            value={campos[f.chave] ?? ''}
                            disabled={travado}
                            onChange={(e) => setCampos({ ...campos, [f.chave]: e.target.value })}
                            erro={v === null ? 'Inválido' : undefined}
                            ajuda={[(campos[f.chave] ?? '').match(/\d[+-]/) && v ? `= ${formatarMoeda(v)}` : '', cafe ? `+ ${formatarMoeda(cafe)} café` : '']
                              .filter(Boolean)
                              .join(' ') || undefined}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <AreaTexto rotulo="Observações do dia" className="mt-4" value={observacao} disabled={travado} onChange={(e) => setObservacao(e.target.value)} />
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Numero rotulo="Total bruto" valor={formatarMoeda(bruto)} />
                <Numero rotulo="Taxas de cartão" valor={formatarMoeda(taxa)} />
                <Numero rotulo="Líquido" valor={formatarMoeda(arred(bruto - taxa))} destaque />
              </div>
              {!travado && (
                <div className="mt-4 flex justify-end">
                  <Botao variante="secundario" carregando={salvar.isPending && !salvar.variables} onClick={() => salvar.mutate(false)}>Salvar</Botao>
                </div>
              )}
            </Cartao>

            <div className="space-y-4">
              <Cartao titulo="Dinheiro no caixa">
                {saldoAnterior === null ? (
                  <Mensagem tipo="alerta">Informe o saldo inicial em <b>Caixa → Regras</b> para a conferência funcionar.</Mensagem>
                ) : (
                  <dl className="space-y-1 text-sm tabular-nums">
                    <Linha rotulo="Saldo de ontem" valor={saldoAnterior} />
                    <Linha rotulo="+ Vendas em dinheiro" valor={Number(total.dinheiro ?? 0)} />
                    <Linha rotulo="+ Entradas" valor={entradas} />
                    <Linha rotulo="− Saídas e retiradas" valor={-saidas} />
                    <Linha rotulo="= Deveria ter" valor={conf.esperado} forte />
                  </dl>
                )}
                <Campo
                  rotulo="Dinheiro contado agora"
                  className="mt-3"
                  inputMode="decimal"
                  value={contado}
                  disabled={travado}
                  onChange={(e) => setContado(e.target.value)}
                  placeholder="Conte as notas e moedas"
                />
                {conf.diferenca !== null && saldoAnterior !== null && (
                  <p className={cx('mt-2 text-sm font-semibold', conf.diferenca === 0 ? 'text-emerald-700' : 'text-red-700')}>
                    {conf.diferenca === 0 ? 'Bateu certinho.' : `Diferença: ${formatarMoeda(conf.diferenca)} (${conf.diferenca > 0 ? 'sobrando' : 'faltando'})`}
                  </p>
                )}
                {fechado && registro?.diferenca != null && registro.diferenca !== 0 && (
                  <p className="mt-1 text-xs text-slate-500">Diferença registrada no fechamento: {formatarMoeda(registro.diferenca)}</p>
                )}
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {registro && !fechado && (
                    <BotaoExcluir
                      modulo="caixa"
                      tabela="caixa_dias"
                      id={registro.id}
                      descricao={`o caixa de ${formatarData(data)}`}
                      aoExcluir={atualizar}
                    />
                  )}
                  {!fechado && pode('caixa', 'criar') && (
                    <Botao icone={<Lock className="h-4 w-4" />} carregando={salvar.isPending && !!salvar.variables} onClick={() => salvar.mutate(true)}>
                      Fechar o caixa
                    </Botao>
                  )}
                  {fechado && pode('caixa', 'aprovar') && (
                    <Botao variante="secundario" icone={<Unlock className="h-4 w-4" />} carregando={reabrir.isPending} onClick={() => reabrir.mutate()}>
                      Reabrir
                    </Botao>
                  )}
                </div>
                {(salvar.error || reabrir.error) && <div className="mt-3"><Mensagem tipo="erro">{mensagemErro(salvar.error || reabrir.error)}</Mensagem></div>}
                {salvar.isSuccess && !salvar.variables && <p className="mt-2 text-right text-xs text-emerald-700">Salvo.</p>}
              </Cartao>

              <Cartao
                titulo="Entradas e saídas"
                acoes={
                  pode('caixa', 'criar') &&
                  !fechado && (
                    <div className="flex gap-1">
                      <Botao variante="secundario" icone={<ArrowUpCircle className="h-4 w-4" />} onClick={() => setNovo({ sentido: 'saida' })}>Saída</Botao>
                      <Botao variante="secundario" icone={<ArrowDownCircle className="h-4 w-4" />} onClick={() => setNovo({ sentido: 'entrada' })}>Entrada</Botao>
                    </div>
                  )
                }
              >
                <ListaMovimentos lista={movs.data ?? []} vazio="Nenhuma entrada ou saída de dinheiro neste dia." />
              </Cartao>
            </div>
          </div>
        </>
      )}

      {novo && (
        <NovoMovimento
          data={data}
          conta="caixa"
          inicial={novo}
          aoFechar={() => {
            setNovo(null)
            if (params.get('novo')) setParams({}, { replace: true })
          }}
          aoSalvar={() => {
            setNovo(null)
            if (params.get('novo')) setParams({}, { replace: true })
            qc.invalidateQueries({ queryKey: ['caixa_movimentos'] })
            qc.invalidateQueries({ queryKey: ['lancamentos-colaborador'] })
          }}
        />
      )}
    </div>
  )
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={cx('rounded-lg px-2 py-2', destaque ? 'bg-acqua-suave' : 'bg-acqua-gelo')}>
      <p className="text-[11px] text-slate-500">{rotulo}</p>
      <p className="font-semibold tabular-nums text-acqua-titulo">{valor}</p>
    </div>
  )
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: number; forte?: boolean }) {
  return (
    <div className={cx('flex justify-between', forte && 'border-t border-acqua-suave pt-1 font-semibold text-acqua-titulo')}>
      <dt>{rotulo}</dt>
      <dd>{formatarMoeda(valor)}</dd>
    </div>
  )
}
