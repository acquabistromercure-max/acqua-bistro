import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarData, formatarMoeda } from '../../lib/formatos'
import { CATEGORIAS_ENTRADA, CATEGORIAS_PESSOAIS, CATEGORIAS_SAIDA, avaliarSoma, rotuloCategoria, type Categoria } from '../../lib/caixa'
import { Botao, Campo, Janela, Mensagem, Selecao, Tabela, Vazio, cx, mensagemErro } from '../../components/ui'
import { BotaoExcluir, JanelaCancelar, SeloSituacao } from '../../components/registros'
import { usePessoasEscala } from '../escalas/dados'
import type { Movimento } from './dados'

function Chip({ ativo, children, onClick }: { ativo: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cx(
        'min-h-9 rounded-lg border px-2.5 py-1 text-xs font-semibold transition sm:text-sm',
        ativo ? 'border-acqua-petroleo bg-acqua-titulo text-white' : 'border-[#C4D3E8] bg-white text-acqua-titulo hover:bg-acqua-suave',
      )}
    >
      {children}
    </button>
  )
}

/** Lista de entradas e saídas (caixa ou fundo) com detalhes, cancelamento e exclusão. */
export function ListaMovimentos({ lista, mostrarData, vazio }: { lista: Movimento[]; mostrarData?: boolean; vazio: string }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const pessoas = usePessoasEscala()
  const [aberto, setAberto] = useState<Movimento | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const nomePessoa = (id: string | null) => (id ? pessoas.data?.find((p) => p.id === id)?.nome ?? '…' : '')
  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['caixa_movimentos'] })
    qc.invalidateQueries({ queryKey: ['lancamentos-colaborador'] })
  }

  const cancelar = useMutation({
    mutationFn: async (motivo: string) => {
      const { error } = await supabase.from('caixa_movimentos').update({ situacao: 'cancelado', motivo_cancelamento: motivo }).eq('id', aberto!.id)
      if (error) throw error
    },
    onSuccess: () => {
      setAberto(null)
      setCancelando(false)
      atualizar()
    },
  })

  if (lista.length === 0) return <Vazio>{vazio}</Vazio>
  return (
    <>
      <Tabela
        linhas={lista}
        chave={(m) => m.id}
        aoClicar={setAberto}
        colunas={[
          ...(mostrarData ? [{ titulo: 'Data', celula: (m: Movimento) => formatarData(m.data) }] : []),
          {
            titulo: 'Tipo',
            celula: (m) => (
              <span className="flex items-center gap-1.5">
                {m.sentido === 'entrada' ? <ArrowDownCircle className="h-4 w-4 text-emerald-600" /> : <ArrowUpCircle className="h-4 w-4 text-red-600" />}
                {rotuloCategoria(m.categoria)}
              </span>
            ),
          },
          { titulo: 'Motivo', celula: (m) => [m.motivo, nomePessoa(m.colaborador_id), m.fornecedor].filter(Boolean).join(' · ') },
          { titulo: 'Responsável', celula: (m) => m.responsavel },
          {
            titulo: 'Valor',
            celula: (m) =>
              m.situacao === 'cancelado' ? (
                <SeloSituacao situacao="cancelado" />
              ) : (
                <span className={cx('font-semibold tabular-nums', m.sentido === 'saida' ? 'text-red-700' : 'text-emerald-700')}>
                  {m.sentido === 'saida' ? '−' : '+'} {formatarMoeda(m.valor)}
                </span>
              ),
          },
        ]}
      />
      {aberto && !cancelando && (
        <Janela
          aberta
          aoFechar={() => setAberto(null)}
          titulo={`${rotuloCategoria(aberto.categoria)} · ${formatarMoeda(aberto.valor)}`}
          rodape={
            <>
              <BotaoExcluir
                modulo="caixa"
                tabela="caixa_movimentos"
                id={aberto.id}
                descricao={`${rotuloCategoria(aberto.categoria).toLowerCase()} de ${formatarMoeda(aberto.valor)}`}
                aoExcluir={() => {
                  setAberto(null)
                  atualizar()
                }}
              />
              {aberto.situacao !== 'cancelado' && pode('caixa', 'cancelar') && (
                <Botao variante="perigo" onClick={() => setCancelando(true)}>Cancelar</Botao>
              )}
              <Botao variante="secundario" onClick={() => setAberto(null)}>Fechar</Botao>
            </>
          }
        >
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">Data</dt><dd>{formatarData(aberto.data)} · {aberto.conta === 'fundo' ? 'Fundo de despesas' : 'Caixa'}</dd>
            <dt className="text-slate-500">Motivo</dt><dd>{aberto.motivo}</dd>
            <dt className="text-slate-500">Responsável</dt><dd>{aberto.responsavel}</dd>
            {aberto.colaborador_id && (<><dt className="text-slate-500">Colaborador</dt><dd>{nomePessoa(aberto.colaborador_id)} (entra na ficha dele)</dd></>)}
            {aberto.fornecedor && (<><dt className="text-slate-500">Fornecedor</dt><dd>{aberto.fornecedor}</dd></>)}
            {aberto.autorizado_por && (<><dt className="text-slate-500">Autorizado por</dt><dd>{aberto.autorizado_por}</dd></>)}
            {aberto.observacao && (<><dt className="text-slate-500">Observação</dt><dd>{aberto.observacao}</dd></>)}
            <dt className="text-slate-500">Lançado por</dt><dd>{nome(aberto.criado_por)}</dd>
            {aberto.motivo_cancelamento && (<><dt className="text-slate-500">Cancelado</dt><dd>{aberto.motivo_cancelamento}</dd></>)}
          </dl>
        </Janela>
      )}
      <JanelaCancelar
        aberta={cancelando}
        titulo="Cancelar movimento"
        aviso="Se era um vale/adiantamento/passagem de colaborador, o lançamento na ficha dele também é cancelado."
        carregando={cancelar.isPending}
        erro={cancelar.error}
        aoFechar={() => setCancelando(false)}
        aoConfirmar={(m) => cancelar.mutate(m)}
      />
    </>
  )
}

/** Lançar entrada ou saída de dinheiro. Saída para colaborador já vai para a ficha dele. */
export function NovoMovimento({
  data,
  conta,
  inicial,
  aoFechar,
  aoSalvar,
}: {
  data: string
  conta: 'caixa' | 'fundo'
  inicial?: { sentido: 'entrada' | 'saida'; categoria?: Categoria }
  aoFechar: () => void
  aoSalvar: () => void
}) {
  const { perfil } = usePermissoes()
  const pessoas = usePessoasEscala()
  const fornecedores = useQuery({
    queryKey: ['caixa-fornecedores-usados'],
    queryFn: async () => {
      const { data: linhas } = await supabase.from('caixa_movimentos').select('fornecedor').not('fornecedor', 'is', null).limit(300)
      return [...new Set((linhas ?? []).map((l) => l.fornecedor as string))].sort()
    },
    staleTime: 5 * 60_000,
  })
  const [sentido, setSentido] = useState<'entrada' | 'saida'>(inicial?.sentido ?? 'saida')
  const [categoria, setCategoria] = useState<Categoria | ''>(inicial?.categoria ?? '')
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [responsavel, setResponsavel] = useState(perfil?.nome ?? '')
  const [colaboradorId, setColaboradorId] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [autorizado, setAutorizado] = useState('')
  const [dia, setDia] = useState(data)
  useEffect(() => setDia(data), [data])

  const pessoal = CATEGORIAS_PESSOAIS.includes(categoria as Categoria)
  const categorias = sentido === 'saida' ? CATEGORIAS_SAIDA : CATEGORIAS_ENTRADA
  const v = avaliarSoma(valor)

  const salvar = useMutation({
    mutationFn: async () => {
      if (!categoria) throw new Error('Escolha o tipo.')
      if (!v || v <= 0) throw new Error('Informe um valor maior que zero.')
      if (pessoal && !colaboradorId) throw new Error('Escolha o colaborador.')
      const pessoa = pessoas.data?.find((p) => p.id === colaboradorId)
      const { error } = await supabase.from('caixa_movimentos').insert({
        data: dia,
        conta,
        sentido,
        categoria,
        valor: v,
        motivo: motivo.trim() || `${categorias.find((c) => c.valor === categoria)?.rotulo}${pessoa ? ` — ${pessoa.nome}` : ''}`,
        responsavel: responsavel.trim(),
        colaborador_id: pessoal ? colaboradorId : null,
        fornecedor: fornecedor.trim() || null,
        autorizado_por: autorizado.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: aoSalvar,
  })

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={conta === 'fundo' ? 'Fundo de despesas' : sentido === 'saida' ? 'Saída do caixa' : 'Entrada no caixa'}
      largura="max-w-2xl"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-movimento" carregando={salvar.isPending}>Lançar</Botao>
        </>
      }
    >
      <form
        id="form-movimento"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          salvar.mutate()
        }}
      >
        <div className="flex gap-1.5 sm:col-span-2">
          <Chip ativo={sentido === 'saida'} onClick={() => { setSentido('saida'); setCategoria('') }}>Saída / retirada</Chip>
          <Chip ativo={sentido === 'entrada'} onClick={() => { setSentido('entrada'); setCategoria('') }}>Entrada</Chip>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm font-semibold text-acqua-titulo">Tipo</p>
          <div className="flex flex-wrap gap-1.5">
            {categorias.map((c) => (
              <Chip key={c.valor} ativo={categoria === c.valor} onClick={() => setCategoria(c.valor)}>{c.rotulo}</Chip>
            ))}
          </div>
        </div>
        {pessoal && (
          <Selecao
            rotulo="Colaborador"
            className="sm:col-span-2"
            value={colaboradorId}
            onChange={(e) => setColaboradorId(e.target.value)}
            vazio="Escolha…"
            opcoes={(pessoas.data ?? []).filter((p) => p.situacao !== 'desligado').map((p) => ({ valor: p.id, rotulo: `${p.nome}${p.funcao ? ` · ${p.funcao}` : ''}` }))}
            ajuda="O valor entra no financeiro do colaborador (desconto do mês), uma vez só."
          />
        )}
        <Campo
          rotulo="Valor (R$)"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required
          autoFocus
          erro={v === null ? 'Valor inválido' : undefined}
          ajuda={v && valor.match(/[+-]/) ? `= ${formatarMoeda(v)}` : 'Pode somar: 50+21,60'}
        />
        <Campo rotulo="Data" type="date" value={dia} onChange={(e) => setDia(e.target.value)} required />
        <Campo rotulo="Motivo" className="sm:col-span-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: passagens da semana, gás 13kg, troco" />
        <Campo rotulo={sentido === 'saida' ? 'Quem retirou' : 'Quem entregou'} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} required />
        <Campo rotulo="Autorizado por" value={autorizado} onChange={(e) => setAutorizado(e.target.value)} placeholder="Opcional" />
        {!pessoal && sentido === 'saida' && (
          <div className="sm:col-span-2">
            <Campo rotulo="Fornecedor / destino" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} list="fornecedores-caixa" placeholder="Opcional" />
            <datalist id="fornecedores-caixa">
              {(fornecedores.data ?? []).map((f) => <option key={f} value={f} />)}
            </datalist>
          </div>
        )}
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}
