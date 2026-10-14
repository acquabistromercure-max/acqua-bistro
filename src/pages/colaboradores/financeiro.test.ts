import { describe, expect, it } from 'vitest'
import { resumirLancamentos } from './AbaFinanceiro'
import { validarColaborador } from './FormColaborador'

describe('resumirLancamentos', () => {
  it('soma por situação e ignora cancelados', () => {
    const r = resumirLancamentos([
      { valor: 100, situacao: 'pendente', tipo: 'vale' },
      { valor: 50.1, situacao: 'aprovado', tipo: 'adiantamento' },
      { valor: 0.2, situacao: 'aprovado', tipo: 'pagamento' },
      { valor: 999, situacao: 'cancelado', tipo: 'vale' },
    ])
    expect(r).toEqual({ pendente: 100, aprovado: 50.3, pago: 0, valesAdiantamentos: 150.1 })
  })
})

describe('validarColaborador', () => {
  const base = { nome: 'Ana Souza', cpf: '', remuneracao: '', situacao: 'ativo', data_desligamento: '', data_admissao: '', email: '' }
  it('aceita cadastro mínimo', () => {
    expect(validarColaborador(base)).toEqual({})
  })
  it('aponta CPF inválido, desligamento sem data e valor inválido', () => {
    const e = validarColaborador({ ...base, cpf: '111.111.111-11', situacao: 'desligado', remuneracao: 'abc' })
    expect(Object.keys(e).sort()).toEqual(['cpf', 'data_desligamento', 'remuneracao'])
  })
})
