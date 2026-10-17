// Regras do inventário: tipos de movimento e o relatório "o que aconteceu entre duas contagens".

export type TipoMovimento = 'inicial' | 'compra' | 'entrada' | 'quebra' | 'perda' | 'furto' | 'descarte' | 'saida' | 'ajuste'

export const ROTULO_MOVIMENTO: Record<TipoMovimento, string> = {
  inicial: 'Saldo inicial',
  compra: 'Compra (investimento)',
  entrada: 'Entrada avulsa',
  quebra: 'Quebra',
  perda: 'Perda',
  furto: 'Furto / sumiço',
  descarte: 'Descarte',
  saida: 'Saída avulsa',
  ajuste: 'Diferença na contagem',
}

/** Baixas que vêm de ocorrência registrada (quebra, perda...). */
export const TIPOS_PERDA: TipoMovimento[] = ['quebra', 'perda', 'furto', 'descarte']
const ENTRADAS: TipoMovimento[] = ['inicial', 'compra', 'entrada']
const SAIDAS: TipoMovimento[] = ['quebra', 'perda', 'furto', 'descarte', 'saida']

export const RESPONSAVEIS = [
  { valor: 'colaborador', rotulo: 'Colaborador' },
  { valor: 'cliente', rotulo: 'Cliente / hóspede' },
  { valor: 'nao_identificado', rotulo: 'Não identificado' },
]

export type MovimentoBase = {
  item_id: string
  data: string
  tipo: TipoMovimento
  quantidade: number
  situacao: 'registrado' | 'cancelado'
  contagem_id: string | null
}

export type LinhaRelatorio = {
  item_id: string
  anterior: number
  entradas: number
  saidas: number
  esperado: number
  contado: number
  diferenca: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Relatório de uma contagem: saldo da contagem anterior (ou zero), entradas e saídas registradas no período,
 * quanto deveria ter, quanto foi contado e a diferença SEM ocorrência (contado − esperado).
 */
export function relatorioContagem(
  contados: { item_id: string; contado: number }[],
  movimentos: MovimentoBase[],
  dataAnterior: string | null,
  dataAtual: string,
  contagemId: string,
): LinhaRelatorio[] {
  const validos = movimentos.filter((m) => m.situacao === 'registrado' && m.contagem_id !== contagemId && m.data <= dataAtual)
  return contados.map(({ item_id, contado }) => {
    const doItem = validos.filter((m) => m.item_id === item_id)
    const anterior = dataAnterior ? doItem.filter((m) => m.data <= dataAnterior).reduce((s, m) => s + Number(m.quantidade), 0) : 0
    const periodo = doItem.filter((m) => !dataAnterior || m.data > dataAnterior)
    const entradas = periodo.filter((m) => ENTRADAS.includes(m.tipo)).reduce((s, m) => s + Number(m.quantidade), 0)
    const saidas = -periodo.filter((m) => SAIDAS.includes(m.tipo)).reduce((s, m) => s + Number(m.quantidade), 0)
    const esperado = r2(anterior + entradas - saidas)
    return { item_id, anterior: r2(anterior), entradas: r2(entradas), saidas: r2(saidas), esperado, contado: Number(contado), diferenca: r2(Number(contado) - esperado) }
  })
}

/** "10" / "2,5" sem zeros sobrando. */
export const qtd = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })

/** Texto da diferença com sinal: "+2", "−3". */
export const comSinal = (n: number) => (n > 0 ? `+${qtd(n)}` : n < 0 ? `−${qtd(-n)}` : '0')
