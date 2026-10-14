import { describe, expect, it } from 'vitest'
import { camposAlterados } from './Auditoria'

describe('camposAlterados', () => {
  it('lista só o que mudou, ignorando data de atualização', () => {
    expect(camposAlterados({ a: 1, b: 'x', atualizado_em: '1' }, { a: 2, b: 'x', atualizado_em: '2' })).toEqual(['a'])
  })
  it('sem versão anterior não há alterações', () => {
    expect(camposAlterados(null, { a: 1 })).toEqual([])
  })
})
