import { describe, expect, it } from 'vitest'
import { avaliarSoma, conferencia, dataPrevista, porGrupo, preverRecebimentos, somarValores, totalBruto, totalTaxas } from './caixa'

const prazos = { credito: 30, debito: 1 }

describe('caixa', () => {
  it('aceita somas digitadas como na planilha', () => {
    expect(avaliarSoma('54+108+54')).toBe(216)
    expect(avaliarSoma('1.234,56')).toBe(1234.56)
    expect(avaliarSoma('120-4,50')).toBe(115.5)
    expect(avaliarSoma('R$ 60')).toBe(60)
    expect(avaliarSoma('')).toBe(0)
    expect(avaliarSoma('abc')).toBeNull()
  })

  it('soma fontes e calcula bruto, taxas e grupos', () => {
    const v = somarValores({ credito_visa: 100, pix: 50 }, { credito_visa: 20, dinheiro: 30 })
    expect(v).toEqual({ credito_visa: 120, pix: 50, dinheiro: 30 })
    expect(totalBruto(v)).toBe(200)
    expect(totalTaxas(v, { credito_visa: 2 })).toBe(2.4)
    expect(porGrupo({ credito_visa: 10, credito_elo: 5, debito_visa: 3 }).credito).toBe(15)
  })

  it('prevê quando cada valor cai na conta', () => {
    expect(dataPrevista('credito_visa', '2026-09-01', prazos)).toBe('2026-10-01')
    expect(dataPrevista('debito_elo', '2026-09-30', prazos)).toBe('2026-10-01')
    expect(dataPrevista('conta_assinada', '2026-09-10', prazos)).toBe('2026-09-30')
    expect(dataPrevista('conta_assinada', '2026-09-20', prazos)).toBe('2026-10-15')
    expect(dataPrevista('conta_assinada', '2026-12-20', prazos)).toBe('2027-01-15')
    const p = preverRecebimentos([{ data: '2026-09-01', valores: { credito_visa: 100, dinheiro: 50 } }], { credito_visa: 2 }, prazos)
    expect(p).toEqual([{ data: '2026-10-01', chave: 'credito_visa', bruto: 100, liquido: 98 }])
  })

  it('confere o dinheiro do caixa', () => {
    expect(conferencia(100, 50, 20, 30, 135)).toEqual({ esperado: 140, diferenca: -5 })
    expect(conferencia(0, 10, 0, 0, null)).toEqual({ esperado: 10, diferenca: null })
  })
})
