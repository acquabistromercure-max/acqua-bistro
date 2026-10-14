import { describe, expect, it } from 'vitest'
import {
  REGRAS_PADRAO, diasDoMes, duracao, linhaDoDia, minutosAtraso, minutosNoturnos, minutosPrevistos,
  minutosTrabalhados, paraHora, resumoEscala, totalizar, type DiaEscala, type Marcacao,
} from './ponto'

const manha: DiaEscala = { tipo: 'turno', hora_inicio: '06:00', hora_fim: '14:00', intervalo_minutos: 60 }
const noite: DiaEscala = { tipo: 'turno', hora_inicio: '22:00:00', hora_fim: '06:00:00', intervalo_minutos: 60 }
const folga: DiaEscala = { tipo: 'folga', hora_inicio: null, hora_fim: null, intervalo_minutos: 0 }
const regras = { ...REGRAS_PADRAO, feriados: ['2026-10-12'] }

describe('ponto', () => {
  it('converte e soma horários, inclusive passando da meia-noite', () => {
    expect(duracao('06:00', '14:00')).toBe(480)
    expect(duracao('22:00', '06:00')).toBe(480)
    expect(paraHora(1500)).toBe('01:00')
  })

  it('calcula horas previstas e trabalhadas sem o intervalo', () => {
    expect(minutosPrevistos(manha)).toBe(420)
    expect(minutosPrevistos(noite)).toBe(420)
    expect(minutosPrevistos(folga)).toBe(0)
    const m: Marcacao = { entrada: '06:05', saida_intervalo: '10:00', volta_intervalo: '11:00', saida: '14:10' }
    expect(minutosTrabalhados(m)).toBe(425)
    expect(minutosTrabalhados({ ...m, saida: null })).toBeNull()
    expect(minutosTrabalhados({ entrada: '08:00', saida_intervalo: null, volta_intervalo: null, saida: '12:30' })).toBe(270)
  })

  it('separa minutos noturnos (22h às 5h)', () => {
    const virada: Marcacao = { entrada: '22:00', saida_intervalo: '02:00', volta_intervalo: '03:00', saida: '06:00' }
    expect(minutosTrabalhados(virada)).toBe(420)
    expect(minutosNoturnos(virada)).toBe(360) // 22–02 e 03–05
    expect(minutosNoturnos({ entrada: '18:00', saida_intervalo: null, volta_intervalo: null, saida: '23:30' })).toBe(90)
    expect(minutosNoturnos({ entrada: '04:00', saida_intervalo: null, volta_intervalo: null, saida: '12:00' })).toBe(60)
    expect(minutosNoturnos({ entrada: '08:00', saida_intervalo: null, volta_intervalo: null, saida: '17:00' })).toBe(0)
  })

  it('só acusa atraso acima da tolerância', () => {
    const m = (entrada: string): Marcacao => ({ entrada, saida_intervalo: null, volta_intervalo: null, saida: '14:00' })
    expect(minutosAtraso(m('06:10'), manha, 10)).toBe(0)
    expect(minutosAtraso(m('06:25'), manha, 10)).toBe(25)
    expect(minutosAtraso(m('05:50'), manha, 10)).toBe(0)
    expect(minutosAtraso(m('00:20'), noite, 10)).toBe(140)
  })

  it('monta a linha do dia com divergências e saldo', () => {
    const falta = linhaDoDia('2026-10-05', manha, null, regras, '2026-10-14')
    expect(falta.divergencias).toContain('Sem marcação')
    expect(falta.saldo).toBe(-420)

    const futuro = linhaDoDia('2026-10-20', manha, null, regras, '2026-10-14')
    expect(futuro.divergencias).toEqual([])
    expect(futuro.saldo).toBe(0)

    const extra = linhaDoDia(
      '2026-10-12',
      folga,
      { entrada: '08:00', saida_intervalo: null, volta_intervalo: null, saida: '12:00', situacao: 'aprovada' },
      regras,
      '2026-10-14',
    )
    expect(extra.feriado).toBe(true)
    expect(extra.saldo).toBe(240)
    expect(extra.divergencias).toContain('Trabalhou em dia sem turno')

    const cancelada = linhaDoDia(
      '2026-10-06',
      manha,
      { entrada: '06:00', saida_intervalo: null, volta_intervalo: null, saida: '14:00', situacao: 'cancelada' },
      regras,
      '2026-10-14',
    )
    expect(cancelada.marcacao).toBeNull()
    expect(cancelada.divergencias).toContain('Sem marcação')
  })

  it('totaliza a competência', () => {
    const linhas = [
      linhaDoDia('2026-10-05', manha, { entrada: '06:00', saida_intervalo: '10:00', volta_intervalo: '11:00', saida: '15:00', situacao: 'aprovada' }, regras, '2026-10-14'),
      linhaDoDia('2026-10-06', manha, null, regras, '2026-10-14'),
      linhaDoDia('2026-10-11', folga, { entrada: '08:00', saida_intervalo: null, volta_intervalo: null, saida: '10:00', situacao: 'aprovada' }, regras, '2026-10-14'),
    ]
    const t = totalizar(linhas)
    expect(t.previsto).toBe(840)
    expect(t.trabalhado).toBe(600)
    expect(t.extras).toBe(180) // 60 no dia 5 + 120 no domingo
    expect(t.faltantes).toBe(420)
    expect(t.saldo).toBe(-240)
    expect(t.faltas).toBe(1)
    expect(t.domingosFeriadosTrabalhados).toBe(1)
  })

  it('lista os dias do mês e resume a escala', () => {
    expect(diasDoMes('2026-02')).toHaveLength(28)
    expect(diasDoMes('2026-10')[30]).toBe('2026-10-31')
    expect(resumoEscala(manha)).toBe('06:00–14:00')
    expect(resumoEscala(folga)).toBe('Folga')
  })
})
