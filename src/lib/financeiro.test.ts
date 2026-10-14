import { describe, expect, it } from 'vitest'
import { agrupar, periodoAnterior, periodoDe, somaNoPeriodo, ultimasQuinzenas, variacao } from './financeiro'

describe('painel financeiro', () => {
  it('monta períodos e o anterior', () => {
    expect(periodoDe('quinzena', '2026-10-14')).toEqual({ inicio: '2026-10-01', fim: '2026-10-15', rotulo: '01–15 out/26' })
    expect(periodoAnterior('quinzena', periodoDe('quinzena', '2026-10-14')).inicio).toBe('2026-09-16')
    expect(periodoDe('mes', '2026-02-10').fim).toBe('2026-02-28')
    expect(periodoAnterior('mes', periodoDe('mes', '2026-01-10')).inicio).toBe('2025-12-01')
    expect(periodoDe('ano', '2026-05-01')).toEqual({ inicio: '2026-01-01', fim: '2026-12-31', rotulo: '2026' })
  })
  it('lista as últimas quinzenas em ordem', () => {
    expect(ultimasQuinzenas('2026-10-14', 3).map((p) => p.inicio)).toEqual(['2026-09-01', '2026-09-16', '2026-10-01'])
  })
  it('calcula variação, somas e agrupamentos', () => {
    expect(variacao(120, 100)).toBe(20)
    expect(variacao(80, 100)).toBe(-20)
    expect(variacao(10, 0)).toBeNull()
    expect(somaNoPeriodo([{ data: '2026-10-01', valor: 10 }, { data: '2026-10-20', valor: 5 }], { inicio: '2026-10-01', fim: '2026-10-15' })).toBe(10)
    expect(agrupar([{ chave: 'a', valor: 1 }, { chave: 'b', valor: 5 }, { chave: 'a', valor: 2 }])).toEqual([{ chave: 'b', valor: 5 }, { chave: 'a', valor: 3 }])
  })
})
