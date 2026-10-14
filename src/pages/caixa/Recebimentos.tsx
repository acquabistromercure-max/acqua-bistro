import { useMemo } from 'react'
import { formatarData, formatarMoeda, hojeISO, somarDias } from '../../lib/formatos'
import { NOMES_DIAS, diaDaSemana } from '../../lib/ponto'
import { FORMAS_CAIXA, arred, preverRecebimentos, somarValores } from '../../lib/caixa'
import { Cartao, Carregando, Vazio, cx } from '../../components/ui'
import { useCafesNoCaixa, useCaixaDias, useRegrasCaixa } from './dados'

/** O que vai cair na conta nos próximos dias (crédito, débito, pix, conta assinada), já descontadas as taxas. */
export default function Recebimentos() {
  const hoje = hojeISO()
  // Vendas dos últimos 45 dias cobrem crédito em 30 dias e a conta assinada quinzenal.
  const inicio = somarDias(hoje, -45)
  const fim = somarDias(hoje, 45)
  const { taxas, prazos } = useRegrasCaixa()
  const dias = useCaixaDias(inicio, hoje)
  const cafes = useCafesNoCaixa(inicio, hoje)

  const previsoes = useMemo(() => {
    const porData = new Map((dias.data ?? []).map((d) => [d.data, d.vendas]))
    cafes.data?.forEach((v, data) => porData.set(data, somarValores(porData.get(data) ?? {}, v)))
    return preverRecebimentos([...porData].map(([data, valores]) => ({ data, valores })), taxas, prazos).filter((p) => p.data >= hoje && p.data <= fim)
  }, [dias.data, cafes.data, taxas, prazos, hoje, fim])

  const porDia = useMemo(() => {
    const m = new Map<string, { bruto: number; liquido: number; itens: Record<string, number> }>()
    for (const p of previsoes) {
      const atual = m.get(p.data) ?? { bruto: 0, liquido: 0, itens: {} }
      atual.bruto = arred(atual.bruto + p.bruto)
      atual.liquido = arred(atual.liquido + p.liquido)
      atual.itens[p.chave] = arred((atual.itens[p.chave] ?? 0) + p.liquido)
      m.set(p.data, atual)
    }
    return [...m].sort(([a], [b]) => a.localeCompare(b))
  }, [previsoes])

  const proximos7 = porDia.filter(([d]) => d <= somarDias(hoje, 7)).reduce((s, [, v]) => s + v.liquido, 0)
  const proximos30 = porDia.filter(([d]) => d <= somarDias(hoje, 30)).reduce((s, [, v]) => s + v.liquido, 0)
  const rotulo = (k: string) => FORMAS_CAIXA.find((f) => f.chave === k)?.rotulo ?? k

  if (dias.isLoading) return <Carregando />
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Resumo rotulo="Cai hoje" valor={porDia.find(([d]) => d === hoje)?.[1].liquido ?? 0} />
        <Resumo rotulo="Próximos 7 dias" valor={proximos7} />
        <Resumo rotulo="Próximos 30 dias" valor={proximos30} />
      </div>
      <Cartao titulo="Calendário de recebimentos (líquido de taxas)">
        {porDia.length === 0 ? (
          <Vazio>Nada previsto para os próximos dias.</Vazio>
        ) : (
          <ul className="divide-y divide-acqua-suave">
            {porDia.map(([data, v]) => (
              <li key={data} className={cx('flex flex-wrap items-start justify-between gap-2 py-2', data === hoje && 'rounded-lg bg-acqua-gelo px-2')}>
                <div>
                  <p className="font-semibold text-acqua-titulo">{NOMES_DIAS[diaDaSemana(data)]}, {formatarData(data)}</p>
                  <p className="text-xs text-slate-500">
                    {Object.entries(v.itens).map(([k, n]) => `${rotulo(k)} ${formatarMoeda(n)}`).join(' · ')}
                  </p>
                </div>
                <p className="font-semibold tabular-nums text-acqua-titulo">{formatarMoeda(v.liquido)}</p>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      <p className="text-xs text-slate-500">
        Prazos: crédito em {prazos.credito} dias, débito em {prazos.debito} dia(s); conta assinada de 1 a 15 cai no fim do mês e de 16 em diante no
        dia 15 seguinte. Ajuste em Regras.
      </p>
    </div>
  )
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-xl border border-acqua-suave bg-white p-3">
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="text-lg font-semibold tabular-nums text-acqua-titulo">{formatarMoeda(valor)}</p>
    </div>
  )
}
