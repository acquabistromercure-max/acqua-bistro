import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download, Lock, Printer, Unlock, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarData, formatarDataHora, formatarMoeda, hojeISO, lerMoeda } from '../../lib/formatos'
import { baixarCSV } from '../../lib/exportar'
import { NOMES_DIAS, diaDaSemana } from '../../lib/ponto'
import { MOTIVOS_AJUSTE, cafesGarantidos, moverQuinzena, quinzena, resumirQuinzena, tickets, totalDia, type ResumoQuinzena } from '../../lib/cafe'
import { AreaTexto, Botao, Campo, Cartao, Carregando, Janela, Mensagem, Selo, Vazio, cx, mensagemErro } from '../../components/ui'
import { useQuinzena, useTabelaPeriodo, type Ajuste, type CafeDia, type ConsumoQuarto } from './dados'

const LINHAS: { chave: keyof ResumoQuinzena; rotulo: string }[] = [
  { chave: 'cafes', rotulo: 'Cafés (servidos + tickets)' },
  { chave: 'ajustes', rotulo: 'Por fora da lista' },
  { chave: 'bordero', rotulo: 'Borderô (conta do quarto)' },
  { chave: 'eventos', rotulo: 'Eventos / coffee break' },
]

/** Quinzena com o hotel: dia a dia, totais, envio, valores aceitos pelo hotel, diferença e pagamento. */
export default function Quinzena() {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const [inicio, setInicio] = useState(quinzena(hojeISO()).inicio)
  const q = quinzena(inicio)
  const dias = useTabelaPeriodo<CafeDia>('cafe_dias', q.inicio, q.fim)
  const ajustes = useTabelaPeriodo<Ajuste>('cafe_ajustes', q.inicio, q.fim, { coluna: 'situacao', valor: 'registrado' })
  const bordero = useTabelaPeriodo<ConsumoQuarto>('consumos_quarto', q.inicio, q.fim, { coluna: 'situacao', valor: 'registrado' })
  const fechamento = useQuinzena(q.inicio)
  const ativa = fechamento.data?.ativa ?? null

  const [eventos, setEventos] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [conferindo, setConferindo] = useState(false)
  const [reabrindo, setReabrindo] = useState(false)

  const calculado = useMemo(
    () => resumirQuinzena(dias.data ?? [], ajustes.data ?? [], bordero.data ?? [], lerMoeda(eventos) ?? 0),
    [dias.data, ajustes.data, bordero.data, eventos],
  )
  // Enviada: vale o retrato guardado no envio.
  const resumo = (ativa?.resumo as ResumoQuinzena | undefined) ?? calculado
  const reconhecido = ativa?.reconhecido ?? {}
  const temReconhecido = Object.keys(reconhecido).length > 0
  const totalReconhecido = LINHAS.reduce((s, l) => s + Number(reconhecido[l.chave] ?? 0), 0)

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['quinzenas_hotel'] })
  }

  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('quinzenas_hotel').insert({ inicio: q.inicio, fim: q.fim, resumo: calculado })
      if (error) throw error
    },
    onSuccess: () => {
      setEnviando(false)
      atualizar()
    },
  })

  const exportar = () => {
    const linhasDias = (dias.data ?? []).map((d) => ({
      Data: formatarData(d.data),
      Hóspedes: d.hospedes,
      Garantido: cafesGarantidos(d),
      Servidos: d.cafes_servidos,
      Tickets: tickets(d),
      Valor: Number(d.valor_cafe),
      Total: totalDia(d),
    }))
    baixarCSV(
      `cafe-hotel-${q.inicio}-a-${q.fim}`,
      linhasDias,
      Object.keys(linhasDias[0] ?? { Data: '' }).map((k) => ({ titulo: k, valor: (l: Record<string, string | number>) => l[k] })),
    )
  }

  const exportarDetalhes = () =>
    baixarCSV(`cafe-por-fora-e-bordero-${q.inicio}-a-${q.fim}`, [...(ajustes.data ?? []).map((a) => ({ ...a, tipo: 'Por fora da lista' })), ...(bordero.data ?? []).map((b) => ({ ...b, tipo: 'Borderô' }))], [
      { titulo: 'Tipo', valor: (l) => l.tipo },
      { titulo: 'Data', valor: (l) => formatarData(l.data) },
      { titulo: 'Apto', valor: (l) => l.apartamento },
      {
        titulo: 'Descrição',
        valor: (l) =>
          'motivo' in l
            ? [MOTIVOS_AJUSTE.find((m) => m.valor === l.motivo)?.rotulo, l.autorizado_por, l.descricao].filter(Boolean).join(' · ')
            : `${l.quantidade}× ${l.item}${l.entregue_recepcao ? ' (entregue na recepção)' : ''}`,
      },
      { titulo: 'Valor', valor: (l) => Number(l.total) },
    ])

  const carregando = dias.isLoading || ajustes.isLoading || bordero.isLoading || fechamento.isLoading

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Botao variante="secundario" aria-label="Quinzena anterior" onClick={() => setInicio(moverQuinzena(inicio, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Botao>
        <span className="min-w-40 text-center text-sm font-semibold text-acqua-titulo">Quinzena {q.rotulo}</span>
        <Botao variante="secundario" aria-label="Próxima quinzena" onClick={() => setInicio(moverQuinzena(inicio, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Botao>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Botao variante="secundario" icone={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Imprimir</Botao>
          {pode('cafes', 'exportar') && (
            <>
              <Botao variante="secundario" icone={<Download className="h-4 w-4" />} onClick={exportar} disabled={!dias.data?.length}>Dias</Botao>
              <Botao variante="secundario" icone={<Download className="h-4 w-4" />} onClick={exportarDetalhes}>Por fora e borderô</Botao>
            </>
          )}
        </div>
      </div>
      <h2 className="hidden font-serif text-xl text-acqua-titulo print:block">Café da manhã — quinzena {q.rotulo}</h2>

      {carregando ? (
        <Carregando />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {ativa ? (
              <Selo cor={ativa.situacao === 'paga' ? 'verde' : 'azul'}>
                {ativa.situacao === 'paga' ? `Paga em ${formatarData(ativa.pago_em)}` : `Enviada ao hotel em ${formatarDataHora(ativa.criado_em)}`} por {nome(ativa.criado_por)}
              </Selo>
            ) : (
              <Selo cor="amarelo">Em aberto</Selo>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
            <Cartao titulo="Dia a dia">
              {(dias.data ?? []).length === 0 ? (
                <Vazio>Nenhum dia lançado nesta quinzena.</Vazio>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm tabular-nums">
                    <thead className="text-xs uppercase tracking-wider text-acqua-petroleo">
                      <tr>
                        {['Dia', 'Hóspedes', 'Garantido', 'Servidos', 'Tickets', 'Total'].map((t) => (
                          <th key={t} className="px-2 py-2 font-semibold">{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-acqua-suave">
                      {(dias.data ?? []).map((d) => (
                        <tr key={d.id}>
                          <td className="whitespace-nowrap px-2 py-1.5">{d.data.slice(8, 10)} {NOMES_DIAS[diaDaSemana(d.data)]}</td>
                          <td className="px-2 py-1.5">{d.hospedes}</td>
                          <td className="px-2 py-1.5">{String(cafesGarantidos(d)).replace('.', ',')}</td>
                          <td className="px-2 py-1.5">{d.cafes_servidos}</td>
                          <td className={cx('px-2 py-1.5', tickets(d) > 0 && 'font-semibold text-[#7A5A0E]')}>{tickets(d) || ''}</td>
                          <td className="px-2 py-1.5 font-semibold">{formatarMoeda(totalDia(d))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-acqua-suave font-semibold text-acqua-titulo">
                      <tr>
                        <td className="px-2 py-2">Total</td>
                        <td className="px-2 py-2">{calculado.hospedes}</td>
                        <td className="px-2 py-2">{String(calculado.garantidos).replace('.', ',')}</td>
                        <td className="px-2 py-2">{calculado.servidos}</td>
                        <td className="px-2 py-2">{calculado.tickets}</td>
                        <td className="px-2 py-2">{formatarMoeda(calculado.cafes)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Cartao>

            <Cartao titulo="Restaurante × Hotel">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-xs uppercase tracking-wider text-acqua-petroleo">
                  <tr>
                    <th className="py-2 text-left font-semibold">Linha</th>
                    <th className="py-2 text-right font-semibold">Restaurante</th>
                    {temReconhecido && <th className="py-2 text-right font-semibold">Hotel</th>}
                    {temReconhecido && <th className="py-2 text-right font-semibold">Diferença</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-acqua-suave">
                  {LINHAS.map((l) => {
                    const r = Number(resumo[l.chave] ?? 0)
                    const h = Number(reconhecido[l.chave] ?? 0)
                    return (
                      <tr key={l.chave}>
                        <td className="py-1.5">{l.rotulo}</td>
                        <td className="py-1.5 text-right">{formatarMoeda(r)}</td>
                        {temReconhecido && <td className="py-1.5 text-right">{formatarMoeda(h)}</td>}
                        {temReconhecido && <td className={cx('py-1.5 text-right font-semibold', h - r < 0 && 'text-red-700')}>{formatarMoeda(h - r)}</td>}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="border-t-2 border-acqua-suave font-semibold text-acqua-titulo">
                  <tr>
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right">{formatarMoeda(resumo.total)}</td>
                    {temReconhecido && <td className="py-2 text-right">{formatarMoeda(totalReconhecido)}</td>}
                    {temReconhecido && (
                      <td className={cx('py-2 text-right', totalReconhecido - resumo.total < 0 && 'text-red-700')}>{formatarMoeda(totalReconhecido - resumo.total)}</td>
                    )}
                  </tr>
                </tfoot>
              </table>

              {!ativa && (
                <div className="mt-4 space-y-3 print:hidden">
                  <Campo
                    rotulo="Eventos / coffee break da quinzena (R$)"
                    inputMode="decimal"
                    value={eventos}
                    onChange={(e) => setEventos(e.target.value)}
                    ajuda="Enquanto o módulo de eventos não fica pronto, informe o total aqui."
                  />
                  {pode('cafes', 'aprovar') && (
                    <Botao className="w-full" icone={<Lock className="h-4 w-4" />} onClick={() => setEnviando(true)} disabled={!dias.data?.length}>
                      Enviar quinzena ao hotel
                    </Botao>
                  )}
                </div>
              )}
              {ativa && pode('cafes', 'aprovar') && (
                <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                  <Botao icone={<Wallet className="h-4 w-4" />} onClick={() => setConferindo(true)}>
                    {ativa.situacao === 'paga' ? 'Ver pagamento' : 'Valores do hotel e pagamento'}
                  </Botao>
                  <Botao variante="secundario" icone={<Unlock className="h-4 w-4" />} onClick={() => setReabrindo(true)}>Reabrir</Botao>
                </div>
              )}
              {ativa?.observacao && <p className="mt-3 text-sm text-slate-600">{ativa.observacao}</p>}
            </Cartao>
          </div>

          {(fechamento.data?.historico.length ?? 0) > 1 && (
            <Cartao titulo="Histórico desta quinzena" className="print:hidden">
              <ul className="space-y-1 text-sm">
                {fechamento.data!.historico.map((h) => (
                  <li key={h.id}>
                    {formatarDataHora(h.criado_em)} · {h.situacao === 'reaberta' ? `reaberta: ${h.motivo_reabertura}` : h.situacao} · total {formatarMoeda(Number(h.resumo.total ?? 0))}
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </>
      )}

      <Janela
        aberta={enviando}
        aoFechar={() => setEnviando(false)}
        titulo={`Enviar quinzena ${q.rotulo}`}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setEnviando(false)}>Voltar</Botao>
            <Botao carregando={enviar.isPending} onClick={() => enviar.mutate()}>Enviar ({formatarMoeda(calculado.total)})</Botao>
          </>
        }
      >
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            Os valores de hoje ficam guardados e os lançamentos do hotel, por fora da lista e borderô desta quinzena ficam travados. Para
            corrigir depois, é preciso reabrir (com motivo).
          </p>
          {(bordero.data ?? []).some((b) => !b.entregue_recepcao) && (
            <Mensagem tipo="alerta">Há consumos do borderô ainda não marcados como entregues na recepção.</Mensagem>
          )}
          {enviar.error && <Mensagem tipo="erro">{mensagemErro(enviar.error)}</Mensagem>}
        </div>
      </Janela>

      {conferindo && ativa && <JanelaHotel quinzenaId={ativa.id} resumo={resumo} inicial={ativa} aoFechar={() => setConferindo(false)} aoSalvar={() => { setConferindo(false); atualizar() }} />}
      {reabrindo && ativa && <JanelaReabrir quinzenaId={ativa.id} aoFechar={() => setReabrindo(false)} aoSalvar={() => { setReabrindo(false); atualizar() }} />}
    </div>
  )
}

function JanelaHotel({
  quinzenaId,
  resumo,
  inicial,
  aoFechar,
  aoSalvar,
}: {
  quinzenaId: string
  resumo: ResumoQuinzena
  inicial: { reconhecido: Record<string, number>; valor_pago: number | null; pago_em: string | null; observacao: string | null; situacao: string }
  aoFechar: () => void
  aoSalvar: () => void
}) {
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(LINHAS.map((l) => [l.chave, String(inicial.reconhecido[l.chave] ?? resumo[l.chave] ?? 0).replace('.', ',')])),
  )
  const [valorPago, setValorPago] = useState(inicial.valor_pago != null ? String(inicial.valor_pago).replace('.', ',') : '')
  const [pagoEm, setPagoEm] = useState(inicial.pago_em ?? '')
  const [observacao, setObservacao] = useState(inicial.observacao ?? '')

  const salvar = useMutation({
    mutationFn: async () => {
      const reconhecido = Object.fromEntries(LINHAS.map((l) => [l.chave, lerMoeda(valores[l.chave] ?? '') ?? 0]))
      const pago = lerMoeda(valorPago)
      const { error } = await supabase
        .from('quinzenas_hotel')
        .update({
          reconhecido,
          observacao: observacao.trim() || null,
          ...(pago !== null && pagoEm ? { situacao: 'paga', valor_pago: pago, pago_em: pagoEm } : {}),
        })
        .eq('id', quinzenaId)
      if (error) throw error
    },
    onSuccess: aoSalvar,
  })

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Valores do hotel e pagamento"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Fechar</Botao>
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Botao>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <p className="text-sm text-slate-600 sm:col-span-2">Informe quanto o hotel aceitou em cada linha. A diferença aparece no quadro.</p>
        {LINHAS.map((l) => (
          <Campo
            key={l.chave}
            rotulo={`${l.rotulo} (R$)`}
            inputMode="decimal"
            value={valores[l.chave] ?? ''}
            onChange={(e) => setValores({ ...valores, [l.chave]: e.target.value })}
            ajuda={`Restaurante: ${formatarMoeda(Number(resumo[l.chave] ?? 0))}`}
          />
        ))}
        <Campo rotulo="Valor pago pelo hotel (R$)" inputMode="decimal" value={valorPago} onChange={(e) => setValorPago(e.target.value)} />
        <Campo rotulo="Pago em" type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} />
        <AreaTexto rotulo="Observação" className="sm:col-span-2" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </div>
    </Janela>
  )
}

function JanelaReabrir({ quinzenaId, aoFechar, aoSalvar }: { quinzenaId: string; aoFechar: () => void; aoSalvar: () => void }) {
  const [motivo, setMotivo] = useState('')
  const reabrir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('quinzenas_hotel').update({ situacao: 'reaberta', motivo_reabertura: motivo.trim() }).eq('id', quinzenaId)
      if (error) throw error
    },
    onSuccess: aoSalvar,
  })
  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Reabrir quinzena"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Voltar</Botao>
          <Botao carregando={reabrir.isPending} disabled={!motivo.trim()} onClick={() => reabrir.mutate()}>Reabrir</Botao>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-700">O envio continua no histórico como "reaberto". Depois das correções, envie a quinzena de novo.</p>
        <AreaTexto rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
        {reabrir.error && <Mensagem tipo="erro">{mensagemErro(reabrir.error)}</Mensagem>}
      </div>
    </Janela>
  )
}
