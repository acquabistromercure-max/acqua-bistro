import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarData, formatarMinutos, hojeISO, somarDias } from '../../lib/formatos'
import { NOMES_DIAS, diaDaSemana, horaCurta, linhaDoDia, resumoEscala } from '../../lib/ponto'
import { Alternador, Botao, Campo, Carregando, Mensagem, Selo, Tabela, mensagemErro } from '../../components/ui'
import { SeloSituacao } from '../../components/registros'
import { chaveDia, nomeCurto, porDia, useEscalas, usePessoasEscala, useRegistrosPonto, useRegrasPonto, type Pessoa } from './dados'
import JanelaPonto from './JanelaPonto'

/** Ponto do dia: quem estava escalado, as marcações e o que falta aprovar. */
export default function Ponto() {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const hoje = hojeISO()
  const regras = useRegrasPonto()
  const [data, setData] = useState(hoje)
  const [todos, setTodos] = useState(false)
  const [aberto, setAberto] = useState<Pessoa | null>(null)

  const pessoas = usePessoasEscala()
  const escalas = useEscalas(data, data)
  const registros = useRegistrosPonto(data, data)
  const escalaDe = useMemo(() => porDia(escalas.data), [escalas.data])
  const pontoDe = useMemo(() => porDia(registros.data), [registros.data])

  const linhas = useMemo(() => {
    return (pessoas.data ?? [])
      .filter((p) => {
        const temAlgo = escalaDe.has(chaveDia(p.id, data)) || pontoDe.has(chaveDia(p.id, data))
        return temAlgo || (todos && p.situacao !== 'desligado')
      })
      .map((p) => {
        const escala = escalaDe.get(chaveDia(p.id, data)) ?? null
        const registro = pontoDe.get(chaveDia(p.id, data)) ?? null
        return { pessoa: p, escala, registro, linha: linhaDoDia(data, escala, registro, regras, hoje) }
      })
      .sort((a, b) => {
        // Escalados em turno primeiro, depois por horário de início e nome.
        const ta = a.escala?.tipo === 'turno' ? 0 : 1
        const tb = b.escala?.tipo === 'turno' ? 0 : 1
        if (ta !== tb) return ta - tb
        return (a.escala?.hora_inicio ?? '99').localeCompare(b.escala?.hora_inicio ?? '99') || a.pessoa.nome.localeCompare(b.pessoa.nome)
      })
  }, [pessoas.data, escalaDe, pontoDe, todos, data, regras, hoje])

  const pendentes = (registros.data ?? []).filter((r) => r.situacao === 'registrada' && r.saida)

  const aprovarTodos = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('registros_ponto')
        .update({ situacao: 'aprovada' })
        .in('id', pendentes.map((r) => r.id))
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ponto'] }),
  })

  const aberta = aberto ? linhas.find((l) => l.pessoa.id === aberto.id) : undefined

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex items-end gap-1">
          <Botao variante="secundario" aria-label="Dia anterior" onClick={() => setData(somarDias(data, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Botao>
          <Campo rotulo="Dia" type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} className="w-40" />
          <Botao variante="secundario" aria-label="Próximo dia" onClick={() => setData(somarDias(data, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Botao>
          {data !== hoje && <Botao variante="fantasma" onClick={() => setData(hoje)}>Hoje</Botao>}
        </div>
        <div className="w-full sm:w-72">
          <Alternador rotulo="Mostrar toda a equipe" descricao="Inclui quem não está na escala do dia" ligado={todos} aoMudar={setTodos} />
        </div>
        {pode('ponto', 'aprovar') && pendentes.length > 0 && (
          <Botao className="sm:ml-auto" icone={<CheckCheck className="h-4 w-4" />} carregando={aprovarTodos.isPending} onClick={() => aprovarTodos.mutate()}>
            Aprovar {pendentes.length} marcação(ões) completa(s)
          </Botao>
        )}
      </div>

      <p className="mb-3 text-sm text-slate-600">
        {NOMES_DIAS[diaDaSemana(data)]}, {formatarData(data)}
        {regras.feriados.includes(data) && <> · <Selo cor="vermelho">Feriado</Selo></>}
      </p>

      {aprovarTodos.error && <div className="mb-3"><Mensagem tipo="erro">{mensagemErro(aprovarTodos.error)}</Mensagem></div>}

      {pessoas.isLoading || escalas.isLoading || registros.isLoading ? (
        <Carregando />
      ) : pessoas.error || escalas.error || registros.error ? (
        <Mensagem tipo="erro">{mensagemErro(pessoas.error || escalas.error || registros.error)}</Mensagem>
      ) : (
        <Tabela
          linhas={linhas}
          chave={(l) => l.pessoa.id}
          aoClicar={(l) => setAberto(l.pessoa)}
          vazio="Ninguém na escala deste dia. Ligue “Mostrar toda a equipe” para lançar ponto de qualquer pessoa."
          colunas={[
            {
              titulo: 'Pessoa',
              celula: (l) => (
                <span>
                  <span className="block font-semibold">{nomeCurto(l.pessoa)}</span>
                  {l.pessoa.funcao && <span className="block text-xs text-slate-500">{l.pessoa.funcao}</span>}
                </span>
              ),
            },
            { titulo: 'Escala', celula: (l) => (l.escala ? [l.escala.turno, resumoEscala(l.escala)].filter(Boolean).join(' · ') : '—') },
            {
              titulo: 'Marcações',
              celula: (l) =>
                l.registro ? (
                  <span className="tabular-nums">
                    {horaCurta(l.registro.entrada)}
                    {l.registro.saida_intervalo && ` · ${horaCurta(l.registro.saida_intervalo)}–${horaCurta(l.registro.volta_intervalo)}`}
                    {` · ${horaCurta(l.registro.saida) || '…'}`}
                  </span>
                ) : (
                  '—'
                ),
            },
            { titulo: 'Trabalhado', celula: (l) => (l.linha.trabalhado === null ? '—' : formatarMinutos(l.linha.trabalhado)) },
            {
              titulo: 'Situação',
              celula: (l) => (
                <span className="flex flex-wrap gap-1">
                  {l.registro && <SeloSituacao situacao={l.registro.situacao} />}
                  {l.linha.divergencias
                    .filter((d) => d !== 'Aguardando aprovação')
                    .map((d) => (
                      <Selo key={d} cor="amarelo">{d}</Selo>
                    ))}
                </span>
              ),
            },
          ]}
        />
      )}

      {aberto && aberta && (
        <JanelaPonto
          key={`${aberto.id}-${data}`}
          pessoa={aberto}
          data={data}
          registro={aberta.registro}
          escala={aberta.escala}
          aoFechar={() => setAberto(null)}
        />
      )}
    </>
  )
}
