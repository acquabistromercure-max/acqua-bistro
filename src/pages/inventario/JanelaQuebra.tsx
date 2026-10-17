import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatarMoeda, hojeISO, lerMoeda } from '../../lib/formatos'
import { RESPONSAVEIS, qtd } from '../../lib/inventario'
import { AreaTexto, Botao, Campo, Janela, Mensagem, Selecao, mensagemErro } from '../../components/ui'
import { usePessoasEscala } from '../escalas/dados'
import { CHAVES_INVENTARIO, useItens } from './dados'

const TIPOS = [
  { valor: 'quebra', rotulo: 'Quebra' },
  { valor: 'perda', rotulo: 'Perda / extravio' },
  { valor: 'furto', rotulo: 'Furto / sumiço' },
  { valor: 'descarte', rotulo: 'Descarte (gasto, sem uso)' },
]

/**
 * Quebra ou perda (gerente/admin): baixa o inventário na hora. Se foi um colaborador, vira ocorrência aprovada na ficha
 * dele (o desconto, se houver, é gerado depois na própria ocorrência).
 */
export default function JanelaQuebra({
  itemId,
  colaboradorId,
  aoFechar,
}: {
  itemId?: string
  colaboradorId?: string
  aoFechar: () => void
}) {
  const qc = useQueryClient()
  const itens = useItens()
  const pessoas = usePessoasEscala()
  const [item, setItem] = useState(itemId ?? '')
  const [tipo, setTipo] = useState('quebra')
  const [quantidade, setQuantidade] = useState('1')
  const [data, setData] = useState(hojeISO())
  const [responsavel, setResponsavel] = useState(colaboradorId ? 'colaborador' : 'nao_identificado')
  const [colaborador, setColaborador] = useState(colaboradorId ?? '')
  const [descricao, setDescricao] = useState('')
  const escolhido = itens.data?.find((i) => i.id === item)
  const q = lerMoeda(quantidade) ?? 0

  const salvar = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error('Escolha o item.')
      const { error } = await supabase.rpc('registrar_quebra', {
        p_item: item,
        p_quantidade: q,
        p_tipo: tipo,
        p_data: data,
        p_responsavel_tipo: responsavel,
        p_colaborador: responsavel === 'colaborador' ? colaborador || null : null,
        p_descricao: descricao.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      CHAVES_INVENTARIO.forEach((queryKey) => qc.invalidateQueries({ queryKey }))
      qc.invalidateQueries({ queryKey: ['ocorrencias'] })
      qc.invalidateQueries({ queryKey: ['linha-do-tempo'] })
      aoFechar()
    },
  })

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Registrar quebra ou perda"
      largura="max-w-xl"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-quebra" carregando={salvar.isPending}>Registrar</Botao>
        </>
      }
    >
      <form id="form-quebra" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar.mutate() }}>
        <Selecao
          rotulo="Item"
          className="sm:col-span-2"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          required
          vazio="Escolha o item…"
          opcoes={(itens.data ?? []).filter((i) => i.ativo).map((i) => ({ valor: i.id, rotulo: `${i.nome} — tem ${qtd(i.quantidade)} ${i.unidade}` }))}
        />
        <Selecao rotulo="O que aconteceu" value={tipo} onChange={(e) => setTipo(e.target.value)} opcoes={TIPOS} />
        <Campo
          rotulo={`Quantidade${escolhido ? ` (${escolhido.unidade})` : ''}`}
          inputMode="decimal"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          required
          ajuda={escolhido?.valor_unitario && q > 0 ? `Equivale a ${formatarMoeda(q * Number(escolhido.valor_unitario))}` : undefined}
        />
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        <Selecao rotulo="Quem foi" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} opcoes={RESPONSAVEIS} disabled={!!colaboradorId} />
        {responsavel === 'colaborador' && (
          <Selecao
            rotulo="Colaborador"
            className="sm:col-span-2"
            value={colaborador}
            onChange={(e) => setColaborador(e.target.value)}
            required
            disabled={!!colaboradorId}
            vazio="Escolha…"
            opcoes={(pessoas.data ?? []).filter((p) => p.situacao !== 'desligado').map((p) => ({ valor: p.id, rotulo: p.nome }))}
          />
        )}
        <AreaTexto
          rotulo="Descrição"
          className="sm:col-span-2"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          required
          placeholder="Ex.: bandeja caiu na hora do almoço; hóspede do apto 402 quebrou a taça"
        />
        <p className="text-xs text-slate-500 sm:col-span-2">
          A quantidade sai do inventário na hora e fica no histórico do item.
          {responsavel === 'colaborador' && ' Também vira uma ocorrência na ficha do colaborador; se for descontar, gere o desconto lá.'}
        </p>
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}
