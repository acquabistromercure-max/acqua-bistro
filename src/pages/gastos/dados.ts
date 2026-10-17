import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useConfiguracao } from '../../lib/hooks'

export type TipoGasto = 'obra' | 'manutencao' | 'investimento'
export type Pagamento = 'pago' | 'caixa' | 'fundo' | 'cartao' | 'a_pagar'

export type Gasto = {
  id: string
  tipo: TipoGasto
  data: string
  descricao: string
  projeto: string | null
  categoria: string
  fornecedor_id: string | null
  prestador: string | null
  valor: number
  pagamento: Pagamento
  forma: string | null
  cartao_id: string | null
  parcelas: number
  vencimento: string | null
  responsavel: string | null
  item_id: string | null
  quantidade: number | null
  proxima_manutencao: string | null
  anexo: string | null
  observacao: string | null
  situacao: 'registrado' | 'cancelado'
  motivo_cancelamento: string | null
  criado_por: string | null
  criado_em: string
}

export const TITULO: Record<TipoGasto, { titulo: string; descricao: string; novo: string; vazio: string }> = {
  obra: {
    titulo: 'Obra',
    descricao: 'Tudo o que está sendo gasto na reforma: serviços, mão de obra e material.',
    novo: 'Novo gasto da obra',
    vazio: 'Nenhum gasto de obra lançado.',
  },
  manutencao: {
    titulo: 'Manutenção',
    descricao: 'Manutenções feitas nos equipamentos, quanto custaram e quando é a próxima.',
    novo: 'Nova manutenção',
    vazio: 'Nenhuma manutenção lançada.',
  },
  investimento: {
    titulo: 'Investimentos',
    descricao: 'Equipamentos e materiais de uso no restaurante. O que é comprado entra sozinho no inventário.',
    novo: 'Novo investimento',
    vazio: 'Nenhum investimento lançado.',
  },
}

export const PAGAMENTOS: { valor: Pagamento; rotulo: string; ajuda: string }[] = [
  { valor: 'pago', rotulo: 'Já pago (pix, transferência...)', ajuda: 'Saiu direto da conta. Entra só aqui e no painel financeiro.' },
  { valor: 'caixa', rotulo: 'Dinheiro do caixa', ajuda: 'Vira uma saída no caixa do dia.' },
  { valor: 'fundo', rotulo: 'Fundo de despesas', ajuda: 'Vira uma saída no fundo de despesas.' },
  { valor: 'cartao', rotulo: 'Cartão empresa', ajuda: 'Vira uma compra no cartão, com as parcelas nas faturas.' },
  { valor: 'a_pagar', rotulo: 'A pagar (boleto/parcelado)', ajuda: 'Vira conta(s) a pagar com vencimento.' },
]

export const FORMAS_PAGO = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'dinheiro', rotulo: 'Dinheiro (fora do caixa)' },
  { valor: 'debito', rotulo: 'Cartão de débito' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'outro', rotulo: 'Outro' },
]

const PADRAO_CATEGORIAS: Record<TipoGasto, string[]> = {
  obra: ['Mão de obra', 'Material', 'Projeto', 'Outros'],
  manutencao: ['Preventiva', 'Corretiva', 'Peças', 'Outros'],
  investimento: ['Equipamento', 'Utensílios', 'Móveis', 'Outros'],
}

export function useCategoriasGastos(tipo: TipoGasto) {
  const todas = useConfiguracao<Record<TipoGasto, string[]>>('gastos_categorias', PADRAO_CATEGORIAS)
  return todas[tipo] ?? PADRAO_CATEGORIAS[tipo]
}

export function useGastos(tipo: TipoGasto) {
  return useQuery({
    queryKey: ['gastos', tipo],
    queryFn: async () => {
      const { data, error } = await supabase.from('gastos').select('*').eq('tipo', tipo).order('data', { ascending: false }).limit(3000)
      if (error) throw error
      return data as Gasto[]
    },
  })
}
