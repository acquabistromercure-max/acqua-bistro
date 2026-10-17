import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Copy, Download, Printer, Search, Wand2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarData, formatarMinutos, hojeISO, normalizar, somarDias } from '../../lib/formatos'
import { descreverPeriodo, intervalo } from '../../lib/periodos'
import { baixarCSV } from '../../lib/exportar'
import { NOMES_DIAS, ROTULOS_TIPO_ESCALA, diaDaSemana, minutosPrevistos, resumoEscala, type TipoEscala } from '../../lib/ponto'
import { Abas, Botao, Campo, Carregando, Confirmar, Mensagem, Vazio, cx, mensagemErro } from '../../components/ui'
import { COR_TIPO, agruparPorTurno, chaveDia, nomeCurto, porDia, useEscalas, usePessoasEscala, useRegrasPonto, turnoDaPessoa, type Escala, type Pessoa } from './dados'
import JanelaDiaEscala from './JanelaDiaEscala'

type Visao = 'semana' | 'mes'

function listarDias(inicio: string, fim: string): string[] {
  const dias: string[] = []
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d)
  return dias
}

function mover(visao: Visao, data: string, sentido: 1 | -1): string {
  if (visao === 'semana') return somarDias(data, 7 * sentido)
  const d = new Date(`${data.slice(0, 8)}01T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + sentido)
  return d.toISOString().slice(0, 10)
}

/** Grade da escala: pessoas nas linhas, dias nas colunas. Clicar num dia abre a edição. */
export default function GradeEscala() {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const hoje = hojeISO()
  const regras = useRegrasPonto()
  const [visao, setVisao] = useState<Visao>('semana')
  const [data, setData] = useState(hoje)
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<{ pessoa: Pessoa; data: string } | null>(null)
  const [copiando, setCopiando] = useState(false)
  const { inicio, fim } = intervalo(visao, data)
  const dias = useMemo(() => listarDias(inicio, fim), [inicio, fim])

  const pessoas = usePessoasEscala()
  const escalas = useEscalas(inicio, fim)
  const mapa = useMemo(() => porDia(escalas.data), [escalas.data])

  const visiveis = useMemo(() => {
    const termo = normalizar(busca)
    const comEscala = new Set((escalas.data ?? []).map((e) => e.colaborador_id))
    return (pessoas.data ?? []).filter(
      (p) =>
        (p.situacao !== 'desligado' || comEscala.has(p.id)) &&
        (!termo || normalizar(`${p.nome} ${p.apelido ?? ''} ${p.funcao ?? ''}`).includes(termo)),
    )
  }, [pessoas.data, escalas.data, busca])
  // Manhã, Tarde e Noite (pela hora de entrada da ficha), cada grupo em ordem alfabética.
  const grupos = useMemo(() => agruparPorTurno(visiveis), [visiveis])

  const copiar = useMutation({
    mutationFn: async () => {
      const { data: qtd, error } = await supabase.rpc('copiar_escala', { p_origem: somarDias(inicio, -7), p_destino: inicio, p_dias: 7 })
      if (error) throw error
      return qtd as number
    },
    onSuccess: () => {
      setCopiando(false)
      qc.invalidateQueries({ queryKey: ['escalas'] })
    },
  })

  const preencher = useMutation({
    mutationFn: async () => {
      const { data: qtd, error } = await supabase.rpc('gerar_escala_padrao', { p_inicio: inicio, p_fim: fim })
      if (error) throw error
      return qtd as number
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escalas'] }),
  })

  const exportar = () =>
    baixarCSV(
      `escala-${inicio}-a-${fim}`,
      grupos.flatMap((g) => g.pessoas),
      [
        { titulo: 'Turno', valor: (p: Pessoa) => turnoDaPessoa(p) },
        { titulo: 'Pessoa', valor: (p: Pessoa) => p.nome },
        { titulo: 'Função', valor: (p: Pessoa) => p.funcao },
        ...dias.map((d) => ({
          titulo: `${NOMES_DIAS[diaDaSemana(d)]} ${formatarData(d)}`,
          valor: (p: Pessoa) => {
            const e = mapa.get(chaveDia(p.id, d))
            return e ? [e.turno, resumoEscala(e)].filter(Boolean).join(' ') : ''
          },
        })),
        {
          titulo: 'Horas previstas',
          valor: (p: Pessoa) => formatarMinutos(dias.reduce((s, d) => s + minutosPrevistos(mapa.get(chaveDia(p.id, d))), 0)),
        },
      ],
    )

  const podeMexer = pode('escalas', 'criar') || pode('escalas', 'editar')
  const doDia = (d: string) => (escalas.data ?? []).filter((e) => e.data === d)

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <div className="w-44">
          <Abas abas={[{ valor: 'semana', rotulo: 'Semana' }, { valor: 'mes', rotulo: 'Mês' }]} ativa={visao} aoMudar={setVisao} />
        </div>
        <div className="mb-4 flex items-center gap-1">
          <Botao variante="secundario" aria-label="Período anterior" onClick={() => setData(mover(visao, data, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Botao>
          <span className="min-w-36 text-center text-sm font-semibold text-acqua-titulo">{descreverPeriodo(visao, data)}</span>
          <Botao variante="secundario" aria-label="Próximo período" onClick={() => setData(mover(visao, data, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Botao>
          {(hoje < inicio || hoje > fim) && (
            <Botao variante="fantasma" onClick={() => setData(hoje)}>Hoje</Botao>
          )}
        </div>
        <div className="relative mb-4 w-full sm:w-56">
          <Campo rotulo="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou função" />
          <Search className="pointer-events-none absolute right-3 top-[34px] h-4 w-4 text-slate-400" />
        </div>
        <div className="mb-4 flex flex-wrap gap-2 sm:ml-auto">
          {pode('escalas', 'criar') && (
            <Botao
              variante="secundario"
              icone={<Wand2 className="h-4 w-4" />}
              carregando={preencher.isPending}
              onClick={() => preencher.mutate()}
              title="Preenche os dias vazios com o horário e as folgas fixas cadastrados na ficha de cada pessoa"
            >
              Preencher pelo horário fixo
            </Botao>
          )}
          {visao === 'semana' && pode('escalas', 'criar') && (
            <Botao variante="secundario" icone={<Copy className="h-4 w-4" />} onClick={() => setCopiando(true)}>
              Copiar semana anterior
            </Botao>
          )}
          <Botao variante="secundario" icone={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
            Imprimir
          </Botao>
          {pode('escalas', 'exportar') && (
            <Botao variante="secundario" icone={<Download className="h-4 w-4" />} onClick={exportar} disabled={!visiveis.length}>
              Exportar
            </Botao>
          )}
        </div>
      </div>

      <h2 className="mb-3 hidden font-serif text-xl text-acqua-titulo print:block">
        Escala — {formatarData(inicio)} a {formatarData(fim)}
      </h2>

      {(preencher.isSuccess || preencher.error) && (
        <div className="mb-3 print:hidden">
          {preencher.error ? (
            <Mensagem tipo="erro">{mensagemErro(preencher.error)}</Mensagem>
          ) : (
            <Mensagem tipo="sucesso">
              {preencher.data
                ? `${preencher.data} dia(s) preenchidos pelo horário fixo. Ajuste o que for diferente clicando no dia.`
                : 'Nada para preencher: os dias já estão lançados ou ninguém tem horário fixo na ficha.'}
            </Mensagem>
          )}
        </div>
      )}
      {copiar.isSuccess && (
        <div className="mb-3 print:hidden">
          <Mensagem tipo="sucesso">
            {copiar.data ? `${copiar.data} dia(s) copiados da semana anterior.` : 'Nada novo para copiar: os dias já estavam preenchidos.'}
          </Mensagem>
        </div>
      )}

      {pessoas.isLoading || escalas.isLoading ? (
        <Carregando />
      ) : pessoas.error || escalas.error ? (
        <Mensagem tipo="erro">{mensagemErro(pessoas.error || escalas.error)}</Mensagem>
      ) : visiveis.length === 0 ? (
        <Vazio>{pessoas.data?.length ? 'Ninguém encontrado com essa busca.' : 'Cadastre colaboradores para montar a escala.'}</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-acqua-suave bg-white print:overflow-visible print:border-slate-300">
          <table className="w-full border-collapse text-left text-xs print:text-[9px]">
            <thead>
              <tr className="bg-acqua-gelo text-acqua-petroleo">
                <th scope="col" className="sticky left-0 z-10 min-w-36 bg-acqua-gelo px-3 py-2 font-semibold">Pessoa</th>
                {dias.map((d) => {
                  const destaque = d === hoje
                  const especial = diaDaSemana(d) === 7 || regras.feriados.includes(d)
                  return (
                    <th
                      key={d}
                      scope="col"
                      className={cx(
                        'px-1 py-2 text-center font-semibold',
                        visao === 'semana' ? 'min-w-24' : 'min-w-14',
                        especial && 'text-red-700',
                        destaque && 'bg-acqua-suave',
                      )}
                    >
                      <span className="block uppercase">{NOMES_DIAS[diaDaSemana(d)]}</span>
                      <span className="block text-sm text-acqua-titulo print:text-[10px]">{d.slice(8, 10)}</span>
                    </th>
                  )
                })}
                <th scope="col" className="px-3 py-2 text-right font-semibold">Horas</th>
              </tr>
            </thead>
            {grupos.map((g) => (
            <tbody key={g.turno} className="divide-y divide-acqua-suave">
              <tr className="bg-[#FBF3DF]">
                <th scope="colgroup" colSpan={dias.length + 2} className="px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-acqua-titulo">
                  <span className="sticky left-3">
                    {g.turno} <span className="font-normal normal-case text-slate-500">· {g.pessoas.length} pessoa(s)</span>
                  </span>
                </th>
              </tr>
              {g.pessoas.map((p) => {
                const total = dias.reduce((s, d) => s + minutosPrevistos(mapa.get(chaveDia(p.id, d))), 0)
                return (
                  <tr key={p.id}>
                    <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-normal">
                      <span className="block font-semibold text-acqua-titulo">{nomeCurto(p)}</span>
                      {p.funcao && <span className="block text-[11px] text-slate-500">{p.funcao}</span>}
                    </th>
                    {dias.map((d) => {
                      const e = mapa.get(chaveDia(p.id, d))
                      return (
                        <td key={d} className={cx('p-0.5 text-center', d === hoje && 'bg-acqua-gelo')}>
                          <CelulaDia escala={e} compacta={visao === 'mes'} clicavel={podeMexer || !!e} aoClicar={() => setAberto({ pessoa: p, data: d })} />
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-right font-semibold text-acqua-titulo">{total ? formatarMinutos(total) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            ))}
            <tfoot>
              <tr className="bg-acqua-gelo text-acqua-petroleo">
                <th scope="row" className="sticky left-0 z-10 bg-acqua-gelo px-3 py-2 text-left font-semibold">Em turno</th>
                {dias.map((d) => (
                  <td key={d} className="px-1 py-2 text-center font-semibold">
                    {doDia(d).filter((e) => e.tipo === 'turno').length || ''}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Legenda />

      {aberto && (
        <JanelaDiaEscala
          pessoa={aberto.pessoa}
          data={aberto.data}
          atual={mapa.get(chaveDia(aberto.pessoa.id, aberto.data)) ?? null}
          dias={dias}
          doDia={doDia(aberto.data)}
          pessoas={pessoas.data ?? []}
          aoFechar={() => setAberto(null)}
        />
      )}
      <Confirmar
        aberta={copiando}
        titulo="Copiar semana anterior"
        mensagem={
          <>
            Copia a escala de {formatarData(somarDias(inicio, -7))} a {formatarData(somarDias(inicio, -1))} para esta semana.
            Dias que já estão preenchidos aqui não mudam.
            {copiar.error && <div className="mt-3"><Mensagem tipo="erro">{mensagemErro(copiar.error)}</Mensagem></div>}
          </>
        }
        textoConfirmar="Copiar"
        carregando={copiar.isPending}
        aoConfirmar={() => copiar.mutate()}
        aoFechar={() => setCopiando(false)}
      />
    </>
  )
}

function CelulaDia({ escala, compacta, clicavel, aoClicar }: { escala?: Escala; compacta: boolean; clicavel: boolean; aoClicar: () => void }) {
  const conteudo = escala ? (
    <span className={cx('flex min-h-11 flex-col items-center justify-center rounded-md px-1 py-1 leading-tight', COR_TIPO[escala.tipo])}>
      {escala.tipo === 'turno' ? (
        <>
          {!compacta && escala.turno && <span className="text-[10px] font-semibold uppercase opacity-70">{escala.turno}</span>}
          <span className="font-semibold">{compacta ? escala.hora_inicio?.slice(0, 5) : resumoEscala(escala)}</span>
        </>
      ) : (
        <span className="font-semibold">{compacta ? ROTULOS_TIPO_ESCALA[escala.tipo].slice(0, 3) : ROTULOS_TIPO_ESCALA[escala.tipo]}</span>
      )}
      {escala.observacao && !compacta && <span className="max-w-24 truncate text-[10px] opacity-70" title={escala.observacao}>{escala.observacao}</span>}
    </span>
  ) : (
    <span className="flex min-h-11 items-center justify-center rounded-md text-slate-300 print:text-transparent">+</span>
  )
  if (!clicavel) return conteudo
  return (
    <button type="button" onClick={aoClicar} className="block w-full rounded-md hover:ring-2 hover:ring-acqua focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acqua">
      {conteudo}
    </button>
  )
}

function Legenda() {
  const tipos = Object.keys(ROTULOS_TIPO_ESCALA) as TipoEscala[]
  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      {tipos.map((t) => (
        <span key={t} className={cx('rounded-full px-2 py-0.5 font-semibold', COR_TIPO[t])}>
          {ROTULOS_TIPO_ESCALA[t]}
        </span>
      ))}
      <span className="text-slate-500">Domingos e feriados em vermelho no cabeçalho.</span>
    </div>
  )
}
