import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useTurnos } from '../../lib/hooks'
import { formatarData } from '../../lib/formatos'
import { NOMES_DIAS, diaDaSemana, horaCurta, resumoEscala, type TipoEscala } from '../../lib/ponto'
import { AreaTexto, Botao, Campo, Janela, Mensagem, Selecao, cx, mensagemErro } from '../../components/ui'
import { TIPOS_ESCALA, escalaDoDia, nomeCurto, useHorariosTurnos, type Escala, type Pessoa } from './dados'

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

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
  // Dia ainda vazio: começa com o horário fixo da ficha (ou folga, se for dia de folga fixa).
  const sugerida = atual ?? escalaDoDia(null, pessoa, data)
  const [tipo, setTipo] = useState<TipoEscala>(sugerida?.tipo ?? 'turno')
  const [turno, setTurno] = useState(atual?.turno ?? '')
  const [inicio, setInicio] = useState(horaCurta(sugerida?.hora_inicio))
  const [fim, setFim] = useState(horaCurta(sugerida?.hora_fim))
  const [intervalo, setIntervalo] = useState(String(sugerida?.intervalo_minutos ?? pessoa.intervalo_minutos ?? 60))
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
              <div className="mb-2 flex flex-wrap gap-1.5">
                {[
                  { rotulo: `Toda ${NOMES_DIAS[diaDaSemana(data)]}`, dias: outrosDias.filter((d) => diaDaSemana(d) === diaDaSemana(data)) },
                  { rotulo: 'Seg a sex', dias: outrosDias.filter((d) => diaDaSemana(d) <= 5) },
                  { rotulo: 'Todos', dias: outrosDias },
                  { rotulo: 'Limpar', dias: [] },
                ].map((a) => (
                  <button
                    key={a.rotulo}
                    type="button"
                    onClick={() => setRepetir(a.dias)}
                    className="rounded-full border border-[#C4D3E8] bg-white px-2.5 py-0.5 text-xs font-semibold text-acqua-titulo hover:bg-acqua-suave"
                  >
                    {a.rotulo}
                  </button>
                ))}
              </div>
              {/* Calendário: colunas de segunda a domingo, cada data embaixo do seu dia da semana. */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {NOMES_DIAS.slice(1).map((n) => (
                  <div key={n} className="pb-1 text-[11px] font-semibold uppercase text-slate-500">{n}</div>
                ))}
                {Array.from({ length: diaDaSemana(dias[0]) - 1 }, (_, i) => <div key={`vazio-${i}`} />)}
                {dias.map((d) => {
                  const esteDia = d === data
                  const marcado = repetir.includes(d)
                  const inicioMes = d.endsWith('-01') || d === dias[0]
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={esteDia}
                      aria-pressed={marcado}
                      aria-label={`${NOMES_DIAS[diaDaSemana(d)]} ${formatarData(d)}`}
                      title={esteDia ? 'Dia que você está editando' : undefined}
                      onClick={() => setRepetir(marcado ? repetir.filter((x) => x !== d) : [...repetir, d])}
                      className={cx(
                        'flex h-10 flex-col items-center justify-center rounded-lg border text-sm font-semibold tabular-nums leading-none',
                        esteDia
                          ? 'cursor-default border-acqua-dourado bg-[#FBF3DF] text-acqua-titulo'
                          : marcado
                            ? 'border-acqua-petroleo bg-acqua-titulo text-white'
                            : 'border-[#C4D3E8] bg-white text-acqua-titulo hover:bg-acqua-suave',
                        diaDaSemana(d) >= 6 && !marcado && !esteDia && 'bg-slate-50',
                      )}
                    >
                      {Number(d.slice(8, 10))}
                      {inicioMes && <span className="mt-0.5 text-[9px] font-normal opacity-70">{MESES_CURTOS[Number(d.slice(5, 7)) - 1]}</span>}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Em dourado, o dia que você está editando. {repetir.length > 0 && <b>{repetir.length} dia(s) marcado(s). </b>}
              </p>
              <p className="mt-1 text-xs text-slate-500">Os dias marcados ficam iguais a este (substitui o que já estiver lá).</p>
            </fieldset>
          )}
          {!!erro && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(erro)}</Mensagem></div>}
        </form>
      )}
    </Janela>
  )
}
