import { describe, expect, it } from 'vitest'
import { demonstrativo, producao } from './eventos'

describe('eventos', () => {
  it('monta o demonstrativo do evento', () => {
    const d = demonstrativo({ pessoas: 38, preco_por_pessoa: 49, valor_adicional: 54, sinal: 500, valor_recebido: null }, [{ total: 60 }, { total: 19.6 }])
    expect(d.pacote).toBe(1862)
    expect(d.extras).toBe(79.6)
    expect(d.total).toBe(1995.6)
    expect(d.saldo).toBe(1495.6)
  })
  it('calcula a produção pelo número de pessoas', () => {
    expect(producao([{ nome: 'Pão de queijo', unidade: 'un', por_pessoa: 3 }, { nome: 'Suco', unidade: 'L', por_pessoa: 0.25 }], 38)).toEqual([
      { nome: 'Pão de queijo', unidade: 'un', por_pessoa: 3, total: 114 },
      { nome: 'Suco', unidade: 'L', por_pessoa: 0.25, total: 9.5 },
    ])
  })
})
