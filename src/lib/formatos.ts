// Formatação padrão do sistema (Brasil). Datas do banco chegam como "AAAA-MM-DD" ou ISO.

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatarMoeda(valor: number | string | null | undefined): string {
  const n = typeof valor === 'string' ? Number(valor) : valor
  return moeda.format(Number.isFinite(n) ? (n as number) : 0)
}

/** Converte texto digitado ("1.234,56", "12,5", "R$ 3") em número. Vazio ou inválido → null. */
export function lerMoeda(texto: string): number | null {
  const limpo = texto.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
  if (limpo === '' || limpo === '-') return null
  const n = Number(limpo)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

/** "2026-10-14" → "14/10/2026" (sem fuso: datas puras não mudam de dia). */
export function formatarData(data: string | null | undefined): string {
  if (!data) return ''
  const [a, m, d] = data.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/** ISO com hora → "14/10/2026 08:30" no fuso de Fortaleza. */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Data de hoje em Fortaleza, no formato do banco ("AAAA-MM-DD"). */
export function hojeISO(agora = new Date()): string {
  return agora.toLocaleDateString('en-CA', { timeZone: 'America/Fortaleza' })
}

/** Soma dias a uma data "AAAA-MM-DD". */
export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Minutos → "7h30" (negativo: "-0h15"). */
export function formatarMinutos(min: number): string {
  const sinal = min < 0 ? '-' : ''
  const abs = Math.abs(Math.round(min))
  return `${sinal}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}`
}

/** Normaliza texto para busca: sem acento, minúsculo. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
