import { describe, expect, it } from 'vitest'
import { chavePeriodo, descreverPeriodo, intervalo, semanaISO } from './periodos'

describe('periodos', () => {
  it('calcula a semana ISO, inclusive na virada do ano', () => {
    expect(semanaISO('2026-10-14')).toBe('2026-W42')
    expect(semanaISO('2027-01-01')).toBe('2026-W53')
    expect(semanaISO('2025-12-29')).toBe('2026-W01')
  })
  it('gera a chave do período por frequência', () => {
    expect(chavePeriodo('diaria', '2026-10-14')).toBe('2026-10-14')
    expect(chavePeriodo('semanal', '2026-10-18')).toBe('2026-W42')
    expect(chavePeriodo('mensal', '2026-10-14')).toBe('2026-10')
    expect(chavePeriodo('anual', '2026-10-14')).toBe('2026')
  })
  it('acha início e fim do período', () => {
    expect(intervalo('semana', '2026-10-14')).toEqual({ inicio: '2026-10-12', fim: '2026-10-18' })
    expect(intervalo('mes', '2026-02-10')).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' })
    expect(intervalo('mes', '2026-12-31')).toEqual({ inicio: '2026-12-01', fim: '2026-12-31' })
  })
  it('descreve o período em português', () => {
    expect(descreverPeriodo('mes', '2026-10-14')).toBe('outubro de 2026')
    expect(descreverPeriodo('semana', '2026-10-14')).toBe('12/10 a 18/10')
  })
})
