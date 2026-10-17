import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useConfiguracao } from '../../lib/hooks'
import { REGRAS_PADRAO, type DiaEscala, type Marcacao, type RegrasPonto, type TipoEscala } from '../../lib/ponto'

export type Pessoa = {
  id: string
  nome: string
  apelido: string | null
  funcao: string | null
  vinculo: string
  situacao: 'ativo' | 'afastado' | 'desligado'
  horario_entrada?: string | null
  horario_saida?: string | null
  intervalo_minutos?: number
  dias_folga?: number[]
  turno?: string | null
  regime?: 'semanal' | '12x36'
  escala_referencia?: string | null
}

type ComHorario = {
  horario_entrada?: string | null
  horario_saida?: string | null
  intervalo_minutos?: number
  dias_folga?: number[]
  regime?: 'semanal' | '12x36'
  escala_referencia?: string | null
}

/** 12x36: trabalha nos dias a um número par de dias da referência; folga nos outros. */
export function folgaNo12x36(referencia: string, data: string) {
  const dias = Math.round((Date.parse(`${data}T12:00:00Z`) - Date.parse(`${referencia}T12:00:00Z`)) / 86_400_000)
  return Math.abs(dias) % 2 === 1
}

/**
 * Escala que vale para o dia: a lançada na grade ou, se não houver, a do horário fixo da ficha
 * (folga nos dias de folga fixa). Sem horário fixo e sem escala → nada previsto.
 */
export function escalaDoDia(escala: DiaEscala | null | undefined, pessoa: ComHorario | null | undefined, data: string): DiaEscala | null {
  if (escala) return escala
  if (!pessoa?.horario_entrada || !pessoa.horario_saida) return null
  const dow = new Date(`${data}T12:00:00Z`).getUTCDay() || 7
  const folga =
    pessoa.regime === '12x36' && pessoa.escala_referencia ? folgaNo12x36(pessoa.escala_referencia, data) : (pessoa.dias_folga ?? []).includes(dow)
  if (folga) return { tipo: 'folga', hora_inicio: null, hora_fim: null, intervalo_minutos: 0 }
  return { tipo: 'turno', hora_inicio: pessoa.horario_entrada, hora_fim: pessoa.horario_saida, intervalo_minutos: pessoa.intervalo_minutos ?? 60 }
}

export type Escala = DiaEscala & {
  id: string
  colaborador_id: string
  data: string
  turno: string | null
  observacao: string | null
}

export type RegistroPonto = Marcacao & {
  id: string
  colaborador_id: string
  data: string
  justificativa: string | null
  situacao: 'registrada' | 'aprovada' | 'cancelada'
  aprovado_por: string | null
  aprovado_em: string | null
  motivo_cancelamento: string | null
  criado_por: string | null
}

export type Fechamento = {
  id: string
  colaborador_id: string
  competencia: string
  situacao: 'fechado' | 'reaberto'
  resumo: Record<string, number>
  fechado_por: string | null
  fechado_em: string
  reaberto_por: string | null
  reaberto_em: string | null
  motivo_reabertura: string | null
}

export const TIPOS_ESCALA: { valor: TipoEscala; rotulo: string }[] = [
  { valor: 'turno', rotulo: 'Turno de trabalho' },
  { valor: 'folga', rotulo: 'Folga' },
  { valor: 'ferias', rotulo: 'Férias' },
  { valor: 'afastamento', rotulo: 'Afastamento' },
  { valor: 'ausencia', rotulo: 'Ausência' },
]

/** Cores da grade por tipo de dia. */
export const COR_TIPO: Record<TipoEscala, string> = {
  turno: 'bg-acqua-suave text-acqua-titulo',
  folga: 'bg-slate-100 text-slate-600',
  ferias: 'bg-[#FBF3DF] text-[#7A5A0E]',
  afastamento: 'bg-amber-50 text-amber-800',
  ausencia: 'bg-red-50 text-red-800',
}

/** Pessoas que podem entrar na escala (nome e função; a ficha completa continua protegida). */
export function usePessoasEscala() {
  return useQuery({
    queryKey: ['pessoas-escala'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pessoas_escala')
      if (error) throw error
      return data as Pessoa[]
    },
    staleTime: 60_000,
  })
}

export function useEscalas(inicio: string, fim: string, colaboradorId?: string) {
  return useQuery({
    queryKey: ['escalas', inicio, fim, colaboradorId ?? 'todos'],
    queryFn: async () => {
      let q = supabase.from('escalas').select('*').gte('data', inicio).lte('data', fim)
      if (colaboradorId) q = q.eq('colaborador_id', colaboradorId)
      const { data, error } = await q
      if (error) throw error
      return data as Escala[]
    },
  })
}

export function useRegistrosPonto(inicio: string, fim: string, colaboradorId?: string, ativo = true) {
  return useQuery({
    queryKey: ['ponto', inicio, fim, colaboradorId ?? 'todos'],
    enabled: ativo,
    queryFn: async () => {
      let q = supabase.from('registros_ponto').select('*').gte('data', inicio).lte('data', fim).neq('situacao', 'cancelada')
      if (colaboradorId) q = q.eq('colaborador_id', colaboradorId)
      const { data, error } = await q
      if (error) throw error
      return data as RegistroPonto[]
    },
  })
}

type HorarioTurno = { inicio: string; fim: string; intervalo: number }

export function useHorariosTurnos() {
  return useConfiguracao<Record<string, HorarioTurno>>('horarios_turnos', {})
}

/** Regras de cálculo da folha-ponto (configuráveis pelo administrador). */
export function useRegrasPonto(): RegrasPonto {
  const tolerancia = useConfiguracao<number>('ponto_tolerancia_minutos', REGRAS_PADRAO.toleranciaMinutos)
  const noturna = useConfiguracao<{ inicio: string; fim: string }>('hora_noturna', {
    inicio: REGRAS_PADRAO.noturnaInicio,
    fim: REGRAS_PADRAO.noturnaFim,
  })
  const feriados = useConfiguracao<string[]>('feriados', [])
  return { toleranciaMinutos: Number(tolerancia), noturnaInicio: noturna.inicio, noturnaFim: noturna.fim, feriados }
}

/** Chave "pessoa|data" para achar o registro de um dia. */
export const chaveDia = (colaboradorId: string, data: string) => `${colaboradorId}|${data}`

export function porDia<T extends { colaborador_id: string; data: string }>(linhas: T[] | undefined): Map<string, T> {
  return new Map((linhas ?? []).map((l) => [chaveDia(l.colaborador_id, l.data), l]))
}

export const nomeCurto = (p: Pick<Pessoa, 'nome' | 'apelido'>) => p.apelido || p.nome
