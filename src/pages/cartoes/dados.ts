import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export type Cartao = {
  id: string
  apelido: string
  banco: string
  final: string
  titular: string | null
  tipo: 'empresa' | 'pessoal'
  fechamento_dia: number
  vencimento_dia: number
  limite: number | null
  ativo: boolean
}

export type CompraCartao = {
  id: string
  cartao_id: string
  data: string
  estabelecimento: string
  fornecedor_id: string | null
  itens: string
  categoria: string
  valor_total: number
  parcelas: number
  responsavel: string
  comprovante_ok: boolean
  observacao: string | null
  situacao: 'registrado' | 'cancelado'
  motivo_cancelamento: string | null
  criado_por: string | null
}

export type Fatura = {
  id: string
  cartao_id: string
  competencia: string
  valor_calculado: number
  valor_pago: number
  pago_em: string
  observacao: string | null
  criado_por: string | null
}

export function useCartoes() {
  return useQuery({
    queryKey: ['cartoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cartoes').select('*').order('apelido')
      if (error) throw error
      return data as Cartao[]
    },
  })
}

/** Compras dos últimos 24 meses (cobre parcelas que ainda caem nas faturas). */
export function useComprasCartao() {
  return useQuery({
    queryKey: ['compras_cartao'],
    queryFn: async () => {
      const desde = new Date()
      desde.setMonth(desde.getMonth() - 24)
      const { data, error } = await supabase
        .from('compras_cartao')
        .select('*')
        .gte('data', desde.toISOString().slice(0, 10))
        .order('data', { ascending: false })
      if (error) throw error
      return data as CompraCartao[]
    },
  })
}

export function useFaturas() {
  return useQuery({
    queryKey: ['faturas_cartao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('faturas_cartao').select('*').order('competencia', { ascending: false })
      if (error) throw error
      return data as Fatura[]
    },
  })
}

export const rotuloCartao = (c: Pick<Cartao, 'apelido' | 'final'>) => `${c.apelido} •••• ${c.final}`
