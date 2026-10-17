import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useConfiguracao } from '../../lib/hooks'
import type { TipoMovimento } from '../../lib/inventario'

export type Item = {
  id: string
  nome: string
  categoria: string
  local: string | null
  unidade: string
  quantidade: number
  estoque_minimo: number | null
  valor_unitario: number | null
  patrimonio: string | null
  equipamento: boolean
  observacao: string | null
  ativo: boolean
  criado_por: string | null
  criado_em: string
}

export type Movimento = {
  id: string
  item_id: string
  data: string
  tipo: TipoMovimento
  quantidade: number
  motivo: string | null
  responsavel_tipo: 'colaborador' | 'cliente' | 'nao_identificado' | null
  colaborador_id: string | null
  ocorrencia_id: string | null
  gasto_id: string | null
  contagem_id: string | null
  situacao: 'registrado' | 'cancelado'
  motivo_cancelamento: string | null
  criado_por: string | null
  criado_em: string
}

export type Contagem = {
  id: string
  data: string
  titulo: string
  situacao: 'aberta' | 'fechada'
  observacao: string | null
  fechada_por: string | null
  fechada_em: string | null
  criado_por: string | null
  criado_em: string
}

export type ItemContado = {
  id: string
  contagem_id: string
  item_id: string
  contado: number
  esperado: number | null
  observacao: string | null
  contado_por: string | null
}

export function useItens() {
  return useQuery({
    queryKey: ['inventario_itens'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventario_itens').select('*').order('categoria').order('nome')
      if (error) throw error
      return data as Item[]
    },
  })
}

/** Movimentos (todos ou de um item), mais recentes primeiro. */
export function useMovimentos(itemId?: string) {
  return useQuery({
    queryKey: ['inventario_movimentos', itemId ?? 'todos'],
    queryFn: async () => {
      let q = supabase.from('inventario_movimentos').select('*').order('data', { ascending: false }).order('criado_em', { ascending: false }).limit(2000)
      if (itemId) q = q.eq('item_id', itemId)
      const { data, error } = await q
      if (error) throw error
      return data as Movimento[]
    },
  })
}

export function useContagens() {
  return useQuery({
    queryKey: ['inventario_contagens'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventario_contagens').select('*').order('data', { ascending: false })
      if (error) throw error
      return data as Contagem[]
    },
  })
}

export const useCategoriasInventario = () =>
  useConfiguracao<string[]>('inventario_categorias', ['Louças', 'Talheres', 'Copos e taças', 'Utensílios de cozinha', 'Panelas', 'Equipamentos', 'Móveis', 'Outros'])
export const useLocaisInventario = () => useConfiguracao<string[]>('inventario_locais', ['Salão', 'Cozinha', 'Bar', 'Estoque'])

/** Chaves de cache que mudam quando o inventário mexe. */
export const CHAVES_INVENTARIO = [['inventario_itens'], ['inventario_movimentos'], ['inventario_contagens'], ['inventario_contados']]
