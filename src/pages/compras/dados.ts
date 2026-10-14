import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useConfiguracao } from '../../lib/hooks'

export type Fornecedor = {
  id: string
  nome: string
  categoria: string | null
  contato: string | null
  telefone: string | null
  cnpj: string | null
  prazo_dias: number | null
  forma_pagamento: string | null
  observacao: string | null
  ativo: boolean
}

export type Produto = {
  id: string
  nome: string
  categoria: string
  unidade: string
  fornecedor_id: string | null
  preco_referencia: number | null
  ativo: boolean
}

export type SituacaoPedido = 'solicitado' | 'aprovado' | 'comprado' | 'recebido' | 'concluido' | 'cancelado'

export type Pedido = {
  id: string
  numero: number
  titulo: string
  categoria: string | null
  prioridade: 'normal' | 'urgente'
  necessario_em: string | null
  fornecedor_id: string | null
  situacao: SituacaoPedido
  aprovado_por: string | null
  aprovado_em: string | null
  comprado_em: string | null
  recebido_em: string | null
  observacao: string | null
  motivo_cancelamento: string | null
  criado_por: string | null
  criado_em: string
  pedido_itens?: ItemPedido[]
}

export type ItemPedido = {
  id: string
  pedido_id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  unidade: string
  preco_estimado: number | null
  preco_real: number | null
  quantidade_recebida: number | null
  observacao: string | null
}

export type ContaPagar = {
  id: string
  descricao: string
  fornecedor_id: string | null
  categoria: string
  valor: number
  data_compra: string | null
  vencimento: string
  forma: string | null
  parcela: string | null
  pedido_id: string | null
  situacao: 'aberta' | 'paga' | 'cancelada'
  pago_em: string | null
  valor_pago: number | null
  pago_por: string | null
  observacao: string | null
  motivo_cancelamento: string | null
  criado_por: string | null
}

export const ETAPAS: { valor: SituacaoPedido; rotulo: string }[] = [
  { valor: 'solicitado', rotulo: 'Solicitado' },
  { valor: 'aprovado', rotulo: 'Aprovado' },
  { valor: 'comprado', rotulo: 'Comprado' },
  { valor: 'recebido', rotulo: 'Recebido' },
  { valor: 'concluido', rotulo: 'Concluído' },
]

export const FORMAS_CONTA = [
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'cartao', rotulo: 'Cartão' },
  { valor: 'debito_automatico', rotulo: 'Débito automático' },
  { valor: 'outro', rotulo: 'Outro' },
]

export function useCategoriasCompras() {
  return useConfiguracao<string[]>('compras_categorias', ['Limpeza', 'Frios', 'Secos'])
}
export function useUnidades() {
  return useConfiguracao<string[]>('compras_unidades', ['un', 'kg', 'L', 'cx', 'pct'])
}
export function useCategoriasContas() {
  return useConfiguracao<string[]>('contas_categorias', ['Insumos', 'Contas mensais', 'Outros'])
}

export function useFornecedores() {
  return useQuery({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fornecedores').select('*').order('nome')
      if (error) throw error
      return data as Fornecedor[]
    },
    staleTime: 60_000,
  })
}

export function useProdutos() {
  return useQuery({
    queryKey: ['produtos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('produtos').select('*').order('categoria').order('nome')
      if (error) throw error
      return data as Produto[]
    },
    staleTime: 60_000,
  })
}

export const totalItens = (itens: ItemPedido[], real = false) =>
  Math.round(
    itens.reduce((s, i) => s + Number((real ? i.preco_real ?? i.preco_estimado : i.preco_estimado) ?? 0) * Number(real ? i.quantidade_recebida ?? i.quantidade : i.quantidade), 0) * 100,
  ) / 100
