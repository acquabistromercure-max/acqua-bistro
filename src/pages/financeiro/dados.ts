import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { totalDia } from '../../lib/cafe'
import { FORMAS_CAIXA, totalTaxas, type Taxas, type Valores } from '../../lib/caixa'
import { dataVencimento, parcelas } from '../../lib/cartao'
import { chaveDaVendaCafe } from '../caixa/dados'

export type Fonte = 'credito' | 'debito' | 'pix' | 'dinheiro' | 'conta_assinada' | 'outros' | 'hotel' | 'eventos'
export type Receita = { data: string; valor: number; fonte: Fonte; taxa: number }
export type Despesa = { data: string; valor: number; categoria: string; quem: string; origem: 'Contas' | 'Cartão' | 'Caixa' | 'Diárias' | 'Gastos' }
export type DiaCafe = { data: string; hospedes: number; servidos: number; tickets: number; valor: number }

export const ROTULO_FONTE: Record<Fonte, string> = {
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  conta_assinada: 'Conta assinada',
  outros: 'Outros',
  hotel: 'Hotel (café, borderô e ajustes)',
  eventos: 'Eventos',
}

const fonteDaChave = (k: string): Fonte =>
  k.startsWith('credito_') ? 'credito' : k.startsWith('debito_') ? 'debito' : (['pix', 'dinheiro', 'conta_assinada'].includes(k) ? k : 'outros') as Fonte

async function linhas<T>(consulta: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await consulta
  return error ? [] : ((data ?? []) as T[])
}

/** Tudo o que o painel precisa num intervalo, já normalizado em receitas, despesas e cafés. */
export function useDadosFinanceiros(inicio: string, fim: string, taxas: Taxas) {
  return useQuery({
    queryKey: ['painel-financeiro', inicio, fim, JSON.stringify(taxas)],
    staleTime: 60_000,
    queryFn: async () => {
      const [caixa, vendasCafe, cafeDias, ajustes, bordero, eventos, contas, fornecedores, comprasCartao, cartoes, movimentos, diarias, lancamentos, gastos] = await Promise.all([
        linhas<{ data: string; vendas: Valores }>(supabase.from('caixa_dias').select('data, vendas').gte('data', inicio).lte('data', fim)),
        linhas<{ recebido_em: string; forma: string | null; bandeira: string | null; valor_total: number }>(
          supabase.from('cafe_vendas').select('recebido_em, forma, bandeira, valor_total').eq('pago', true).eq('situacao', 'registrado').gte('recebido_em', inicio).lte('recebido_em', fim),
        ),
        linhas<{ data: string; hospedes: number; cafes_servidos: number; valor_cafe: number; percentual_garantido: number }>(supabase.from('cafe_dias').select('*').gte('data', inicio).lte('data', fim)),
        linhas<{ data: string; total: number }>(supabase.from('cafe_ajustes').select('data, total').eq('situacao', 'registrado').gte('data', inicio).lte('data', fim)),
        linhas<{ data: string; total: number }>(supabase.from('consumos_quarto').select('data, total').eq('situacao', 'registrado').gte('data', inicio).lte('data', fim)),
        linhas<{ data: string; situacao: string; titulo: string; pessoas: number; preco_por_pessoa: number; valor_adicional: number; evento_consumos: { total: number; situacao: string }[] }>(
          supabase.from('eventos').select('data, situacao, titulo, pessoas, preco_por_pessoa, valor_adicional, evento_consumos(total, situacao)').gte('data', inicio).lte('data', fim),
        ),
        linhas<{ vencimento: string; valor: number; categoria: string; fornecedor_id: string | null; descricao: string; situacao: string }>(
          supabase.from('contas_pagar').select('vencimento, valor, categoria, fornecedor_id, descricao, situacao').neq('situacao', 'cancelada').gte('vencimento', inicio).lte('vencimento', fim),
        ),
        linhas<{ id: string; nome: string }>(supabase.from('fornecedores').select('id, nome')),
        linhas<{ cartao_id: string; data: string; valor_total: number; parcelas: number; categoria: string; estabelecimento: string; situacao: string }>(
          supabase.from('compras_cartao').select('cartao_id, data, valor_total, parcelas, categoria, estabelecimento, situacao').neq('situacao', 'cancelado'),
        ),
        linhas<{ id: string; fechamento_dia: number; vencimento_dia: number }>(supabase.from('cartoes').select('id, fechamento_dia, vencimento_dia')),
        linhas<{ data: string; valor: number; categoria: string; fornecedor: string | null; motivo: string; sentido: string; situacao: string; gasto_id: string | null }>(
          supabase.from('caixa_movimentos').select('data, valor, categoria, fornecedor, motivo, sentido, situacao, gasto_id').eq('sentido', 'saida').eq('situacao', 'registrado').gte('data', inicio).lte('data', fim),
        ),
        linhas<{ data: string; valor: number; situacao: string; funcao: string | null }>(
          supabase.from('diarias').select('data, valor, situacao, funcao').in('situacao', ['trabalhada', 'aprovada', 'paga']).gte('data', inicio).lte('data', fim),
        ),
        linhas<{ data: string; valor: number; tipo: string; situacao: string }>(
          supabase.from('lancamentos_colaborador').select('data, valor, tipo, situacao').in('tipo', ['vale', 'adiantamento']).neq('situacao', 'cancelado').gte('data', inicio).lte('data', fim),
        ),
        // Obra/manutenção/investimento: os pagos direto entram daqui; os demais já vêm do caixa, cartão ou contas.
        linhas<{ id: string; tipo: string; data: string; valor: number; descricao: string; prestador: string | null; fornecedor_id: string | null; pagamento: string }>(
          supabase.from('gastos').select('id, tipo, data, valor, descricao, prestador, fornecedor_id, pagamento').eq('situacao', 'registrado').gte('data', inicio).lte('data', fim),
        ),
      ])

      const receitas: Receita[] = []
      // Caixa (digitado) + cafés pagos na hora, por forma; taxa da maquininha por bandeira.
      const somar = (data: string, v: Valores) => {
        for (const f of FORMAS_CAIXA) {
          const valor = Number(v[f.chave] ?? 0)
          if (!valor) continue
          receitas.push({ data, valor, fonte: fonteDaChave(f.chave), taxa: totalTaxas({ [f.chave]: valor }, taxas) })
        }
      }
      caixa.forEach((d) => somar(d.data, d.vendas ?? {}))
      vendasCafe.forEach((v) => somar(v.recebido_em, { [chaveDaVendaCafe(v.forma, v.bandeira)]: Number(v.valor_total) }))
      // Hotel: cafés (servidos + tickets), ajustes e borderô.
      const cafes: DiaCafe[] = cafeDias.map((d) => {
        const valor = totalDia({ hospedes: d.hospedes, cafes_servidos: d.cafes_servidos, valor_cafe: Number(d.valor_cafe), percentual_garantido: Number(d.percentual_garantido) })
        const valorServido = d.cafes_servidos * Number(d.valor_cafe)
        return { data: d.data, hospedes: d.hospedes, servidos: d.cafes_servidos, tickets: Number(d.valor_cafe) ? Math.round((valor - valorServido) / Number(d.valor_cafe)) : 0, valor }
      })
      cafes.forEach((c) => receitas.push({ data: c.data, valor: c.valor, fonte: 'hotel', taxa: 0 }))
      ;[...ajustes, ...bordero].forEach((a) => receitas.push({ data: a.data, valor: Number(a.total), fonte: 'hotel', taxa: 0 }))
      // Eventos (confirmados em diante): pacote + adicional + consumos.
      eventos
        .filter((e) => !['orcamento', 'cancelado'].includes(e.situacao))
        .forEach((e) => {
          const consumos = (e.evento_consumos ?? []).filter((c) => c.situacao !== 'cancelado').reduce((s, c) => s + Number(c.total), 0)
          receitas.push({ data: e.data, valor: Number(e.pessoas) * Number(e.preco_por_pessoa) + Number(e.valor_adicional) + consumos, fonte: 'eventos', taxa: 0 })
        })

      const nomeF = new Map(fornecedores.map((f) => [f.id, f.nome]))
      const despesas: Despesa[] = []
      contas.forEach((c) => despesas.push({ data: c.vencimento, valor: Number(c.valor), categoria: c.categoria, quem: (c.fornecedor_id && nomeF.get(c.fornecedor_id)) || c.descricao, origem: 'Contas' }))
      const regra = new Map(cartoes.map((c) => [c.id, c]))
      comprasCartao.forEach((c) => {
        const r = regra.get(c.cartao_id)
        if (!r) return
        for (const p of parcelas(c.data, Number(c.valor_total), c.parcelas, r)) {
          const data = dataVencimento(p.competencia, r)
          if (data >= inicio && data <= fim) despesas.push({ data, valor: p.valor, categoria: c.categoria, quem: c.estabelecimento, origem: 'Cartão' })
        }
      })
      const ROTULO_GASTO: Record<string, string> = { obra: 'Obra', manutencao: 'Manutenção', investimento: 'Investimento' }
      const tipoGasto = new Map(gastos.map((g) => [g.id, ROTULO_GASTO[g.tipo] ?? 'Outros']))
      movimentos
        .filter((m) => ['compra', 'despesa', 'passagem'].includes(m.categoria))
        .forEach((m) =>
          despesas.push({
            data: m.data,
            valor: Number(m.valor),
            categoria: (m.gasto_id && tipoGasto.get(m.gasto_id)) || (m.categoria === 'passagem' ? 'Pessoal' : m.categoria === 'compra' ? 'Insumos' : 'Despesas do caixa'),
            quem: m.fornecedor || m.motivo,
            origem: 'Caixa',
          }),
        )
      gastos
        .filter((g) => g.pagamento === 'pago')
        .forEach((g) =>
          despesas.push({ data: g.data, valor: Number(g.valor), categoria: ROTULO_GASTO[g.tipo] ?? 'Outros', quem: (g.fornecedor_id && nomeF.get(g.fornecedor_id)) || g.prestador || g.descricao, origem: 'Gastos' }),
        )
      diarias.forEach((d) => despesas.push({ data: d.data, valor: Number(d.valor), categoria: 'Pessoal', quem: `Diária${d.funcao ? ` · ${d.funcao}` : ''}`, origem: 'Diárias' }))

      const adiantamentos = lancamentos.map((l) => ({ data: l.data, valor: Number(l.valor) }))
      return { receitas, despesas, cafes, adiantamentos }
    },
  })
}
