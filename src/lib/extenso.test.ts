import { describe, expect, it } from 'vitest'
import { valorPorExtenso } from './extenso'

describe('valor por extenso', () => {
  it('escreve valores de recibo', () => {
    expect(valorPorExtenso(150)).toBe('cento e cinquenta reais')
    expect(valorPorExtenso(100)).toBe('cem reais')
    expect(valorPorExtenso(1)).toBe('um real')
    expect(valorPorExtenso(800)).toBe('oitocentos reais')
    expect(valorPorExtenso(1500)).toBe('mil e quinhentos reais')
    expect(valorPorExtenso(1621)).toBe('mil seiscentos e vinte e um reais')
    expect(valorPorExtenso(21.6)).toBe('vinte e um reais e sessenta centavos')
    expect(valorPorExtenso(0.5)).toBe('cinquenta centavos')
    expect(valorPorExtenso(2000000)).toBe('dois milhões de reais')
    expect(valorPorExtenso(1050)).toBe('mil e cinquenta reais')
  })
})
