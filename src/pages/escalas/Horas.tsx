import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Printer } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useConfiguracao } from '../../lib/hooks'
import { formatarMinutos, formatarMoeda, hojeISO } from '../../lib/formatos'
import { baixarCSV } from '../../lib/exportar'
import { esc, imprimirDocumento, tabelaHtml } from '../../lib/imprimir'
import { diasDoMes, linhaDoDia, totalizar, type TotaisFolha } from '../../lib/ponto'
import { mesPorExtenso } from '../../lib/documentos'
import { Botao, Campo, Carregando, Mensagem, Selecao, cx, mensagemErro } from '../../components/ui'
import FolhaPonto from './FolhaPonto'
import { chaveDia, escalaDoDia, porDia, usePessoasEscala, useRegrasPonto, type Escala, type Pessoa, type RegistroPonto } from './dados'

type Linha = {
  pessoa: Pessoa
  t: TotaisFolha
  faltas: number
  atestados: number
  atrasosMin: number
  vales: number
  comissoes: number
  descontos: number
  passagem: number
}

/** Horas do mês: geral (todos) ou de uma pessoa; base do relatório mensal para a contabilidade. */
export default function Horas() {
  const { pode } = usePermissoes()
  const regras = useRegrasPonto()
  const tarifa = Number(useConfiguracao<number>('passagem_valor_dia', 0)) || 0
  const [mes, setMes] = useState(hojeISO().slice(0, 7))
  const [pessoaId, setPessoaId] = useState('')
  const dias = diasDoMes(mes)
  const inicio = dias[0]
  const fim = dias[dias.length - 1]
  const pessoas = usePessoasEscala()

  const dados = useQuery({
    queryKey: ['horas-mes', mes],
    queryFn: async () => {
      const [e, r, o, l] = await Promise.all([
        supabase.from('escalas').select('*').gte('data', inicio).lte('data', fim),
        supabase.from('registros_ponto').select('*').gte('data', inicio).lte('data', fim).neq('situacao', 'cancelada'),
        supabase.from('ocorrencias').select('colaborador_id, data, tipo, minutos, dias').gte('data', inicio).lte('data', fim).neq('situacao', 'cancelada'),
        supabase
          .from('lancamentos_colaborador')
          .select('colaborador_id, tipo, valor')
          .or(`competencia.eq.${mes},and(competencia.is.null,data.gte.${inicio},data.lte.${fim})`)
          .neq('situacao', 'cancelado'),
      ])
      if (e.error) throw e.error
      if (r.error) throw r.error
      return {
        escalas: (e.data ?? []) as Escala[],
        registros: (r.data ?? []) as RegistroPonto[],
        ocorrencias: (o.data ?? []) as { colaborador_id: string; data: string; tipo: string; minutos: number | null; dias: number | null }[],
        lancamentos: (l.data ?? []) as { colaborador_id: string; tipo: string; valor: number }[],
      }
    },
  })

  const linhas: Linha[] = useMemo(() => {
    if (!dados.data || !pessoas.data) return []
    const e = porDia(dados.data.escalas)
    const r = porDia(dados.data.registros)
    const hoje = hojeISO()
    return pessoas.data
      .filter((p) => p.situacao !== 'desligado' || dados.data!.registros.some((x) => x.colaborador_id === p.id))
      .map((p) => {
        const doMes = dias.map((d) => linhaDoDia(d, escalaDoDia(e.get(chaveDia(p.id, d)), p, d), r.get(chaveDia(p.id, d)) ?? null, regras, hoje))
        const t = totalizar(doMes)
        const oc = dados.data!.ocorrencias.filter((x) => x.colaborador_id === p.id)
        // Falta = dia escalado sem marcação ou com ocorrência de falta (o mesmo dia conta uma vez só).
        const diasFalta = new Set([
          ...doMes.filter((l) => l.divergencias.includes('Sem marcação')).map((l) => l.data),
          ...oc.filter((x) => x.tipo === 'falta').map((x) => x.data),
        ])
        const lc = dados.data!.lancamentos.filter((x) => x.colaborador_id === p.id)
        const soma = (tipos: string[]) => lc.filter((x) => tipos.includes(x.tipo)).reduce((s, x) => s + Number(x.valor), 0)
        return {
          pessoa: p,
          t,
          faltas: diasFalta.size,
          atestados: oc.filter((x) => x.tipo === 'atestado').reduce((s, x) => s + (x.dias ?? 1), 0),
          atrasosMin: oc.filter((x) => x.tipo === 'atraso').reduce((s, x) => s + (x.minutos ?? 0), 0) + t.atrasos,
          vales: soma(['vale', 'adiantamento']),
          comissoes: soma(['comissao']),
          descontos: soma(['desconto']),
          passagem: Math.round(t.diasTrabalhados * tarifa * 100) / 100,
        }
      })
      .filter((l) => l.t.trabalhado > 0 || l.t.previsto > 0 || l.faltas || l.vales)
  }, [dados.data, pessoas.data, dias, regras, tarifa])

  const verFinanceiro = pode('financeiro')
  const colunas: { titulo: string; valor: (l: Linha) => string | number }[] = [
    { titulo: 'Colaborador', valor: (l) => l.pessoa.nome },
    { titulo: 'Função', valor: (l) => l.pessoa.funcao ?? '' },
    { titulo: 'Dias trab.', valor: (l) => l.t.diasTrabalhados },
    { titulo: 'Previsto', valor: (l) => formatarMinutos(l.t.previsto) },
    { titulo: 'Trabalhado', valor: (l) => formatarMinutos(l.t.trabalhado) },
    { titulo: 'Horas extras', valor: (l) => formatarMinutos(l.t.extras) },
    { titulo: 'Horas negativas', valor: (l) => formatarMinutos(l.t.faltantes) },
    { titulo: 'Saldo', valor: (l) => formatarMinutos(l.t.saldo) },
    { titulo: 'Noturnas', valor: (l) => formatarMinutos(l.t.noturno) },
    { titulo: 'Dom./feriados', valor: (l) => l.t.domingosFeriadosTrabalhados },
    { titulo: 'Faltas', valor: (l) => l.faltas },
    { titulo: 'Atestados (dias)', valor: (l) => l.atestados },
    { titulo: 'Atrasos (min)', valor: (l) => l.atrasosMin },
    ...(verFinanceiro
      ? [
          { titulo: 'Vales/adiant.', valor: (l: Linha) => formatarMoeda(l.vales) },
          { titulo: 'Comissões', valor: (l: Linha) => formatarMoeda(l.comissoes) },
          { titulo: 'Descontos', valor: (l: Linha) => formatarMoeda(l.descontos) },
          { titulo: 'Passagem estimada', valor: (l: Linha) => formatarMoeda(l.passagem) },
        ]
      : []),
  ]

  const exportar = () => baixarCSV(`horas-contabilidade-${mes}`, linhas, colunas)
  const imprimir = () =>
    imprimirDocumento(
      `Horas ${mes}`,
      `<h1>Informações para a contabilidade — ${esc(mesPorExtenso(mes))}</h1>
       ${tabelaHtml(colunas.map((c) => ({ titulo: c.titulo, num: !['Colaborador', 'Função'].includes(c.titulo) })), linhas.map((l) => colunas.map((c) => c.valor(l))))}
       <p class="nota">Horas em relógio. Faltas = dias escalados sem marcação ou com ocorrência de falta. Regras de adicionais e hora noturna reduzida conforme RH/contabilidade.</p>
       <div class="assinaturas"><div>Responsável</div><div>Contabilidade</div></div>`,
    )

  const pessoa = pessoas.data?.find((p) => p.id === pessoaId)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Campo rotulo="Mês" type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="w-44" />
        <Selecao
          rotulo="Ver"
          className="w-72"
          value={pessoaId}
          onChange={(e) => setPessoaId(e.target.value)}
          vazio="Todos (geral)"
          opcoes={(pessoas.data ?? []).filter((p) => p.situacao !== 'desligado').map((p) => ({ valor: p.id, rotulo: p.nome }))}
        />
        {!pessoaId && (
          <div className="ml-auto flex gap-2">
            <Botao variante="secundario" icone={<Printer className="h-4 w-4" />} onClick={imprimir} disabled={!linhas.length}>Imprimir</Botao>
            {pode('ponto', 'exportar') && <Botao variante="secundario" icone={<Download className="h-4 w-4" />} onClick={exportar} disabled={!linhas.length}>Exportar para contabilidade</Botao>}
          </div>
        )}
      </div>

      {pessoa ? (
        <FolhaPonto key={pessoa.id} colaboradorId={pessoa.id} />
      ) : dados.isLoading || pessoas.isLoading ? (
        <Carregando />
      ) : dados.error ? (
        <Mensagem tipo="erro">{mensagemErro(dados.error)}</Mensagem>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Horas trabalhadas', formatarMinutos(linhas.reduce((s, l) => s + l.t.trabalhado, 0))],
              ['Horas extras', formatarMinutos(linhas.reduce((s, l) => s + l.t.extras, 0))],
              ['Horas noturnas', formatarMinutos(linhas.reduce((s, l) => s + l.t.noturno, 0))],
              ['Faltas', String(linhas.reduce((s, l) => s + l.faltas, 0))],
            ].map(([r, v]) => (
              <div key={r} className="rounded-xl border border-acqua-suave bg-white p-3">
                <p className="text-xs text-slate-500">{r}</p>
                <p className="text-lg font-semibold tabular-nums text-acqua-titulo">{v}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-acqua-suave bg-white">
            <table className="w-full text-right text-xs tabular-nums">
              <thead className="bg-acqua-gelo text-acqua-petroleo">
                <tr>
                  {colunas.map((c) => (
                    <th key={c.titulo} className={cx('px-2 py-2 font-semibold', c.titulo === 'Colaborador' && 'sticky left-0 bg-acqua-gelo text-left', c.titulo === 'Função' && 'text-left')}>
                      {c.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-acqua-suave">
                {linhas.map((l) => (
                  <tr key={l.pessoa.id} className="cursor-pointer hover:bg-acqua-gelo" onClick={() => setPessoaId(l.pessoa.id)}>
                    {colunas.map((c) => (
                      <td
                        key={c.titulo}
                        className={cx(
                          'px-2 py-2',
                          c.titulo === 'Colaborador' && 'sticky left-0 bg-white text-left font-semibold text-acqua-titulo',
                          c.titulo === 'Função' && 'text-left text-slate-500',
                          c.titulo === 'Saldo' && l.t.saldo < 0 && 'text-red-700',
                          c.titulo === 'Horas extras' && l.t.extras > 0 && 'text-emerald-700',
                        )}
                      >
                        {c.valor(l)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!linhas.length && <p className="text-sm text-slate-500">Nenhuma hora lançada neste mês.</p>}
          <p className="text-xs text-slate-500">
            Clique numa pessoa para ver a folha dia a dia. Quando o dia não tem escala, vale o horário fixo da ficha.
            {verFinanceiro && !tarifa && ' Para estimar a passagem, informe o valor por dia em Caixa → Regras.'}
          </p>
        </>
      )}
    </div>
  )
}
