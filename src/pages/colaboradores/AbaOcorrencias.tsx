import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarData, formatarMoeda, hojeISO } from '../../lib/formatos'
import { useNomesUsuarios } from '../../lib/hooks'
import { AreaTexto, Botao, Campo, Carregando, Janela, Mensagem, Selecao, Tabela, mensagemErro } from '../../components/ui'
import { BotaoExcluir, JanelaCancelar, SeloSituacao } from '../../components/registros'
import { TIPOS_OCORRENCIA, rotulo, type Colaborador } from './tipos'

export type Ocorrencia = {
  id: string
  colaborador_id: string
  tipo: string
  data: string
  descricao: string
  minutos: number | null
  dias: number | null
  situacao: 'registrada' | 'aprovada' | 'cancelada'
  aprovado_por: string | null
  motivo_cancelamento: string | null
  criado_por: string | null
  criado_em: string
}

export default function AbaOcorrencias({ colaborador }: { colaborador: Colaborador }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const [nova, setNova] = useState(false)
  const [aberta, setAberta] = useState<Ocorrencia | null>(null)
  const [cancelando, setCancelando] = useState(false)

  const lista = useQuery({
    queryKey: ['ocorrencias', colaborador.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('ocorrencias').select('*').eq('colaborador_id', colaborador.id).order('data', { ascending: false })
      if (error) throw error
      return data as Ocorrencia[]
    },
  })

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['ocorrencias', colaborador.id] })
    qc.invalidateQueries({ queryKey: ['linha-do-tempo', colaborador.id] })
  }

  const mudar = useMutation({
    mutationFn: async (dados: Partial<Ocorrencia>) => {
      const { error } = await supabase.from('ocorrencias').update(dados).eq('id', aberta!.id)
      if (error) throw error
    },
    onSuccess: () => {
      setAberta(null)
      setCancelando(false)
      atualizar()
    },
  })

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-600">Registrar uma ocorrência não gera desconto automático. Depois de aprovada, abra a ocorrência para lançar o desconto.</p>
        {pode('ocorrencias', 'criar') && (
          <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setNova(true)}>Nova ocorrência</Botao>
        )}
      </div>
      {lista.isLoading ? (
        <Carregando />
      ) : (
        <Tabela
          linhas={lista.data ?? []}
          chave={(o) => o.id}
          aoClicar={setAberta}
          vazio="Nenhuma ocorrência registrada."
          colunas={[
            { titulo: 'Data', celula: (o) => formatarData(o.data) },
            { titulo: 'Tipo', celula: (o) => rotulo(TIPOS_OCORRENCIA, o.tipo) },
            {
              titulo: 'Descrição',
              celula: (o) => (
                <span>
                  {o.descricao}
                  {o.minutos && <span className="text-slate-500"> · {o.minutos} min</span>}
                  {o.dias && <span className="text-slate-500"> · {o.dias} dia(s)</span>}
                </span>
              ),
            },
            { titulo: 'Situação', celula: (o) => <SeloSituacao situacao={o.situacao} /> },
            { titulo: 'Lançado por', celula: (o) => nome(o.criado_por) },
          ]}
        />
      )}
      {nova && <NovaOcorrencia colaborador={colaborador} aoFechar={() => setNova(false)} aoSalvar={() => { setNova(false); atualizar() }} />}
      {aberta && !cancelando && (
        <Janela
          aberta
          aoFechar={() => setAberta(null)}
          titulo={`${rotulo(TIPOS_OCORRENCIA, aberta.tipo)} de ${formatarData(aberta.data)}`}
          rodape={
            <>
              <BotaoExcluir
                modulo="ocorrencias"
                tabela="ocorrencias"
                id={aberta.id}
                descricao={`a ocorrência de ${formatarData(aberta.data)}`}
                aoExcluir={() => {
                  setAberta(null)
                  atualizar()
                }}
              />
              {aberta.situacao !== 'cancelada' && pode('ocorrencias', 'cancelar') && (
                <Botao variante="perigo" onClick={() => setCancelando(true)}>Cancelar</Botao>
              )}
              {aberta.situacao === 'registrada' && pode('ocorrencias', 'aprovar') && (
                <Botao carregando={mudar.isPending} onClick={() => mudar.mutate({ situacao: 'aprovada' })}>Aprovar</Botao>
              )}
            </>
          }
        >
          <div className="space-y-2 text-sm">
            <p>{aberta.descricao}</p>
            <p className="text-slate-500">Situação: <SeloSituacao situacao={aberta.situacao} /></p>
            {aberta.aprovado_por && <p className="text-slate-500">Aprovada por {nome(aberta.aprovado_por)}</p>}
            {aberta.motivo_cancelamento && <p className="text-slate-500">Motivo do cancelamento: {aberta.motivo_cancelamento}</p>}
            {mudar.error && <Mensagem tipo="erro">{mensagemErro(mudar.error)}</Mensagem>}
            {aberta.situacao === 'aprovada' && aberta.tipo !== 'atestado' && pode('financeiro', 'criar') && (
              <GerarDesconto ocorrencia={aberta} aoGerar={atualizar} />
            )}
          </div>
        </Janela>
      )}
      <JanelaCancelar
        aberta={cancelando}
        titulo="Cancelar ocorrência"
        carregando={mudar.isPending}
        erro={mudar.error}
        aoFechar={() => setCancelando(false)}
        aoConfirmar={(motivo) => mudar.mutate({ situacao: 'cancelada', motivo_cancelamento: motivo })}
      />
    </>
  )
}

/** Ocorrência aprovada (falta, atraso…) vira desconto no financeiro do colaborador, uma vez só. */
function GerarDesconto({ ocorrencia, aoGerar }: { ocorrencia: Ocorrencia; aoGerar: () => void }) {
  const qc = useQueryClient()
  const [valor, setValor] = useState('')
  const existente = useQuery({
    queryKey: ['desconto-ocorrencia', ocorrencia.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos_colaborador')
        .select('id, valor, situacao')
        .eq('origem_tipo', 'ocorrencia')
        .eq('origem_id', ocorrencia.id)
        .maybeSingle()
      if (error) throw error
      return data as { id: string; valor: number; situacao: string } | null
    },
  })
  const gerar = useMutation({
    mutationFn: async () => {
      const v = Number(valor.replace(',', '.'))
      if (!(v > 0)) throw new Error('Informe o valor do desconto.')
      const { error } = await supabase.from('lancamentos_colaborador').insert({
        colaborador_id: ocorrencia.colaborador_id,
        tipo: 'desconto',
        data: ocorrencia.data,
        valor: v,
        competencia: ocorrencia.data.slice(0, 7),
        descricao: `${rotulo(TIPOS_OCORRENCIA, ocorrencia.tipo)} de ${formatarData(ocorrencia.data)}: ${ocorrencia.descricao}`,
        origem_tipo: 'ocorrencia',
        origem_id: ocorrencia.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['desconto-ocorrencia', ocorrencia.id] })
      qc.invalidateQueries({ queryKey: ['lancamentos-colaborador', ocorrencia.colaborador_id] })
      aoGerar()
    },
  })
  if (existente.isLoading) return null
  if (existente.data)
    return (
      <Mensagem tipo="sucesso">
        Desconto de {formatarMoeda(existente.data.valor)} já lançado no financeiro ({existente.data.situacao}).
      </Mensagem>
    )
  return (
    <div className="rounded-xl border border-acqua-suave bg-acqua-gelo p-3">
      <p className="mb-2 font-semibold text-acqua-titulo">Descontar no financeiro</p>
      <div className="flex flex-wrap items-end gap-2">
        <Campo rotulo="Valor (R$)" inputMode="decimal" className="w-36" value={valor} onChange={(e) => setValor(e.target.value)} />
        <Botao carregando={gerar.isPending} onClick={() => gerar.mutate()}>Gerar desconto</Botao>
      </div>
      <p className="mt-1 text-xs text-slate-500">Entra como desconto pendente no mês {ocorrencia.data.slice(5, 7)}/{ocorrencia.data.slice(0, 4)}.</p>
      {gerar.error && <div className="mt-2"><Mensagem tipo="erro">{mensagemErro(gerar.error)}</Mensagem></div>}
    </div>
  )
}

function NovaOcorrencia({ colaborador, aoFechar, aoSalvar }: { colaborador: Colaborador; aoFechar: () => void; aoSalvar: () => void }) {
  const [tipo, setTipo] = useState('falta')
  const [data, setData] = useState(hojeISO())
  const [descricao, setDescricao] = useState('')
  const [minutos, setMinutos] = useState('')
  const [dias, setDias] = useState('')
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ocorrencias').insert({
        colaborador_id: colaborador.id,
        tipo,
        data,
        descricao: descricao.trim(),
        minutos: tipo === 'atraso' && minutos ? Number(minutos) : null,
        dias: tipo === 'atestado' && dias ? Number(dias) : null,
      })
      if (error) throw error
    },
    onSuccess: aoSalvar,
  })
  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={`Nova ocorrência — ${colaborador.nome}`}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-ocorrencia" carregando={salvar.isPending}>Registrar</Botao>
        </>
      }
    >
      <form
        id="form-ocorrencia"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (descricao.trim()) salvar.mutate()
        }}
      >
        <Selecao rotulo="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} opcoes={TIPOS_OCORRENCIA} />
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        {tipo === 'atraso' && <Campo rotulo="Minutos de atraso" type="number" min={1} value={minutos} onChange={(e) => setMinutos(e.target.value)} />}
        {tipo === 'atestado' && <Campo rotulo="Dias de atestado" type="number" min={1} value={dias} onChange={(e) => setDias(e.target.value)} />}
        <AreaTexto rotulo="Descrição / justificativa" value={descricao} onChange={(e) => setDescricao(e.target.value)} required className="sm:col-span-2" />
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}
