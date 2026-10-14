// Cartão empresa: em que fatura cai cada parcela.
// Regra: compra no dia do fechamento ou depois entra na fatura seguinte. A fatura vence no "dia de vencimento"
// do mês do fechamento (ou do mês seguinte, se o vencimento for antes do fechamento no calendário).

export type CartaoRegra = { fechamento_dia: number; vencimento_dia: number }

const ultimoDia = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate() // mes 1–12

function somarMeses(ano: number, mes: number, n: number): [number, number] {
  const t = ano * 12 + (mes - 1) + n
  return [Math.floor(t / 12), (t % 12) + 1]
}

/** Mês (AAAA-MM) em que vence a fatura da 1ª parcela de uma compra feita em "data". */
export function competenciaPrimeiraParcela(data: string, c: CartaoRegra): string {
  const ano = Number(data.slice(0, 4))
  const mes = Number(data.slice(5, 7))
  const dia = Number(data.slice(8, 10))
  // Mês em que a fatura fecha.
  let [fa, fm] = dia >= Math.min(c.fechamento_dia, ultimoDia(ano, mes)) ? somarMeses(ano, mes, 1) : [ano, mes]
  // Vence no mesmo mês do fechamento se o dia de vencimento vier depois; senão no mês seguinte.
  if (c.vencimento_dia <= c.fechamento_dia) [fa, fm] = somarMeses(fa, fm, 1)
  return `${fa}-${String(fm).padStart(2, '0')}`
}

export function dataVencimento(competencia: string, c: CartaoRegra): string {
  const ano = Number(competencia.slice(0, 4))
  const mes = Number(competencia.slice(5, 7))
  return `${competencia}-${String(Math.min(c.vencimento_dia, ultimoDia(ano, mes))).padStart(2, '0')}`
}

export type Parcela = { numero: number; de: number; competencia: string; valor: number }

/** Divide o valor em parcelas (centavos de diferença na 1ª) e diz em que fatura cai cada uma. */
export function parcelas(data: string, valor: number, n: number, c: CartaoRegra): Parcela[] {
  const base = Math.floor((valor / n) * 100) / 100
  const primeira = Math.round((valor - base * (n - 1)) * 100) / 100
  const comp = competenciaPrimeiraParcela(data, c)
  const [a, m] = [Number(comp.slice(0, 4)), Number(comp.slice(5, 7))]
  return Array.from({ length: n }, (_, i) => {
    const [ai, mi] = somarMeses(a, m, i)
    return { numero: i + 1, de: n, competencia: `${ai}-${String(mi).padStart(2, '0')}`, valor: i === 0 ? primeira : base }
  })
}
