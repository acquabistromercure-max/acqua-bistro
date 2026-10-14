// CPF, CNPJ e telefone: limpar, validar e formatar.

export const soDigitos = (t: string) => t.replace(/\D/g, '')

export function cpfValido(cpf: string): boolean {
  const d = soDigitos(cpf)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const digito = (n: number) => {
    let soma = 0
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
}

export function formatarCPF(cpf: string | null | undefined): string {
  const d = soDigitos(cpf ?? '')
  if (d.length !== 11) return cpf ?? ''
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function cnpjValido(cnpj: string): boolean {
  const d = soDigitos(cnpj)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const calc = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = pesos.reduce((s, p, i) => s + Number(d[i]) * p, 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}

export function formatarCNPJ(cnpj: string | null | undefined): string {
  const d = soDigitos(cnpj ?? '')
  if (d.length !== 14) return cnpj ?? ''
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function formatarTelefone(tel: string | null | undefined): string {
  const d = soDigitos(tel ?? '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return tel ?? ''
}
