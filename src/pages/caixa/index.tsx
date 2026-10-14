import { useSearchParams } from 'react-router-dom'
import { Abas, Pagina } from '../../components/ui'
import DiaCaixa from './Dia'
import MesCaixa from './Mes'
import Recebimentos from './Recebimentos'
import Fundo from './Fundo'
import RegrasCaixa from './Regras'

type Aba = 'dia' | 'mes' | 'recebimentos' | 'fundo' | 'regras'
const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'dia', rotulo: 'Caixa do dia' },
  { valor: 'mes', rotulo: 'Planilha do mês' },
  { valor: 'recebimentos', rotulo: 'A receber' },
  { valor: 'fundo', rotulo: 'Fundo de despesas' },
  { valor: 'regras', rotulo: 'Regras' },
]

export default function Caixa() {
  const [params, setParams] = useSearchParams()
  const pedida = params.get('aba') as Aba | null
  const aba: Aba = ABAS.some((a) => a.valor === pedida) ? pedida! : 'dia'
  return (
    <Pagina titulo="Caixa" descricao="Vendas por forma de pagamento, entradas e saídas com responsável, conferência e recebimentos previstos.">
      <div className="print:hidden">
        <Abas abas={ABAS} ativa={aba} aoMudar={(v) => setParams(v === 'dia' ? {} : { aba: v }, { replace: true })} />
      </div>
      {aba === 'dia' && <DiaCaixa />}
      {aba === 'mes' && <MesCaixa />}
      {aba === 'recebimentos' && <Recebimentos />}
      {aba === 'fundo' && <Fundo />}
      {aba === 'regras' && <RegrasCaixa />}
    </Pagina>
  )
}
