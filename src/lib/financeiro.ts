// Painel financeiro: períodos (quinzena, mês, ano), comparação com o período anterior e agregações.
import { somarDias } from './formatos'
import { quinzena } from './cafe'

export type EscalaPeriodo = 'quinzena' | 'mes' | 'ano'
export type Periodo = { inicio: string; fim: string; rotulo: string }

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function periodoDe(escala: EscalaPeriodo, data: string): Periodo {
  if (escala === 'quinzena') {
    const q = quinzena(data)
    const mes = MESES[Number(data.slice(5, 7)) - 1]
    return { inicio: q.inicio, fim: q.fim, rotulo: `${q.inicio.slice(8, 10)}–${q.fim.slice(8, 10)} ${mes}/${data.slice(2, 4)}` }
  }
  if (escala === 'mes') {
    const inicio = `${data.slice(0, 7)}-01`
    const prox = new Date(`${inicio}T12:00:00Z`)
    prox.setUTCMonth(prox.getUTCMonth() + 1)
    return { inicio, fim: somarDias(prox.toISOString().slice(0, 10), -1), rotulo: `${MESES[Number(data.slice(5, 7)) - 1]}/${data.slice(0, 4)}` }
  }
  return { inicio: `${data.slice(0, 4)}-01-01`, fim: `${data.slice(0, 4)}-12-31`, rotulo: data.slice(0, 4) }
}

/** Período imediatamente anterior (para comparar). */
export function periodoAnterior(escala: EscalaPeriodo, p: Periodo): Periodo {
  return periodoDe(escala, somarDias(p.inicio, -1))
}

export function periodoSeguinte(escala: EscalaPeriodo, p: Periodo): Periodo {
  return periodoDe(escala, somarDias(p.fim, 1))
}

/** As n quinzenas que terminam na quinzena da data (da mais antiga para a atual). */
export function ultimasQuinzenas(data: string, n: number): Periodo[] {
  const lista: Periodo[] = []
  let p = periodoDe('quinzena', data)
  for (let i = 0; i < n; i++) {
    lista.unshift(p)
    p = periodoAnterior('quinzena', p)
  }
  return lista
}

/** Variação percentual (null quando não dá para comparar). */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10
}

export const dentro = (data: string, p: Pick<Periodo, 'inicio' | 'fim'>) => data >= p.inicio && data <= p.fim

/** Soma valores de uma lista de { data, valor } dentro do período. */
export function somaNoPeriodo(lista: { data: string; valor: number }[], p: Pick<Periodo, 'inicio' | 'fim'>): number {
  return Math.round(lista.filter((x) => dentro(x.data, p)).reduce((s, x) => s + Number(x.valor), 0) * 100) / 100
}

/** Agrupa { chave, valor } somando, do maior para o menor. */
export function agrupar(lista: { chave: string; valor: number }[]): { chave: string; valor: number }[] {
  const m = new Map<string, number>()
  for (const x of lista) m.set(x.chave, (m.get(x.chave) ?? 0) + Number(x.valor))
  return [...m].map(([chave, valor]) => ({ chave, valor: Math.round(valor * 100) / 100 })).sort((a, b) => b.valor - a.valor)
}
