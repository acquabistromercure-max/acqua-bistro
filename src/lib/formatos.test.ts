import { describe, expect, it } from 'vitest'
import { formatarData, formatarMinutos, formatarMoeda, hojeISO, lerMoeda, normalizar, somarDias } from './formatos'

describe('formatos', () => {
  it('formata moeda em reais', () => {
    expect(formatarMoeda(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50')
    expect(formatarMoeda('10').replace(/\s/g, ' ')).toBe('R$ 10,00')
    expect(formatarMoeda(null).replace(/\s/g, ' ')).toBe('R$ 0,00')
  })
  it('lê valores digitados', () => {
    expect(lerMoeda('1.234,56')).toBe(1234.56)
    expect(lerMoeda('R$ 12,5')).toBe(12.5)
    expect(lerMoeda('')).toBeNull()
    expect(lerMoeda('abc')).toBeNull()
  })
  it('formata datas sem mudar o dia', () => {
    expect(formatarData('2026-10-14')).toBe('14/10/2026')
    expect(formatarData('2026-10-14T23:59:00Z')).toBe('14/10/2026')
  })
  it('usa o fuso de Fortaleza para "hoje"', () => {
    expect(hojeISO(new Date('2026-10-15T02:00:00Z'))).toBe('2026-10-14')
  })
  it('soma dias atravessando meses', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('formata minutos como horas', () => {
    expect(formatarMinutos(450)).toBe('7h30')
    expect(formatarMinutos(-15)).toBe('-0h15')
  })
  it('normaliza para busca', () => {
    expect(normalizar('Café Ação')).toBe('cafe acao')
  })
})
