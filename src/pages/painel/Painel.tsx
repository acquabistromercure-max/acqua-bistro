import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePermissoes } from '../../lib/permissoes'
import { hojeISO, somarDias } from '../../lib/formatos'
import { descreverPeriodo, intervalo, type Escala } from '../../lib/periodos'
import { Abas, Botao, Pagina } from '../../components/ui'
import Atalhos from './Atalhos'
import Rotina from './Rotina'
import { CARDS } from './cards'

const ESCALAS: { valor: Escala; rotulo: string }[] = [
  { valor: 'dia', rotulo: 'Dia' },
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'mes', rotulo: 'Mês' },
  { valor: 'ano', rotulo: 'Ano' },
]

/** Avança/volta um período inteiro a partir da data. */
function mover(escala: Escala, data: string, sentido: 1 | -1): string {
  if (escala === 'dia') return somarDias(data, sentido)
  if (escala === 'semana') return somarDias(data, 7 * sentido)
  const d = new Date(`${data.slice(0, 8)}01T12:00:00Z`)
  if (escala === 'mes') d.setUTCMonth(d.getUTCMonth() + sentido)
  else d.setUTCFullYear(d.getUTCFullYear() + sentido)
  return d.toISOString().slice(0, 10)
}

export default function Painel() {
  const { perfil, pode } = usePermissoes()
  const hoje = hojeISO()
  const [escala, setEscala] = useState<Escala>('dia')
  const [data, setData] = useState(hoje)
  const filtro = { escala, data, ...intervalo(escala, data) }
  const cards = CARDS.filter((c) => pode(c.modulo))
  const primeiroNome = perfil?.nome?.split(' ')[0] || perfil?.email || ''

  return (
    <Pagina
      titulo={`Olá, ${primeiroNome}!`}
      descricao="Resumo do Acqua Bistrô e o que precisa ser feito."
      acoes={
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-64">
            <Abas abas={ESCALAS} ativa={escala} aoMudar={setEscala} />
          </div>
          <div className="mb-4 flex items-center gap-1">
            <Botao variante="secundario" aria-label="Período anterior" onClick={() => setData(mover(escala, data, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Botao>
            <span className="min-w-36 text-center text-sm font-semibold text-acqua-titulo">{descreverPeriodo(escala, data)}</span>
            <Botao variante="secundario" aria-label="Próximo período" onClick={() => setData(mover(escala, data, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Botao>
            {data !== hoje && <Botao variante="fantasma" onClick={() => setData(hoje)}>Hoje</Botao>}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <Atalhos />
        {cards.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <c.Componente key={c.id} filtro={filtro} />
            ))}
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <Rotina data={data} />
        </div>
      </div>
    </Pagina>
  )
}
