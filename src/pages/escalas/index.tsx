import { useSearchParams } from 'react-router-dom'
import { usePermissoes } from '../../lib/permissoes'
import { Abas, Pagina } from '../../components/ui'
import GradeEscala from './GradeEscala'
import Ponto from './Ponto'
import FolhaPonto from './FolhaPonto'

type Aba = 'escala' | 'ponto' | 'folha'

export default function EscalasPonto() {
  const { pode } = usePermissoes()
  const [params, setParams] = useSearchParams()
  const abas: { valor: Aba; rotulo: string }[] = [
    { valor: 'escala', rotulo: 'Escala' },
    ...(pode('ponto') ? [{ valor: 'ponto' as const, rotulo: 'Ponto do dia' }, { valor: 'folha' as const, rotulo: 'Folha-ponto' }] : []),
  ]
  const pedida = params.get('aba') as Aba | null
  const aba: Aba = abas.some((a) => a.valor === pedida) ? pedida! : 'escala'

  return (
    <Pagina titulo="Escalas e ponto" descricao="Quem trabalha quando, marcações de ponto e folha-ponto do mês.">
      <div className="print:hidden">
        <Abas abas={abas} ativa={aba} aoMudar={(v) => setParams(v === 'escala' ? {} : { aba: v }, { replace: true })} />
      </div>
      {aba === 'escala' && <GradeEscala />}
      {aba === 'ponto' && <Ponto />}
      {aba === 'folha' && <FolhaPonto />}
    </Pagina>
  )
}
