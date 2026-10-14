import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Printer, Receipt } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarData, formatarDataHora, formatarMoeda, hojeISO, lerMoeda, somarDias } from '../../lib/formatos'
import { esc, imprimirDocumento, tabelaHtml } from '../../lib/imprimir'
import { Botao, Janela, Mensagem, Selo, cx, mensagemErro } from '../../components/ui'
import { BotaoExcluir, JanelaCancelar } from '../../components/registros'
import { ETAPAS, totalItens, useFornecedores, type ItemPedido, type Pedido } from './dados'

/** Detalhe do pedido: itens, etapas, recebimento (preço real e quantidade), impressão e conta a pagar. */
export default function PedidoJanela({ pedido, aoFechar }: { pedido: Pedido; aoFechar: () => void }) {
  const qc = useQueryClient()
  const { pode, perfil } = usePermissoes()
  const nome = useNomesUsuarios()
  const fornecedores = useFornecedores()
  const itens = pedido.pedido_itens ?? []
  const [cancelando, setCancelando] = useState(false)
  const [recebendo, setRecebendo] = useState(false)
  const [reais, setReais] = useState<Record<string, { preco: string; qtd: string }>>(
    Object.fromEntries(itens.map((i) => [i.id, { preco: i.preco_real != null ? String(i.preco_real).replace('.', ',') : i.preco_estimado != null ? String(i.preco_estimado).replace('.', ',') : '', qtd: String(i.quantidade_recebida ?? i.quantidade).replace('.', ',') }])),
  )
  const fornecedor = fornecedores.data?.find((f) => f.id === pedido.fornecedor_id)
  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['pedidos'] })
    qc.invalidateQueries({ queryKey: ['contas_pagar'] })
  }

  const mudar = useMutation({
    mutationFn: async (dados: Partial<Pedido>) => {
      const { error } = await supabase.from('pedidos').update(dados).eq('id', pedido.id)
      if (error) throw error
    },
    onSuccess: () => {
      setCancelando(false)
      atualizar()
      aoFechar()
    },
  })

  const receber = useMutation({
    mutationFn: async () => {
      for (const i of itens) {
        const r = reais[i.id]
        const { error } = await supabase
          .from('pedido_itens')
          .update({ preco_real: lerMoeda(r?.preco ?? ''), quantidade_recebida: Number((r?.qtd ?? '').replace(',', '.')) || 0 })
          .eq('id', i.id)
        if (error) throw error
      }
      const { error } = await supabase.from('pedidos').update({ situacao: 'recebido' }).eq('id', pedido.id)
      if (error) throw error
    },
    onSuccess: () => {
      setRecebendo(false)
      atualizar()
      aoFechar()
    },
  })

  const gerarConta = useMutation({
    mutationFn: async () => {
      const valor = totalItens(itens, true)
      if (!valor) throw new Error('Informe os preços reais (registre o recebimento) antes de gerar a conta.')
      const base = pedido.recebido_em ?? pedido.comprado_em ?? hojeISO()
      const { error } = await supabase.from('contas_pagar').insert({
        descricao: `Pedido #${pedido.numero} — ${pedido.titulo}`,
        fornecedor_id: pedido.fornecedor_id,
        categoria: pedido.categoria === 'Limpeza' ? 'Limpeza' : 'Insumos',
        valor,
        data_compra: base,
        vencimento: somarDias(base, fornecedor?.prazo_dias ?? 0),
        forma: 'boleto',
        pedido_id: pedido.id,
      })
      if (error) throw error
    },
    onSuccess: atualizar,
  })

  const imprimir = () =>
    imprimirDocumento(
      `Pedido ${pedido.numero}`,
      `<h1>Lista de pedidos nº ${pedido.numero} — ${esc(pedido.titulo)}</h1>
       <div class="campos">
         <div><b>Categoria</b>${esc(pedido.categoria ?? '—')}</div>
         <div><b>Fornecedor</b>${esc(fornecedor?.nome ?? '—')}</div>
         <div><b>Pedido por</b>${esc(nome(pedido.criado_por))}</div>
         <div><b>Precisa até</b>${esc(formatarData(pedido.necessario_em) || '—')}</div>
       </div>
       ${tabelaHtml(
         [{ titulo: 'Produto' }, { titulo: 'Qtd', num: true }, { titulo: 'Unid.' }, { titulo: 'Preço ref.', num: true }, { titulo: 'Conferido' }],
         itens.map((i) => [i.descricao, String(i.quantidade).replace('.', ','), i.unidade, i.preco_estimado ? formatarMoeda(i.preco_estimado) : '', '☐']),
       )}
       ${pedido.observacao ? `<p><b>Obs.:</b> ${esc(pedido.observacao)}</p>` : ''}
       <div class="assinaturas"><div>Solicitante</div><div>Recebido por</div></div>`,
      { subtitulo: `Situação: ${ETAPAS.find((e) => e.valor === pedido.situacao)?.rotulo ?? pedido.situacao}` },
    )

  const etapaAtual = ETAPAS.findIndex((e) => e.valor === pedido.situacao)
  const proximo: Record<string, { para: Pedido['situacao']; rotulo: string; acao: 'aprovar' | 'editar' } | undefined> = {
    solicitado: { para: 'aprovado', rotulo: 'Aprovar', acao: 'aprovar' },
    aprovado: { para: 'comprado', rotulo: 'Marcar como comprado', acao: 'editar' },
    recebido: { para: 'concluido', rotulo: 'Concluir', acao: 'editar' },
  }
  const passo = proximo[pedido.situacao]
  const erro = mudar.error || receber.error || gerarConta.error
  const total = totalItens(itens)
  const totalReal = totalItens(itens, true)
  const podeCancelar = pedido.situacao !== 'cancelado' && pedido.situacao !== 'concluido' && (pode('compras', 'cancelar') || (pedido.criado_por === perfil?.id && pedido.situacao === 'solicitado'))

  return (
    <>
      <Janela
        aberta={!cancelando}
        aoFechar={aoFechar}
        largura="max-w-3xl"
        titulo={`Pedido #${pedido.numero} · ${pedido.titulo}`}
        rodape={
          <>
            <BotaoExcluir modulo="compras" tabela="pedidos" id={pedido.id} descricao={`o pedido #${pedido.numero}`} aoExcluir={() => { atualizar(); aoFechar() }} />
            {podeCancelar && <Botao variante="perigo" onClick={() => setCancelando(true)}>Cancelar</Botao>}
            <Botao variante="secundario" icone={<Printer className="h-4 w-4" />} onClick={imprimir}>Imprimir</Botao>
            {['comprado', 'recebido', 'concluido'].includes(pedido.situacao) && pode('contas', 'criar') && (
              <Botao variante="secundario" icone={<Receipt className="h-4 w-4" />} carregando={gerarConta.isPending} onClick={() => gerarConta.mutate()}>
                Gerar conta a pagar
              </Botao>
            )}
            {pedido.situacao === 'comprado' && (pode('compras', 'editar') || pode('compras', 'aprovar')) && !recebendo && (
              <Botao onClick={() => setRecebendo(true)}>Registrar recebimento</Botao>
            )}
            {recebendo && <Botao carregando={receber.isPending} onClick={() => receber.mutate()}>Confirmar recebimento</Botao>}
            {passo && pode('compras', passo.acao) && !recebendo && (
              <Botao carregando={mudar.isPending} onClick={() => mudar.mutate({ situacao: passo.para })}>{passo.rotulo}</Botao>
            )}
          </>
        }
      >
        <div className="space-y-4 text-sm">
          {pedido.situacao === 'cancelado' ? (
            <Mensagem tipo="erro">Cancelado: {pedido.motivo_cancelamento}</Mensagem>
          ) : (
            <ol className="flex flex-wrap gap-1">
              {ETAPAS.map((e, i) => (
                <li key={e.valor} className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', i <= etapaAtual ? 'bg-acqua-titulo text-white' : 'bg-slate-100 text-slate-500')}>
                  {i + 1}. {e.rotulo}
                </li>
              ))}
            </ol>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-600">
            <span>Pedido por <b>{nome(pedido.criado_por)}</b> em {formatarDataHora(pedido.criado_em)}</span>
            {pedido.prioridade === 'urgente' && <Selo cor="vermelho">Urgente</Selo>}
            {pedido.necessario_em && <span>Precisa até {formatarData(pedido.necessario_em)}</span>}
            {fornecedor && <span>Fornecedor: {fornecedor.nome}</span>}
            {pedido.aprovado_por && <span>Aprovado por {nome(pedido.aprovado_por)}</span>}
          </div>
          <div className="overflow-x-auto rounded-xl border border-acqua-suave">
            <table className="w-full text-sm">
              <thead className="bg-acqua-gelo text-xs uppercase tracking-wider text-acqua-petroleo">
                <tr>
                  <th className="px-3 py-2 text-left">Produto</th>
                  <th className="px-3 py-2 text-right">Qtd</th>
                  <th className="px-3 py-2 text-right">Preço ref.</th>
                  {(recebendo || ['recebido', 'concluido'].includes(pedido.situacao)) && <th className="px-3 py-2 text-right">Recebido</th>}
                  {(recebendo || ['recebido', 'concluido'].includes(pedido.situacao)) && <th className="px-3 py-2 text-right">Preço pago</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-acqua-suave">
                {itens.map((i: ItemPedido) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2">{i.descricao}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{String(i.quantidade).replace('.', ',')} {i.unidade}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{i.preco_estimado != null ? formatarMoeda(i.preco_estimado) : '—'}</td>
                    {recebendo ? (
                      <>
                        <td className="px-3 py-1 text-right">
                          <input aria-label="Quantidade recebida" className="h-9 w-20 rounded border border-[#C4D3E8] px-2 text-right" value={reais[i.id]?.qtd ?? ''} onChange={(e) => setReais({ ...reais, [i.id]: { ...reais[i.id], qtd: e.target.value } })} />
                        </td>
                        <td className="px-3 py-1 text-right">
                          <input aria-label="Preço pago" className="h-9 w-24 rounded border border-[#C4D3E8] px-2 text-right" value={reais[i.id]?.preco ?? ''} onChange={(e) => setReais({ ...reais, [i.id]: { ...reais[i.id], preco: e.target.value } })} />
                        </td>
                      </>
                    ) : (
                      ['recebido', 'concluido'].includes(pedido.situacao) && (
                        <>
                          <td className={cx('px-3 py-2 text-right tabular-nums', Number(i.quantidade_recebida) < Number(i.quantidade) && 'font-semibold text-amber-700')}>
                            {String(i.quantidade_recebida ?? '—').replace('.', ',')}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{i.preco_real != null ? formatarMoeda(i.preco_real) : '—'}</td>
                        </>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-right">
            Estimado: <b>{formatarMoeda(total)}</b>
            {['recebido', 'concluido'].includes(pedido.situacao) && <> · Pago: <b>{formatarMoeda(totalReal)}</b></>}
          </p>
          {pedido.observacao && <p className="rounded-lg bg-acqua-gelo p-3">{pedido.observacao}</p>}
          {gerarConta.isSuccess && <Mensagem tipo="sucesso">Conta a pagar criada. Veja na aba Contas a pagar.</Mensagem>}
          {erro && <Mensagem tipo="erro">{mensagemErro(erro)}</Mensagem>}
        </div>
      </Janela>
      <JanelaCancelar
        aberta={cancelando}
        titulo={`Cancelar pedido #${pedido.numero}`}
        carregando={mudar.isPending}
        erro={mudar.error}
        aoFechar={() => setCancelando(false)}
        aoConfirmar={(motivo) => mudar.mutate({ situacao: 'cancelado', motivo_cancelamento: motivo })}
      />
    </>
  )
}
