import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useConfiguracao } from '../../lib/hooks'
import { usePermissoes } from '../../lib/permissoes'
import { arred, somarValores, type ChaveVenda, type Prazos, type Taxas, type Valores } from '../../lib/caixa'

export type CaixaDia = {
  id: string
  data: string
  vendas: Valores
  saldo_contado: number | null
  diferenca: number | null
  observacao: string | null
  fechado: boolean
  fechado_por: string | null
  fechado_em: string | null
  criado_por: string | null
}

export type Movimento = {
  id: string
  data: string
  conta: 'caixa' | 'fundo'
  sentido: 'entrada' | 'saida'
  categoria: string
  valor: number
  motivo: string
  responsavel: string
  colaborador_id: string | null
  fornecedor: string | null
  autorizado_por: string | null
  observacao: string | null
  situacao: 'registrado' | 'cancelado'
  motivo_cancelamento: string | null
  criado_por: string | null
  criado_em: string
}

export type SaldoInicial = { data: string | null; caixa: number; fundo: number }

export function useRegrasCaixa() {
  const taxas = useConfiguracao<Taxas>('caixa_taxas', {})
  const prazos = useConfiguracao<Prazos>('caixa_prazos', { credito: 30, debito: 1 })
  const saldo = useConfiguracao<SaldoInicial>('caixa_saldo_inicial', { data: null, caixa: 0, fundo: 0 })
  return { taxas, prazos, saldo: { data: saldo.data, caixa: Number(saldo.caixa) || 0, fundo: Number(saldo.fundo) || 0 } }
}

export function useCaixaDias(inicio: string, fim: string) {
  return useQuery({
    queryKey: ['caixa_dias', inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.from('caixa_dias').select('*').gte('data', inicio).lte('data', fim).order('data')
      if (error) throw error
      return data as CaixaDia[]
    },
  })
}

export function useMovimentos(inicio: string, fim: string, conta?: 'caixa' | 'fundo') {
  return useQuery({
    queryKey: ['caixa_movimentos', inicio, fim, conta ?? 'todas'],
    queryFn: async () => {
      let q = supabase.from('caixa_movimentos').select('*').gte('data', inicio).lte('data', fim).order('data').order('criado_em')
      if (conta) q = q.eq('conta', conta)
      const { data, error } = await q
      if (error) throw error
      return data as Movimento[]
    },
  })
}

type VendaCafe = { recebido_em: string; forma: string | null; bandeira: string | null; valor_total: number }

/** Forma + bandeira do café → coluna da planilha de caixa. */
export function chaveDaVendaCafe(forma: string | null, bandeira: string | null): ChaveVenda {
  if (forma === 'credito' && bandeira && ['visa', 'mastercard', 'amex', 'elo'].includes(bandeira)) return `credito_${bandeira}` as ChaveVenda
  if (forma === 'debito' && bandeira && ['visa', 'mastercard', 'elo'].includes(bandeira)) return `debito_${bandeira}` as ChaveVenda
  if (forma === 'pix') return 'pix'
  if (forma === 'dinheiro') return 'dinheiro'
  return 'outros'
}

/** Cafés pagos na hora (módulo Café), por dia e forma — entram no caixa sem redigitar. */
export function useCafesNoCaixa(inicio: string, fim: string) {
  const { pode } = usePermissoes()
  return useQuery({
    queryKey: ['cafe_vendas', 'caixa', inicio, fim],
    enabled: pode('cafes'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cafe_vendas')
        .select('recebido_em, forma, bandeira, valor_total')
        .eq('pago', true)
        .eq('situacao', 'registrado')
        .gte('recebido_em', inicio)
        .lte('recebido_em', fim)
      if (error) throw error
      const porDia = new Map<string, Valores>()
      for (const v of data as VendaCafe[]) {
        const chave = chaveDaVendaCafe(v.forma, v.bandeira)
        porDia.set(v.recebido_em, somarValores(porDia.get(v.recebido_em) ?? {}, { [chave]: Number(v.valor_total) }))
      }
      return porDia
    },
  })
}

/** Total de entradas e saídas (registradas) de uma lista de movimentos. */
export function totaisMovimentos(lista: Movimento[]) {
  const validos = lista.filter((m) => m.situacao !== 'cancelado')
  const entradas = arred(validos.filter((m) => m.sentido === 'entrada').reduce((s, m) => s + Number(m.valor), 0))
  const saidas = arred(validos.filter((m) => m.sentido === 'saida').reduce((s, m) => s + Number(m.valor), 0))
  return { entradas, saidas }
}
