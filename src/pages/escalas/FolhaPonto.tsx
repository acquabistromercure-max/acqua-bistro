import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Lock, Printer, Unlock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarData, formatarDataHora, formatarMinutos, hojeISO } from '../../lib/formatos'
import { baixarCSV } from '../../lib/exportar'
import { NOMES_DIAS, diaDaSemana, diasDoMes, horaCurta, linhaDoDia, resumoEscala, totalizar, type LinhaFolha } from '../../lib/ponto'
import { AreaTexto, Botao, Campo, Cartao, Carregando, Confirmar, Janela, Mensagem, Selecao, Selo, Vazio, cx, mensagemErro } from '../../components/ui'
import { BotaoExcluir } from '../../components/registros'
import { chaveDia, porDia, useEscalas, usePessoasEscala, useRegistrosPonto, useRegrasPonto, type Fechamento } from './dados'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const nomeCompetencia = (c: string) => `${MESES[Number(c.slice(5, 7)) - 1]} de ${c.slice(0, 4)}`

/** Folha-ponto do mês de uma pessoa: dia a dia, totais, impressão para assinatura e fechamento. */
export default function FolhaPonto({ colaboradorId: fixo }: { colaboradorId?: string }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const hoje = hojeISO()
  const regras = useRegrasPonto()
  const [colaboradorId, setColaboradorId] = useState(fixo ?? '')
  const [competencia, setCompetencia] = useState(hoje.slice(0, 7))
  const [fechando, setFechando] = useState(false)
  const [reabrindo, setReabrindo] = useState(false)
  const [motivo, setMotivo] = useState('')

  const dias = useMemo(() => diasDoMes(competencia), [competencia])
  const inicio = dias[0]
  const fim = dias[dias.length - 1]
  const pessoas = usePessoasEscala()
  const pessoa = pessoas.data?.find((p) => p.id === colaboradorId)
  const escalas = useEscalas(inicio, fim, colaboradorId || undefined)
  const registros = useRegistrosPonto(inicio, fim, colaboradorId || undefined, !!colaboradorId)

  const fechamentos = useQuery({
    queryKey: ['fechamentos-ponto', colaboradorId],
    enabled: !!colaboradorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fechamentos_ponto')
        .select('*')
        .eq('colaborador_id', colaboradorId)
        .order('fechado_em', { ascending: false })
      if (error) throw error
      return data as Fechamento[]
    },
  })
  const fechado = fechamentos.data?.find((f) => f.competencia === competencia && f.situacao === 'fechado')

  const linhas: LinhaFolha[] = useMemo(() => {
    if (!colaboradorId) return []
    const e = porDia(escalas.data)
    const r = porDia(registros.data)
    return dias.map((d) => linhaDoDia(d, e.get(chaveDia(colaboradorId, d)) ?? null, r.get(chaveDia(colaboradorId, d)) ?? null, regras, hoje))
  }, [colaboradorId, dias, escalas.data, registros.data, regras, hoje])
  const totais = useMemo(() => totalizar(linhas), [linhas])
  const pendentes = (registros.data ?? []).filter((r) => r.situacao === 'registrada').length

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['fechamentos-ponto'] })
    qc.invalidateQueries({ queryKey: ['ponto'] })
  }

  const fechar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('fechamentos_ponto').insert({ colaborador_id: colaboradorId, competencia, resumo: totais })
      if (error) throw error
    },
    onSuccess: () => {
      setFechando(false)
      atualizar()
    },
  })

  const reabrir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('fechamentos_ponto')
        .update({ situacao: 'reaberto', motivo_reabertura: motivo.trim() })
        .eq('id', fechado!.id)
      if (error) throw error
    },
    onSuccess: () => {
      setReabrindo(false)
      setMotivo('')
      atualizar()
    },
  })

  const exportar = () =>
    baixarCSV(`folha-ponto-${pessoa?.nome ?? 'colaborador'}-${competencia}`, linhas, [
      { titulo: 'Data', valor: (l) => formatarData(l.data) },
      { titulo: 'Dia', valor: (l) => NOMES_DIAS[diaDaSemana(l.data)] + (l.feriado ? ' (feriado)' : '') },
      { titulo: 'Escala', valor: (l) => (l.escala ? [l.escala.turno, resumoEscala(l.escala)].filter(Boolean).join(' ') : '') },
      { titulo: 'Entrada', valor: (l) => horaCurta(l.marcacao?.entrada) },
      { titulo: 'Saída intervalo', valor: (l) => horaCurta(l.marcacao?.saida_intervalo) },
      { titulo: 'Volta intervalo', valor: (l) => horaCurta(l.marcacao?.volta_intervalo) },
      { titulo: 'Saída', valor: (l) => horaCurta(l.marcacao?.saida) },
      { titulo: 'Previsto', valor: (l) => (l.previsto ? formatarMinutos(l.previsto) : '') },
      { titulo: 'Trabalhado', valor: (l) => (l.trabalhado === null ? '' : formatarMinutos(l.trabalhado)) },
      { titulo: 'Saldo', valor: (l) => (l.saldo ? formatarMinutos(l.saldo) : '') },
      { titulo: 'Noturno', valor: (l) => (l.noturno ? formatarMinutos(l.noturno) : '') },
      { titulo: 'Observações', valor: (l) => l.divergencias.join(', ') },
    ])

  const carregando = escalas.isLoading || registros.isLoading || fechamentos.isLoading
  const erro = escalas.error || registros.error || fechamentos.error

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        {!fixo && (
          <Selecao
            rotulo="Pessoa"
            className="w-full sm:w-72"
            value={colaboradorId}
            onChange={(e) => setColaboradorId(e.target.value)}
            vazio="Escolha…"
            opcoes={(pessoas.data ?? []).map((p) => ({ valor: p.id, rotulo: `${p.nome}${p.situacao === 'desligado' ? ' (desligado)' : ''}` }))}
          />
        )}
        <Campo rotulo="Mês" type="month" value={competencia} onChange={(e) => e.target.value && setCompetencia(e.target.value)} className="w-44" />
        {colaboradorId && (
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Botao variante="secundario" icone={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Imprimir</Botao>
            {pode('ponto', 'exportar') && (
              <Botao variante="secundario" icone={<Download className="h-4 w-4" />} onClick={exportar}>Exportar</Botao>
            )}
            {pode('ponto', 'aprovar') &&
              (fechado ? (
                <Botao variante="secundario" icone={<Unlock className="h-4 w-4" />} onClick={() => setReabrindo(true)}>Reabrir mês</Botao>
              ) : (
                <Botao icone={<Lock className="h-4 w-4" />} onClick={() => setFechando(true)} disabled={competencia > hoje.slice(0, 7)}>
                  Fechar mês
                </Botao>
              ))}
          </div>
        )}
      </div>

      {!colaboradorId ? (
        <Vazio>Escolha a pessoa para ver a folha-ponto do mês.</Vazio>
      ) : carregando ? (
        <Carregando />
      ) : erro ? (
        <Mensagem tipo="erro">{mensagemErro(erro)}</Mensagem>
      ) : (
        <div className="space-y-4">
          {/* Cabeçalho que aparece na impressão */}
          <div className="hidden print:block">
            <h2 className="font-serif text-xl text-acqua-titulo">Folha-ponto — {nomeCompetencia(competencia)}</h2>
            <p className="text-sm">
              {pessoa?.nome}
              {pessoa?.funcao && ` · ${pessoa.funcao}`} · Acqua Bistrô
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {fechado ? (
              <Selo cor="verde">Fechado em {formatarDataHora(fechado.fechado_em)} por {nome(fechado.fechado_por)}</Selo>
            ) : (
              <Selo cor="amarelo">Mês aberto</Selo>
            )}
            {pendentes > 0 && <Selo cor="amarelo">{pendentes} marcação(ões) aguardando aprovação</Selo>}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 print:grid-cols-8">
            <Total rotulo="Previsto" valor={formatarMinutos(totais.previsto)} />
            <Total rotulo="Trabalhado" valor={formatarMinutos(totais.trabalhado)} />
            <Total rotulo="Horas a mais" valor={formatarMinutos(totais.extras)} destaque={totais.extras > 0 ? 'verde' : undefined} />
            <Total rotulo="Horas a menos" valor={formatarMinutos(totais.faltantes)} destaque={totais.faltantes > 0 ? 'vermelho' : undefined} />
            <Total rotulo="Saldo do mês" valor={formatarMinutos(totais.saldo)} destaque={totais.saldo < 0 ? 'vermelho' : totais.saldo > 0 ? 'verde' : undefined} />
            <Total rotulo="Noturnas" valor={formatarMinutos(totais.noturno)} />
            <Total rotulo="Dom./feriados" valor={`${totais.domingosFeriadosTrabalhados} dia(s)`} />
            <Total rotulo="Faltas" valor={String(totais.faltas)} destaque={totais.faltas ? 'vermelho' : undefined} />
          </div>

          <div className="overflow-x-auto rounded-xl border border-acqua-suave bg-white print:overflow-visible">
            <table className="w-full text-left text-xs print:text-[9px]">
              <thead className="bg-acqua-gelo text-acqua-petroleo">
                <tr>
                  {['Dia', 'Escala', 'Entrada', 'Intervalo', 'Saída', 'Previsto', 'Trabalhado', 'Saldo', 'Noturno', 'Observações'].map((t) => (
                    <th key={t} scope="col" className="px-2 py-2 font-semibold">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-acqua-suave tabular-nums">
                {linhas.map((l) => (
                  <tr key={l.data} className={cx((l.domingo || l.feriado) && 'bg-red-50/40')}>
                    <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-acqua-titulo">
                      {l.data.slice(8, 10)} {NOMES_DIAS[diaDaSemana(l.data)]}
                      {l.feriado && <span className="ml-1 text-[10px] text-red-700">fer.</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">{l.escala ? resumoEscala(l.escala) : ''}</td>
                    <td className="px-2 py-1.5">{horaCurta(l.marcacao?.entrada)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      {l.marcacao?.saida_intervalo && `${horaCurta(l.marcacao.saida_intervalo)}–${horaCurta(l.marcacao.volta_intervalo)}`}
                    </td>
                    <td className="px-2 py-1.5">{horaCurta(l.marcacao?.saida)}</td>
                    <td className="px-2 py-1.5">{l.previsto ? formatarMinutos(l.previsto) : ''}</td>
                    <td className="px-2 py-1.5">{l.trabalhado === null ? '' : formatarMinutos(l.trabalhado)}</td>
                    <td className={cx('px-2 py-1.5 font-semibold', l.saldo < 0 && 'text-red-700', l.saldo > 0 && 'text-emerald-700')}>
                      {l.saldo ? formatarMinutos(l.saldo) : ''}
                    </td>
                    <td className="px-2 py-1.5">{l.noturno ? formatarMinutos(l.noturno) : ''}</td>
                    <td className="px-2 py-1.5 text-slate-600">{l.divergencias.join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-500">
            Cálculo em horas de relógio. Tolerância de atraso: {regras.toleranciaMinutos} min. Faixa noturna: {regras.noturnaInicio} às {regras.noturnaFim}.
            Adicionais, hora noturna reduzida e banco de horas seguem as regras do RH/contabilidade.
          </p>

          {/* Assinaturas (só na impressão) */}
          <div className="hidden grid-cols-2 gap-10 pt-12 text-center text-xs print:grid">
            <div className="border-t border-slate-500 pt-1">{pessoa?.nome}</div>
            <div className="border-t border-slate-500 pt-1">Responsável — Acqua Bistrô</div>
          </div>

          {!!fechamentos.data?.length && (
            <Cartao titulo="Histórico de fechamentos" className="print:hidden">
              <ul className="space-y-2 text-sm">
                {fechamentos.data.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold capitalize">{nomeCompetencia(f.competencia)}</span>
                    <Selo cor={f.situacao === 'fechado' ? 'verde' : 'cinza'}>{f.situacao === 'fechado' ? 'Fechado' : 'Reaberto'}</Selo>
                    <span className="text-slate-500">
                      por {nome(f.fechado_por)} em {formatarDataHora(f.fechado_em)}
                      {f.reaberto_em && ` · reaberto por ${nome(f.reaberto_por)} em ${formatarDataHora(f.reaberto_em)}: ${f.motivo_reabertura}`}
                    </span>
                    <BotaoExcluir
                      modulo="ponto"
                      tabela="fechamentos_ponto"
                      id={f.id}
                      descricao={`o fechamento de ${nomeCompetencia(f.competencia)}`}
                      aoExcluir={atualizar}
                      className="ml-auto"
                    />
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </div>
      )}

      <Confirmar
        aberta={fechando}
        titulo={`Fechar ${nomeCompetencia(competencia)}`}
        mensagem={
          <div className="space-y-2">
            <p>
              Depois de fechado, o ponto deste mês de <b>{pessoa?.nome}</b> não pode mais ser alterado (só reabrindo, com motivo).
              Os totais de hoje ficam guardados no histórico.
            </p>
            {pendentes > 0 && <Mensagem tipo="alerta">Há {pendentes} marcação(ões) aguardando aprovação. Aprove ou cancele antes de fechar.</Mensagem>}
            {totais.divergencias > 0 && <Mensagem tipo="alerta">O mês tem {totais.divergencias} divergência(s). Confira a coluna Observações.</Mensagem>}
            {fechar.error && <Mensagem tipo="erro">{mensagemErro(fechar.error)}</Mensagem>}
          </div>
        }
        textoConfirmar="Fechar mês"
        carregando={fechar.isPending}
        aoConfirmar={() => fechar.mutate()}
        aoFechar={() => setFechando(false)}
      />
      <Janela
        aberta={reabrindo}
        aoFechar={() => setReabrindo(false)}
        titulo="Reabrir mês"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setReabrindo(false)}>Voltar</Botao>
            <Botao carregando={reabrir.isPending} disabled={!motivo.trim()} onClick={() => reabrir.mutate()}>Reabrir</Botao>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700">O fechamento continua no histórico, marcado como reaberto. Depois dos ajustes, feche o mês de novo.</p>
          <AreaTexto rotulo="Motivo da reabertura" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
          {reabrir.error && <Mensagem tipo="erro">{mensagemErro(reabrir.error)}</Mensagem>}
        </div>
      </Janela>
    </>
  )
}

function Total({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: 'verde' | 'vermelho' }) {
  return (
    <div className="rounded-xl border border-acqua-suave bg-white px-3 py-2">
      <p className="text-[11px] text-slate-500">{rotulo}</p>
      <p className={cx('font-semibold tabular-nums text-acqua-titulo', destaque === 'verde' && 'text-emerald-700', destaque === 'vermelho' && 'text-red-700')}>
        {valor}
      </p>
    </div>
  )
}
