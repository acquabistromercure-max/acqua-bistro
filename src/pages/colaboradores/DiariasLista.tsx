import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarData, formatarMoeda, hojeISO, lerMoeda } from '../../lib/formatos'
import { useNomesUsuarios, useTurnos } from '../../lib/hooks'
import { AreaTexto, Botao, Campo, Carregando, Janela, Mensagem, Selecao, Tabela, mensagemErro } from '../../components/ui'
import { JanelaCancelar, SeloSituacao } from '../../components/registros'
import type { Colaborador } from './tipos'

export type Diaria = {
  id: string
  colaborador_id: string
  data: string
  turno: string | null
  funcao: string | null
  valor: number
  situacao: 'convocada' | 'trabalhada' | 'aprovada' | 'paga' | 'cancelada'
  aprovado_por: string | null
  motivo_cancelamento: string | null
  observacao: string | null
  evento_id?: string | null
  colaboradores?: { nome: string } | null
}

const PROXIMA: Record<string, { situacao: Diaria['situacao']; rotulo: string; acao: 'editar' | 'aprovar' } | undefined> = {
  convocada: { situacao: 'trabalhada', rotulo: 'Marcar como trabalhada', acao: 'editar' },
  trabalhada: { situacao: 'aprovada', rotulo: 'Aprovar diária', acao: 'aprovar' },
  aprovada: { situacao: 'paga', rotulo: 'Marcar como paga', acao: 'editar' },
}

/** Lista de diárias: de um colaborador (ficha) ou de todos num período (aba Diárias). */
export default function DiariasLista({ colaborador, inicio, fim }: { colaborador?: Colaborador; inicio?: string; fim?: string }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const [nova, setNova] = useState(false)
  const [aberta, setAberta] = useState<Diaria | null>(null)
  const [cancelando, setCancelando] = useState(false)

  const chave = ['diarias', colaborador?.id ?? 'todos', inicio, fim]
  const lista = useQuery({
    queryKey: chave,
    queryFn: async () => {
      let q = supabase.from('diarias').select('*, colaboradores(nome)').order('data', { ascending: false })
      if (colaborador) q = q.eq('colaborador_id', colaborador.id)
      if (inicio) q = q.gte('data', inicio)
      if (fim) q = q.lte('data', fim)
      const { data, error } = await q
      if (error) throw error
      return data as Diaria[]
    },
  })

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['diarias'] })
    qc.invalidateQueries({ queryKey: ['linha-do-tempo'] })
    qc.invalidateQueries({ queryKey: ['lancamentos-colaborador'] })
  }

  const mudar = useMutation({
    mutationFn: async (dados: Partial<Diaria>) => {
      const { error } = await supabase.from('diarias').update(dados).eq('id', aberta!.id)
      if (error) throw error
    },
    onSuccess: () => {
      setAberta(null)
      setCancelando(false)
      atualizar()
    },
  })

  const total = (lista.data ?? []).filter((d) => d.situacao !== 'cancelada').reduce((s, d) => s + Number(d.valor), 0)
  const proxima = aberta ? PROXIMA[aberta.situacao] : undefined

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {lista.data?.length ?? 0} diária(s) · total {formatarMoeda(total)} (sem as canceladas)
        </p>
        {pode('colaboradores', 'criar') && <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setNova(true)}>Convocar diária</Botao>}
      </div>
      {lista.isLoading ? (
        <Carregando />
      ) : (
        <Tabela
          linhas={lista.data ?? []}
          chave={(d) => d.id}
          aoClicar={setAberta}
          vazio="Nenhuma diária neste período."
          colunas={[
            { titulo: 'Data', celula: (d) => formatarData(d.data) },
            ...(colaborador ? [] : [{ titulo: 'Pessoa', celula: (d: Diaria) => d.colaboradores?.nome ?? '—' }]),
            { titulo: 'Turno', celula: (d) => d.turno || '—' },
            { titulo: 'Função', celula: (d) => d.funcao || '—' },
            { titulo: 'Valor', celula: (d) => formatarMoeda(d.valor) },
            { titulo: 'Situação', celula: (d) => <SeloSituacao situacao={d.situacao} /> },
          ]}
        />
      )}
      {nova && <NovaDiaria colaborador={colaborador} aoFechar={() => setNova(false)} aoSalvar={() => { setNova(false); atualizar() }} />}
      {aberta && !cancelando && (
        <Janela
          aberta
          aoFechar={() => setAberta(null)}
          titulo={`Diária de ${formatarData(aberta.data)}`}
          rodape={
            !['cancelada', 'paga'].includes(aberta.situacao) && (
              <>
                {pode('colaboradores', 'cancelar') && (
                  <Botao variante="perigo" className="mr-auto" onClick={() => setCancelando(true)}>Cancelar</Botao>
                )}
                {proxima && pode('colaboradores', proxima.acao) && (
                  <Botao carregando={mudar.isPending} onClick={() => mudar.mutate({ situacao: proxima.situacao })}>{proxima.rotulo}</Botao>
                )}
              </>
            )
          }
        >
          <div className="space-y-1 text-sm">
            {!colaborador && <p className="font-semibold">{aberta.colaboradores?.nome}</p>}
            <p>{[aberta.turno, aberta.funcao].filter(Boolean).join(' · ')} — {formatarMoeda(aberta.valor)}</p>
            <p>Situação: <SeloSituacao situacao={aberta.situacao} /></p>
            {aberta.observacao && <p>{aberta.observacao}</p>}
            {aberta.aprovado_por && <p className="text-slate-500">Aprovada por {nome(aberta.aprovado_por)}</p>}
            {aberta.motivo_cancelamento && <p className="text-slate-500">Cancelada: {aberta.motivo_cancelamento}</p>}
            {mudar.error && <Mensagem tipo="erro">{mensagemErro(mudar.error)}</Mensagem>}
          </div>
        </Janela>
      )}
      <JanelaCancelar
        aberta={cancelando}
        titulo="Cancelar diária"
        carregando={mudar.isPending}
        erro={mudar.error}
        aoFechar={() => setCancelando(false)}
        aoConfirmar={(motivo) => mudar.mutate({ situacao: 'cancelada', motivo_cancelamento: motivo })}
      />
    </>
  )
}

function NovaDiaria({ colaborador, aoFechar, aoSalvar }: { colaborador?: Colaborador; aoFechar: () => void; aoSalvar: () => void }) {
  const turnos = useTurnos()
  const [colaboradorId, setColaboradorId] = useState(colaborador?.id ?? '')
  const [data, setData] = useState(hojeISO())
  const [turno, setTurno] = useState('')
  const [funcao, setFuncao] = useState(colaborador?.funcao ?? '')
  const [valor, setValor] = useState(colaborador?.remuneracao != null ? String(colaborador.remuneracao).replace('.', ',') : '')
  const [observacao, setObservacao] = useState('')

  const pessoas = useQuery({
    queryKey: ['colaboradores-ativos'],
    enabled: !colaborador,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('colaboradores')
        .select('id, nome, funcao, remuneracao, vinculo')
        .neq('situacao', 'desligado')
        .order('nome')
      if (error) throw error
      return data
    },
  })

  const salvar = useMutation({
    mutationFn: async () => {
      const v = lerMoeda(valor)
      if (!colaboradorId) throw new Error('Escolha a pessoa.')
      if (v === null) throw new Error('Informe o valor da diária.')
      const { error } = await supabase.from('diarias').insert({
        colaborador_id: colaboradorId,
        data,
        turno: turno || null,
        funcao: funcao.trim() || null,
        valor: v,
        observacao: observacao.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: aoSalvar,
  })

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Convocar diária"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-diaria" carregando={salvar.isPending}>Salvar</Botao>
        </>
      }
    >
      <form
        id="form-diaria"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          salvar.mutate()
        }}
      >
        {!colaborador && (
          <Selecao
            rotulo="Pessoa"
            className="sm:col-span-2"
            value={colaboradorId}
            vazio="Escolha…"
            onChange={(e) => {
              setColaboradorId(e.target.value)
              const p = pessoas.data?.find((x) => x.id === e.target.value)
              if (p?.funcao) setFuncao(p.funcao)
              if (p?.remuneracao != null) setValor(String(p.remuneracao).replace('.', ','))
            }}
            opcoes={(pessoas.data ?? []).map((p) => ({ valor: p.id, rotulo: `${p.nome}${p.vinculo === 'diarista' ? ' (diarista)' : ''}` }))}
          />
        )}
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        <Selecao rotulo="Turno" value={turno} onChange={(e) => setTurno(e.target.value)} vazio="—" opcoes={turnos.map((t) => ({ valor: t, rotulo: t }))} />
        <Campo rotulo="Função" value={funcao} onChange={(e) => setFuncao(e.target.value)} />
        <Campo rotulo="Valor (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required />
        <AreaTexto rotulo="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} className="sm:col-span-2" />
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}
