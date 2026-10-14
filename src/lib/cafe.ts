// Regras do café com o hotel (seguem as planilhas da operação). Os números do contrato vêm da tela Regras.
import { somarDias } from './formatos'

export type DiaHotel = { hospedes: number; cafes_servidos: number; valor_cafe: number; percentual_garantido: number }

/** Café garantido do dia (pode ter casas decimais, como na planilha). */
export function cafesGarantidos(d: Pick<DiaHotel, 'hospedes' | 'percentual_garantido'>): number {
  return Math.round(d.hospedes * Number(d.percentual_garantido)) / 100
}

/** Tickets: o que falta para chegar ao garantido, arredondado (o hotel paga mesmo sem consumo). */
export function tickets(d: DiaHotel): number {
  return Math.round(Math.max(cafesGarantidos(d) - d.cafes_servidos, 0))
}

/** Total do dia para cobrar do hotel: (servidos + tickets) × valor. */
export function totalDia(d: DiaHotel): number {
  return arred((d.cafes_servidos + tickets(d)) * Number(d.valor_cafe))
}

export const arred = (v: number) => Math.round(v * 100) / 100

/** Quinzena que contém a data: 1–15 ou 16–último dia do mês. */
export function quinzena(data: string): { inicio: string; fim: string; rotulo: string } {
  const mes = data.slice(0, 7)
  const dia = Number(data.slice(8, 10))
  if (dia <= 15) return { inicio: `${mes}-01`, fim: `${mes}-15`, rotulo: `1 a 15/${mes.slice(5, 7)}/${mes.slice(0, 4)}` }
  const proximo = new Date(`${mes}-01T12:00:00Z`)
  proximo.setUTCMonth(proximo.getUTCMonth() + 1)
  const fim = somarDias(proximo.toISOString().slice(0, 10), -1)
  return { inicio: `${mes}-16`, fim, rotulo: `16 a ${fim.slice(8, 10)}/${mes.slice(5, 7)}/${mes.slice(0, 4)}` }
}

/** Quinzena anterior/seguinte. */
export function moverQuinzena(inicio: string, sentido: 1 | -1): string {
  return sentido === 1 ? somarDias(quinzena(inicio).fim, 1) : quinzena(somarDias(inicio, -1)).inicio
}

export type ResumoQuinzena = {
  hospedes: number
  servidos: number
  garantidos: number
  tickets: number
  cafes: number // valor dos cafés servidos + tickets
  ajustes: number
  bordero: number
  eventos: number
  total: number
}

export function resumirQuinzena(
  dias: DiaHotel[],
  ajustes: { total: number }[],
  bordero: { total: number }[],
  eventos = 0,
): ResumoQuinzena {
  const r: ResumoQuinzena = { hospedes: 0, servidos: 0, garantidos: 0, tickets: 0, cafes: 0, ajustes: 0, bordero: 0, eventos, total: 0 }
  for (const d of dias) {
    r.hospedes += d.hospedes
    r.servidos += d.cafes_servidos
    r.garantidos += cafesGarantidos(d)
    r.tickets += tickets(d)
    r.cafes += totalDia(d)
  }
  r.garantidos = arred(r.garantidos)
  r.cafes = arred(r.cafes)
  r.ajustes = arred(ajustes.reduce((s, a) => s + Number(a.total), 0))
  r.bordero = arred(bordero.reduce((s, b) => s + Number(b.total), 0))
  r.total = arred(r.cafes + r.ajustes + r.bordero + eventos)
  return r
}

export const MOTIVOS_AJUSTE: { valor: string; rotulo: string; sinal: 1 | -1 }[] = [
  { valor: 'late_checkin', rotulo: 'Late check-in', sinal: 1 },
  { valor: 'fora_da_ventilacao', rotulo: 'Fora da ventilação / lista', sinal: 1 },
  { valor: 'pessoa_adicional', rotulo: 'Pessoa a mais no apartamento', sinal: 1 },
  { valor: 'liberado_gestor', rotulo: 'Liberado por gestor', sinal: 1 },
  { valor: 'faturar_empresa', rotulo: 'Faturar para empresa', sinal: 1 },
  { valor: 'sem_direito', rotulo: 'Sem direito a café (descontar)', sinal: -1 },
  { valor: 'faturado_hotelaria', rotulo: 'Faturado para hotelaria (descontar)', sinal: -1 },
  { valor: 'outro', rotulo: 'Outro motivo', sinal: 1 },
]

export const FORMAS: { valor: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'outro'; rotulo: string }[] = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'credito', rotulo: 'Crédito' },
  { valor: 'debito', rotulo: 'Débito' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'outro', rotulo: 'Outro' },
]

export const BANDEIRAS: { valor: 'visa' | 'mastercard' | 'amex' | 'elo' | 'outra'; rotulo: string }[] = [
  { valor: 'visa', rotulo: 'Visa' },
  { valor: 'mastercard', rotulo: 'Master' },
  { valor: 'elo', rotulo: 'Elo' },
  { valor: 'amex', rotulo: 'Amex' },
  { valor: 'outra', rotulo: 'Outra' },
]
