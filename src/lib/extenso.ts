// Valor em reais por extenso (recibos): 150 → "cento e cinquenta reais".

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function ate999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const resto = n % 100
  const partes: string[] = []
  if (c) partes.push(CENTENAS[c])
  if (resto) {
    if (resto < 20) partes.push(UNIDADES[resto])
    else {
      const d = Math.floor(resto / 10)
      const u = resto % 10
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d])
    }
  }
  return partes.join(' e ')
}

function inteiro(n: number): string {
  if (n === 0) return 'zero'
  const grupos: [number, string, string][] = [
    [1_000_000_000, 'bilhão', 'bilhões'],
    [1_000_000, 'milhão', 'milhões'],
    [1_000, 'mil', 'mil'],
  ]
  const partes: string[] = []
  let resto = n
  for (const [base, singular, plural] of grupos) {
    const q = Math.floor(resto / base)
    if (q) {
      partes.push(base === 1000 && q === 1 ? 'mil' : `${ate999(q)} ${q === 1 ? singular : plural}`)
      resto %= base
    }
  }
  if (resto) partes.push(ate999(resto))
  // "e" antes do último grupo quando ele é < 100 ou centena redonda (mil e duzentos, mil e cinquenta).
  if (partes.length > 1 && resto && (resto < 100 || resto % 100 === 0)) {
    const ultimo = partes.pop()
    return `${partes.join(' ')} e ${ultimo}`
  }
  return partes.join(' ')
}

export function valorPorExtenso(valor: number): string {
  const total = Math.round(Math.abs(valor) * 100)
  const reais = Math.floor(total / 100)
  const centavos = total % 100
  const partes: string[] = []
  if (reais) {
    const texto = inteiro(reais)
    const de = /(milhão|milhões|bilhão|bilhões)$/.test(texto) ? ' de' : ''
    partes.push(`${texto}${de} ${reais === 1 ? 'real' : 'reais'}`)
  }
  if (centavos) partes.push(`${inteiro(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  return partes.length ? partes.join(' e ') : 'zero reais'
}
