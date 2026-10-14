import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { ItemModelo } from '../../lib/eventos'

export type Cliente = { id: string; nome: string; documento: string | null; contato: string | null; telefone: string | null; email: string | null; observacao: string | null }
export type Modelo = { id: string; nome: string; descricao: string | null; preco_por_pessoa: number; itens: ItemModelo[]; ativo: boolean }
export type ProdutoEvento = { id: string; nome: string; unidade: string; preco: number; ativo: boolean }

export type Evento = {
  id: string
  titulo: string
  cliente_id: string | null
  contato: string | null
  telefone: string | null
  data: string
  hora_inicio: string | null
  hora_fim: string | null
  local: string | null
  pessoas: number
  modelo_id: string | null
  preco_por_pessoa: number
  cardapio: string | null
  valor_adicional: number
  sinal: number
  sinal_pago_em: string | null
  situacao: string
  faturar_hotel: boolean
  valor_recebido: number | null
  recebido_em: string | null
  observacao: string | null
  motivo_cancelamento: string | null
  criado_por: string | null
  evento_consumos?: Consumo[]
}

export type Consumo = {
  id: string
  evento_id: string
  momento: string
  produto: string
  quantidade: number
  preco_unitario: number
  total: number
  observacao: string | null
  situacao: 'registrado' | 'cancelado'
  motivo_cancelamento: string | null
  criado_por: string | null
}

function useLista<T>(tabela: string, ordem = 'nome') {
  return useQuery({
    queryKey: [tabela],
    queryFn: async () => {
      const { data, error } = await supabase.from(tabela).select('*').order(ordem)
      if (error) throw error
      return data as T[]
    },
    staleTime: 60_000,
  })
}

export const useClientes = () => useLista<Cliente>('clientes')
export const useModelos = () => useLista<Modelo>('evento_modelos')
export const useProdutosEvento = () => useLista<ProdutoEvento>('evento_produtos')

export function useEventos(inicio?: string, fim?: string) {
  return useQuery({
    queryKey: ['eventos', inicio ?? '', fim ?? ''],
    queryFn: async () => {
      let q = supabase.from('eventos').select('*, evento_consumos(*)').order('data').order('hora_inicio')
      if (inicio) q = q.gte('data', inicio)
      if (fim) q = q.lte('data', fim)
      const { data, error } = await q
      if (error) throw error
      return data as Evento[]
    },
  })
}

export const consumosValidos = (e: Pick<Evento, 'evento_consumos'>) => (e.evento_consumos ?? []).filter((c) => c.situacao !== 'cancelado')
