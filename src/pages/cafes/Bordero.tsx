import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BedDouble, Check, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarDataHora, formatarMoeda, lerMoeda } from '../../lib/formatos'
import { Botao, Campo, Cartao, Janela, Mensagem, Selo, Tabela, Vazio, cx, mensagemErro } from '../../components/ui'
import { JanelaCancelar, SeloSituacao } from '../../components/registros'
import type { ConsumoQuarto, ItemBordero } from './dados'

/** Borderô: consumo lançado na conta do quarto e entregue à recepção. */
export default function Bordero({ data, lista, itens, travado }: { data: string; lista: ConsumoQuarto[]; itens: ItemBordero[]; travado: boolean }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const [novo, setNovo] = useState(false)
  const [aberto, setAberto] = useState<ConsumoQuarto | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [entregueA, setEntregueA] = useState('')
  const atualizar = () => qc.invalidateQueries({ queryKey: ['consumos_quarto'] })

  const mudar = useMutation({
    mutationFn: async (dados: Partial<ConsumoQuarto>) => {
      const { error } = await supabase.from('consumos_quarto').update(dados).eq('id', aberto!.id)
      if (error) throw error
    },
    onSuccess: () => {
      setAberto(null)
      setCancelando(false)
      atualizar()
    },
  })

  const validos = lista.filter((c) => c.situacao !== 'cancelado')
  const total = validos.reduce((s, c) => s + Number(c.total), 0)
  const pendentes = validos.filter((c) => !c.entregue_recepcao).length

  return (
    <Cartao
      titulo={<span className="flex items-center gap-2"><BedDouble className="h-5 w-5 text-acqua-dourado" /> Borderô (conta do quarto)</span>}
      acoes={
        !travado && pode('cafes', 'criar') && (
          <Botao variante="secundario" icone={<Plus className="h-4 w-4" />} onClick={() => setNovo(true)}>Consumo</Botao>
        )
      }
    >
      {lista.length === 0 ? (
        <Vazio>Nada lançado na conta dos quartos neste dia.</Vazio>
      ) : (
        <>
          <Tabela
            linhas={lista}
            chave={(c) => c.id}
            aoClicar={(c) => {
              setAberto(c)
              setEntregueA(c.entregue_a ?? '')
            }}
            colunas={[
              { titulo: 'Apto', celula: (c) => <b>{c.apartamento}</b> },
              { titulo: 'Consumo', celula: (c) => `${c.quantidade > 1 ? `${c.quantidade}× ` : ''}${c.item}` },
              { titulo: 'Valor', celula: (c) => <span className="font-semibold tabular-nums">{formatarMoeda(c.total)}</span> },
              {
                titulo: 'Recepção',
                celula: (c) =>
                  c.situacao === 'cancelado' ? (
                    <SeloSituacao situacao="cancelado" />
                  ) : c.entregue_recepcao ? (
                    <Selo cor="verde">Entregue{c.entregue_a ? ` · ${c.entregue_a}` : ''}</Selo>
                  ) : (
                    <Selo cor="amarelo">A entregar</Selo>
                  ),
              },
            ]}
          />
          <p className="mt-2 text-right text-sm text-slate-600">
            Total: <b>{formatarMoeda(total)}</b>
            {pendentes > 0 && <> · <span className="text-amber-800">{pendentes} a entregar na recepção</span></>}
          </p>
        </>
      )}

      {novo && <NovoConsumo data={data} itens={itens} aoFechar={() => setNovo(false)} aoSalvar={() => { setNovo(false); atualizar() }} />}

      {aberto && !cancelando && (
        <Janela
          aberta
          aoFechar={() => setAberto(null)}
          titulo={`Apto ${aberto.apartamento} · ${aberto.item}`}
          rodape={
            aberto.situacao !== 'cancelado' && !travado && (
              <>
                {pode('cafes', 'cancelar') && (
                  <Botao variante="perigo" className="mr-auto" onClick={() => setCancelando(true)}>Cancelar / estornar</Botao>
                )}
                {aberto.entregue_recepcao ? (
                  <Botao variante="secundario" carregando={mudar.isPending} onClick={() => mudar.mutate({ entregue_recepcao: false })}>
                    Desfazer entrega
                  </Botao>
                ) : (
                  <Botao icone={<Check className="h-4 w-4" />} carregando={mudar.isPending} onClick={() => mudar.mutate({ entregue_recepcao: true, entregue_a: entregueA.trim() || null })}>
                    Entregue na recepção
                  </Botao>
                )}
              </>
            )
          }
        >
          <div className="space-y-3 text-sm">
            <p>
              {aberto.quantidade} × {formatarMoeda(aberto.valor_unitario)} = <b>{formatarMoeda(aberto.total)}</b>
            </p>
            {aberto.observacao && <p>{aberto.observacao}</p>}
            <p className="text-xs text-slate-500">Lançado por {nome(aberto.criado_por)}</p>
            {aberto.entregue_recepcao ? (
              <p className="text-xs text-slate-500">Entregue {aberto.entregue_a ? `a ${aberto.entregue_a} ` : ''}em {formatarDataHora(aberto.entregue_em)}</p>
            ) : (
              aberto.situacao !== 'cancelado' && !travado && (
                <Campo rotulo="Entregue a (recepção)" value={entregueA} onChange={(e) => setEntregueA(e.target.value)} placeholder="Nome de quem recebeu" />
              )
            )}
            {aberto.motivo_cancelamento && <p className="text-slate-500">Cancelado: {aberto.motivo_cancelamento}</p>}
            {mudar.error && <Mensagem tipo="erro">{mensagemErro(mudar.error)}</Mensagem>}
          </div>
        </Janela>
      )}
      <JanelaCancelar
        aberta={cancelando}
        titulo="Cancelar / estornar consumo"
        carregando={mudar.isPending}
        erro={mudar.error}
        aoFechar={() => setCancelando(false)}
        aoConfirmar={(motivo) => mudar.mutate({ situacao: 'cancelado', motivo_cancelamento: motivo })}
      />
    </Cartao>
  )
}

function NovoConsumo({ data, itens, aoFechar, aoSalvar }: { data: string; itens: ItemBordero[]; aoFechar: () => void; aoSalvar: () => void }) {
  const [apartamento, setApartamento] = useState('')
  const [item, setItem] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [valor, setValor] = useState('')
  const [observacao, setObservacao] = useState('')

  const salvar = useMutation({
    mutationFn: async () => {
      const v = lerMoeda(valor)
      if (v === null) throw new Error('Informe o valor unitário.')
      const { error } = await supabase.from('consumos_quarto').insert({
        data,
        apartamento: apartamento.trim(),
        item: item.trim(),
        quantidade: Math.max(1, Number(quantidade) || 1),
        valor_unitario: v,
        observacao: observacao.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: aoSalvar,
  })

  const total = (lerMoeda(valor) ?? 0) * (Number(quantidade) || 0)

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Consumo na conta do quarto"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-bordero" carregando={salvar.isPending}>Salvar</Botao>
        </>
      }
    >
      <form
        id="form-bordero"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          salvar.mutate()
        }}
      >
        <Campo rotulo="Apartamento" value={apartamento} onChange={(e) => setApartamento(e.target.value)} required autoFocus />
        <Campo rotulo="Quantidade" type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} required />
        {itens.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-semibold text-acqua-titulo">Itens frequentes</p>
            <div className="flex flex-wrap gap-1.5">
              {itens.map((i) => (
                <button
                  key={i.nome}
                  type="button"
                  onClick={() => {
                    setItem(i.nome)
                    setValor(String(i.valor).replace('.', ','))
                  }}
                  className={cx(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-semibold',
                    item === i.nome ? 'border-acqua-petroleo bg-acqua-titulo text-white' : 'border-[#C4D3E8] bg-white text-acqua-titulo hover:bg-acqua-suave',
                  )}
                >
                  {i.nome} · {formatarMoeda(i.valor)}
                </button>
              ))}
            </div>
          </div>
        )}
        <Campo rotulo="Consumo" value={item} onChange={(e) => setItem(e.target.value)} required placeholder="Ex.: Almoço" />
        <Campo rotulo="Valor unitário (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required />
        <Campo rotulo="Observação" className="sm:col-span-2" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        <p className="text-sm text-acqua-titulo sm:col-span-2">Total: <b>{formatarMoeda(total)}</b></p>
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}
