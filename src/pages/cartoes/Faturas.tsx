import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarData, formatarMoeda, hojeISO, lerMoeda } from '../../lib/formatos'
import { dataVencimento, parcelas } from '../../lib/cartao'
import { imprimirDocumento, tabelaHtml } from '../../lib/imprimir'
import { Botao, Campo, Cartao as Caixa, Carregando, Mensagem, Selecao, Selo, Vazio, cx, mensagemErro } from '../../components/ui'
import { rotuloCartao, useCartoes, useComprasCartao, useFaturas } from './dados'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const nomeMes = (c: string) => `${MESES[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}`
function mover(c: string, n: number) {
  const t = Number(c.slice(0, 4)) * 12 + Number(c.slice(5, 7)) - 1 + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

/** Fatura do mês por cartão (calculada pelas compras e parcelas), pagamento e próximos meses comprometidos. */
export default function Faturas() {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const cartoes = useCartoes()
  const compras = useComprasCartao()
  const faturas = useFaturas()
  const [cartaoId, setCartaoId] = useState('')
  const [comp, setComp] = useState(hojeISO().slice(0, 7))
  const [valorPago, setValorPago] = useState('')
  const [pagoEm, setPagoEm] = useState(hojeISO())
  const cartao = cartoes.data?.find((c) => c.id === (cartaoId || cartoes.data?.[0]?.id))

  // Todas as parcelas de todas as compras válidas, com a fatura em que caem.
  const todas = useMemo(() => {
    const lista: { cartao_id: string; competencia: string; valor: number; numero: number; de: number; data: string; estabelecimento: string; itens: string }[] = []
    for (const c of compras.data ?? []) {
      if (c.situacao === 'cancelado') continue
      const regra = cartoes.data?.find((x) => x.id === c.cartao_id)
      if (!regra) continue
      for (const p of parcelas(c.data, Number(c.valor_total), c.parcelas, regra)) {
        lista.push({ ...p, cartao_id: c.cartao_id, data: c.data, estabelecimento: c.estabelecimento, itens: c.itens })
      }
    }
    return lista
  }, [compras.data, cartoes.data])

  const daFatura = todas.filter((p) => p.cartao_id === cartao?.id && p.competencia === comp).sort((a, b) => a.data.localeCompare(b.data))
  const total = Math.round(daFatura.reduce((s, p) => s + p.valor, 0) * 100) / 100
  const paga = faturas.data?.find((f) => f.cartao_id === cartao?.id && f.competencia === comp)
  const proximos = Array.from({ length: 6 }, (_, i) => mover(hojeISO().slice(0, 7), i)).map((m) => ({
    m,
    valor: Math.round(todas.filter((p) => p.cartao_id === cartao?.id && p.competencia === m).reduce((s, p) => s + p.valor, 0) * 100) / 100,
  }))
  const maior = Math.max(1, ...proximos.map((p) => p.valor))

  const pagar = useMutation({
    mutationFn: async () => {
      const v = lerMoeda(valorPago) ?? total
      const { error } = await supabase.from('faturas_cartao').insert({ cartao_id: cartao!.id, competencia: comp, valor_calculado: total, valor_pago: v, pago_em: pagoEm })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faturas_cartao'] }),
  })
  const desfazer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('faturas_cartao').delete().eq('id', paga!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faturas_cartao'] }),
  })

  const imprimir = () =>
    cartao &&
    imprimirDocumento(
      `Fatura ${nomeMes(comp)}`,
      `<h1>Fatura ${nomeMes(comp)} — ${rotuloCartao(cartao)}</h1>
       ${tabelaHtml(
         [{ titulo: 'Data' }, { titulo: 'Estabelecimento' }, { titulo: 'Itens' }, { titulo: 'Parcela' }, { titulo: 'Valor', num: true }],
         daFatura.map((p) => [formatarData(p.data), p.estabelecimento, p.itens, `${p.numero}/${p.de}`, formatarMoeda(p.valor)]),
       )}
       <p class="total">Total: ${formatarMoeda(total)}</p>`,
      { subtitulo: `Vencimento ${formatarData(dataVencimento(comp, cartao))}` },
    )

  if (cartoes.isLoading || compras.isLoading) return <Carregando />
  if (!cartoes.data?.length) return <Vazio>Cadastre o cartão na aba Cartões.</Vazio>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Selecao rotulo="Cartão" className="w-64" value={cartao?.id ?? ''} onChange={(e) => setCartaoId(e.target.value)} opcoes={cartoes.data.map((c) => ({ valor: c.id, rotulo: rotuloCartao(c) }))} />
        <div className="mb-0.5 flex items-center gap-1">
          <Botao variante="secundario" aria-label="Fatura anterior" onClick={() => setComp(mover(comp, -1))}><ChevronLeft className="h-4 w-4" /></Botao>
          <span className="min-w-28 text-center text-sm font-semibold capitalize text-acqua-titulo">{nomeMes(comp)}</span>
          <Botao variante="secundario" aria-label="Próxima fatura" onClick={() => setComp(mover(comp, 1))}><ChevronRight className="h-4 w-4" /></Botao>
        </div>
        <Botao variante="secundario" className="ml-auto" icone={<Printer className="h-4 w-4" />} onClick={imprimir} disabled={!daFatura.length}>Imprimir</Botao>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
        <Caixa
          titulo={`Fatura de ${nomeMes(comp)}${cartao ? ` · vence ${formatarData(dataVencimento(comp, cartao))}` : ''}`}
          acoes={paga ? <Selo cor="verde">Paga em {formatarData(paga.pago_em)}</Selo> : total > 0 ? <Selo cor="amarelo">Em aberto</Selo> : null}
        >
          {daFatura.length === 0 ? (
            <Vazio>Nenhuma parcela nesta fatura.</Vazio>
          ) : (
            <ul className="divide-y divide-acqua-suave text-sm">
              {daFatura.map((p, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="font-semibold text-acqua-titulo">{p.estabelecimento}</span>
                    <span className="block truncate text-xs text-slate-500">{formatarData(p.data)} · {p.itens}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    {formatarMoeda(p.valor)}
                    {p.de > 1 && <span className="block text-xs text-slate-500">{p.numero}/{p.de}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-right text-base font-semibold text-acqua-titulo">Total: {formatarMoeda(total)}</p>
          {paga ? (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Pago {formatarMoeda(paga.valor_pago)}{Number(paga.valor_pago) !== total && ` (calculado ${formatarMoeda(total)})`}</span>
              {pode('cartoes', 'editar') && <Botao variante="fantasma" carregando={desfazer.isPending} onClick={() => desfazer.mutate()}>Desfazer</Botao>}
            </div>
          ) : (
            total > 0 &&
            pode('cartoes', 'editar') && (
              <div className="mt-3 grid grid-cols-[1fr,1fr,auto] items-end gap-2 rounded-lg bg-acqua-gelo p-3">
                <Campo rotulo="Valor pago" inputMode="decimal" value={valorPago} onChange={(e) => setValorPago(e.target.value)} placeholder={String(total).replace('.', ',')} />
                <Campo rotulo="Pago em" type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} />
                <Botao carregando={pagar.isPending} onClick={() => pagar.mutate()}>Registrar</Botao>
              </div>
            )
          )}
          {(pagar.error || desfazer.error) && <div className="mt-2"><Mensagem tipo="erro">{mensagemErro(pagar.error || desfazer.error)}</Mensagem></div>}
        </Caixa>

        <Caixa titulo="Próximos 6 meses já comprometidos">
          <ul className="space-y-2">
            {proximos.map((p) => (
              <li key={p.m}>
                <button type="button" onClick={() => setComp(p.m)} className="w-full text-left">
                  <div className="flex justify-between text-sm">
                    <span className={cx('capitalize', p.m === comp && 'font-semibold text-acqua-titulo')}>{nomeMes(p.m)}</span>
                    <span className="tabular-nums">{formatarMoeda(p.valor)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-acqua-suave">
                    <div className="h-2 rounded-full bg-acqua-petroleo" style={{ width: `${(p.valor / maior) * 100}%` }} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {cartao?.limite ? <p className="mt-3 text-xs text-slate-500">Limite do cartão: {formatarMoeda(cartao.limite)}</p> : null}
        </Caixa>
      </div>
    </div>
  )
}
