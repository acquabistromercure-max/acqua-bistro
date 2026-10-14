import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react'
import { usePermissoes } from '../../lib/permissoes'
import { formatarMoeda, hojeISO } from '../../lib/formatos'
import { baixarCSV } from '../../lib/exportar'
import { descreverPeriodo, intervalo } from '../../lib/periodos'
import { NOMES_DIAS, diaDaSemana, diasDoMes } from '../../lib/ponto'
import { FORMAS_CAIXA, arred, somarValores, totalBruto, totalTaxas, type Valores } from '../../lib/caixa'
import { Botao, Carregando, Mensagem, cx, mensagemErro } from '../../components/ui'
import { totaisMovimentos, useCafesNoCaixa, useCaixaDias, useMovimentos, useRegrasCaixa } from './dados'

type Linha = { data: string; valores: Valores; bruto: number; taxas: number; liquido: number; saidas: number; fechado: boolean; existe: boolean }

/** Planilha do mês: um dia por linha, uma coluna por forma/bandeira, totais, taxas e líquido. */
export default function MesCaixa() {
  const { pode } = usePermissoes()
  const [ref, setRef] = useState(hojeISO())
  const { inicio, fim } = intervalo('mes', ref)
  const { taxas } = useRegrasCaixa()
  const dias = useCaixaDias(inicio, fim)
  const cafes = useCafesNoCaixa(inicio, fim)
  const movs = useMovimentos(inicio, fim, 'caixa')

  const linhas: Linha[] = useMemo(() => {
    const porData = new Map((dias.data ?? []).map((d) => [d.data, d]))
    return diasDoMes(inicio.slice(0, 7)).map((data) => {
      const d = porData.get(data)
      const valores = somarValores(d?.vendas ?? {}, cafes.data?.get(data) ?? {})
      const bruto = totalBruto(valores)
      const t = totalTaxas(valores, taxas)
      const { saidas } = totaisMovimentos((movs.data ?? []).filter((m) => m.data === data))
      return { data, valores, bruto, taxas: t, liquido: arred(bruto - t), saidas, fechado: !!d?.fechado, existe: !!d || bruto > 0 }
    })
  }, [dias.data, cafes.data, movs.data, taxas, inicio])

  const colunas = FORMAS_CAIXA.filter((f) => linhas.some((l) => Number(l.valores[f.chave] ?? 0) !== 0) || ['credito_visa', 'credito_mastercard', 'debito_visa', 'debito_mastercard', 'pix', 'dinheiro', 'conta_assinada'].includes(f.chave))
  const total = (k: keyof Linha) => arred(linhas.reduce((s, l) => s + Number(l[k] ?? 0), 0))
  const totalForma = (chave: string) => arred(linhas.reduce((s, l) => s + Number(l.valores[chave as keyof Valores] ?? 0), 0))

  const mover = (n: 1 | -1) => {
    const d = new Date(`${inicio}T12:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + n)
    setRef(d.toISOString().slice(0, 10))
  }

  const exportar = () =>
    baixarCSV(`caixa-${inicio.slice(0, 7)}`, linhas.filter((l) => l.existe), [
      { titulo: 'Dia', valor: (l) => l.data.slice(8, 10) },
      ...colunas.map((c) => ({ titulo: c.rotulo, valor: (l: Linha) => Number(l.valores[c.chave] ?? 0) })),
      { titulo: 'Total bruto', valor: (l) => l.bruto },
      { titulo: 'Taxas', valor: (l) => l.taxas },
      { titulo: 'Total líquido', valor: (l) => l.liquido },
      { titulo: 'Saídas de dinheiro', valor: (l) => l.saidas },
    ])

  const erro = dias.error || movs.error

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Botao variante="secundario" aria-label="Mês anterior" onClick={() => mover(-1)}><ChevronLeft className="h-4 w-4" /></Botao>
        <span className="min-w-36 text-center text-sm font-semibold capitalize text-acqua-titulo">{descreverPeriodo('mes', ref)}</span>
        <Botao variante="secundario" aria-label="Próximo mês" onClick={() => mover(1)}><ChevronRight className="h-4 w-4" /></Botao>
        <div className="ml-auto flex gap-2">
          <Botao variante="secundario" icone={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Imprimir</Botao>
          {pode('caixa', 'exportar') && <Botao variante="secundario" icone={<Download className="h-4 w-4" />} onClick={exportar}>Exportar</Botao>}
        </div>
      </div>
      <h2 className="hidden font-serif text-xl capitalize text-acqua-titulo print:block">Controle de caixa — {descreverPeriodo('mes', ref)}</h2>
      {erro && <Mensagem tipo="erro">{mensagemErro(erro)}</Mensagem>}
      {dias.isLoading || movs.isLoading ? (
        <Carregando />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-acqua-suave bg-white">
          <table className="w-full text-right text-xs tabular-nums print:text-[8px]">
            <thead className="bg-acqua-gelo text-acqua-petroleo">
              <tr>
                <th className="sticky left-0 bg-acqua-gelo px-2 py-2 text-left font-semibold">Dia</th>
                {colunas.map((c) => (
                  <th key={c.chave} className="px-2 py-2 font-semibold">
                    <span className="block text-[10px] uppercase opacity-70">{c.grupo === 'Outros' ? '' : c.grupo}</span>
                    {c.curto}
                  </th>
                ))}
                <th className="px-2 py-2 font-semibold">Bruto</th>
                <th className="px-2 py-2 font-semibold">Taxas</th>
                <th className="px-2 py-2 font-semibold">Líquido</th>
                <th className="px-2 py-2 font-semibold">Saídas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-acqua-suave">
              {linhas.map((l) => (
                <tr key={l.data} className={cx(!l.existe && 'text-slate-300', diaDaSemana(l.data) === 7 && 'bg-red-50/30')}>
                  <td className="sticky left-0 whitespace-nowrap bg-white px-2 py-1.5 text-left font-semibold text-acqua-titulo">
                    {l.data.slice(8, 10)} <span className="font-normal text-slate-400">{NOMES_DIAS[diaDaSemana(l.data)]}</span>
                    {l.fechado && <span className="ml-1 text-emerald-600" title="Caixa fechado">✓</span>}
                  </td>
                  {colunas.map((c) => (
                    <td key={c.chave} className="px-2 py-1.5">{Number(l.valores[c.chave] ?? 0) ? formatarMoeda(l.valores[c.chave]).replace('R$', '').trim() : ''}</td>
                  ))}
                  <td className="px-2 py-1.5 font-semibold">{l.bruto ? formatarMoeda(l.bruto) : ''}</td>
                  <td className="px-2 py-1.5 text-slate-500">{l.taxas ? formatarMoeda(l.taxas) : ''}</td>
                  <td className="px-2 py-1.5 font-semibold text-acqua-titulo">{l.liquido ? formatarMoeda(l.liquido) : ''}</td>
                  <td className="px-2 py-1.5 text-red-700">{l.saidas ? formatarMoeda(l.saidas) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-acqua-suave bg-acqua-gelo font-semibold text-acqua-titulo">
              <tr>
                <td className="sticky left-0 bg-acqua-gelo px-2 py-2 text-left">Total</td>
                {colunas.map((c) => (
                  <td key={c.chave} className="px-2 py-2">{formatarMoeda(totalForma(c.chave))}</td>
                ))}
                <td className="px-2 py-2">{formatarMoeda(total('bruto'))}</td>
                <td className="px-2 py-2">{formatarMoeda(total('taxas'))}</td>
                <td className="px-2 py-2">{formatarMoeda(total('liquido'))}</td>
                <td className="px-2 py-2 text-red-700">{formatarMoeda(total('saidas'))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">Inclui os cafés pagos na hora lançados no módulo Café. ✓ = caixa do dia fechado e conferido.</p>
    </div>
  )
}
