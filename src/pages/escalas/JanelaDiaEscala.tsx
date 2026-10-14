import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useTurnos } from '../../lib/hooks'
import { formatarData } from '../../lib/formatos'
import { NOMES_DIAS, diaDaSemana, horaCurta, resumoEscala, type TipoEscala } from '../../lib/ponto'
import { AreaTexto, Botao, Campo, Janela, Mensagem, Selecao, cx, mensagemErro } from '../../components/ui'
import { TIPOS_ESCALA, nomeCurto, useHorariosTurnos, type Escala, type Pessoa } from './dados'

/** Editar o dia de uma pessoa na escala, repetir em outros dias, trocar com um colega ou tirar o dia. */
export default function JanelaDiaEscala({
  pessoa,
  data,
  atual,
  dias,
  doDia,
  pessoas,
  aoFechar,
}: {
  pessoa: Pessoa
  data: string
  atual: Escala | null
  /** Dias visíveis na grade (para "repetir nos dias"). */
  dias: string[]
  /** Escalas já lançadas no mesmo dia (para a troca). */
  doDia: Escala[]
  pessoas: Pessoa[]
  aoFechar: () => void
}) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const turnos = useTurnos()
  const horarios = useHorariosTurnos()
  const [tipo, setTipo] = useState<TipoEscala>(atual?.tipo ?? 'turno')
  const [turno, setTurno] = useState(atual?.turno ?? '')
  const [inicio, setInicio] = useState(horaCurta(atual?.hora_inicio))
  const [fim, setFim] = useState(horaCurta(atual?.hora_fim))
  const [intervalo, setIntervalo] = useState(String(atual?.intervalo_minutos ?? 60))
  const [observacao, setObservacao] = useState(atual?.observacao ?? '')
  const [repetir, setRepetir] = useState<string[]>([])
  const [trocando, setTrocando] = useState(false)
  const [trocarCom, setTrocarCom] = useState('')
  const [motivo, setMotivo] = useState('')

  const podeSalvar = atual ? pode('escalas', 'editar') : pode('escalas', 'criar')
  const atualizar = () => qc.invalidateQueries({ queryKey: ['escalas'] })

  const escolherTurno = (t: string) => {
    setTurno(t)
    const h = horarios[t]
    if (h) {
      setInicio(h.inicio)
      setFim(h.fim)
      setIntervalo(String(h.intervalo))
    }
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const ehTurno = tipo === 'turno'
      if (ehTurno && (!inicio || !fim)) throw new Error('Informe o horário de início e de fim do turno.')
      const dados = {
        colaborador_id: pessoa.id,
        tipo,
        turno: ehTurno ? turno || null : null,
        hora_inicio: ehTurno ? inicio : null,
        hora_fim: ehTurno ? fim : null,
        intervalo_minutos: ehTurno ? Math.max(0, Number(intervalo) || 0) : 0,
        observacao: observacao.trim() || null,
      }
      const linhas = [data, ...repetir].map((d) => ({ ...dados, data: d }))
      const { error } = await supabase.from('escalas').upsert(linhas, { onConflict: 'colaborador_id,data' })
      if (error) throw error
    },
    onSuccess: () => {
      atualizar()
      aoFechar()
    },
  })

  const remover = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('escalas').delete().eq('id', atual!.id)
      if (error) throw error
    },
    onSuccess: () => {
      atualizar()
      aoFechar()
    },
  })

  const trocar = useMutation({
    mutationFn: async () => {
      if (!trocarCom) throw new Error('Escolha com quem trocar.')
      const { error } = await supabase.rpc('trocar_escala', { p_a: atual!.id, p_b: trocarCom, p_motivo: motivo })
      if (error) throw error
    },
    onSuccess: () => {
      atualizar()
      aoFechar()
    },
  })

  const nomes = new Map(pessoas.map((p) => [p.id, nomeCurto(p)]))
  const colegas = doDia.filter((e) => e.colaborador_id !== pessoa.id)
  const outrosDias = dias.filter((d) => d !== data)
  const erro = salvar.error || remover.error || trocar.error

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={`${nomeCurto(pessoa)} · ${NOMES_DIAS[diaDaSemana(data)]} ${formatarData(data)}`}
      largura="max-w-xl"
      rodape={
        trocando ? (
          <>
            <Botao variante="secundario" onClick={() => setTrocando(false)}>Voltar</Botao>
            <Botao carregando={trocar.isPending} disabled={!trocarCom || !motivo.trim()} onClick={() => trocar.mutate()}>
              Confirmar troca
            </Botao>
          </>
        ) : (
          <>
            {atual && pode('escalas', 'editar') && (
              <>
                <Botao variante="fantasma" className="mr-auto" icone={<Trash2 className="h-4 w-4" />} carregando={remover.isPending} onClick={() => remover.mutate()}>
                  Tirar da escala
                </Botao>
                {colegas.length > 0 && (
                  <Botao variante="secundario" icone={<ArrowLeftRight className="h-4 w-4" />} onClick={() => setTrocando(true)}>
                    Trocar
                  </Botao>
                )}
              </>
            )}
            <Botao variante="secundario" onClick={aoFechar}>Fechar</Botao>
            {podeSalvar && (
              <Botao type="submit" form="form-escala" carregando={salvar.isPending}>Salvar</Botao>
            )}
          </>
        )
      }
    >
      {trocando ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Cada pessoa fica com o dia planejado da outra. Hoje {nomeCurto(pessoa)} está com <b>{resumoEscala(atual)}</b>.
          </p>
          <Selecao
            rotulo="Trocar com"
            value={trocarCom}
            onChange={(e) => setTrocarCom(e.target.value)}
            vazio="Escolha…"
            opcoes={colegas.map((e) => ({ valor: e.id, rotulo: `${nomes.get(e.colaborador_id) ?? '…'} — ${resumoEscala(e)}` }))}
          />
          <AreaTexto rotulo="Motivo da troca" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
          {!!erro && <Mensagem tipo="erro">{mensagemErro(erro)}</Mensagem>}
        </div>
      ) : (
        <form
          id="form-escala"
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            salvar.mutate()
          }}
        >
          <Selecao
            rotulo="O que é este dia"
            className="sm:col-span-2"
            value={tipo}
            disabled={!podeSalvar}
            onChange={(e) => setTipo(e.target.value as TipoEscala)}
            opcoes={TIPOS_ESCALA}
          />
          {tipo === 'turno' && (
            <>
              <Selecao
                rotulo="Turno"
                value={turno}
                disabled={!podeSalvar}
                onChange={(e) => escolherTurno(e.target.value)}
                vazio="—"
                opcoes={turnos.map((t) => ({ valor: t, rotulo: t }))}
              />
              <Campo rotulo="Intervalo (minutos)" type="number" min={0} max={600} value={intervalo} disabled={!podeSalvar} onChange={(e) => setIntervalo(e.target.value)} />
              <Campo rotulo="Início" type="time" value={inicio} disabled={!podeSalvar} onChange={(e) => setInicio(e.target.value)} required />
              <Campo rotulo="Fim" type="time" value={fim} disabled={!podeSalvar} onChange={(e) => setFim(e.target.value)} required ajuda="Pode passar da meia-noite." />
            </>
          )}
          <AreaTexto rotulo="Observação" className="sm:col-span-2" value={observacao} disabled={!podeSalvar} onChange={(e) => setObservacao(e.target.value)} />
          {podeSalvar && pode('escalas', 'editar') && outrosDias.length > 0 && (
            <fieldset className="sm:col-span-2">
              <legend className="mb-1 text-sm font-semibold text-acqua-titulo">Repetir também nos dias</legend>
              <div className="flex flex-wrap gap-1.5">
                {outrosDias.map((d) => {
                  const marcado = repetir.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() => setRepetir(marcado ? repetir.filter((x) => x !== d) : [...repetir, d])}
                      className={cx(
                        'rounded-lg border px-2 py-1 text-xs font-semibold',
                        marcado ? 'border-acqua-petroleo bg-acqua-titulo text-white' : 'border-[#C4D3E8] bg-white text-acqua-titulo hover:bg-acqua-suave',
                      )}
                    >
                      {NOMES_DIAS[diaDaSemana(d)]} {d.slice(8, 10)}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1 text-xs text-slate-500">Os dias marcados ficam iguais a este (substitui o que já estiver lá).</p>
            </fieldset>
          )}
          {!!erro && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(erro)}</Mensagem></div>}
        </form>
      )}
    </Janela>
  )
}
