// Exporta listas para planilha (CSV que o Excel abre direto, com acentos).

export type ColunaCSV<T> = { titulo: string; valor: (linha: T) => string | number | null | undefined }

export function gerarCSV<T>(linhas: T[], colunas: ColunaCSV<T>[]): string {
  const celula = (v: unknown) => {
    const texto = v === null || v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v)
    return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
  }
  const cabecalho = colunas.map((c) => celula(c.titulo)).join(';')
  const corpo = linhas.map((l) => colunas.map((c) => celula(c.valor(l))).join(';'))
  return [cabecalho, ...corpo].join('\r\n')
}

export function baixarCSV<T>(nomeArquivo: string, linhas: T[], colunas: ColunaCSV<T>[]) {
  const blob = new Blob(['﻿' + gerarCSV(linhas, colunas)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
