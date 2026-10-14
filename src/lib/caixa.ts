// Caixa: formas de recebimento (iguais à planilha da operação), taxas, previsão de recebimento e conferência.
// Taxas e prazos vêm da tela Caixa → Regras (não ficam no código).
import { somarDias } from './formatos'

export type ChaveVenda =
  | 'credito_visa' | 'credito_mastercard' | 'credito_amex' | 'credito_elo'
  | 'debito_visa' | 'debito_mastercard' | 'debito_elo'
  | 'pix' | 'dinheiro' | 'conta_assinada' | 'outros'

export const FORMAS_CAIXA: { chave: ChaveVenda; rotulo: string; grupo: 'Crédito' | 'Débito' | 'Outros'; curto: string }[] = [
  { chave: 'credito_visa', rotulo: 'Crédito Visa', grupo: 'Crédito', curto: 'Visa' },
  { chave: 'credito_mastercard', rotulo: 'Crédito Master', grupo: 'Crédito', curto: 'Master' },
  { chave: 'credito_amex', rotulo: 'Crédito Amex', grupo: 'Crédito', curto: 'Amex' },
  { chave: 'credito_elo', rotulo: 'Crédito Elo', grupo: 'Crédito', curto: 'Elo' },
  { chave: 'debito_visa', rotulo: 'Débito Visa', grupo: 'Débito', curto: 'Visa' },
  { chave: 'debito_mastercard', rotulo: 'Débito Master', grupo: 'Débito', curto: 'Master' },
  { chave: 'debito_elo', rotulo: 'Débito Elo', grupo: 'Débito', curto: 'Elo' },
  { chave: 'pix', rotulo: 'Pix', grupo: 'Outros', curto: 'Pix' },
  { chave: 'dinheiro', rotulo: 'Dinheiro', grupo: 'Outros', curto: 'Dinheiro' },
  { chave: 'conta_assinada', rotulo: 'Conta assinada', grupo: 'Outros', curto: 'Conta assinada' },
  { chave: 'outros', rotulo: 'Outros', grupo: 'Outros', curto: 'Outros' },
]

export type Valores = Partial<Record<ChaveVenda, number>>
export type Taxas = Partial<Record<ChaveVenda, number>> // percentual (ex.: 1.63)
export type Prazos = { credito: number; debito: number }

export const arred = (v: number) => Math.round(v * 100) / 100

/** Converte o que foi digitado: aceita somas como na planilha ("54+108+54", "120-4,50"). Vazio → 0. Inválido → null. */
export function avaliarSoma(texto: string): number | null {
  const limpo = texto.replace(/[R$\s]/g, '')
  if (limpo === '') return 0
  if (!/^[-+]?[\d.,]+([+-][\d.,]+)*$/.test(limpo)) return null
  let total = 0
  for (const parte of limpo.match(/[+-]?[\d.,]+/g) ?? []) {
    const sinal = parte.startsWith('-') ? -1 : 1
    const numero = parte.replace(/^[+-]/, '')
    // "1.234,56" ou "1234,56" ou "1234.56"
    const normal = numero.includes(',') ? numero.replace(/\./g, '').replace(',', '.') : numero
    const n = Number(normal)
    if (!Number.isFinite(n)) return null
    total += sinal * n
  }
  return arred(total)
}

/** Soma valores de duas fontes (ex.: caixa digitado + cafés lançados no módulo Café). */
export function somarValores(...fontes: Valores[]): Valores {
  const r: Valores = {}
  for (const f of fontes) for (const [k, v] of Object.entries(f)) r[k as ChaveVenda] = arred((r[k as ChaveVenda] ?? 0) + Number(v ?? 0))
  return r
}

export function totalBruto(v: Valores): number {
  return arred(FORMAS_CAIXA.reduce((s, f) => s + Number(v[f.chave] ?? 0), 0))
}

export function totalTaxas(v: Valores, taxas: Taxas): number {
  return arred(FORMAS_CAIXA.reduce((s, f) => s + (Number(v[f.chave] ?? 0) * Number(taxas[f.chave] ?? 0)) / 100, 0))
}

export function porGrupo(v: Valores): { credito: number; debito: number; pix: number; dinheiro: number; contaAssinada: number; outros: number } {
  const soma = (g: string) => arred(FORMAS_CAIXA.filter((f) => f.grupo === g).reduce((s, f) => s + Number(v[f.chave] ?? 0), 0))
  return {
    credito: soma('Crédito'),
    debito: soma('Débito'),
    pix: arred(Number(v.pix ?? 0)),
    dinheiro: arred(Number(v.dinheiro ?? 0)),
    contaAssinada: arred(Number(v.conta_assinada ?? 0)),
    outros: arred(Number(v.outros ?? 0)),
  }
}

/** Data prevista para o dinheiro cair: crédito D+prazo, débito D+prazo, conta assinada por quinzena, o resto no dia. */
export function dataPrevista(chave: ChaveVenda, data: string, prazos: Prazos): string {
  if (chave.startsWith('credito_')) return somarDias(data, prazos.credito)
  if (chave.startsWith('debito_')) return somarDias(data, prazos.debito)
  if (chave === 'conta_assinada') {
    // Vendas de 1 a 15 recebem no último dia do mês; de 16 em diante, no dia 15 do mês seguinte (planilha).
    const dia = Number(data.slice(8, 10))
    const inicioMes = new Date(`${data.slice(0, 7)}-01T12:00:00Z`)
    inicioMes.setUTCMonth(inicioMes.getUTCMonth() + 1)
    const proximoMes = inicioMes.toISOString().slice(0, 7)
    return dia <= 15 ? somarDias(`${proximoMes}-01`, -1) : `${proximoMes}-15`
  }
  return data
}

export type Previsao = { data: string; chave: ChaveVenda; bruto: number; liquido: number }

export function preverRecebimentos(dias: { data: string; valores: Valores }[], taxas: Taxas, prazos: Prazos): Previsao[] {
  const lista: Previsao[] = []
  for (const d of dias) {
    for (const f of FORMAS_CAIXA) {
      const bruto = Number(d.valores[f.chave] ?? 0)
      if (!bruto || f.chave === 'dinheiro') continue
      lista.push({
        data: dataPrevista(f.chave, d.data, prazos),
        chave: f.chave,
        bruto: arred(bruto),
        liquido: arred(bruto - (bruto * Number(taxas[f.chave] ?? 0)) / 100),
      })
    }
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data))
}

/** Categorias de entrada e saída de dinheiro (caixa e fundo de despesas). */
export type Categoria =
  | 'sangria' | 'deposito' | 'troco' | 'compra' | 'despesa' | 'vale' | 'adiantamento' | 'passagem' | 'diaria' | 'pagamento'
  | 'suprimento' | 'aporte' | 'devolucao' | 'outro'

export const CATEGORIAS_SAIDA: { valor: Categoria; rotulo: string; pessoal?: boolean }[] = [
  { valor: 'vale', rotulo: 'Vale', pessoal: true },
  { valor: 'adiantamento', rotulo: 'Adiantamento', pessoal: true },
  { valor: 'passagem', rotulo: 'Passagem', pessoal: true },
  { valor: 'diaria', rotulo: 'Diária', pessoal: true },
  { valor: 'pagamento', rotulo: 'Pagamento a colaborador', pessoal: true },
  { valor: 'compra', rotulo: 'Compra / fornecedor' },
  { valor: 'despesa', rotulo: 'Despesa (uber, gás, conserto…)' },
  { valor: 'sangria', rotulo: 'Sangria / depósito no banco' },
  { valor: 'troco', rotulo: 'Troco / fundo de troco' },
  { valor: 'outro', rotulo: 'Outro' },
]

export const CATEGORIAS_ENTRADA: { valor: Categoria; rotulo: string }[] = [
  { valor: 'suprimento', rotulo: 'Suprimento (dinheiro colocado no caixa)' },
  { valor: 'aporte', rotulo: 'Aporte da empresa' },
  { valor: 'devolucao', rotulo: 'Devolução / troco que voltou' },
  { valor: 'outro', rotulo: 'Outra entrada' },
]

export const CATEGORIAS_PESSOAIS: Categoria[] = ['vale', 'adiantamento', 'passagem', 'diaria', 'pagamento']

export function rotuloCategoria(c: string): string {
  return [...CATEGORIAS_SAIDA, ...CATEGORIAS_ENTRADA].find((x) => x.valor === c)?.rotulo ?? c
}

/** Conferência do dinheiro: saldo anterior + entradas em dinheiro − saídas = esperado; contado − esperado = diferença. */
export function conferencia(saldoAnterior: number, vendasDinheiro: number, entradas: number, saidas: number, contado: number | null) {
  const esperado = arred(saldoAnterior + vendasDinheiro + entradas - saidas)
  return { esperado, diferenca: contado === null ? null : arred(contado - esperado) }
}
