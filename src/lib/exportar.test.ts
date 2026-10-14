import { describe, expect, it } from 'vitest'
import { gerarCSV } from './exportar'

describe('gerarCSV', () => {
  it('usa ponto e vírgula, vírgula decimal e escapa aspas', () => {
    const csv = gerarCSV(
      [{ nome: 'Ana "Chefe"', valor: 12.5 }, { nome: 'Bia; Caixa', valor: null }],
      [
        { titulo: 'Nome', valor: (l) => l.nome },
        { titulo: 'Valor', valor: (l) => l.valor },
      ],
    )
    expect(csv).toBe('Nome;Valor\r\n"Ana ""Chefe""";12,5\r\n"Bia; Caixa";')
  })
})
