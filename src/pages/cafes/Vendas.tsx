import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, Coffee } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarMoeda, lerMoeda } from '../../lib/formatos'
import { BANDEIRAS, FORMAS } from '../../lib/cafe'
import { Botao, Campo, Cartao, Janela, Mensagem, Selecao, Tabela, Vazio, cx, mensagemErro } from '../../components/ui'
import { BotaoExcluir, JanelaCancelar, SeloSituacao } from '../../components/registros'
import { ROTULO_FORMA, descreverPagamento, useMensalistas, type Venda } from './dados'

type Forma = (typeof FORMAS)[number]['valor']
type Bandeira = (typeof BANDEIRAS)[number]['valor']

/** Cafés pagos direto ao restaurante (extras, passantes) ou anotados para mensalistas. */
export default function Vendas({ data, lista, precos, focar }: { data: string; lista: Venda[]; precos: number[]; focar?: boolean }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const [aberta, setAberta] = useState<Venda | null>(null)
  const [cancelando, setCancelando] = useState<Venda | null>(null)
  const atualizar = () => qc.invalidateQueries({ queryKey: ['cafe_vendas'] })

  const mudar = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<Venda> }) => {
      const { error } = await supabase.from('cafe_vendas').update(dados).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setCancelando(null)
      setAberta(null)
      atualizar()
    },
  })

  const validas = lista.filter((v) => v.situacao !== 'cancelado')
  const recebidas = validas.filter((v) => v.pago)
  const porForma = recebidas.reduce<Record<string, number>>((m, v) => ({ ...m, [v.forma ?? 'outro']: (m[v.forma ?? 'outro'] ?? 0) + Number(v.valor_total) }), {})
  const total = recebidas.reduce((s, v) => s + Number(v.valor_total), 0)
  const aReceber = validas.filter((v) => !v.pago).reduce((s, v) => s + Number(v.valor_total), 0)

  return (
    <Cartao titulo={<span className="flex items-center gap-2"><Coffee className="h-5 w-5 text-acqua-dourado" /> Cafés pagos na hora</span>}>
      {pode('cafes', 'criar') && <NovaVenda data={data} precos={precos} focar={focar} aoSalvar={atualizar} />}

      <div className="mt-4">
        {lista.length === 0 ? (
          <Vazio>Nenhuma venda de café neste dia.</Vazio>
        ) : (
          <Tabela
            linhas={lista}
            chave={(v) => v.id}
            aoClicar={setAberta}
            colunas={[
              { titulo: 'Cliente', celula: (v) => <b>{v.cliente}</b> },
              { titulo: 'Qtd', celula: (v) => v.quantidade },
              { titulo: 'Valor', celula: (v) => <span className="font-semibold tabular-nums">{formatarMoeda(v.valor_total)}</span> },
              { titulo: 'Pagamento', celula: (v) => (v.situacao === 'cancelado' ? <SeloSituacao situacao="cancelado" /> : descreverPagamento(v)) },
              {
                titulo: 'Conferido',
                celula: (v) =>
                  v.situacao === 'cancelado' ? null : (
                    <button
                      type="button"
                      disabled={!pode('cafes', 'editar') || mudar.isPending}
                      onClick={(e) => {
                        e.stopPropagation()
                        mudar.mutate({ id: v.id, dados: { conferido: !v.conferido } })
                      }}
                      title={v.conferido ? `Conferido por ${nome(v.conferido_por)}` : 'Marcar como conferido'}
                      className="inline-flex items-center gap-1 rounded p-1 text-sm disabled:cursor-default"
                    >
                      {v.conferido ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-slate-300" />}
                    </button>
                  ),
              },
            ]}
          />
        )}
      </div>

      {validas.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm text-slate-600">
          {Object.entries(porForma).map(([f, v]) => (
            <span key={f}>{ROTULO_FORMA[f]}: <b className="tabular-nums">{formatarMoeda(v)}</b></span>
          ))}
          {aReceber > 0 && <span className="text-amber-800">A receber: <b>{formatarMoeda(aReceber)}</b></span>}
          <span className="text-acqua-titulo">Recebido: <b>{formatarMoeda(total)}</b></span>
        </div>
      )}
      {mudar.error && !cancelando && <div className="mt-3"><Mensagem tipo="erro">{mensagemErro(mudar.error)}</Mensagem></div>}

      {aberta && !cancelando && (
        <Janela
          aberta
          aoFechar={() => setAberta(null)}
          titulo={`Venda · ${aberta.cliente}`}
          rodape={
            <>
              <BotaoExcluir
                modulo="cafes"
                tabela="cafe_vendas"
                id={aberta.id}
                descricao={`a venda de ${formatarMoeda(aberta.valor_total)} (${aberta.cliente})`}
                aoExcluir={() => {
                  setAberta(null)
                  atualizar()
                }}
              />
              {aberta.situacao !== 'cancelado' && pode('cafes', 'cancelar') && (
                <Botao variante="perigo" onClick={() => setCancelando(aberta)}>Cancelar</Botao>
              )}
              <Botao variante="secundario" onClick={() => setAberta(null)}>Fechar</Botao>
            </>
          }
        >
          <div className="space-y-1 text-sm">
            <p>
              {aberta.quantidade} café(s) · <b>{formatarMoeda(aberta.valor_total)}</b> · {descreverPagamento(aberta)}
            </p>
            <p className="text-xs text-slate-500">Lançado por {nome(aberta.criado_por)}</p>
            {aberta.conferido && <p className="text-xs text-slate-500">Conferido por {nome(aberta.conferido_por)}</p>}
            {aberta.motivo_cancelamento && <p className="text-slate-500">Cancelado: {aberta.motivo_cancelamento}</p>}
          </div>
        </Janela>
      )}
      <JanelaCancelar
        aberta={!!cancelando}
        titulo={`Cancelar venda · ${cancelando?.cliente ?? ''}`}
        carregando={mudar.isPending}
        erro={mudar.error}
        aoFechar={() => setCancelando(null)}
        aoConfirmar={(motivo) => cancelando && mudar.mutate({ id: cancelando.id, dados: { situacao: 'cancelado', motivo_cancelamento: motivo } })}
      />
    </Cartao>
  )
}

function Chip({ ativo, children, onClick }: { ativo: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cx(
        'min-h-10 rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
        ativo ? 'border-acqua-petroleo bg-acqua-titulo text-white' : 'border-[#C4D3E8] bg-white text-acqua-titulo hover:bg-acqua-suave',
      )}
    >
      {children}
    </button>
  )
}

/** Lançamento rápido: cliente, quantidade, valor (atalhos de preço), forma e bandeira — sem somas à mão. */
function NovaVenda({ data, precos, focar, aoSalvar }: { data: string; precos: number[]; focar?: boolean; aoSalvar: () => void }) {
  const mensalistas = useMensalistas()
  const [cliente, setCliente] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [valorUnit, setValorUnit] = useState('')
  const [forma, setForma] = useState<Forma | 'mensalista' | ''>('')
  const [bandeira, setBandeira] = useState<Bandeira | ''>('')
  const [mensalistaId, setMensalistaId] = useState('')

  const qtd = Math.max(1, Number(quantidade) || 1)
  const unit = lerMoeda(valorUnit)
  const total = unit === null ? null : Math.round(unit * qtd * 100) / 100
  const ehCartao = forma === 'credito' || forma === 'debito'

  const salvar = useMutation({
    mutationFn: async () => {
      if (total === null) throw new Error('Informe o valor do café.')
      if (!forma) throw new Error('Escolha a forma de pagamento.')
      if (ehCartao && !bandeira) throw new Error('Escolha a bandeira do cartão.')
      const mensalista = mensalistas.data?.find((m) => m.id === mensalistaId)
      if (forma === 'mensalista' && !mensalista) throw new Error('Escolha o mensalista.')
      const { error } = await supabase.from('cafe_vendas').insert({
        data,
        cliente: forma === 'mensalista' ? mensalista!.apartamento || mensalista!.nome : cliente.trim(),
        mensalista_id: forma === 'mensalista' ? mensalista!.id : null,
        quantidade: qtd,
        valor_total: total,
        pago: forma !== 'mensalista',
        forma: forma === 'mensalista' ? null : forma,
        bandeira: ehCartao ? bandeira : null,
        recebido_em: forma === 'mensalista' ? null : data,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setCliente('')
      setQuantidade('1')
      setForma('')
      setBandeira('')
      setMensalistaId('')
      aoSalvar()
    },
  })

  const ativos = (mensalistas.data ?? []).filter((m) => m.ativo)

  return (
    <form
      className="space-y-3 rounded-xl border border-acqua-suave bg-acqua-gelo p-3"
      onSubmit={(e) => {
        e.preventDefault()
        salvar.mutate()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr,90px,140px]">
        {forma === 'mensalista' ? (
          <Selecao
            rotulo="Mensalista"
            value={mensalistaId}
            onChange={(e) => setMensalistaId(e.target.value)}
            vazio={ativos.length ? 'Escolha…' : 'Cadastre na aba Mensalistas'}
            opcoes={ativos.map((m) => ({ valor: m.id, rotulo: `${m.nome}${m.apartamento ? ` · apto ${m.apartamento}` : ''}` }))}
          />
        ) : (
          <div>
            <Campo rotulo="Apartamento ou cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} required autoFocus={focar} placeholder="Ex.: 1905" />
            <button type="button" className="link mt-1 text-xs" onClick={() => setCliente('Passante')}>É passante</button>
          </div>
        )}
        <Campo rotulo="Qtd" type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        <Campo rotulo="Valor de cada (R$)" inputMode="decimal" value={valorUnit} onChange={(e) => setValorUnit(e.target.value)} required />
      </div>
      {precos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {precos.map((p) => (
            <Chip key={p} ativo={unit === p} onClick={() => setValorUnit(String(p).replace('.', ','))}>{formatarMoeda(p)}</Chip>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {FORMAS.map((f) => (
          <Chip key={f.valor} ativo={forma === f.valor} onClick={() => setForma(f.valor)}>{f.rotulo}</Chip>
        ))}
        <Chip ativo={forma === 'mensalista'} onClick={() => setForma('mensalista')}>Mensalista (a receber)</Chip>
      </div>
      {ehCartao && (
        <div className="flex flex-wrap gap-1.5">
          {BANDEIRAS.map((b) => (
            <Chip key={b.valor} ativo={bandeira === b.valor} onClick={() => setBandeira(b.valor)}>{b.rotulo}</Chip>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-acqua-titulo">Total: <b className="tabular-nums">{total === null ? '—' : formatarMoeda(total)}</b></p>
        <Botao type="submit" carregando={salvar.isPending}>Lançar venda</Botao>
      </div>
      {salvar.error && <Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem>}
    </form>
  )
}
