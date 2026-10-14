import { describe, expect, it } from 'vitest'
import { competenciaPrimeiraParcela, dataVencimento, parcelas } from './cartao'

const cartao = { fechamento_dia: 5, vencimento_dia: 12 }

describe('cartão empresa', () => {
  it('coloca a compra na fatura certa', () => {
    expect(competenciaPrimeiraParcela('2026-09-03', cartao)).toBe('2026-09') // antes do fechamento
    expect(competenciaPrimeiraParcela('2026-09-05', cartao)).toBe('2026-10') // no dia do fechamento
    expect(competenciaPrimeiraParcela('2026-12-20', cartao)).toBe('2027-01')
    // Vencimento antes do fechamento no calendário (fecha 25, vence 5 do mês seguinte).
    expect(competenciaPrimeiraParcela('2026-09-10', { fechamento_dia: 25, vencimento_dia: 5 })).toBe('2026-10')
    expect(competenciaPrimeiraParcela('2026-09-26', { fechamento_dia: 25, vencimento_dia: 5 })).toBe('2026-11')
  })

  it('divide em parcelas mensais', () => {
    expect(parcelas('2026-09-01', 100, 3, cartao)).toEqual([
      { numero: 1, de: 3, competencia: '2026-09', valor: 33.34 },
      { numero: 2, de: 3, competencia: '2026-10', valor: 33.33 },
      { numero: 3, de: 3, competencia: '2026-11', valor: 33.33 },
    ])
    expect(dataVencimento('2026-02', { fechamento_dia: 25, vencimento_dia: 31 })).toBe('2026-02-28')
  })
})
