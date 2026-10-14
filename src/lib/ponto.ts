// Cálculos da escala e da folha-ponto. Horários "HH:MM" (ou "HH:MM:SS" vindo do banco).
// Turnos que passam da meia-noite são tratados como continuação do mesmo dia de trabalho.
// Regras (tolerância, faixa noturna, feriados) vêm de "configuracoes" e ainda precisam de validação do RH.

export type TipoEscala = 'turno' | 'folga' | 'ferias' | 'afastamento' | 'ausencia'

export type DiaEscala = {
  tipo: TipoEscala
  turno?: string | null
  hora_inicio: string | null
  hora_fim: string | null
  intervalo_minutos: number
}

export type Marcacao = {
  entrada: string
  saida_intervalo: string | null
  volta_intervalo: string | null
  saida: string | null
  situacao?: 'registrada' | 'aprovada' | 'cancelada'
}

export type RegrasPonto = {
  toleranciaMinutos: number
  noturnaInicio: string
  noturnaFim: string
  feriados: string[]
}

export const REGRAS_PADRAO: RegrasPonto = { toleranciaMinutos: 10, noturnaInicio: '22:00', noturnaFim: '05:00', feriados: [] }

/** "06:30" → 390. */
export function paraMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/** 390 → "06:30" (aceita valores acima de 24h, ex.: 1500 → "01:00"). */
export function paraHora(minutos: number): string {
  const m = ((Math.round(minutos) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Hora curta para exibir ("06:30:00" → "06:30"). */
export function horaCurta(hora: string | null | undefined): string {
  return hora ? hora.slice(0, 5) : ''
}

/** Duração de um trecho; se o fim for menor que o início, passou da meia-noite. */
export function duracao(inicio: string, fim: string): number {
  const d = paraMinutos(fim) - paraMinutos(inicio)
  return d < 0 ? d + 1440 : d
}

/** Trechos trabalhados como pares [início, fim] em minutos corridos desde 00:00 do dia (fim pode passar de 1440). */
export function trechos(m: Marcacao): [number, number][] | null {
  if (!m.saida) return null
  const pontos = [m.entrada, m.saida_intervalo, m.volta_intervalo, m.saida].filter((p): p is string => !!p)
  const corridos: number[] = []
  for (const p of pontos) {
    let v = paraMinutos(p)
    while (corridos.length && v < corridos[corridos.length - 1]) v += 1440
    corridos.push(v)
  }
  const pares: [number, number][] = []
  for (let i = 0; i + 1 < corridos.length; i += 2) pares.push([corridos[i], corridos[i + 1]])
  return pares
}

/** Minutos trabalhados (sem o intervalo). Nulo se a marcação está incompleta (sem saída). */
export function minutosTrabalhados(m: Marcacao): number | null {
  const t = trechos(m)
  return t ? t.reduce((s, [a, b]) => s + (b - a), 0) : null
}

/** Minutos previstos na escala (turno − intervalo). Folga, férias etc. = 0. */
export function minutosPrevistos(e: DiaEscala | null | undefined): number {
  if (!e || e.tipo !== 'turno' || !e.hora_inicio || !e.hora_fim) return 0
  return Math.max(0, duracao(e.hora_inicio, e.hora_fim) - (e.intervalo_minutos || 0))
}

/** Minutos de relógio dentro da faixa noturna (ex.: 22:00–05:00). */
export function minutosNoturnos(m: Marcacao, regras: Pick<RegrasPonto, 'noturnaInicio' | 'noturnaFim'> = REGRAS_PADRAO): number {
  const t = trechos(m)
  if (!t) return 0
  const ini = paraMinutos(regras.noturnaInicio)
  const fim = paraMinutos(regras.noturnaFim)
  // Faixas noturnas em minutos corridos, cobrindo dois dias (trabalho que passa da meia-noite).
  const faixas: [number, number][] =
    ini > fim
      ? [[-1440 + ini, fim], [ini, 1440 + fim], [1440 + ini, 2880 + fim]]
      : [[ini, fim], [1440 + ini, 1440 + fim]]
  let total = 0
  for (const [a, b] of t) {
    for (const [fa, fb] of faixas) total += Math.max(0, Math.min(b, fb) - Math.max(a, fa))
  }
  return total
}

/** Atraso na entrada além da tolerância (0 se dentro da tolerância ou sem turno). */
export function minutosAtraso(m: Marcacao, e: DiaEscala | null | undefined, toleranciaMinutos = REGRAS_PADRAO.toleranciaMinutos): number {
  if (!e || e.tipo !== 'turno' || !e.hora_inicio) return 0
  let diff = paraMinutos(m.entrada) - paraMinutos(e.hora_inicio)
  if (diff < -720) diff += 1440 // entrada depois da meia-noite para turno que começou antes
  if (diff > 720) diff -= 1440
  return diff > toleranciaMinutos ? diff : 0
}

/** Segunda = 1 ... domingo = 7. */
export function diaDaSemana(data: string): number {
  const d = new Date(`${data}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

export const NOMES_DIAS = ['', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

export type LinhaFolha = {
  data: string
  domingo: boolean
  feriado: boolean
  escala: DiaEscala | null
  marcacao: Marcacao | null
  previsto: number
  trabalhado: number | null
  saldo: number
  noturno: number
  atraso: number
  divergencias: string[]
}

/**
 * Monta a linha do dia da folha-ponto. "hoje" serve para não acusar falta em dias que ainda não chegaram.
 * Saldo = trabalhado − previsto (positivo: horas a mais; negativo: horas a menos).
 */
export function linhaDoDia(
  data: string,
  escala: DiaEscala | null,
  marcacao: Marcacao | null,
  regras: RegrasPonto,
  hoje: string,
): LinhaFolha {
  const valida = marcacao && marcacao.situacao !== 'cancelada' ? marcacao : null
  const previsto = minutosPrevistos(escala)
  const trabalhado = valida ? minutosTrabalhados(valida) : null
  const divergencias: string[] = []
  const atraso = valida ? minutosAtraso(valida, escala, regras.toleranciaMinutos) : 0

  if (escala?.tipo === 'turno' && !valida && data < hoje) divergencias.push('Sem marcação')
  if (valida && !escala) divergencias.push('Trabalhou sem escala')
  if (valida && escala && escala.tipo !== 'turno') divergencias.push('Trabalhou em dia sem turno')
  if (valida && trabalhado === null && data < hoje) divergencias.push('Marcação sem saída')
  if (atraso > 0) divergencias.push(`Atraso de ${atraso} min`)
  if (valida?.situacao === 'registrada') divergencias.push('Aguardando aprovação')

  const saldo = trabalhado === null ? (valida ? 0 : data < hoje ? -previsto : 0) : trabalhado - previsto
  return {
    data,
    domingo: diaDaSemana(data) === 7,
    feriado: regras.feriados.includes(data),
    escala,
    marcacao: valida,
    previsto,
    trabalhado,
    saldo,
    noturno: valida ? minutosNoturnos(valida, regras) : 0,
    atraso,
    divergencias,
  }
}

export type TotaisFolha = {
  previsto: number
  trabalhado: number
  extras: number
  faltantes: number
  saldo: number
  noturno: number
  atrasos: number
  domingosFeriadosTrabalhados: number
  minutosDomingoFeriado: number
  diasTrabalhados: number
  faltas: number
  divergencias: number
}

export function totalizar(linhas: LinhaFolha[]): TotaisFolha {
  const t: TotaisFolha = {
    previsto: 0, trabalhado: 0, extras: 0, faltantes: 0, saldo: 0, noturno: 0, atrasos: 0,
    domingosFeriadosTrabalhados: 0, minutosDomingoFeriado: 0, diasTrabalhados: 0, faltas: 0, divergencias: 0,
  }
  for (const l of linhas) {
    t.previsto += l.previsto
    t.trabalhado += l.trabalhado ?? 0
    t.saldo += l.saldo
    if (l.saldo > 0) t.extras += l.saldo
    if (l.saldo < 0) t.faltantes -= l.saldo
    t.noturno += l.noturno
    t.atrasos += l.atraso
    if (l.trabalhado) {
      t.diasTrabalhados += 1
      if (l.domingo || l.feriado) {
        t.domingosFeriadosTrabalhados += 1
        t.minutosDomingoFeriado += l.trabalhado
      }
    }
    if (l.divergencias.includes('Sem marcação')) t.faltas += 1
    t.divergencias += l.divergencias.filter((d) => d !== 'Aguardando aprovação').length
  }
  return t
}

/** Todas as datas do mês "AAAA-MM". */
export function diasDoMes(competencia: string): string[] {
  const [a, m] = competencia.split('-').map(Number)
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate()
  return Array.from({ length: total }, (_, i) => `${competencia}-${String(i + 1).padStart(2, '0')}`)
}

/** Texto curto da escala do dia para a grade ("06:00–14:00", "Folga", ...). */
export function resumoEscala(e: DiaEscala | null | undefined): string {
  if (!e) return ''
  if (e.tipo === 'turno') return `${horaCurta(e.hora_inicio)}–${horaCurta(e.hora_fim)}`
  return ROTULOS_TIPO_ESCALA[e.tipo]
}

export const ROTULOS_TIPO_ESCALA: Record<TipoEscala, string> = {
  turno: 'Turno',
  folga: 'Folga',
  ferias: 'Férias',
  afastamento: 'Afastamento',
  ausencia: 'Ausência',
}
