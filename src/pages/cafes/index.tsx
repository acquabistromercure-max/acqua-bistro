import { useSearchParams } from 'react-router-dom'
import { Abas, Pagina } from '../../components/ui'
import Dia from './Dia'
import Quinzena from './Quinzena'
import Mensalistas from './Mensalistas'
import Regras from './Regras'

type Aba = 'dia' | 'quinzena' | 'mensalistas' | 'regras'

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'dia', rotulo: 'Dia' },
  { valor: 'quinzena', rotulo: 'Quinzena com o hotel' },
  { valor: 'mensalistas', rotulo: 'Mensalistas' },
  { valor: 'regras', rotulo: 'Regras' },
]

export default function Cafes() {
  const [params, setParams] = useSearchParams()
  const pedida = params.get('aba') as Aba | null
  const aba: Aba = ABAS.some((a) => a.valor === pedida) ? pedida! : 'dia'

  return (
    <Pagina titulo="Café da manhã" descricao="Café do hotel, por fora da lista, borderô, cafés pagos na hora e fechamento da quinzena.">
      <div className="print:hidden">
        <Abas abas={ABAS} ativa={aba} aoMudar={(v) => setParams(v === 'dia' ? {} : { aba: v }, { replace: true })} />
      </div>
      {aba === 'dia' && <Dia />}
      {aba === 'quinzena' && <Quinzena />}
      {aba === 'mensalistas' && <Mensalistas />}
      {aba === 'regras' && <Regras />}
    </Pagina>
  )
}
