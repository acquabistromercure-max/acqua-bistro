// Períodos usados no painel e nos relatórios. Datas sempre "AAAA-MM-DD" (dia de Fortaleza).
import { somarDias } from './formatos'

export type Frequencia = 'diaria' | 'semanal' | 'mensal' | 'anual'
export type Escala = 'dia' | 'semana' | 'mes' | 'ano'

const ESCALA_DA_FREQUENCIA: Record<Frequencia, Escala> = { diaria: 'dia', semanal: 'semana', mensal: 'mes', anual: 'ano' }

/** Dia da semana com segunda = 1 ... domingo = 7. */
function diaDaSemana(data: string): number {
  const d = new Date(`${data}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

/** Semana ISO: "2026-W42". */
export function semanaISO(data: string): string {
  const quinta = somarDias(data, 4 - diaDaSemana(data)) // a quinta-feira define o ano da semana
  const ano = Number(quinta.slice(0, 4))
  const inicioAno = `${ano}-01-01`
  const dias = (Date.parse(`${quinta}T12:00:00Z`) - Date.parse(`${inicioAno}T12:00:00Z`)) / 86_400_000
  return `${ano}-W${String(Math.floor(dias / 7) + 1).padStart(2, '0')}`
}

/** Chave do período em que a tarefa é marcada como feita. */
export function chavePeriodo(frequencia: Frequencia, data: string): string {
  switch (ESCALA_DA_FREQUENCIA[frequencia]) {
    case 'dia':
      return data
    case 'semana':
      return semanaISO(data)
    case 'mes':
      return data.slice(0, 7)
    case 'ano':
      return data.slice(0, 4)
  }
}

/** Primeiro e último dia do período que contém a data. */
export function intervalo(escala: Escala, data: string): { inicio: string; fim: string } {
  if (escala === 'dia') return { inicio: data, fim: data }
  if (escala === 'semana') {
    const inicio = somarDias(data, 1 - diaDaSemana(data))
    return { inicio, fim: somarDias(inicio, 6) }
  }
  if (escala === 'mes') {
    const inicio = `${data.slice(0, 7)}-01`
    const proximo = new Date(`${inicio}T12:00:00Z`)
    proximo.setUTCMonth(proximo.getUTCMonth() + 1)
    return { inicio, fim: somarDias(proximo.toISOString().slice(0, 10), -1) }
  }
  return { inicio: `${data.slice(0, 4)}-01-01`, fim: `${data.slice(0, 4)}-12-31` }
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Texto amigável do período ("14/10/2026", "13/10 a 19/10", "outubro de 2026", "2026"). */
export function descreverPeriodo(escala: Escala, data: string): string {
  const { inicio, fim } = intervalo(escala, data)
  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
  if (escala === 'dia') return `${dm(data)}/${data.slice(0, 4)}`
  if (escala === 'semana') return `${dm(inicio)} a ${dm(fim)}`
  if (escala === 'mes') return `${MESES[Number(data.slice(5, 7)) - 1]} de ${data.slice(0, 4)}`
  return data.slice(0, 4)
}
