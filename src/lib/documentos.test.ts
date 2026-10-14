import { describe, expect, it } from 'vitest'
import { TEXTOS_PADRAO, corpoTexto, dataPorExtenso, mesPorExtenso, preencher } from './documentos'

describe('documentos', () => {
  it('preenche os marcadores', () => {
    expect(preencher('Recebi {valor} de {empresa}. {descricao}', { valor: 'R$ 10,00', empresa: 'Acqua', descricao: '' })).toBe('Recebi R$ 10,00 de Acqua.')
    expect(preencher('{desconhecido}', {})).toBe('{desconhecido}')
  })
  it('escapa o conteúdo e monta o corpo', () => {
    const html = corpoTexto('Recibo', TEXTOS_PADRAO.recibo_vale, { nome: '<b>Ana</b>', empresa: 'Acqua', valor: 'R$ 50,00', valor_extenso: 'cinquenta reais', cnpj: '1', descricao: '', data: '01/09/2026', data_extenso: '1 de setembro de 2026', cidade: 'Fortaleza' })
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;')
    expect(html).toContain('cinquenta reais')
  })
  it('escreve datas por extenso', () => {
    expect(dataPorExtenso('2026-09-07')).toBe('7 de setembro de 2026')
    expect(mesPorExtenso('2026-10')).toBe('outubro de 2026')
  })
})
