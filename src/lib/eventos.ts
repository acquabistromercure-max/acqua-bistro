// Eventos: valores do demonstrativo e lista de produção do coffee break.

export type ItemModelo = { nome: string; unidade: string; por_pessoa: number }

export type ValoresEvento = {
  pessoas: number
  preco_por_pessoa: number
  valor_adicional: number
  sinal: number
  valor_recebido: number | null
}

const arred = (v: number) => Math.round(v * 100) / 100

/** Demonstrativo: pacote (pessoas × preço) + adicional + consumos avulsos − sinal = saldo. */
export function demonstrativo(e: ValoresEvento, consumos: { total: number }[]) {
  const pacote = arred(Number(e.pessoas) * Number(e.preco_por_pessoa))
  const extras = arred(consumos.reduce((s, c) => s + Number(c.total), 0))
  const total = arred(pacote + Number(e.valor_adicional) + extras)
  const pago = arred(Number(e.sinal) + Number(e.valor_recebido ?? 0))
  return { pacote, extras, adicional: arred(Number(e.valor_adicional)), total, sinal: arred(Number(e.sinal)), saldo: arred(total - pago) }
}

/** Quantidades para produzir: item por pessoa × pessoas (arredondado para cima). */
export function producao(itens: ItemModelo[], pessoas: number): (ItemModelo & { total: number })[] {
  return itens.map((i) => ({ ...i, total: Math.ceil(Number(i.por_pessoa) * pessoas * 100) / 100 }))
}

export const ETAPAS_EVENTO: { valor: string; rotulo: string }[] = [
  { valor: 'orcamento', rotulo: 'Orçamento' },
  { valor: 'confirmado', rotulo: 'Confirmado' },
  { valor: 'em_andamento', rotulo: 'Em andamento' },
  { valor: 'encerrado', rotulo: 'Encerrado' },
  { valor: 'faturado', rotulo: 'Faturado' },
  { valor: 'recebido', rotulo: 'Recebido' },
]
