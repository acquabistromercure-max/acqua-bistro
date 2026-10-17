import { describe, expect, it } from 'vitest'
import { comSinal, relatorioContagem, type MovimentoBase } from './inventario'

const m = (data: string, tipo: MovimentoBase['tipo'], quantidade: number, extra: Partial<MovimentoBase> = {}): MovimentoBase => ({
  item_id: 'prato', data, tipo, quantidade, situacao: 'registrado', contagem_id: null, ...extra,
})

describe('relatorioContagem', () => {
  const movimentos = [
    m('2026-10-01', 'inicial', 50),
    m('2026-10-31', 'ajuste', -1, { contagem_id: 'outubro' }), // contagem anterior: contou 49
    m('2026-11-05', 'quebra', -10),
    m('2026-11-08', 'compra', 12),
    m('2026-11-09', 'quebra', -5, { situacao: 'cancelado' }), // cancelada não conta
    m('2026-11-30', 'ajuste', -3, { contagem_id: 'novembro' }), // ajuste da própria contagem não entra no esperado
    m('2026-12-02', 'quebra', -1), // depois da contagem
  ]

  it('compara com a contagem anterior e acusa a diferença sem ocorrência', () => {
    const [l] = relatorioContagem([{ item_id: 'prato', contado: 48 }], movimentos, '2026-10-31', '2026-11-30', 'novembro')
    expect(l).toEqual({ item_id: 'prato', anterior: 49, entradas: 12, saidas: 10, esperado: 51, contado: 48, diferenca: -3 })
  })

  it('primeira contagem parte do zero e soma tudo até a data', () => {
    const [l] = relatorioContagem([{ item_id: 'prato', contado: 50 }], movimentos.slice(0, 1), null, '2026-10-31', 'outubro')
    expect(l.anterior).toBe(0)
    expect(l.entradas).toBe(50)
    expect(l.diferenca).toBe(0)
  })
})

describe('comSinal', () => {
  it('mostra o sinal', () => {
    expect(comSinal(2)).toBe('+2')
    expect(comSinal(-3)).toBe('−3')
    expect(comSinal(0)).toBe('0')
  })
})
