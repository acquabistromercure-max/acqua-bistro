import { describe, expect, it } from 'vitest'
import { cafesGarantidos, moverQuinzena, quinzena, resumirQuinzena, tickets, totalDia } from './cafe'

// Valores de exemplo (não são os do contrato real).
const dia = (hospedes: number, cafes_servidos: number) => ({ hospedes, cafes_servidos, valor_cafe: 10, percentual_garantido: 70 })

describe('café com o hotel', () => {
  it('calcula garantido e tickets como a planilha', () => {
    expect(cafesGarantidos(dia(156, 94))).toBe(109.2)
    expect(tickets(dia(156, 94))).toBe(15) // round(109,2 − 94)
    expect(tickets(dia(90, 75))).toBe(0) // serviu mais que o garantido
    expect(totalDia(dia(156, 94))).toBe(1090) // (94 + 15) × 10
    expect(totalDia(dia(90, 75))).toBe(750)
  })

  it('acha a quinzena da data', () => {
    expect(quinzena('2026-09-03')).toEqual({ inicio: '2026-09-01', fim: '2026-09-15', rotulo: '1 a 15/09/2026' })
    expect(quinzena('2026-09-16').fim).toBe('2026-09-30')
    expect(quinzena('2026-02-20').fim).toBe('2026-02-28')
    expect(moverQuinzena('2026-09-01', 1)).toBe('2026-09-16')
    expect(moverQuinzena('2026-09-16', 1)).toBe('2026-10-01')
    expect(moverQuinzena('2026-10-01', -1)).toBe('2026-09-16')
  })

  it('resume a quinzena com ajustes e borderô', () => {
    const r = resumirQuinzena([dia(156, 94), dia(90, 75)], [{ total: 20 }, { total: -10 }], [{ total: 60 }], 100)
    expect(r.tickets).toBe(15)
    expect(r.cafes).toBe(1840)
    expect(r.ajustes).toBe(10)
    expect(r.bordero).toBe(60)
    expect(r.total).toBe(2010)
  })
})
