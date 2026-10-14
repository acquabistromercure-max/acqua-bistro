// Gráficos simples em HTML (sem biblioteca): barras agrupadas, barras horizontais e indicadores com variação.
// Cores: paleta categórica validada (série 1 azul, série 2 laranja); texto sempre nas cores de texto, nunca na da série.
import { useState, type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cx } from './ui'

export const COR_SERIE = ['#2a78d6', '#eb6834', '#1baf7a'] as const

type Serie = { nome: string; cor: string; valores: number[] }

/** Barras verticais agrupadas por categoria (ex.: receita × despesa por quinzena). Uma escala só. */
export function BarrasAgrupadas({
  categorias,
  series,
  formatar,
  altura = 200,
  rotulo,
}: {
  categorias: string[]
  series: Serie[]
  formatar: (v: number) => string
  altura?: number
  rotulo: string
}) {
  const [foco, setFoco] = useState<number | null>(null)
  const maximo = Math.max(1, ...series.flatMap((s) => s.valores.map((v) => Math.max(0, v))))
  const linhas = [1, 0.5]
  return (
    <figure aria-label={rotulo}>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
          {series.map((s) => (
            <span key={s.nome} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} /> {s.nome}
            </span>
          ))}
        </div>
      )}
      <div className="relative" style={{ height: altura }}>
        {linhas.map((l) => (
          <div key={l} className="absolute inset-x-0 border-t border-dashed border-slate-200" style={{ bottom: `${l * 100}%` }}>
            <span className="absolute -top-2 left-0 bg-white pr-1 text-[10px] text-slate-400">{formatar(maximo * l)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-2 border-b border-slate-300 pl-12 sm:gap-3">
          {categorias.map((c, i) => (
            <div
              key={c}
              className="relative flex h-full flex-1 items-end justify-center gap-[2px]"
              onMouseEnter={() => setFoco(i)}
              onMouseLeave={() => setFoco(null)}
              onFocus={() => setFoco(i)}
              onBlur={() => setFoco(null)}
              tabIndex={0}
              aria-label={`${c}: ${series.map((s) => `${s.nome} ${formatar(s.valores[i] ?? 0)}`).join(', ')}`}
            >
              {series.map((s) => (
                <div
                  key={s.nome}
                  className={cx('w-full max-w-7 rounded-t transition-opacity', foco !== null && foco !== i && 'opacity-50')}
                  style={{ height: `${(Math.max(0, s.valores[i] ?? 0) / maximo) * 100}%`, background: s.cor, minHeight: (s.valores[i] ?? 0) > 0 ? 2 : 0 }}
                />
              ))}
              {foco === i && (
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                  <p className="mb-1 font-semibold text-acqua-titulo">{c}</p>
                  {series.map((s) => (
                    <p key={s.nome} className="flex items-center justify-between gap-3 text-slate-600">
                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: s.cor }} />{s.nome}</span>
                      <b className="tabular-nums text-acqua-titulo">{formatar(s.valores[i] ?? 0)}</b>
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex gap-2 pl-12 sm:gap-3">
        {categorias.map((c) => (
          <span key={c} className="flex-1 truncate text-center text-[10px] text-slate-500" title={c}>{c}</span>
        ))}
      </div>
    </figure>
  )
}

/** Barras horizontais de uma série (ex.: receita por forma de pagamento), com o valor escrito ao lado. */
export function BarrasHorizontais({
  itens,
  formatar,
  cor = COR_SERIE[0],
  vazio = 'Sem dados no período.',
}: {
  itens: { rotulo: string; valor: number; detalhe?: string }[]
  formatar: (v: number) => string
  cor?: string
  vazio?: string
}) {
  const maximo = Math.max(1, ...itens.map((i) => i.valor))
  const total = itens.reduce((s, i) => s + i.valor, 0)
  if (!itens.length || !total) return <p className="py-6 text-center text-sm text-slate-500">{vazio}</p>
  return (
    <ul className="space-y-2.5">
      {itens.map((i) => (
        <li key={i.rotulo} title={i.detalhe}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="truncate text-slate-700">{i.rotulo}</span>
            <span className="shrink-0 tabular-nums text-acqua-titulo">
              <b>{formatar(i.valor)}</b> <span className="text-xs text-slate-500">{Math.round((i.valor / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${(i.valor / maximo) * 100}%`, background: cor }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Indicador com valor, comparação com o período anterior e seta (subir pode ser bom ou ruim). */
export function Indicador({
  rotulo,
  valor,
  anterior,
  formatar,
  subirEhBom = true,
  icone,
  detalhe,
}: {
  rotulo: string
  valor: number
  anterior?: number
  formatar: (v: number) => string
  subirEhBom?: boolean
  icone?: ReactNode
  detalhe?: string
}) {
  const v = anterior ? Math.round(((valor - anterior) / Math.abs(anterior)) * 1000) / 10 : null
  const bom = v === null || v === 0 ? null : v > 0 === subirEhBom
  return (
    <div className="rounded-2xl border border-acqua-suave bg-white p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-acqua-petroleo">{icone}{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-acqua-titulo">{formatar(valor)}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
        {v === null ? (
          <>sem comparação</>
        ) : (
          <>
            <span className={cx('flex items-center font-semibold', bom === true && 'text-emerald-700', bom === false && 'text-red-700')}>
              {v > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : v < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
              {v > 0 ? '+' : ''}{String(v).replace('.', ',')}%
            </span>
            vs. anterior ({formatar(anterior ?? 0)})
          </>
        )}
      </p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </div>
  )
}
