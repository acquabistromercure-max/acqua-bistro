import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useConfiguracao } from '../../lib/hooks'

export type CafeDia = {
  id: string
  data: string
  hospedes: number
  cafes_servidos: number
  valor_cafe: number
  percentual_garantido: number
  observacao: string | null
}

export type Ajuste = {
  id: string
  data: string
  apartamento: string
  hospede: string | null
  quantidade: number
  valor_unitario: number
  total: number
  motivo: string
  autorizado_por: string | null
  cliente_id?: string | null
  descricao: string | null
  situacao: 'registrado' | 'cancelado'
  motivo_cancelamento: string | null
  criado_por: string | null
}

export type ConsumoQuarto = {
  id: string
  data: string
  apartamento: string
  item: string
  quantidade: number
  valor_unitario: number
  total: number
  observacao: string | null
  entregue_recepcao: boolean
  entregue_a: string | null
  entregue_em: string | null
  situacao: 'registrado' | 'cancelado'
  motivo_cancelamento: string | null
  criado_por: string | null
}

export type Venda = {
  id: string
  data: string
  cliente: string
  mensalista_id: string | null
  quantidade: number
  valor_total: number
  pago: boolean
  forma: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'outro' | null
  bandeira: 'visa' | 'mastercard' | 'amex' | 'elo' | 'outra' | null
  recebido_em: string | null
  conferido: boolean
  conferido_por: string | null
  observacao: string | null
  situacao: 'registrado' | 'cancelado'
  motivo_cancelamento: string | null
  criado_por: string | null
}

export type Mensalista = { id: string; nome: string; apartamento: string | null; ativo: boolean; observacao: string | null }

export type Quinzena = {
  id: string
  inicio: string
  fim: string
  situacao: 'enviada' | 'paga' | 'reaberta'
  resumo: Record<string, number>
  reconhecido: Record<string, number>
  valor_pago: number | null
  pago_em: string | null
  observacao: string | null
  motivo_reabertura: string | null
  criado_por: string | null
  criado_em: string
}

export type RegrasCafe = { valor_cafe: number; percentual_garantido: number }
export type ItemBordero = { nome: string; valor: number }

export function useRegrasCafe() {
  const regras = useConfiguracao<RegrasCafe>('cafe_regras', { valor_cafe: 0, percentual_garantido: 0 })
  const itens = useConfiguracao<ItemBordero[]>('cafe_itens_bordero', [])
  const precos = useConfiguracao<number[]>('cafe_precos_venda', [])
  const autorizadores = useConfiguracao<string[]>('cafe_autorizadores', [])
  return {
    regras: { valor_cafe: Number(regras.valor_cafe) || 0, percentual_garantido: Number(regras.percentual_garantido) || 0 },
    itens,
    precos,
    autorizadores,
    configurado: Number(regras.valor_cafe) > 0 && Number(regras.percentual_garantido) > 0,
  }
}

/** Busca linhas de uma tabela do café num período (sempre ordenadas por data/criação). */
export function useTabelaPeriodo<T>(tabela: string, inicio: string, fim: string, extra?: { coluna: string; valor: string }) {
  return useQuery({
    queryKey: [tabela, inicio, fim, extra?.valor ?? ''],
    queryFn: async () => {
      let q = supabase.from(tabela).select('*').gte('data', inicio).lte('data', fim).order('data').order('criado_em')
      if (extra) q = q.eq(extra.coluna, extra.valor)
      const { data, error } = await q
      if (error) throw error
      return data as T[]
    },
  })
}

/** Fechamento ativo (enviado ou pago) da quinzena que começa em "inicio". */
export function useQuinzena(inicio: string) {
  return useQuery({
    queryKey: ['quinzenas_hotel', inicio],
    queryFn: async () => {
      const { data, error } = await supabase.from('quinzenas_hotel').select('*').eq('inicio', inicio).order('criado_em', { ascending: false })
      if (error) throw error
      const lista = data as Quinzena[]
      return { ativa: lista.find((q) => q.situacao !== 'reaberta') ?? null, historico: lista }
    },
  })
}

export function useMensalistas() {
  return useQuery({
    queryKey: ['cafe_mensalistas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cafe_mensalistas').select('*').order('nome')
      if (error) throw error
      return data as Mensalista[]
    },
  })
}

export const ROTULO_FORMA: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito', outro: 'Outro' }
export const ROTULO_BANDEIRA: Record<string, string> = { visa: 'Visa', mastercard: 'Master', amex: 'Amex', elo: 'Elo', outra: 'Outra' }

export function descreverPagamento(v: Pick<Venda, 'pago' | 'forma' | 'bandeira'>) {
  if (!v.pago) return 'A receber'
  return [v.forma ? ROTULO_FORMA[v.forma] : '', v.bandeira ? ROTULO_BANDEIRA[v.bandeira] : ''].filter(Boolean).join(' ')
}
