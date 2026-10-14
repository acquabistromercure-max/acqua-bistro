import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatarData, formatarMinutos, hojeISO } from '../../lib/formatos'
import { descreverPeriodo, intervalo } from '../../lib/periodos'
import { NOMES_DIAS, ROTULOS_TIPO_ESCALA, diaDaSemana, minutosPrevistos, resumoEscala } from '../../lib/ponto'
import { Botao, Carregando, Mensagem, Tabela, cx, mensagemErro } from '../../components/ui'
import type { Colaborador } from '../colaboradores/tipos'
import { COR_TIPO, useEscalas } from './dados'

/** Aba "Escala" da ficha: os dias planejados do mês para a pessoa. */
export default function AbaEscalaFicha({ colaborador }: { colaborador: Colaborador }) {
  const [data, setData] = useState(hojeISO())
  const { inicio, fim } = intervalo('mes', data)
  const escalas = useEscalas(inicio, fim, colaborador.id)
  const linhas = [...(escalas.data ?? [])].sort((a, b) => a.data.localeCompare(b.data))
  const total = linhas.reduce((s, e) => s + minutosPrevistos(e), 0)

  const mover = (sentido: 1 | -1) => {
    const d = new Date(`${inicio}T12:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + sentido)
    setData(d.toISOString().slice(0, 10))
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Botao variante="secundario" aria-label="Mês anterior" onClick={() => mover(-1)}><ChevronLeft className="h-4 w-4" /></Botao>
        <span className="min-w-36 text-center text-sm font-semibold text-acqua-titulo">{descreverPeriodo('mes', data)}</span>
        <Botao variante="secundario" aria-label="Próximo mês" onClick={() => mover(1)}><ChevronRight className="h-4 w-4" /></Botao>
        <span className="text-sm text-slate-600 sm:ml-auto">Previsto no mês: <b>{formatarMinutos(total)}</b></span>
      </div>
      {escalas.isLoading ? (
        <Carregando />
      ) : escalas.error ? (
        <Mensagem tipo="erro">{mensagemErro(escalas.error)}</Mensagem>
      ) : (
        <Tabela
          linhas={linhas}
          chave={(e) => e.id}
          vazio="Nenhum dia na escala deste mês. Monte a escala em Escalas e ponto."
          colunas={[
            { titulo: 'Dia', celula: (e) => `${NOMES_DIAS[diaDaSemana(e.data)]} ${formatarData(e.data)}` },
            {
              titulo: 'Escala',
              celula: (e) => (
                <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', COR_TIPO[e.tipo])}>
                  {e.tipo === 'turno' ? [e.turno, resumoEscala(e)].filter(Boolean).join(' · ') : ROTULOS_TIPO_ESCALA[e.tipo]}
                </span>
              ),
            },
            { titulo: 'Horas', celula: (e) => (minutosPrevistos(e) ? formatarMinutos(minutosPrevistos(e)) : '—') },
            { titulo: 'Observação', celula: (e) => e.observacao || '—' },
          ]}
        />
      )}
    </>
  )
}
