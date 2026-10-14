import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarData, formatarMoeda, hojeISO, lerMoeda } from '../../lib/formatos'
import { useNomesUsuarios } from '../../lib/hooks'
import { Botao, Campo, Carregando, Janela, Mensagem, Selecao, Tabela, mensagemErro } from '../../components/ui'
import { BotaoExcluir, JanelaCancelar, SeloSituacao } from '../../components/registros'
import { TIPOS_LANCAMENTO, rotulo, type Colaborador } from './tipos'

export type Lancamento = {
  id: string
  colaborador_id: string
  tipo: string
  data: string
  valor: number
  descricao: string | null
  competencia: string | null
  situacao: 'pendente' | 'aprovado' | 'pago' | 'cancelado'
  aprovado_por: string | null
  motivo_cancelamento: string | null
  origem_tipo: string | null
  origem_id: string | null
  criado_por: string | null
}

/** Totais por situação (cancelados não entram). */
export function resumirLancamentos(lista: Pick<Lancamento, 'valor' | 'situacao' | 'tipo'>[]) {
  const soma = (f: (l: (typeof lista)[number]) => boolean) =>
    Math.round(lista.filter(f).reduce((s, l) => s + Number(l.valor), 0) * 100) / 100
  return {
    pendente: soma((l) => l.situacao === 'pendente'),
    aprovado: soma((l) => l.situacao === 'aprovado'),
    pago: soma((l) => l.situacao === 'pago'),
    valesAdiantamentos: soma((l) => l.situacao !== 'cancelado' && (l.tipo === 'vale' || l.tipo === 'adiantamento')),
  }
}

const ORIGENS: Record<string, string> = { retirada_caixa: 'Retirada do caixa', caixa_movimento: 'Retirada do caixa', diaria: 'Diária aprovada' }

export default function AbaFinanceiro({ colaborador }: { colaborador: Colaborador }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const [novo, setNovo] = useState(false)
  const [aberto, setAberto] = useState<Lancamento | null>(null)
  const [cancelando, setCancelando] = useState(false)

  const lista = useQuery({
    queryKey: ['lancamentos-colaborador', colaborador.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos_colaborador')
        .select('*')
        .eq('colaborador_id', colaborador.id)
        .order('data', { ascending: false })
      if (error) throw error
      return data as Lancamento[]
    },
  })

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['lancamentos-colaborador', colaborador.id] })
    qc.invalidateQueries({ queryKey: ['linha-do-tempo', colaborador.id] })
  }

  const mudar = useMutation({
    mutationFn: async (dados: Partial<Lancamento>) => {
      const { error } = await supabase.from('lancamentos_colaborador').update(dados).eq('id', aberto!.id)
      if (error) throw error
    },
    onSuccess: () => {
      setAberto(null)
      setCancelando(false)
      atualizar()
    },
  })

  const r = resumirLancamentos(lista.data ?? [])

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Pendente', r.pendente],
          ['Aprovado (a pagar)', r.aprovado],
          ['Pago', r.pago],
          ['Vales e adiantamentos', r.valesAdiantamentos],
        ].map(([t, v]) => (
          <div key={t as string} className="rounded-xl border border-acqua-suave bg-white p-3">
            <p className="text-xs text-slate-500">{t}</p>
            <p className="text-lg font-semibold text-acqua-titulo">{formatarMoeda(v as number)}</p>
          </div>
        ))}
      </div>
      <div className="mb-3 flex justify-end">
        {pode('financeiro', 'criar') && <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setNovo(true)}>Novo lançamento</Botao>}
      </div>
      {lista.isLoading ? (
        <Carregando />
      ) : (
        <Tabela
          linhas={lista.data ?? []}
          chave={(l) => l.id}
          aoClicar={setAberto}
          vazio="Nenhum lançamento financeiro."
          colunas={[
            { titulo: 'Data', celula: (l) => formatarData(l.data) },
            { titulo: 'Tipo', celula: (l) => rotulo(TIPOS_LANCAMENTO, l.tipo) },
            { titulo: 'Valor', celula: (l) => formatarMoeda(l.valor), className: 'text-right' },
            { titulo: 'Descrição', celula: (l) => l.descricao || (l.origem_tipo ? ORIGENS[l.origem_tipo] ?? l.origem_tipo : '—') },
            { titulo: 'Situação', celula: (l) => <SeloSituacao situacao={l.situacao} /> },
          ]}
        />
      )}
      {novo && <NovoLancamento colaborador={colaborador} aoFechar={() => setNovo(false)} aoSalvar={() => { setNovo(false); atualizar() }} />}
      {aberto && !cancelando && (
        <Janela
          aberta
          aoFechar={() => setAberto(null)}
          titulo={`${rotulo(TIPOS_LANCAMENTO, aberto.tipo)} — ${formatarMoeda(aberto.valor)}`}
          rodape={
            <>
              <BotaoExcluir
                modulo="financeiro"
                tabela="lancamentos_colaborador"
                id={aberto.id}
                descricao={`o lançamento de ${formatarMoeda(aberto.valor)}`}
                aoExcluir={() => {
                  setAberto(null)
                  atualizar()
                }}
              />
              {aberto.situacao !== 'cancelado' && (
              <>
                {pode('financeiro', 'cancelar') && (
                  <Botao variante="perigo" onClick={() => setCancelando(true)}>Cancelar</Botao>
                )}
                {aberto.situacao === 'pendente' && pode('financeiro', 'aprovar') && (
                  <Botao carregando={mudar.isPending} onClick={() => mudar.mutate({ situacao: 'aprovado' })}>Aprovar</Botao>
                )}
                {aberto.situacao === 'aprovado' && pode('financeiro', 'editar') && (
                  <Botao carregando={mudar.isPending} onClick={() => mudar.mutate({ situacao: 'pago' })}>Marcar como pago</Botao>
                )}
              </>
              )}
            </>
          }
        >
          <div className="space-y-1 text-sm">
            <p>Data: {formatarData(aberto.data)}{aberto.competencia && ` · competência ${aberto.competencia}`}</p>
            {aberto.descricao && <p>{aberto.descricao}</p>}
            {aberto.origem_tipo && <p className="text-slate-500">Origem: {ORIGENS[aberto.origem_tipo] ?? aberto.origem_tipo}</p>}
            <p className="text-slate-500">Lançado por {nome(aberto.criado_por)}</p>
            {aberto.aprovado_por && <p className="text-slate-500">Aprovado por {nome(aberto.aprovado_por)}</p>}
            {aberto.motivo_cancelamento && <p className="text-slate-500">Cancelado: {aberto.motivo_cancelamento}</p>}
            {mudar.error && <Mensagem tipo="erro">{mensagemErro(mudar.error)}</Mensagem>}
          </div>
        </Janela>
      )}
      <JanelaCancelar
        aberta={cancelando}
        titulo="Cancelar lançamento"
        carregando={mudar.isPending}
        erro={mudar.error}
        aoFechar={() => setCancelando(false)}
        aoConfirmar={(motivo) => mudar.mutate({ situacao: 'cancelado', motivo_cancelamento: motivo })}
      />
    </>
  )
}

function NovoLancamento({ colaborador, aoFechar, aoSalvar }: { colaborador: Colaborador; aoFechar: () => void; aoSalvar: () => void }) {
  const [tipo, setTipo] = useState('adiantamento')
  const [data, setData] = useState(hojeISO())
  const [valor, setValor] = useState('')
  const [competencia, setCompetencia] = useState(hojeISO().slice(0, 7))
  const [descricao, setDescricao] = useState('')
  const salvar = useMutation({
    mutationFn: async () => {
      const v = lerMoeda(valor)
      if (!v || v <= 0) throw new Error('Informe um valor maior que zero.')
      const { error } = await supabase.from('lancamentos_colaborador').insert({
        colaborador_id: colaborador.id,
        tipo,
        data,
        valor: v,
        competencia: competencia || null,
        descricao: descricao.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: aoSalvar,
  })
  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={`Novo lançamento — ${colaborador.nome}`}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-lancamento" carregando={salvar.isPending}>Lançar</Botao>
        </>
      }
    >
      <form
        id="form-lancamento"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          salvar.mutate()
        }}
      >
        <Selecao rotulo="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} opcoes={TIPOS_LANCAMENTO} />
        <Campo rotulo="Valor (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required />
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        <Campo rotulo="Competência (mês)" type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
        <Campo rotulo="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="sm:col-span-2" />
        <p className="text-xs text-slate-500 sm:col-span-2">
          Vales tirados do caixa são lançados pela tela do Caixa, para não contar duas vezes.
        </p>
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}
