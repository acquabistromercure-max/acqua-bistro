import { describe, expect, it } from 'vitest'
import { cnpjValido, cpfValido, formatarCNPJ, formatarCPF, formatarTelefone } from './documentos-br'

describe('documentos brasileiros', () => {
  it('valida CPF', () => {
    expect(cpfValido('123.456.789-09')).toBe(true)
    expect(cpfValido('123.456.789-00')).toBe(false)
    expect(cpfValido('111.111.111-11')).toBe(false)
    expect(cpfValido('123')).toBe(false)
  })
  it('valida CNPJ', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true)
    expect(cnpjValido('11.222.333/0001-80')).toBe(false)
  })
  it('formata', () => {
    expect(formatarCPF('12345678909')).toBe('123.456.789-09')
    expect(formatarCNPJ('11222333000181')).toBe('11.222.333/0001-81')
    expect(formatarTelefone('85988887777')).toBe('(85) 98888-7777')
    expect(formatarTelefone('8532221111')).toBe('(85) 3222-1111')
  })
})
